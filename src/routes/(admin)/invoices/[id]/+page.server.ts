import { error, fail } from '@sveltejs/kit';
import { env as publicEnv } from '$env/dynamic/public';
import type { Actions, PageServerLoad } from './$types';
import type { Invoice } from '$lib/types/db';
import {
  invoicePaymentRecordSchema,
  invoiceSendSchema,
  invoiceStatusSchema,
  invoiceUpdateSchema,
  parseForm,
  parseInvoiceLineItems
} from '$lib/schemas';
import {
  balanceDue,
  createPaymentIntent,
  defaultDueDate,
  loadInvoiceBundle,
  replaceInvoiceLines,
  statusAfterPayment
} from '$lib/server/invoices';
import { sendInvoiceEmail } from '$lib/server/invoice-email';

export const load: PageServerLoad = async ({ params, locals: { supabase } }) => {
  const bundle = await loadInvoiceBundle(supabase, params.id);
  if (!bundle) throw error(404, 'Invoice not found');
  return bundle;
};

async function loadInvoice(supabase: App.Locals['supabase'], id: string) {
  const { data, error: invoiceError } = await supabase
    .from('invoices')
    .select('*, customer:customers(id, business_name, email)')
    .eq('id', id)
    .maybeSingle();
  if (invoiceError || !data) throw new Error(invoiceError?.message ?? 'Invoice not found.');
  return data as Invoice & {
    customer: { id: string; business_name: string; email: string | null } | null;
  };
}

export const actions: Actions = {
  saveDraft: async ({ params, request, locals: { supabase } }) => {
    const invoice = await loadInvoice(supabase, params.id).catch((err) => err);
    if (invoice instanceof Error) return fail(404, { message: invoice.message, fieldErrors: {} });
    if (invoice.status !== 'draft') {
      return fail(400, { message: 'Only draft invoices can be edited.', fieldErrors: {} });
    }

    const form = await request.formData();
    const parsed = parseForm(invoiceUpdateSchema, form);
    if (!parsed.success) {
      return fail(400, { message: parsed.message, fieldErrors: parsed.fieldErrors });
    }

    let lines;
    try {
      lines = parseInvoiceLineItems(parsed.data.line_items_json);
    } catch (err) {
      return fail(400, {
        message: err instanceof Error ? err.message : 'Invalid invoice lines.',
        fieldErrors: {}
      });
    }

    try {
      await replaceInvoiceLines(supabase, params.id, lines, {
        shipping: parsed.data.shipping,
        discount: parsed.data.discount
      });
      const { error: updateError } = await supabase
        .from('invoices')
        .update({
          terms: parsed.data.terms,
          due_at: parsed.data.due_at ? new Date(parsed.data.due_at).toISOString() : null,
          billing_email: parsed.data.billing_email,
          customer_memo: parsed.data.customer_memo,
          internal_notes: parsed.data.internal_notes
        })
        .eq('id', params.id);
      if (updateError) throw new Error(updateError.message);
    } catch (err) {
      return fail(400, {
        message: err instanceof Error ? err.message : 'Invoice update failed.',
        fieldErrors: {}
      });
    }

    return { saved: true, message: 'Invoice saved.' };
  },

  issue: async ({ params, locals: { supabase } }) => {
    const invoice = await loadInvoice(supabase, params.id).catch((err) => err);
    if (invoice instanceof Error) return fail(404, { message: invoice.message, fieldErrors: {} });
    if (invoice.status !== 'draft') {
      return fail(400, { message: 'Only draft invoices can be issued.', fieldErrors: {} });
    }

    const now = new Date();
    const dueAt = invoice.due_at ?? defaultDueDate(invoice.terms, now).toISOString();
    const { error: updateError } = await supabase
      .from('invoices')
      .update({ status: 'issued', issued_at: now.toISOString(), due_at: dueAt })
      .eq('id', params.id);
    if (updateError) return fail(400, { message: updateError.message, fieldErrors: {} });
    return { saved: true, message: 'Invoice issued.' };
  },

  setStatus: async ({ params, request, locals: { supabase } }) => {
    const form = await request.formData();
    const parsed = parseForm(invoiceStatusSchema, form);
    if (!parsed.success)
      return fail(400, { message: parsed.message, fieldErrors: parsed.fieldErrors });

    const status = parsed.data.status;
    const patch: Record<string, unknown> = { status };
    if (status === 'paid') {
      const invoice = await loadInvoice(supabase, params.id).catch((err) => err);
      if (invoice instanceof Error) return fail(404, { message: invoice.message, fieldErrors: {} });
      patch['amount_paid'] = invoice.total;
      patch['paid_at'] = new Date().toISOString();
      patch['payment_status'] = 'paid';
    }
    if (status === 'issued') patch['issued_at'] = new Date().toISOString();

    const { error: updateError } = await supabase
      .from('invoices')
      .update(patch)
      .eq('id', params.id);
    if (updateError) return fail(400, { message: updateError.message, fieldErrors: {} });
    return { saved: true, message: 'Status updated.' };
  },

  recordPayment: async ({ params, request, locals: { supabase } }) => {
    const form = await request.formData();
    const parsed = parseForm(invoicePaymentRecordSchema, form);
    if (!parsed.success)
      return fail(400, { message: parsed.message, fieldErrors: parsed.fieldErrors });

    const invoice = await loadInvoice(supabase, params.id).catch((err) => err);
    if (invoice instanceof Error) return fail(404, { message: invoice.message, fieldErrors: {} });
    const balance = balanceDue(invoice);
    if (parsed.data.amount > balance) {
      return fail(400, { message: 'Payment exceeds invoice balance.', fieldErrors: {} });
    }

    const amountPaid = Number(invoice.amount_paid) + parsed.data.amount;
    const status = statusAfterPayment(invoice, amountPaid);
    const now = new Date().toISOString();

    const { error: updateError } = await supabase
      .from('invoices')
      .update({
        amount_paid: amountPaid,
        status,
        paid_at: status === 'paid' ? now : null,
        payment_status: status === 'paid' ? 'paid' : 'processing'
      })
      .eq('id', params.id);
    if (updateError) return fail(400, { message: updateError.message, fieldErrors: {} });

    await supabase.from('invoice_payment_intents').insert({
      invoice_id: invoice.id,
      customer_id: invoice.customer_id,
      amount: parsed.data.amount,
      currency: 'usd',
      status: 'succeeded',
      provider: 'manual_record',
      provider_reference: `manual_record_${crypto.randomUUID()}`,
      completed_at: now
    });

    await supabase.from('cash_entries').insert({
      occurred_on: now.slice(0, 10),
      direction: 'in',
      amount: parsed.data.amount,
      source: 'invoice_payment',
      ref_table: 'invoices',
      ref_id: invoice.id,
      notes: `Invoice ${invoice.invoice_number ?? invoice.id.slice(0, 8)} payment`
    });

    return { saved: true, message: 'Payment recorded.' };
  },

  createPaymentIntent: async ({ params, locals: { supabase }, url }) => {
    const invoice = await loadInvoice(supabase, params.id).catch((err) => err);
    if (invoice instanceof Error) return fail(404, { message: invoice.message, fieldErrors: {} });

    try {
      const appUrl = publicEnv['PUBLIC_APP_URL'] || url.origin;
      await createPaymentIntent(supabase, invoice, appUrl, { created_by_role: 'admin' });
    } catch (err) {
      return fail(400, {
        message: err instanceof Error ? err.message : 'Payment intent failed.',
        fieldErrors: {}
      });
    }

    return { saved: true, message: 'Payment link prepared.' };
  },

  sendEmail: async ({ params, request, locals: { supabase }, url }) => {
    const invoice = await loadInvoice(supabase, params.id).catch((err) => err);
    if (invoice instanceof Error) return fail(404, { message: invoice.message, fieldErrors: {} });

    const form = await request.formData();
    const parsed = parseForm(invoiceSendSchema, form);
    if (!parsed.success)
      return fail(400, { message: parsed.message, fieldErrors: parsed.fieldErrors });

    if (invoice.status === 'draft') {
      const now = new Date();
      const dueAt = invoice.due_at ?? defaultDueDate(invoice.terms, now).toISOString();
      const { error: issueError } = await supabase
        .from('invoices')
        .update({ status: 'issued', issued_at: now.toISOString(), due_at: dueAt })
        .eq('id', invoice.id);
      if (issueError) return fail(400, { message: issueError.message, fieldErrors: {} });
      invoice.status = 'issued';
      invoice.issued_at = now.toISOString();
      invoice.due_at = dueAt;
    }

    const recipient =
      parsed.data.recipient ?? invoice.billing_email ?? invoice.customer?.email ?? null;
    if (!recipient)
      return fail(400, { message: 'Add a billing email before sending.', fieldErrors: {} });

    const appUrl = publicEnv['PUBLIC_APP_URL'] || url.origin;
    const result = await sendInvoiceEmail(supabase, {
      invoice,
      recipient,
      kind: parsed.data.reminder ? 'reminder' : 'send',
      portalUrl: `${appUrl.replace(/\/$/, '')}/portal/invoices/${invoice.id}`
    });

    if (!result.ok) return fail(400, { message: result.message, fieldErrors: {} });
    return { saved: true, message: result.message };
  }
};

import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { invoiceCreateSchema, parseForm, parseInvoiceLineItems } from '$lib/schemas';
import { createInvoiceWithLines, defaultDueDate } from '$lib/server/invoices';

export const load: PageServerLoad = async ({ locals: { supabase }, url }) => {
  const { data } = await supabase
    .from('customers')
    .select('id, business_name, email')
    .neq('status', 'archived')
    .order('business_name')
    .limit(500);

  return {
    customers: data ?? [],
    defaultCustomerId: url.searchParams.get('customer') ?? ''
  };
};

export const actions: Actions = {
  create: async ({ request, locals: { supabase } }) => {
    const form = await request.formData();
    const parsed = parseForm(invoiceCreateSchema, form);
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

    const now = new Date();
    const issuedAt = parsed.data.issue_now ? now.toISOString() : null;
    const dueAt = parsed.data.due_at
      ? new Date(parsed.data.due_at).toISOString()
      : defaultDueDate(parsed.data.terms, now).toISOString();

    let invoice;
    try {
      invoice = await createInvoiceWithLines(
        supabase,
        {
          customer_id: parsed.data.customer_id,
          status: parsed.data.issue_now ? 'issued' : 'draft',
          terms: parsed.data.terms,
          issued_at: issuedAt,
          due_at: dueAt,
          billing_email: parsed.data.billing_email,
          customer_memo: parsed.data.customer_memo,
          internal_notes: parsed.data.internal_notes
        },
        lines,
        { shipping: parsed.data.shipping, discount: parsed.data.discount }
      );
    } catch (err) {
      return fail(400, {
        message: err instanceof Error ? err.message : 'Invoice create failed.',
        fieldErrors: {}
      });
    }

    throw redirect(303, `/invoices/${invoice.id}`);
  }
};

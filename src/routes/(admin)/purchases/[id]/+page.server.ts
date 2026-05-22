import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
  parseForm,
  purchaseMarkPaidSchema,
  purchaseUpdateSchema
} from '$lib/schemas';

export const load: PageServerLoad = async ({ params, locals: { supabase } }) => {
  const [purchaseRes, suppliersRes] = await Promise.all([
    supabase
      .from('purchases')
      .select(
        '*, supplier:suppliers(id, name, key, distribution_fee_pct), order:orders(id, total, placed_at, customer:customers(id, business_name))'
      )
      .eq('id', params.id)
      .maybeSingle(),
    supabase.from('suppliers').select('id, name, key, distribution_fee_pct').order('name')
  ]);

  if (purchaseRes.error || !purchaseRes.data) throw error(404, 'Purchase not found');

  return {
    purchase: purchaseRes.data as Record<string, unknown> & {
      id: string;
      supplier: { id: string; name: string; key: string; distribution_fee_pct: number } | null;
      order: {
        id: string;
        total: number;
        placed_at: string;
        customer: { id: string; business_name: string } | null;
      } | null;
    },
    suppliers: (suppliersRes.data ?? []) as Array<{
      id: string;
      name: string;
      key: string;
      distribution_fee_pct: number;
    }>
  };
};

export const actions: Actions = {
  update: async ({ params, request, locals: { supabase } }) => {
    const form = await request.formData();
    const parsed = parseForm(purchaseUpdateSchema, form);
    if (!parsed.success) {
      return fail(400, { message: parsed.message, fieldErrors: parsed.fieldErrors });
    }

    const d = parsed.data;
    const update: Record<string, unknown> = {};
    if (d.supplier_id !== undefined) update.supplier_id = d.supplier_id;
    if (d.order_id !== undefined) update.order_id = d.order_id ?? null;
    if (d.ordered_at !== undefined) update.ordered_at = d.ordered_at ?? null;
    if (d.received_at !== undefined) update.received_at = d.received_at ?? null;
    if (d.subtotal !== undefined) update.subtotal = d.subtotal;
    if (d.freight !== undefined) update.freight = d.freight;
    if (d.distribution_fee_pct !== undefined) update.distribution_fee_pct = d.distribution_fee_pct;
    if (d.tax !== undefined) update.tax = d.tax;
    if (d.status !== undefined) update.status = d.status;
    if (d.payment_status !== undefined) update.payment_status = d.payment_status;
    if (d.due_date !== undefined) update.due_date = d.due_date ?? null;
    if (d.invoice_ref !== undefined) update.invoice_ref = d.invoice_ref ?? null;
    if (d.notes !== undefined) update.notes = d.notes ?? null;

    const { error: updateErr } = await supabase
      .from('purchases')
      .update(update)
      .eq('id', params.id);

    if (updateErr) return fail(400, { message: updateErr.message, fieldErrors: {} });
    return { saved: true };
  },

  markReceived: async ({ params, locals: { supabase } }) => {
    const { error: err } = await supabase
      .from('purchases')
      .update({ status: 'received', received_at: new Date().toISOString() })
      .eq('id', params.id);
    if (err) return fail(400, { message: err.message, fieldErrors: {} });
    return { saved: true };
  },

  markPaid: async ({ params, request, locals: { supabase } }) => {
    const form = await request.formData();
    const parsed = parseForm(purchaseMarkPaidSchema, form);
    if (!parsed.success) return fail(400, { message: parsed.message, fieldErrors: parsed.fieldErrors });

    const paidOn = parsed.data.paid_on
      ? new Date(parsed.data.paid_on).toISOString()
      : new Date().toISOString();

    const { data: purchase, error: fetchErr } = await supabase
      .from('purchases')
      .select('total, supplier:suppliers(name)')
      .eq('id', params.id)
      .maybeSingle();
    if (fetchErr || !purchase) return fail(404, { message: 'Purchase not found.', fieldErrors: {} });

    const { error: updateErr } = await supabase
      .from('purchases')
      .update({ payment_status: 'paid', paid_at: paidOn })
      .eq('id', params.id);
    if (updateErr) return fail(400, { message: updateErr.message, fieldErrors: {} });

    const supplierName = (purchase.supplier as unknown as { name?: string } | null)?.name ?? 'supplier';
    await supabase.from('cash_entries').insert({
      occurred_on: paidOn.slice(0, 10),
      direction: 'out',
      amount: Number(purchase.total),
      source: 'purchase_payment',
      ref_table: 'purchases',
      ref_id: params.id,
      notes: `Paid ${supplierName}`
    });

    return { saved: true };
  },

  delete: async ({ params, locals: { supabase } }) => {
    const { error: err } = await supabase.from('purchases').delete().eq('id', params.id);
    if (err) return fail(400, { message: err.message, fieldErrors: {} });
    throw redirect(303, '/purchases');
  }
};

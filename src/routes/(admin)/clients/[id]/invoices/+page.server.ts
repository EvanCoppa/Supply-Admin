import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import type { Invoice, InvoiceStatus, InvoiceTerms, Order } from '$lib/types/db';

const STATUSES: InvoiceStatus[] = [
  'draft',
  'issued',
  'paid',
  'partially_paid',
  'overdue',
  'void',
  'refunded'
];
const TERMS: InvoiceTerms[] = ['due_on_receipt', 'net_15', 'net_30', 'net_60', 'prepaid'];

export const load: PageServerLoad = async ({ params, locals: { supabase } }) => {
  const [invRes, ordersRes] = await Promise.all([
    supabase
      .from('invoices')
      .select('*')
      .eq('customer_id', params.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('orders')
      .select('id, total, placed_at, status')
      .eq('customer_id', params.id)
      .order('placed_at', { ascending: false })
      .limit(50)
  ]);

  return {
    invoices: (invRes.data ?? []) as Invoice[],
    orders: (ordersRes.data ?? []) as Pick<Order, 'id' | 'total' | 'placed_at' | 'status'>[]
  };
};

export const actions: Actions = {
  createFromOrder: async ({ params, request, locals: { supabase } }) => {
    const form = await request.formData();
    const orderId = String(form.get('order_id') ?? '');
    const terms = String(form.get('terms') ?? 'net_30');
    const dueDays = Number(form.get('due_days') ?? 30);
    if (!orderId) return fail(400, { message: 'Pick an order.' });
    if (!TERMS.includes(terms as InvoiceTerms)) return fail(400, { message: 'Invalid terms.' });

    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .select('subtotal, tax, shipping, total, shipping_address_snapshot')
      .eq('id', orderId)
      .eq('customer_id', params.id)
      .maybeSingle();
    if (orderErr || !order) return fail(400, { message: 'Order not found.' });

    const now = new Date();
    const due = new Date(now.getTime() + dueDays * 24 * 60 * 60 * 1000);

    const { error } = await supabase.from('invoices').insert({
      customer_id: params.id,
      order_id: orderId,
      status: 'issued',
      subtotal: order.subtotal,
      tax: order.tax,
      shipping: order.shipping,
      total: order.total,
      amount_paid: 0,
      terms,
      issued_at: now.toISOString(),
      due_at: due.toISOString(),
      billing_address_snapshot: order.shipping_address_snapshot
    });
    if (error) return fail(400, { message: error.message });
    return { saved: true };
  },

  setStatus: async ({ params, request, locals: { supabase } }) => {
    const form = await request.formData();
    const id = String(form.get('id') ?? '');
    const status = String(form.get('status') ?? '');
    if (!STATUSES.includes(status as InvoiceStatus)) {
      return fail(400, { message: 'Invalid status.' });
    }
    const patch: Record<string, unknown> = { status };
    if (status === 'paid') patch.paid_at = new Date().toISOString();
    if (status === 'issued') patch.issued_at = new Date().toISOString();

    const { error } = await supabase
      .from('invoices')
      .update(patch)
      .eq('id', id)
      .eq('customer_id', params.id);
    if (error) return fail(400, { message: error.message });
    return { saved: true };
  },

  recordPayment: async ({ params, request, locals: { supabase } }) => {
    const form = await request.formData();
    const id = String(form.get('id') ?? '');
    const amount = Number(form.get('amount') ?? 0);
    if (!id || !Number.isFinite(amount) || amount <= 0) {
      return fail(400, { message: 'Payment amount must be positive.' });
    }

    const { data: inv, error: invErr } = await supabase
      .from('invoices')
      .select('total, amount_paid')
      .eq('id', id)
      .eq('customer_id', params.id)
      .maybeSingle();
    if (invErr || !inv) return fail(400, { message: 'Invoice not found.' });

    const newPaid = Number(inv.amount_paid) + amount;
    const nextStatus: InvoiceStatus =
      newPaid >= Number(inv.total) ? 'paid' : 'partially_paid';

    const { error } = await supabase
      .from('invoices')
      .update({
        amount_paid: newPaid,
        status: nextStatus,
        paid_at: nextStatus === 'paid' ? new Date().toISOString() : null
      })
      .eq('id', id)
      .eq('customer_id', params.id);
    if (error) return fail(400, { message: error.message });
    return { saved: true };
  }
};

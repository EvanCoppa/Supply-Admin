import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import type { Invoice, InvoiceStatus } from '$lib/types/db';
import { createInvoiceWithLines } from '$lib/server/invoices';
import { invoiceFromOrderSchema, parseForm } from '$lib/schemas';

const STATUSES: InvoiceStatus[] = [
  'draft',
  'issued',
  'paid',
  'partially_paid',
  'overdue',
  'void',
  'refunded'
];

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
    orders: ordersRes.data ?? []
  };
};

export const actions: Actions = {
  createFromOrder: async ({ params, request, locals: { supabase } }) => {
    const form = await request.formData();
    const parsed = parseForm(invoiceFromOrderSchema, form);
    if (!parsed.success)
      return fail(400, { message: parsed.message, fieldErrors: parsed.fieldErrors });

    const [orderRes, lineItemsRes, customerRes] = await Promise.all([
      supabase
        .from('orders')
        .select('subtotal, tax, shipping, total, shipping_address_snapshot')
        .eq('id', parsed.data.order_id)
        .eq('customer_id', params.id)
        .maybeSingle(),
      supabase
        .from('order_line_items')
        .select(
          'id, product_id, product_sku_snapshot, product_name_snapshot, quantity, unit_price_snapshot'
        )
        .eq('order_id', parsed.data.order_id)
        .order('product_sku_snapshot'),
      supabase.from('customers').select('email').eq('id', params.id).maybeSingle()
    ]);

    const order = orderRes.data;
    const orderErr = orderRes.error;
    if (orderErr || !order) return fail(400, { message: 'Order not found.' });

    const now = new Date();
    const due = new Date(now.getTime() + parsed.data.due_days * 24 * 60 * 60 * 1000);
    const lineItems = lineItemsRes.data ?? [];
    const lines =
      lineItems.length > 0
        ? lineItems.map((line, index) => ({
            order_line_item_id: line.id,
            product_id: line.product_id,
            product_sku_snapshot: line.product_sku_snapshot,
            product_name_snapshot: line.product_name_snapshot,
            description: line.product_name_snapshot,
            quantity: Number(line.quantity),
            unit_price: Number(line.unit_price_snapshot),
            discount: 0,
            tax: index === 0 ? Number(order.tax ?? 0) : 0
          }))
        : [
            {
              description: `Order ${parsed.data.order_id}`,
              quantity: 1,
              unit_price: Number(order.subtotal ?? order.total ?? 0),
              discount: 0,
              tax: Number(order.tax ?? 0)
            }
          ];

    let invoice;
    try {
      invoice = await createInvoiceWithLines(
        supabase,
        {
          customer_id: params.id,
          order_id: parsed.data.order_id,
          status: parsed.data.issue_now ? 'issued' : 'draft',
          terms: parsed.data.terms,
          issued_at: parsed.data.issue_now ? now.toISOString() : null,
          due_at: due.toISOString(),
          billing_email: parsed.data.billing_email ?? customerRes.data?.email ?? null,
          billing_address_snapshot: order.shipping_address_snapshot,
          customer_memo: parsed.data.customer_memo,
          internal_notes: parsed.data.internal_notes
        },
        lines,
        { shipping: Number(order.shipping ?? 0), discount: 0 }
      );
    } catch (err) {
      return fail(400, { message: err instanceof Error ? err.message : 'Invoice create failed.' });
    }

    throw redirect(303, `/invoices/${invoice.id}`);
  },

  setStatus: async ({ params, request, locals: { supabase } }) => {
    const form = await request.formData();
    const id = String(form.get('id') ?? '');
    const status = String(form.get('status') ?? '');
    if (!STATUSES.includes(status as InvoiceStatus)) {
      return fail(400, { message: 'Invalid status.' });
    }
    const patch: Record<string, unknown> = { status };
    if (status === 'paid') patch['paid_at'] = new Date().toISOString();
    if (status === 'issued') patch['issued_at'] = new Date().toISOString();

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
    const nextStatus: InvoiceStatus = newPaid >= Number(inv.total) ? 'paid' : 'partially_paid';

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

import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

type OrderRow = {
  id: string;
  customer_id: string;
  placed_at: string | null;
  total: number;
  status: string;
};

export const load: PageServerLoad = async ({ url, locals: { supabase } }) => {
  const defaultCustomerId = url.searchParams.get('customer') ?? '';
  const defaultOrderId = url.searchParams.get('order') ?? '';

  const [customersRes, ordersRes] = await Promise.all([
    supabase.from('customers').select('id, business_name').order('business_name'),
    supabase
      .from('orders')
      .select('id, customer_id, placed_at, total, status')
      .order('placed_at', { ascending: false })
      .limit(500)
  ]);

  const ordersByCustomer = new Map<string, OrderRow[]>();
  for (const row of (ordersRes.data ?? []) as OrderRow[]) {
    const list = ordersByCustomer.get(row.customer_id) ?? [];
    list.push(row);
    ordersByCustomer.set(row.customer_id, list);
  }

  return {
    customers: customersRes.data ?? [],
    ordersByCustomer: Object.fromEntries(ordersByCustomer),
    defaultCustomerId,
    defaultOrderId
  };
};

export const actions: Actions = {
  create: async ({ request, locals: { supabase, user } }) => {
    const form = await request.formData();
    const customer_id = String(form.get('customer_id') ?? '');
    const order_id = String(form.get('order_id') ?? '');
    if (!customer_id) return fail(400, { message: 'Pick a customer.' });
    if (!order_id) return fail(400, { message: 'Pick an order.' });

    const refund = Number(form.get('refund_amount') ?? 0);
    const fee = Number(form.get('restocking_fee') ?? 0);
    if (!Number.isFinite(refund) || refund < 0) {
      return fail(400, { message: 'Refund amount must be non-negative.' });
    }
    if (!Number.isFinite(fee) || fee < 0) {
      return fail(400, { message: 'Restocking fee must be non-negative.' });
    }

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, customer_id')
      .eq('id', order_id)
      .maybeSingle();
    if (orderError || order?.customer_id !== customer_id) {
      return fail(400, { message: 'Selected order does not belong to that customer.' });
    }

    const { data: created, error } = await supabase
      .from('rmas')
      .insert({
        customer_id,
        order_id,
        reason: String(form.get('reason') ?? '').trim() || null,
        refund_amount: refund,
        restocking_fee: fee,
        notes: String(form.get('notes') ?? '').trim() || null,
        created_by: user?.id ?? null
      })
      .select('id')
      .single();

    if (error || !created) return fail(400, { message: error?.message ?? 'Failed to create RMA.' });
    throw redirect(303, `/rmas/${created.id}`);
  }
};

import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import type { Order, Rma, RmaStatus } from '$lib/types/db';

const STATUSES: RmaStatus[] = [
  'requested',
  'approved',
  'received',
  'refunded',
  'rejected',
  'cancelled'
];

export const load: PageServerLoad = async ({ params, locals: { supabase } }) => {
  const [rmaRes, ordersRes] = await Promise.all([
    supabase
      .from('rmas')
      .select(
        'id, customer_id, order_id, rma_number, status, reason, refund_amount, restocking_fee, notes, created_at, updated_at,' +
          ' items:rma_items(id, product_id, quantity, unit_refund, reason, restock)'
      )
      .eq('customer_id', params.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('orders')
      .select('id, placed_at, total, status')
      .eq('customer_id', params.id)
      .order('placed_at', { ascending: false })
      .limit(50)
  ]);

  return {
    rmas: (rmaRes.data ?? []) as unknown as Array<
      Rma & { items: Array<{ id: string; quantity: number; unit_refund: number; product_id: string; reason: string | null; restock: boolean }> }
    >,
    orders: (ordersRes.data ?? []) as Pick<Order, 'id' | 'placed_at' | 'total' | 'status'>[]
  };
};

export const actions: Actions = {
  create: async ({ params, request, locals: { supabase, user } }) => {
    const form = await request.formData();
    const order_id = String(form.get('order_id') ?? '');
    if (!order_id) return fail(400, { message: 'Pick an order.' });
    const refund = Number(form.get('refund_amount') ?? 0);
    const fee = Number(form.get('restocking_fee') ?? 0);
    if (!Number.isFinite(refund) || refund < 0) {
      return fail(400, { message: 'Refund amount must be non-negative.' });
    }
    if (!Number.isFinite(fee) || fee < 0) {
      return fail(400, { message: 'Restocking fee must be non-negative.' });
    }

    const { error } = await supabase.from('rmas').insert({
      customer_id: params.id,
      order_id,
      reason: String(form.get('reason') ?? '').trim() || null,
      refund_amount: refund,
      restocking_fee: fee,
      notes: String(form.get('notes') ?? '').trim() || null,
      created_by: user?.id ?? null
    });
    if (error) return fail(400, { message: error.message });
    return { saved: true };
  },

  setStatus: async ({ params, request, locals: { supabase } }) => {
    const form = await request.formData();
    const id = String(form.get('id') ?? '');
    const status = String(form.get('status') ?? '');
    if (!STATUSES.includes(status as RmaStatus)) {
      return fail(400, { message: 'Invalid status.' });
    }
    const { error } = await supabase
      .from('rmas')
      .update({ status })
      .eq('id', id)
      .eq('customer_id', params.id);
    if (error) return fail(400, { message: error.message });
    return { saved: true };
  }
};

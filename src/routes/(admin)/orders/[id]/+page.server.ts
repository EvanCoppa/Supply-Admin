import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { callApi } from '$lib/api';

export const load: PageServerLoad = async ({ params, locals: { supabase } }) => {
  const [orderRes, lineItemsRes, paymentsRes] = await Promise.all([
    supabase
      .from('orders')
      .select('*, customer:customers(id, business_name, email)')
      .eq('id', params.id)
      .maybeSingle(),
    supabase
      .from('order_line_items')
      .select('*')
      .eq('order_id', params.id)
      .order('product_sku_snapshot'),
    supabase
      .from('payment_attempts')
      .select('*')
      .eq('order_id', params.id)
      .order('created_at', { ascending: false })
  ]);

  if (orderRes.error || !orderRes.data) throw error(404, 'Order not found');

  return {
    order: orderRes.data,
    lineItems: lineItemsRes.data ?? [],
    payments: paymentsRes.data ?? []
  };
};

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  pending_payment: [],
  paid: ['fulfilled'],
  fulfilled: ['shipped'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: [],
  refunded: []
};

export const actions: Actions = {
  transition: async ({ params, request, locals: { supabase } }) => {
    const form = await request.formData();
    const to = String(form.get('to') ?? '');
    const tracking = String(form.get('tracking') ?? '').trim();

    const { data: order } = await supabase
      .from('orders')
      .select('status')
      .eq('id', params.id)
      .maybeSingle();
    if (!order) return fail(404, { message: 'Order not found.', code: undefined });

    const allowed = ALLOWED_TRANSITIONS[order.status] ?? [];
    if (!allowed.includes(to)) {
      return fail(400, { message: `Cannot transition ${order.status} → ${to}.`, code: undefined });
    }

    const patch: Record<string, unknown> = { status: to };
    if (to === 'shipped' && tracking) {
      // No tracking column on orders in v1; store in payment_reference adjacent field if needed.
      // For now we no-op on tracking persistence — API endpoint should own shipment details.
    }

    const { error } = await supabase.from('orders').update(patch).eq('id', params.id);
    if (error) return fail(400, { message: error.message, code: undefined });
    return { saved: true, message: undefined, code: undefined };
  },

  cancel: async ({ params, locals }) => {
    if (!locals.session) return fail(401, { message: 'Not signed in.', code: undefined });
    const res = await callApi({
      path: `/api/v1/admin/orders/${params.id}/refund`,
      method: 'POST',
      body: { cancel: true },
      accessToken: locals.session.access_token
    });
    if (!res.ok)
      return fail(res.status || 500, {
        message: res.error?.message ?? 'Cancel failed.',
        code: res.error?.code
      });
    return { saved: true, message: undefined, code: undefined };
  },

  refund: async ({ params, request, locals }) => {
    const form = await request.formData();
    const amount = form.get('amount');
    const parsed = amount !== null && amount !== '' ? Number(amount) : null;
    if (parsed !== null && (!Number.isFinite(parsed) || parsed <= 0)) {
      return fail(400, { message: 'Refund amount must be positive.', code: undefined });
    }
    if (!locals.session) return fail(401, { message: 'Not signed in.', code: undefined });

    const res = await callApi({
      path: `/api/v1/admin/orders/${params.id}/refund`,
      method: 'POST',
      body: parsed !== null ? { amount: parsed } : {},
      accessToken: locals.session.access_token
    });
    if (!res.ok)
      return fail(res.status || 500, {
        message: res.error?.message ?? 'Refund failed.',
        code: res.error?.code
      });
    return { saved: true, message: undefined, code: undefined };
  }
};

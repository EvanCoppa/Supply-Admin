import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { callApi } from '$lib/api';
import { orderRefundSchema, orderTransitionSchema, parseForm } from '$lib/schemas';

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
    const parsed = parseForm(orderTransitionSchema, form);
    if (!parsed.success) {
      return fail(400, {
        message: parsed.message,
        fieldErrors: parsed.fieldErrors,
        code: undefined
      });
    }
    const { to } = parsed.data;

    const { data: order } = await supabase
      .from('orders')
      .select('status')
      .eq('id', params.id)
      .maybeSingle();
    if (!order)
      return fail(404, { message: 'Order not found.', fieldErrors: {}, code: undefined });

    const allowed = ALLOWED_TRANSITIONS[order.status] ?? [];
    if (!allowed.includes(to)) {
      return fail(400, {
        message: `Cannot transition ${order.status} → ${to}.`,
        fieldErrors: {},
        code: undefined
      });
    }

    const { error } = await supabase.from('orders').update({ status: to }).eq('id', params.id);
    if (error)
      return fail(400, { message: error.message, fieldErrors: {}, code: undefined });
    return { saved: true, message: undefined, code: undefined };
  },

  cancel: async ({ params, locals }) => {
    if (!locals.session)
      return fail(401, { message: 'Not signed in.', fieldErrors: {}, code: undefined });
    const res = await callApi({
      path: `/api/v1/admin/orders/${params.id}/refund`,
      method: 'POST',
      body: { cancel: true },
      accessToken: locals.session.access_token
    });
    if (!res.ok)
      return fail(res.status || 500, {
        message: res.error?.message ?? 'Cancel failed.',
        fieldErrors: {},
        code: res.error?.code
      });
    return { saved: true, message: undefined, code: undefined };
  },

  refund: async ({ params, request, locals }) => {
    const form = await request.formData();
    const parsed = parseForm(orderRefundSchema, form);
    if (!parsed.success) {
      return fail(400, {
        message: parsed.message,
        fieldErrors: parsed.fieldErrors,
        code: undefined
      });
    }
    if (!locals.session)
      return fail(401, { message: 'Not signed in.', fieldErrors: {}, code: undefined });

    const { amount } = parsed.data;
    const res = await callApi({
      path: `/api/v1/admin/orders/${params.id}/refund`,
      method: 'POST',
      body: amount !== null ? { amount } : {},
      accessToken: locals.session.access_token
    });
    if (!res.ok)
      return fail(res.status || 500, {
        message: res.error?.message ?? 'Refund failed.',
        fieldErrors: {},
        code: res.error?.code
      });
    return { saved: true, message: undefined, code: undefined };
  }
};

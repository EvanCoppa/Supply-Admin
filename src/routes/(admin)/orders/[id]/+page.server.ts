import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
  buyLabelSchema,
  orderRefundSchema,
  orderTransitionSchema,
  parseForm,
  shippingRateRequestSchema
} from '$lib/schemas';
import {
  buildToAddress,
  buyShipmentLabel,
  createShipment,
  getFromAddress,
  isShippingConfigured,
  ShippingError
} from '$lib/server/shipping';

export const load: PageServerLoad = async ({ params, locals: { supabase } }) => {
  const [orderRes, lineItemsRes, paymentsRes, purchasesRes] = await Promise.all([
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
      .order('created_at', { ascending: false }),
    supabase
      .from('purchases')
      .select(
        'id, ordered_at, status, payment_status, subtotal, freight, distribution_fee, total, supplier:suppliers(id, name, key)'
      )
      .eq('order_id', params.id)
      .order('ordered_at', { ascending: false })
  ]);

  if (orderRes.error || !orderRes.data) throw error(404, 'Order not found');

  type PurchaseForOrder = {
    id: string;
    ordered_at: string;
    status: string;
    payment_status: string;
    subtotal: number;
    freight: number;
    distribution_fee: number;
    total: number;
    supplier: { id: string; name: string; key: string } | null;
  };

  return {
    order: orderRes.data,
    lineItems: lineItemsRes.data ?? [],
    payments: paymentsRes.data ?? [],
    purchases: (purchasesRes.data ?? []) as unknown as PurchaseForOrder[],
    shippingConfigured: isShippingConfigured()
  };
};

// Labels can be bought once the order is paid; buying one marks it shipped.
const LABEL_ELIGIBLE_STATUSES = new Set(['paid', 'fulfilled']);

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
    if (!order) return fail(404, { message: 'Order not found.', fieldErrors: {}, code: undefined });

    const allowed = ALLOWED_TRANSITIONS[order.status] ?? [];
    if (!allowed.includes(to)) {
      return fail(400, {
        message: `Cannot transition ${order.status} → ${to}.`,
        fieldErrors: {},
        code: undefined
      });
    }

    const update: { status: string; tracking_number?: string } = { status: to };
    if (to === 'shipped' && parsed.data.tracking) update.tracking_number = parsed.data.tracking;

    const { error } = await supabase.from('orders').update(update).eq('id', params.id);
    if (error) return fail(400, { message: error.message, fieldErrors: {}, code: undefined });
    return { saved: true, message: undefined, code: undefined };
  },

  getRates: async ({ params, request, locals: { supabase } }) => {
    const form = await request.formData();
    const parsed = parseForm(shippingRateRequestSchema, form);
    if (!parsed.success) {
      return fail(400, {
        message: parsed.message,
        fieldErrors: parsed.fieldErrors,
        code: undefined
      });
    }

    const { data: order } = await supabase
      .from('orders')
      .select('status, shipping_address_snapshot, customer:customers(business_name)')
      .eq('id', params.id)
      .maybeSingle();
    if (!order) return fail(404, { message: 'Order not found.', fieldErrors: {}, code: undefined });
    if (!LABEL_ELIGIBLE_STATUSES.has(order.status)) {
      return fail(400, {
        message: `Cannot buy a label for a ${order.status} order.`,
        fieldErrors: {},
        code: undefined
      });
    }

    try {
      const to = buildToAddress(
        order.shipping_address_snapshot,
        (order.customer as { business_name?: string } | null)?.business_name
      );
      const quote = await createShipment({
        to,
        from: getFromAddress(),
        weightOz: parsed.data.weight_oz
      });
      if (quote.rates.length === 0) {
        return fail(400, {
          message: 'No rates available for this address and weight.',
          fieldErrors: {},
          code: undefined
        });
      }
      return {
        rates: quote.rates,
        shipmentId: quote.shipment_id,
        weightOz: parsed.data.weight_oz,
        message: undefined,
        code: undefined
      };
    } catch (err) {
      const message =
        err instanceof ShippingError ? err.message : 'Failed to fetch shipping rates.';
      return fail(400, { message, fieldErrors: {}, code: undefined });
    }
  },

  buyLabel: async ({ params, request, locals: { supabase } }) => {
    const form = await request.formData();
    const parsed = parseForm(buyLabelSchema, form);
    if (!parsed.success) {
      return fail(400, {
        message: parsed.message,
        fieldErrors: parsed.fieldErrors,
        code: undefined
      });
    }

    const { data: order } = await supabase
      .from('orders')
      .select('status, label_url')
      .eq('id', params.id)
      .maybeSingle();
    if (!order) return fail(404, { message: 'Order not found.', fieldErrors: {}, code: undefined });
    if (order.label_url) {
      return fail(400, {
        message: 'A label has already been purchased for this order.',
        fieldErrors: {},
        code: undefined
      });
    }
    if (!LABEL_ELIGIBLE_STATUSES.has(order.status)) {
      return fail(400, {
        message: `Cannot buy a label for a ${order.status} order.`,
        fieldErrors: {},
        code: undefined
      });
    }

    let label;
    try {
      label = await buyShipmentLabel({
        shipmentId: parsed.data.shipment_id,
        rateId: parsed.data.rate_id
      });
    } catch (err) {
      const message = err instanceof ShippingError ? err.message : 'Label purchase failed.';
      return fail(400, { message, fieldErrors: {}, code: undefined });
    }

    const { error: updateError } = await supabase
      .from('orders')
      .update({
        status: 'shipped',
        carrier: label.carrier,
        carrier_service: label.service,
        tracking_number: label.tracking_number,
        tracking_url: label.tracking_url,
        label_url: label.label_url,
        shipment_id: parsed.data.shipment_id,
        label_purchased_at: new Date().toISOString()
      })
      .eq('id', params.id);
    if (updateError) {
      return fail(400, {
        message: `Label was purchased (tracking ${label.tracking_number}) but saving it failed: ${updateError.message}`,
        fieldErrors: {},
        code: undefined
      });
    }
    return { saved: true, message: undefined, code: undefined };
  },

  cancel: async ({ params, locals: { supabase } }) => {
    const { error: updateError } = await supabase
      .from('orders')
      .update({ status: 'cancelled' })
      .eq('id', params.id);

    if (updateError)
      return fail(400, {
        message: updateError.message ?? 'Cancel failed.',
        fieldErrors: {},
        code: undefined
      });
    return { saved: true, message: undefined, code: undefined };
  },

  refund: async ({ params, request, locals: { supabase } }) => {
    const form = await request.formData();
    const parsed = parseForm(orderRefundSchema, form);
    if (!parsed.success) {
      return fail(400, {
        message: parsed.message,
        fieldErrors: parsed.fieldErrors,
        code: undefined
      });
    }

    const { error: updateError } = await supabase
      .from('orders')
      .update({ status: 'refunded' })
      .eq('id', params.id);

    if (updateError)
      return fail(400, {
        message: updateError.message ?? 'Refund failed.',
        fieldErrors: {},
        code: undefined
      });
    return { saved: true, message: undefined, code: undefined };
  }
};

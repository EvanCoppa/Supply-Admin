import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import type { Rma, RmaStatus } from '$lib/types/db';

const STATUSES: RmaStatus[] = [
  'requested',
  'approved',
  'received',
  'refunded',
  'rejected',
  'cancelled'
];

const ALLOWED_TRANSITIONS: Record<RmaStatus, RmaStatus[]> = {
  requested: ['approved', 'rejected', 'cancelled'],
  approved: ['received', 'cancelled'],
  received: ['refunded'],
  refunded: [],
  rejected: [],
  cancelled: []
};

type RmaItemRow = {
  id: string;
  rma_id: string;
  order_line_item_id: string | null;
  product_id: string;
  quantity: number;
  unit_refund: number;
  reason: string | null;
  restock: boolean;
  product: { id: string; sku: string; name: string } | null;
};

type RmaDetail = Rma & {
  customer: { id: string; business_name: string; email: string | null } | null;
  order: { id: string; placed_at: string; total: number; status: string } | null;
  items: RmaItemRow[];
};

type OrderLineItemRow = {
  id: string;
  product_id: string;
  product_sku_snapshot: string;
  product_name_snapshot: string;
  quantity: number;
  unit_price_snapshot: number;
  line_total: number;
};

export const load: PageServerLoad = async ({ params, locals: { supabase } }) => {
  const rmaRes = await supabase
    .from('rmas')
    .select(
      'id, customer_id, order_id, rma_number, status, reason, refund_amount, restocking_fee, notes, created_by, created_at, updated_at,' +
        ' customer:customers(id, business_name, email),' +
        ' order:orders(id, placed_at, total, status),' +
        ' items:rma_items(id, rma_id, order_line_item_id, product_id, quantity, unit_refund, reason, restock,' +
        '   product:products(id, sku, name))'
    )
    .eq('id', params.id)
    .maybeSingle();

  if (rmaRes.error || !rmaRes.data) throw error(404, 'RMA not found');
  const rma = rmaRes.data as unknown as RmaDetail;

  const lineItemsRes = await supabase
    .from('order_line_items')
    .select(
      'id, product_id, product_sku_snapshot, product_name_snapshot, quantity, unit_price_snapshot, line_total'
    )
    .eq('order_id', rma.order_id)
    .order('product_sku_snapshot');

  return {
    rma,
    orderLineItems: (lineItemsRes.data ?? []) as OrderLineItemRow[],
    allowedNextStatuses: ALLOWED_TRANSITIONS[rma.status] ?? []
  };
};

function parsePositiveInt(value: FormDataEntryValue | null): number | null {
  if (value === null) return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) return null;
  return n;
}

function parseNonNegativeNumber(value: FormDataEntryValue | null): number | null {
  if (value === null || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

export const actions: Actions = {
  setStatus: async ({ params, request, locals: { supabase } }) => {
    const form = await request.formData();
    const status = String(form.get('status') ?? '');
    if (!STATUSES.includes(status as RmaStatus)) {
      return fail(400, { message: 'Invalid status.' });
    }

    const { data: current } = await supabase
      .from('rmas')
      .select('status')
      .eq('id', params.id)
      .maybeSingle();
    if (!current) return fail(404, { message: 'RMA not found.' });

    const allowed = ALLOWED_TRANSITIONS[current.status as RmaStatus] ?? [];
    if (!allowed.includes(status as RmaStatus)) {
      return fail(400, {
        message: `Cannot transition ${current.status} → ${status}.`
      });
    }

    const { error } = await supabase.from('rmas').update({ status }).eq('id', params.id);
    if (error) return fail(400, { message: error.message });
    return { saved: true };
  },

  updateRma: async ({ params, request, locals: { supabase } }) => {
    const form = await request.formData();
    const refund = parseNonNegativeNumber(form.get('refund_amount'));
    const fee = parseNonNegativeNumber(form.get('restocking_fee'));
    if (refund === null) return fail(400, { message: 'Refund amount must be ≥ 0.' });
    if (fee === null) return fail(400, { message: 'Restocking fee must be ≥ 0.' });

    const reason = String(form.get('reason') ?? '').trim() || null;
    const notes = String(form.get('notes') ?? '').trim() || null;

    const { error } = await supabase
      .from('rmas')
      .update({
        refund_amount: refund,
        restocking_fee: fee,
        reason,
        notes
      })
      .eq('id', params.id);
    if (error) return fail(400, { message: error.message });
    return { saved: true };
  },

  addItem: async ({ params, request, locals: { supabase } }) => {
    const form = await request.formData();
    const lineItemId = String(form.get('order_line_item_id') ?? '');
    if (!lineItemId) return fail(400, { message: 'Pick a line item.' });

    const quantity = parsePositiveInt(form.get('quantity'));
    if (quantity === null) return fail(400, { message: 'Quantity must be a positive integer.' });

    const unitRefund = parseNonNegativeNumber(form.get('unit_refund'));
    if (unitRefund === null) return fail(400, { message: 'Unit refund must be ≥ 0.' });

    const reason = String(form.get('reason') ?? '').trim() || null;
    const restock = form.get('restock') === 'on';

    const { data: li, error: liErr } = await supabase
      .from('order_line_items')
      .select('id, product_id, order_id, quantity')
      .eq('id', lineItemId)
      .maybeSingle();
    if (liErr || !li) return fail(400, { message: 'Line item not found.' });

    const { data: rma, error: rmaErr } = await supabase
      .from('rmas')
      .select('order_id')
      .eq('id', params.id)
      .maybeSingle();
    if (rmaErr || !rma) return fail(404, { message: 'RMA not found.' });
    if (rma.order_id !== li.order_id) {
      return fail(400, { message: 'Line item does not belong to this RMA’s order.' });
    }
    if (quantity > li.quantity) {
      return fail(400, {
        message: `Quantity exceeds line item quantity (${li.quantity}).`
      });
    }

    const { error: insErr } = await supabase.from('rma_items').insert({
      rma_id: params.id,
      order_line_item_id: lineItemId,
      product_id: li.product_id,
      quantity,
      unit_refund: unitRefund,
      reason,
      restock
    });
    if (insErr) return fail(400, { message: insErr.message });
    return { saved: true };
  },

  updateItem: async ({ params, request, locals: { supabase } }) => {
    const form = await request.formData();
    const id = String(form.get('id') ?? '');
    if (!id) return fail(400, { message: 'Missing item id.' });

    const quantity = parsePositiveInt(form.get('quantity'));
    if (quantity === null) return fail(400, { message: 'Quantity must be a positive integer.' });

    const unitRefund = parseNonNegativeNumber(form.get('unit_refund'));
    if (unitRefund === null) return fail(400, { message: 'Unit refund must be ≥ 0.' });

    const restock = form.get('restock') === 'on';
    const reason = String(form.get('reason') ?? '').trim() || null;

    const { error } = await supabase
      .from('rma_items')
      .update({ quantity, unit_refund: unitRefund, restock, reason })
      .eq('id', id)
      .eq('rma_id', params.id);
    if (error) return fail(400, { message: error.message });
    return { saved: true };
  },

  removeItem: async ({ params, request, locals: { supabase } }) => {
    const form = await request.formData();
    const id = String(form.get('id') ?? '');
    if (!id) return fail(400, { message: 'Missing item id.' });
    const { error } = await supabase
      .from('rma_items')
      .delete()
      .eq('id', id)
      .eq('rma_id', params.id);
    if (error) return fail(400, { message: error.message });
    return { saved: true };
  }
};

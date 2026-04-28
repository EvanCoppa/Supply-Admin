import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { callApi } from '$lib/api';
import { REASON_CODES, inventoryAdjustSchema, parseForm } from '$lib/schemas';

export const load: PageServerLoad = async ({ params, locals: { supabase } }) => {
  const [productRes, inventoryRes, ledgerRes] = await Promise.all([
    supabase
      .from('products')
      .select('id, sku, name, status')
      .eq('id', params.productId)
      .maybeSingle(),
    supabase.from('inventory').select('*').eq('product_id', params.productId).maybeSingle(),
    supabase
      .from('inventory_ledger')
      .select('id, delta, reason, notes, order_id, actor_id, created_at')
      .eq('product_id', params.productId)
      .order('created_at', { ascending: false })
      .limit(200)
  ]);

  if (!productRes.data) throw error(404, 'Product not found');

  return {
    product: productRes.data,
    inventory: inventoryRes.data,
    ledger: ledgerRes.data ?? [],
    reasons: REASON_CODES
  };
};

export const actions: Actions = {
  adjust: async ({ params, request, locals }) => {
    const form = await request.formData();
    const parsed = parseForm(inventoryAdjustSchema, form);
    if (!parsed.success) {
      return fail(400, {
        message: parsed.message,
        fieldErrors: parsed.fieldErrors,
        code: undefined
      });
    }
    if (!locals.session) {
      return fail(401, { message: 'Not signed in.', fieldErrors: {}, code: undefined });
    }

    const { delta, reason, notes } = parsed.data;
    const res = await callApi({
      path: '/api/v1/admin/inventory/adjust',
      method: 'POST',
      body: {
        product_id: params.productId,
        delta,
        reason,
        notes: notes ?? undefined
      },
      accessToken: locals.session.access_token
    });

    if (!res.ok) {
      return fail(res.status || 500, {
        message: res.error?.message ?? 'Adjustment failed.',
        fieldErrors: {},
        code: res.error?.code
      });
    }
    return { saved: true, message: undefined, code: undefined };
  }
};

import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { callApi } from '$lib/api';

const REASONS = ['receipt', 'manual_adjustment', 'cycle_count', 'damage', 'other'] as const;

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
    reasons: REASONS
  };
};

export const actions: Actions = {
  adjust: async ({ params, request, locals }) => {
    const form = await request.formData();
    const delta = Number(form.get('delta'));
    const reason = String(form.get('reason') ?? '');
    const notes = String(form.get('notes') ?? '');

    if (!Number.isInteger(delta) || delta === 0) {
      return fail(400, { message: 'Delta must be a non-zero integer.', code: undefined });
    }
    if (!REASONS.includes(reason as (typeof REASONS)[number])) {
      return fail(400, { message: 'Select a reason code.', code: undefined });
    }
    if (!locals.session) return fail(401, { message: 'Not signed in.', code: undefined });

    const res = await callApi({
      path: '/api/v1/admin/inventory/adjust',
      method: 'POST',
      body: { product_id: params.productId, delta, reason, notes: notes || undefined },
      accessToken: locals.session.access_token
    });

    if (!res.ok) {
      return fail(res.status || 500, {
        message: res.error?.message ?? 'Adjustment failed.',
        code: res.error?.code
      });
    }
    return { saved: true, message: undefined, code: undefined };
  }
};

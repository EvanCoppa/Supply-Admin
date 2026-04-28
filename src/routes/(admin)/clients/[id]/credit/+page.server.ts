import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import type { CustomerCredit } from '$lib/types/db';

export const load: PageServerLoad = async ({ params, locals: { supabase } }) => {
  const { data } = await supabase
    .from('customer_credit')
    .select('*')
    .eq('customer_id', params.id)
    .maybeSingle();
  return { credit: (data ?? null) as CustomerCredit | null };
};

export const actions: Actions = {
  save: async ({ params, request, locals: { supabase } }) => {
    const form = await request.formData();
    const limit = Number(form.get('credit_limit') ?? 0);
    if (!Number.isFinite(limit) || limit < 0) {
      return fail(400, { message: 'Credit limit must be a non-negative number.' });
    }
    const netStr = String(form.get('net_terms_days') ?? '').trim();
    let net: number | null = null;
    if (netStr) {
      net = Number(netStr);
      if (!Number.isInteger(net) || net < 0) {
        return fail(400, { message: 'Net terms must be a non-negative integer.' });
      }
    }
    const on_hold = form.get('on_hold') === 'on';
    const hold_reason = String(form.get('hold_reason') ?? '').trim() || null;

    const { error } = await supabase.from('customer_credit').upsert({
      customer_id: params.id,
      credit_limit: limit,
      net_terms_days: net,
      on_hold,
      hold_reason: on_hold ? hold_reason : null
    });
    if (error) return fail(400, { message: error.message });
    return { saved: true };
  }
};

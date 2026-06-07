import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import type { Coupon } from '$lib/types/db';

export const load: PageServerLoad = async ({ locals: { supabase } }) => {
  const { data, error } = await supabase
    .from('coupons')
    .select(
      'id, code, description, discount_type, discount_value, min_subtotal, max_discount, active, starts_at, expires_at, usage_limit, times_redeemed, created_at, updated_at'
    )
    .order('created_at', { ascending: false });

  if (error) return { coupons: [] as Coupon[], loadError: error.message };
  return { coupons: data ?? [] };
};

// Parse a decimal money/number field. Returns { value } on success (null when
// blank and the field is optional) or { error } with a message.
function parseNumber(
  raw: FormDataEntryValue | null,
  label: string,
  { optional = false, min = 0, max }: { optional?: boolean; min?: number; max?: number } = {}
): { value: number | null } | { error: string } {
  const s = String(raw ?? '').trim();
  if (!s) {
    if (optional) return { value: null };
    return { error: `${label} is required.` };
  }
  const n = Number(s);
  if (Number.isNaN(n)) return { error: `${label} must be a number.` };
  if (n < min) return { error: `${label} must be at least ${min}.` };
  if (max !== undefined && n > max) return { error: `${label} must be at most ${max}.` };
  return { value: n };
}

// datetime-local inputs submit "YYYY-MM-DDTHH:mm" with no timezone — interpret
// as the admin's local time and store as a proper UTC timestamp.
function parseDateTime(raw: FormDataEntryValue | null): string | null {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

type CouponInput = Omit<Coupon, 'id' | 'times_redeemed' | 'created_at' | 'updated_at'>;

// Shared validation/parsing for create + update. Returns the row payload or a
// `fail()` response.
function buildPayload(form: FormData) {
  const code = String(form.get('code') ?? '')
    .trim()
    .toUpperCase();
  if (!code) return fail(400, { message: 'Code is required.' });

  const discount_type = String(form.get('discount_type') ?? 'fixed');
  if (discount_type !== 'fixed' && discount_type !== 'percent') {
    return fail(400, { message: 'Discount type must be fixed or percent.' });
  }

  const valueRes = parseNumber(
    form.get('discount_value'),
    'Discount value',
    discount_type === 'percent' ? { min: 0, max: 100 } : { min: 0 }
  );
  if ('error' in valueRes) return fail(400, { message: valueRes.error });
  if (!valueRes.value || valueRes.value <= 0) {
    return fail(400, { message: 'Discount value must be greater than 0.' });
  }

  const minRes = parseNumber(form.get('min_subtotal'), 'Minimum subtotal', { optional: true });
  if ('error' in minRes) return fail(400, { message: minRes.error });

  const maxRes = parseNumber(form.get('max_discount'), 'Maximum discount', { optional: true });
  if ('error' in maxRes) return fail(400, { message: maxRes.error });

  const usageRes = parseNumber(form.get('usage_limit'), 'Usage limit', { optional: true });
  if ('error' in usageRes) return fail(400, { message: usageRes.error });

  const starts_at = parseDateTime(form.get('starts_at'));
  const expires_at = parseDateTime(form.get('expires_at'));
  if (starts_at && expires_at && new Date(expires_at) <= new Date(starts_at)) {
    return fail(400, { message: 'Expiry must be after the start date.' });
  }

  const payload: CouponInput = {
    code,
    description: String(form.get('description') ?? '').trim() || null,
    discount_type,
    discount_value: valueRes.value,
    min_subtotal: minRes.value ?? 0,
    max_discount: maxRes.value,
    active: form.get('active') === 'on',
    starts_at,
    expires_at,
    usage_limit: usageRes.value === null ? null : Math.round(usageRes.value)
  };
  return { payload };
}

// Postgres unique_violation on the case-insensitive code index.
function friendlyError(error: { code?: string; message: string }, code: string): string {
  if (error.code === '23505') return `A coupon with code "${code}" already exists.`;
  return error.message;
}

export const actions: Actions = {
  create: async ({ request, locals: { supabase } }) => {
    const form = await request.formData();
    const result = buildPayload(form);
    if ('status' in result) return result;

    const { error } = await supabase.from('coupons').insert(result.payload);
    if (error) return fail(400, { message: friendlyError(error, result.payload.code) });
    return { saved: true };
  },

  update: async ({ request, locals: { supabase } }) => {
    const form = await request.formData();
    const id = String(form.get('id') ?? '');
    if (!id) return fail(400, { message: 'Missing coupon id.' });

    const result = buildPayload(form);
    if ('status' in result) return result;

    const { error } = await supabase
      .from('coupons')
      .update({ ...result.payload, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) return fail(400, { message: friendlyError(error, result.payload.code) });
    return { saved: true };
  },

  toggle: async ({ request, locals: { supabase } }) => {
    const form = await request.formData();
    const id = String(form.get('id') ?? '');
    const active = form.get('active') === 'true';
    if (!id) return fail(400, { message: 'Missing coupon id.' });
    const { error } = await supabase
      .from('coupons')
      .update({ active, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) return fail(400, { message: error.message });
    return { saved: true };
  },

  delete: async ({ request, locals: { supabase } }) => {
    const form = await request.formData();
    const id = String(form.get('id') ?? '');
    if (!id) return fail(400, { message: 'Missing coupon id.' });
    const { error } = await supabase.from('coupons').delete().eq('id', id);
    if (error) return fail(400, { message: error.message });
    return { saved: true };
  }
};

import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

type VelocityRow = {
  product_id: string;
  sku: string | null;
  name: string | null;
  total_qty: number;
  unique_customers: number;
  order_count: number;
  revenue: number;
};

type RepeatRow = {
  customer_id: string;
  product_id: string;
  product_name: string | null;
  product_sku: string | null;
  order_count: number;
  total_qty: number;
  last_ordered_at: string;
};

export const load: PageServerLoad = async ({ locals: { supabase } }) => {
  const [velocityRes, repeatsRes, watchlistRes] = await Promise.all([
    supabase
      .from('v_product_velocity_30d')
      .select('product_id, sku, name, total_qty, unique_customers, order_count, revenue')
      .order('total_qty', { ascending: false })
      .limit(20),
    supabase
      .from('v_client_product_repeats_30d')
      .select(
        'customer_id, product_id, product_name, product_sku, order_count, total_qty, last_ordered_at'
      )
      .order('order_count', { ascending: false })
      .limit(50),
    supabase
      .from('watchlist_items')
      .select('id, product_id, notes, created_at, product:products(id, sku, name)')
      .order('created_at', { ascending: false })
  ]);

  const velocity = (velocityRes.data ?? []) as VelocityRow[];
  const repeats = (repeatsRes.data ?? []) as RepeatRow[];

  const customerIds = Array.from(new Set(repeats.map((r) => r.customer_id)));
  const customersRes = customerIds.length
    ? await supabase.from('customers').select('id, business_name').in('id', customerIds)
    : { data: [] };
  const customerMap = new Map<string, string>(
    ((customersRes.data ?? []) as Array<{ id: string; business_name: string }>).map((c) => [
      c.id,
      c.business_name
    ])
  );

  const repeatsWithCustomer = repeats.map((r) => ({
    ...r,
    customer_name: customerMap.get(r.customer_id) ?? 'Unknown'
  }));

  return {
    velocity,
    repeats: repeatsWithCustomer,
    watchlist: (watchlistRes.data ?? []) as unknown as Array<{
      id: string;
      product_id: string;
      notes: string | null;
      created_at: string;
      product: { id: string; sku: string; name: string } | null;
    }>
  };
};

export const actions: Actions = {
  watch: async ({ request, locals: { supabase, user } }) => {
    const form = await request.formData();
    const productId = String(form.get('product_id') ?? '').trim();
    const notes = String(form.get('notes') ?? '').trim() || null;
    if (!productId) return fail(400, { message: 'Product is required.' });

    const { error } = await supabase
      .from('watchlist_items')
      .upsert({ product_id: productId, notes, added_by: user?.id ?? null }, { onConflict: 'product_id' });
    if (error) return fail(400, { message: error.message });
    return { saved: true };
  },

  unwatch: async ({ request, locals: { supabase } }) => {
    const form = await request.formData();
    const id = String(form.get('id') ?? '').trim();
    if (!id) return fail(400, { message: 'Missing id.' });
    const { error } = await supabase.from('watchlist_items').delete().eq('id', id);
    if (error) return fail(400, { message: error.message });
    return { saved: true };
  }
};

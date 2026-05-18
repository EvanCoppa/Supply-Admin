import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals: { supabase }, url }) => {
  const search = (url.searchParams.get('q') ?? '').trim();

  const [customerRes, accessRes] = await Promise.all([
    supabase
      .from('customers')
      .select('catalog_access_mode')
      .eq('id', params.id)
      .maybeSingle(),
    supabase
      .from('customer_product_access')
      .select('product_id, can_view, can_buy')
      .eq('customer_id', params.id)
  ]);

  let productsQuery = supabase
    .from('products')
    .select('id, sku, name, status')
    .eq('status', 'active')
    .order('name')
    .limit(500);

  if (search) productsQuery = productsQuery.or(`name.ilike.%${search}%,sku.ilike.%${search}%`);

  const productsRes = await productsQuery;
  const access = new Map(
    (accessRes.data ?? []).map((row) => [
      row.product_id,
      { can_view: row.can_view, can_buy: row.can_buy }
    ])
  );

  return {
    mode: customerRes.data?.catalog_access_mode === 'all_active' ? 'all_active' : 'allowlist',
    search,
    products: (productsRes.data ?? []).map((product) => {
      const row = access.get(product.id);
      return {
        ...product,
        can_view: row?.can_view ?? (customerRes.data?.catalog_access_mode === 'all_active' ? true : false),
        can_buy: row?.can_buy ?? true,
        has_override: !!row
      };
    })
  };
};

export const actions: Actions = {
  saveMode: async ({ params, request, locals: { supabase } }) => {
    const form = await request.formData();
    const mode = String(form.get('catalog_access_mode') ?? '');
    if (mode !== 'all_active' && mode !== 'allowlist') {
      return fail(400, { message: 'Invalid catalog access mode.' });
    }

    const { error } = await supabase
      .from('customers')
      .update({ catalog_access_mode: mode })
      .eq('id', params.id);

    if (error) return fail(400, { message: error.message });
    return { saved: true };
  },

  setAccess: async ({ params, request, locals: { supabase } }) => {
    const form = await request.formData();
    const product_id = String(form.get('product_id') ?? '');
    const can_view = form.get('can_view') === 'on';
    const can_buy = can_view && form.get('can_buy') === 'on';

    if (!product_id) return fail(400, { message: 'Missing product.' });

    const { error } = await supabase.from('customer_product_access').upsert({
      customer_id: params.id,
      product_id,
      can_view,
      can_buy,
      updated_at: new Date().toISOString()
    });

    if (error) return fail(400, { message: error.message });
    return { saved: true };
  },

  clearAccess: async ({ params, request, locals: { supabase } }) => {
    const form = await request.formData();
    const product_id = String(form.get('product_id') ?? '');
    if (!product_id) return fail(400, { message: 'Missing product.' });

    const { error } = await supabase
      .from('customer_product_access')
      .delete()
      .eq('customer_id', params.id)
      .eq('product_id', product_id);

    if (error) return fail(400, { message: error.message });
    return { saved: true };
  }
};

import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals: { supabase } }) => {
  const [rulesRes, productsRes, categoriesRes] = await Promise.all([
    supabase
      .from('customer_pricing_rules')
      .select(
        'id, scope, product_id, category_id, override_type, absolute_price, percent_discount, effective_start, effective_end, created_at, product:products(name, sku), category:categories(name)'
      )
      .eq('customer_id', params.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('products')
      .select('id, sku, name')
      .eq('status', 'active')
      .order('name')
      .limit(500),
    supabase.from('categories').select('id, name').order('name')
  ]);

  type Rule = {
    id: string;
    scope: 'product' | 'category';
    product_id: string | null;
    category_id: string | null;
    override_type: 'absolute_price' | 'percent_discount';
    absolute_price: number | null;
    percent_discount: number | null;
    effective_start: string | null;
    effective_end: string | null;
    created_at: string;
    product: { name: string; sku: string } | null;
    category: { name: string } | null;
  };

  return {
    rules: (rulesRes.data ?? []) as unknown as Rule[],
    products: (productsRes.data ?? []) as Array<{ id: string; sku: string; name: string }>,
    categories: (categoriesRes.data ?? []) as Array<{ id: string; name: string }>
  };
};

export const actions: Actions = {
  create: async ({ params, request, locals: { supabase } }) => {
    const form = await request.formData();
    const scope = String(form.get('scope') ?? '');
    const override_type = String(form.get('override_type') ?? '');
    if (scope !== 'product' && scope !== 'category') {
      return fail(400, { message: 'Choose a scope.' });
    }
    if (override_type !== 'absolute_price' && override_type !== 'percent_discount') {
      return fail(400, { message: 'Choose an override type.' });
    }

    const product_id = scope === 'product' ? String(form.get('product_id') ?? '') || null : null;
    const category_id = scope === 'category' ? String(form.get('category_id') ?? '') || null : null;
    if (scope === 'product' && !product_id) return fail(400, { message: 'Pick a product.' });
    if (scope === 'category' && !category_id) return fail(400, { message: 'Pick a category.' });

    const absolute_price =
      override_type === 'absolute_price' ? Number(form.get('absolute_price')) : null;
    const percent_discount =
      override_type === 'percent_discount' ? Number(form.get('percent_discount')) : null;

    if (absolute_price !== null && (!Number.isFinite(absolute_price) || absolute_price < 0)) {
      return fail(400, { message: 'Absolute price must be ≥ 0.' });
    }
    if (
      percent_discount !== null &&
      (!Number.isFinite(percent_discount) || percent_discount < 0 || percent_discount > 100)
    ) {
      return fail(400, { message: 'Percent discount must be between 0 and 100.' });
    }

    const effective_start = String(form.get('effective_start') ?? '').trim() || null;
    const effective_end = String(form.get('effective_end') ?? '').trim() || null;

    const { error } = await supabase.from('customer_pricing_rules').insert({
      customer_id: params.id,
      scope,
      product_id,
      category_id,
      override_type,
      absolute_price,
      percent_discount,
      effective_start,
      effective_end
    });
    if (error) return fail(400, { message: error.message });
    return { saved: true };
  },

  delete: async ({ params, request, locals: { supabase } }) => {
    const form = await request.formData();
    const id = String(form.get('id') ?? '');
    const { error } = await supabase
      .from('customer_pricing_rules')
      .delete()
      .eq('id', id)
      .eq('customer_id', params.id);
    if (error) return fail(400, { message: error.message });
    return { saved: true };
  },

  preview: async ({ params, request, locals: { supabase } }) => {
    const form = await request.formData();
    const productId = String(form.get('product_id') ?? '');
    if (!productId) return fail(400, { message: 'Pick a product to preview.' });

    const { data, error } = await supabase.rpc('resolve_customer_price', {
      p_customer_id: params.id,
      p_product_id: productId
    });
    if (error) return fail(400, { previewProductId: productId, message: error.message });
    return { previewProductId: productId, resolvedPrice: data as number | null };
  }
};

import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { parseForm, pricingPreviewSchema, pricingRuleSchema } from '$lib/schemas';

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
    const parsed = parseForm(pricingRuleSchema, form);
    if (!parsed.success) {
      return fail(400, { message: parsed.message, fieldErrors: parsed.fieldErrors });
    }
    const { scope, override_type } = parsed.data;
    const { error } = await supabase.from('customer_pricing_rules').insert({
      customer_id: params.id,
      scope,
      product_id: scope === 'product' ? parsed.data.product_id : null,
      category_id: scope === 'category' ? parsed.data.category_id : null,
      override_type,
      absolute_price:
        override_type === 'absolute_price' ? parsed.data.absolute_price : null,
      percent_discount:
        override_type === 'percent_discount' ? parsed.data.percent_discount : null,
      effective_start: parsed.data.effective_start,
      effective_end: parsed.data.effective_end
    });
    if (error) return fail(400, { message: error.message, fieldErrors: {} });
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
    if (error) return fail(400, { message: error.message, fieldErrors: {} });
    return { saved: true };
  },

  preview: async ({ params, request, locals: { supabase } }) => {
    const form = await request.formData();
    const parsed = parseForm(pricingPreviewSchema, form);
    if (!parsed.success) {
      return fail(400, { message: parsed.message, fieldErrors: parsed.fieldErrors });
    }
    const productId = parsed.data.product_id;
    const { data, error } = await supabase.rpc('resolve_customer_price', {
      p_customer_id: params.id,
      p_product_id: productId
    });
    if (error)
      return fail(400, {
        previewProductId: productId,
        message: error.message,
        fieldErrors: {}
      });
    return { previewProductId: productId, resolvedPrice: data as number | null };
  }
};

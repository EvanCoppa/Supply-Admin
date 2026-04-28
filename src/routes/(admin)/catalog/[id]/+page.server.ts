import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { lowStockThresholdSchema, parseForm, productSchema } from '$lib/schemas';

export const load: PageServerLoad = async ({ params, locals: { supabase } }) => {
  const [productRes, categoriesRes, inventoryRes] = await Promise.all([
    supabase.from('products').select('*').eq('id', params.id).maybeSingle(),
    supabase.from('categories').select('id, name').order('name'),
    supabase.from('inventory').select('*').eq('product_id', params.id).maybeSingle()
  ]);

  if (productRes.error || !productRes.data) {
    throw error(404, 'Product not found');
  }

  return {
    product: productRes.data,
    categories: categoriesRes.data ?? [],
    inventory: inventoryRes.data
  };
};

export const actions: Actions = {
  save: async ({ params, request, locals: { supabase } }) => {
    const form = await request.formData();
    const parsed = parseForm(productSchema, form);
    if (!parsed.success) {
      return fail(400, { message: parsed.message, fieldErrors: parsed.fieldErrors });
    }
    const { error } = await supabase
      .from('products')
      .update(parsed.data)
      .eq('id', params.id);
    if (error) return fail(400, { message: error.message, fieldErrors: {} });
    return { saved: true };
  },

  archive: async ({ params, locals: { supabase } }) => {
    const { error } = await supabase
      .from('products')
      .update({ status: 'archived' })
      .eq('id', params.id);
    if (error) return fail(400, { message: error.message, fieldErrors: {} });
    return { saved: true };
  },

  restore: async ({ params, locals: { supabase } }) => {
    const { error } = await supabase
      .from('products')
      .update({ status: 'active' })
      .eq('id', params.id);
    if (error) return fail(400, { message: error.message, fieldErrors: {} });
    return { saved: true };
  },

  'update-threshold': async ({ params, request, locals: { supabase } }) => {
    const form = await request.formData();
    const parsed = parseForm(lowStockThresholdSchema, form);
    if (!parsed.success) {
      return fail(400, { message: parsed.message, fieldErrors: parsed.fieldErrors });
    }
    const { error } = await supabase.from('inventory').upsert({
      product_id: params.id,
      low_stock_threshold: parsed.data.low_stock_threshold
    });
    if (error) return fail(400, { message: error.message, fieldErrors: {} });
    return { saved: true };
  }
};

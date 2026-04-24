import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

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

function parseProduct(form: FormData) {
  const str = (k: string) => {
    const v = form.get(k);
    return typeof v === 'string' && v.length > 0 ? v : null;
  };
  const num = (k: string) => {
    const v = form.get(k);
    if (typeof v !== 'string' || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  return {
    sku: str('sku'),
    name: str('name'),
    description: str('description'),
    category_id: str('category_id'),
    manufacturer: str('manufacturer'),
    unit_of_measure: str('unit_of_measure'),
    pack_size: num('pack_size'),
    base_price: num('base_price'),
    tax_class: str('tax_class'),
    weight_grams: num('weight_grams'),
    status: (str('status') ?? 'active') as 'active' | 'archived'
  };
}

export const actions: Actions = {
  save: async ({ params, request, locals: { supabase } }) => {
    const form = await request.formData();
    const payload = parseProduct(form);
    if (!payload.sku || !payload.name || payload.base_price === null) {
      return fail(400, { message: 'SKU, name, and base price are required.' });
    }
    const { error } = await supabase.from('products').update(payload).eq('id', params.id);
    if (error) return fail(400, { message: error.message });
    return { saved: true };
  },

  archive: async ({ params, locals: { supabase } }) => {
    const { error } = await supabase
      .from('products')
      .update({ status: 'archived' })
      .eq('id', params.id);
    if (error) return fail(400, { message: error.message });
    return { saved: true };
  },

  restore: async ({ params, locals: { supabase } }) => {
    const { error } = await supabase
      .from('products')
      .update({ status: 'active' })
      .eq('id', params.id);
    if (error) return fail(400, { message: error.message });
    return { saved: true };
  },

  'update-threshold': async ({ params, request, locals: { supabase } }) => {
    const form = await request.formData();
    const v = Number(form.get('low_stock_threshold'));
    if (!Number.isFinite(v) || v < 0) {
      return fail(400, { message: 'Threshold must be a non-negative number.' });
    }
    const { error } = await supabase
      .from('inventory')
      .upsert({ product_id: params.id, low_stock_threshold: v });
    if (error) return fail(400, { message: error.message });
    return { saved: true };
  }
};

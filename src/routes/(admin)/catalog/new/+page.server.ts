import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { supabase } }) => {
  const { data } = await supabase.from('categories').select('id, name').order('name');
  return { categories: data ?? [] };
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
  default: async ({ request, locals: { supabase } }) => {
    const form = await request.formData();
    const payload = parseProduct(form);
    if (!payload.sku || !payload.name || payload.base_price === null) {
      return fail(400, { message: 'SKU, name, and base price are required.', payload });
    }

    const { data, error } = await supabase
      .from('products')
      .insert(payload)
      .select('id')
      .single();

    if (error) return fail(400, { message: error.message, payload });

    // Create inventory row so the product shows up in inventory views.
    await supabase.from('inventory').upsert({ product_id: data.id });

    throw redirect(303, `/catalog/${data.id}`);
  }
};

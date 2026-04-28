import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { featuredGroupSchema, parseForm } from '$lib/schemas';

export const load: PageServerLoad = async ({ locals: { supabase } }) => {
  const [groupsRes, productsRes] = await Promise.all([
    supabase.from('featured_groups').select('*').order('name'),
    supabase
      .from('products')
      .select('id, sku, name')
      .eq('status', 'active')
      .order('name')
      .limit(500)
  ]);
  return {
    groups: groupsRes.data ?? [],
    products: (productsRes.data ?? []) as Array<{ id: string; sku: string; name: string }>
  };
};

export const actions: Actions = {
  create: async ({ request, locals: { supabase } }) => {
    const form = await request.formData();
    const parsed = parseForm(featuredGroupSchema, form);
    if (!parsed.success) {
      return fail(400, { message: parsed.message, fieldErrors: parsed.fieldErrors });
    }
    const product_ids = String(form.get('product_ids') ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const { error } = await supabase
      .from('featured_groups')
      .insert({ ...parsed.data, product_ids });
    if (error) return fail(400, { message: error.message, fieldErrors: {} });
    return { saved: true };
  },

  delete: async ({ request, locals: { supabase } }) => {
    const form = await request.formData();
    const id = String(form.get('id') ?? '');
    const { error } = await supabase.from('featured_groups').delete().eq('id', id);
    if (error) return fail(400, { message: error.message, fieldErrors: {} });
    return { saved: true };
  }
};

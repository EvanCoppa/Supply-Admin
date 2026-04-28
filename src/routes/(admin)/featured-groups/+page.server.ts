import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

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
    const name = String(form.get('name') ?? '').trim();
    const description = String(form.get('description') ?? '').trim() || null;
    const product_ids = String(form.get('product_ids') ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (!name) return fail(400, { message: 'Name is required.' });
    const { error } = await supabase
      .from('featured_groups')
      .insert({ name, description, product_ids });
    if (error) return fail(400, { message: error.message });
    return { saved: true };
  },

  delete: async ({ request, locals: { supabase } }) => {
    const form = await request.formData();
    const id = String(form.get('id') ?? '');
    const { error } = await supabase.from('featured_groups').delete().eq('id', id);
    if (error) return fail(400, { message: error.message });
    return { saved: true };
  }
};

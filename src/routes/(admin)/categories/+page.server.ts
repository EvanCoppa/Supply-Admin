import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { supabase } }) => {
  const { data } = await supabase
    .from('categories')
    .select('id, parent_id, name, slug, display_order')
    .order('name');
  return { categories: data ?? [] };
};

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export const actions: Actions = {
  create: async ({ request, locals: { supabase } }) => {
    const form = await request.formData();
    const name = String(form.get('name') ?? '').trim();
    const parent_id = String(form.get('parent_id') ?? '').trim() || null;
    const display_order = Number(form.get('display_order') ?? 0);
    if (!name) return fail(400, { message: 'Name is required.' });
    const { error } = await supabase.from('categories').insert({
      name,
      slug: slugify(name),
      parent_id,
      display_order: Number.isFinite(display_order) ? display_order : 0
    });
    if (error) return fail(400, { message: error.message });
    return { saved: true };
  },

  delete: async ({ request, locals: { supabase } }) => {
    const form = await request.formData();
    const id = String(form.get('id') ?? '');
    const { error } = await supabase.from('categories').delete().eq('id', id);
    if (error) return fail(400, { message: error.message });
    return { saved: true };
  }
};

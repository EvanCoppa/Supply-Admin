import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { supabase } }) => {
  const { data } = await supabase
    .from('featured_groups')
    .select('*')
    .order('name');
  return { groups: data ?? [] };
};

export const actions: Actions = {
  create: async ({ request, locals: { supabase } }) => {
    const form = await request.formData();
    const name = String(form.get('name') ?? '').trim();
    const description = String(form.get('description') ?? '').trim() || null;
    if (!name) return fail(400, { message: 'Name is required.' });
    const { error } = await supabase.from('featured_groups').insert({ name, description });
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

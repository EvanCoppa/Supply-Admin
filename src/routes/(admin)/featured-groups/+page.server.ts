import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { featuredGroupSchema, parseForm } from '$lib/schemas';

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
    const parsed = parseForm(featuredGroupSchema, form);
    if (!parsed.success) {
      return fail(400, { message: parsed.message, fieldErrors: parsed.fieldErrors });
    }
    const { error } = await supabase.from('featured_groups').insert(parsed.data);
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

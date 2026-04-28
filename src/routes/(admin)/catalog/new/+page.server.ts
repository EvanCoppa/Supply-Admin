import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { parseForm, productSchema } from '$lib/schemas';

export const load: PageServerLoad = async ({ locals: { supabase } }) => {
  const { data } = await supabase.from('categories').select('id, name').order('name');
  return { categories: data ?? [] };
};

export const actions: Actions = {
  default: async ({ request, locals: { supabase } }) => {
    const form = await request.formData();
    const parsed = parseForm(productSchema, form);
    if (!parsed.success) {
      return fail(400, {
        message: parsed.message,
        fieldErrors: parsed.fieldErrors,
        payload: Object.fromEntries(form)
      });
    }

    const { data, error } = await supabase
      .from('products')
      .insert(parsed.data)
      .select('id')
      .single();

    if (error) {
      return fail(400, {
        message: error.message,
        fieldErrors: {},
        payload: parsed.data
      });
    }

    await supabase.from('inventory').upsert({ product_id: data.id });

    throw redirect(303, `/catalog/${data.id}`);
  }
};

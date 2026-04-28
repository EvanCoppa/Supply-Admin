import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { addressSchema, parseForm } from '$lib/schemas';

export const load: PageServerLoad = async ({ params, locals: { supabase } }) => {
  const { data } = await supabase
    .from('customer_addresses')
    .select('*')
    .eq('customer_id', params.id)
    .order('created_at', { ascending: false });
  return { addresses: data ?? [] };
};

export const actions: Actions = {
  create: async ({ params, request, locals: { supabase } }) => {
    const form = await request.formData();
    const parsed = parseForm(addressSchema, form);
    if (!parsed.success) {
      return fail(400, { message: parsed.message, fieldErrors: parsed.fieldErrors });
    }
    const payload = { customer_id: params.id, ...parsed.data };

    if (payload.is_default_shipping) {
      await supabase
        .from('customer_addresses')
        .update({ is_default_shipping: false })
        .eq('customer_id', params.id);
    }
    const { error } = await supabase.from('customer_addresses').insert(payload);
    if (error) return fail(400, { message: error.message, fieldErrors: {} });
    return { saved: true };
  },

  setDefault: async ({ params, request, locals: { supabase } }) => {
    const form = await request.formData();
    const id = String(form.get('id') ?? '');
    if (!id) return fail(400, { message: 'Missing address id.', fieldErrors: {} });
    await supabase
      .from('customer_addresses')
      .update({ is_default_shipping: false })
      .eq('customer_id', params.id);
    const { error } = await supabase
      .from('customer_addresses')
      .update({ is_default_shipping: true })
      .eq('id', id)
      .eq('customer_id', params.id);
    if (error) return fail(400, { message: error.message, fieldErrors: {} });
    return { saved: true };
  },

  delete: async ({ params, request, locals: { supabase } }) => {
    const form = await request.formData();
    const id = String(form.get('id') ?? '');
    const { error } = await supabase
      .from('customer_addresses')
      .delete()
      .eq('id', id)
      .eq('customer_id', params.id);
    if (error) return fail(400, { message: error.message, fieldErrors: {} });
    return { saved: true };
  }
};

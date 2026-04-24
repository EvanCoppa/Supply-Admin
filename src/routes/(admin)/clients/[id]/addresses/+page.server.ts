import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

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
    const payload = {
      customer_id: params.id,
      label: String(form.get('label') ?? '').trim() || null,
      line1: String(form.get('line1') ?? '').trim(),
      line2: String(form.get('line2') ?? '').trim() || null,
      city: String(form.get('city') ?? '').trim(),
      region: String(form.get('region') ?? '').trim(),
      postal_code: String(form.get('postal_code') ?? '').trim(),
      country: String(form.get('country') ?? '').trim().toUpperCase(),
      is_default_shipping: form.get('is_default_shipping') === 'on'
    };
    if (!payload.line1 || !payload.city || !payload.region || !payload.postal_code) {
      return fail(400, { message: 'line1, city, region, and postal code are required.' });
    }
    if (!/^[A-Z]{2}$/.test(payload.country)) {
      return fail(400, { message: 'Country must be a 2-letter ISO code.' });
    }
    if (payload.is_default_shipping) {
      await supabase
        .from('customer_addresses')
        .update({ is_default_shipping: false })
        .eq('customer_id', params.id);
    }
    const { error } = await supabase.from('customer_addresses').insert(payload);
    if (error) return fail(400, { message: error.message });
    return { saved: true };
  },

  setDefault: async ({ params, request, locals: { supabase } }) => {
    const form = await request.formData();
    const id = String(form.get('id') ?? '');
    if (!id) return fail(400, { message: 'Missing address id.' });
    await supabase
      .from('customer_addresses')
      .update({ is_default_shipping: false })
      .eq('customer_id', params.id);
    const { error } = await supabase
      .from('customer_addresses')
      .update({ is_default_shipping: true })
      .eq('id', id)
      .eq('customer_id', params.id);
    if (error) return fail(400, { message: error.message });
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
    if (error) return fail(400, { message: error.message });
    return { saved: true };
  }
};

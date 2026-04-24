import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import type { ContactRole, CustomerContact } from '$lib/types/db';

const ROLES: ContactRole[] = ['primary', 'billing', 'shipping', 'clinical', 'other'];

export const load: PageServerLoad = async ({ params, locals: { supabase } }) => {
  const { data } = await supabase
    .from('customer_contacts')
    .select('*')
    .eq('customer_id', params.id)
    .order('is_primary', { ascending: false })
    .order('last_name', { ascending: true, nullsFirst: false });

  return { contacts: (data ?? []) as CustomerContact[] };
};

function parsePayload(form: FormData, customerId: string) {
  const role = String(form.get('role') ?? '').trim();
  return {
    customer_id: customerId,
    first_name: String(form.get('first_name') ?? '').trim() || null,
    last_name: String(form.get('last_name') ?? '').trim() || null,
    title: String(form.get('title') ?? '').trim() || null,
    email: String(form.get('email') ?? '').trim() || null,
    phone: String(form.get('phone') ?? '').trim() || null,
    mobile_phone: String(form.get('mobile_phone') ?? '').trim() || null,
    role: ROLES.includes(role as ContactRole) ? (role as ContactRole) : null,
    is_primary: form.get('is_primary') === 'on',
    notes: String(form.get('notes') ?? '').trim() || null
  };
}

async function clearPrimary(
  supabase: App.Locals['supabase'],
  customerId: string,
  exceptId?: string
) {
  let q = supabase
    .from('customer_contacts')
    .update({ is_primary: false })
    .eq('customer_id', customerId)
    .eq('is_primary', true);
  if (exceptId) q = q.neq('id', exceptId);
  return q;
}

export const actions: Actions = {
  create: async ({ params, request, locals: { supabase } }) => {
    const form = await request.formData();
    const payload = parsePayload(form, params.id);
    if (!payload.first_name && !payload.last_name && !payload.email) {
      return fail(400, { message: 'Provide at least a name or email.' });
    }
    if (payload.is_primary) await clearPrimary(supabase, params.id);
    const { error } = await supabase.from('customer_contacts').insert(payload);
    if (error) return fail(400, { message: error.message });
    return { saved: true };
  },

  update: async ({ params, request, locals: { supabase } }) => {
    const form = await request.formData();
    const id = String(form.get('id') ?? '');
    if (!id) return fail(400, { message: 'Missing contact id.' });
    const payload = parsePayload(form, params.id);
    if (payload.is_primary) await clearPrimary(supabase, params.id, id);
    const { error } = await supabase
      .from('customer_contacts')
      .update(payload)
      .eq('id', id)
      .eq('customer_id', params.id);
    if (error) return fail(400, { message: error.message });
    return { saved: true };
  },

  delete: async ({ params, request, locals: { supabase } }) => {
    const form = await request.formData();
    const id = String(form.get('id') ?? '');
    const { error } = await supabase
      .from('customer_contacts')
      .delete()
      .eq('id', id)
      .eq('customer_id', params.id);
    if (error) return fail(400, { message: error.message });
    return { saved: true };
  }
};

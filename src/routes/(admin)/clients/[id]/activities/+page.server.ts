import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import type { ActivityDirection, ActivityType, CustomerActivity, CustomerContact } from '$lib/types/db';

const TYPES: ActivityType[] = ['call', 'email', 'meeting', 'visit', 'sms', 'other'];
const DIRECTIONS: ActivityDirection[] = ['inbound', 'outbound'];

export const load: PageServerLoad = async ({ params, locals: { supabase } }) => {
  const [actRes, contactsRes] = await Promise.all([
    supabase
      .from('customer_activities')
      .select(
        'id, customer_id, contact_id, actor_id, type, direction, subject, body, occurred_at, created_at,' +
          ' actor:user_profiles(display_name),' +
          ' contact:customer_contacts(first_name, last_name)'
      )
      .eq('customer_id', params.id)
      .order('occurred_at', { ascending: false })
      .limit(200),
    supabase
      .from('customer_contacts')
      .select('id, first_name, last_name')
      .eq('customer_id', params.id)
      .order('last_name', { ascending: true, nullsFirst: false })
  ]);

  return {
    activities: (actRes.data ?? []) as unknown as Array<
      CustomerActivity & {
        actor: { display_name: string | null } | null;
        contact: { first_name: string | null; last_name: string | null } | null;
      }
    >,
    contacts: (contactsRes.data ?? []) as Pick<CustomerContact, 'id' | 'first_name' | 'last_name'>[]
  };
};

export const actions: Actions = {
  create: async ({ params, request, locals: { supabase, user } }) => {
    const form = await request.formData();
    const type = String(form.get('type') ?? '');
    if (!TYPES.includes(type as ActivityType)) {
      return fail(400, { message: 'Pick an activity type.' });
    }
    const direction = String(form.get('direction') ?? '').trim();
    const occurred = String(form.get('occurred_at') ?? '').trim();
    const occurred_at = occurred ? new Date(occurred).toISOString() : new Date().toISOString();

    const { error } = await supabase.from('customer_activities').insert({
      customer_id: params.id,
      contact_id: String(form.get('contact_id') ?? '').trim() || null,
      actor_id: user?.id ?? null,
      type,
      direction: DIRECTIONS.includes(direction as ActivityDirection) ? direction : null,
      subject: String(form.get('subject') ?? '').trim() || null,
      body: String(form.get('body') ?? '').trim() || null,
      occurred_at
    });
    if (error) return fail(400, { message: error.message });
    return { saved: true };
  },

  delete: async ({ params, request, locals: { supabase } }) => {
    const form = await request.formData();
    const id = String(form.get('id') ?? '');
    const { error } = await supabase
      .from('customer_activities')
      .delete()
      .eq('id', id)
      .eq('customer_id', params.id);
    if (error) return fail(400, { message: error.message });
    return { saved: true };
  }
};

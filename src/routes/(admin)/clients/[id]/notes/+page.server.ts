import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import type { CustomerNote } from '$lib/types/db';

export const load: PageServerLoad = async ({ params, locals: { supabase } }) => {
  const { data } = await supabase
    .from('customer_notes')
    .select('*, author:user_profiles(display_name)')
    .eq('customer_id', params.id)
    .order('pinned', { ascending: false })
    .order('created_at', { ascending: false });

  return {
    notes: (data ?? []) as Array<
      CustomerNote & { author: { display_name: string | null } | null }
    >
  };
};

export const actions: Actions = {
  create: async ({ params, request, locals: { supabase, user } }) => {
    const form = await request.formData();
    const body = String(form.get('body') ?? '').trim();
    if (!body) return fail(400, { message: 'Note body cannot be empty.' });
    const { error } = await supabase.from('customer_notes').insert({
      customer_id: params.id,
      author_id: user?.id ?? null,
      body,
      pinned: form.get('pinned') === 'on'
    });
    if (error) return fail(400, { message: error.message });
    return { saved: true };
  },

  update: async ({ params, request, locals: { supabase } }) => {
    const form = await request.formData();
    const id = String(form.get('id') ?? '');
    const body = String(form.get('body') ?? '').trim();
    if (!id || !body) return fail(400, { message: 'Missing id or body.' });
    const { error } = await supabase
      .from('customer_notes')
      .update({ body, pinned: form.get('pinned') === 'on' })
      .eq('id', id)
      .eq('customer_id', params.id);
    if (error) return fail(400, { message: error.message });
    return { saved: true };
  },

  togglePinned: async ({ params, request, locals: { supabase } }) => {
    const form = await request.formData();
    const id = String(form.get('id') ?? '');
    const pinned = form.get('pinned') === 'true';
    const { error } = await supabase
      .from('customer_notes')
      .update({ pinned: !pinned })
      .eq('id', id)
      .eq('customer_id', params.id);
    if (error) return fail(400, { message: error.message });
    return { saved: true };
  },

  delete: async ({ params, request, locals: { supabase } }) => {
    const form = await request.formData();
    const id = String(form.get('id') ?? '');
    const { error } = await supabase
      .from('customer_notes')
      .delete()
      .eq('id', id)
      .eq('customer_id', params.id);
    if (error) return fail(400, { message: error.message });
    return { saved: true };
  }
};

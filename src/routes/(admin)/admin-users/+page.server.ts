import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { createSupabaseAdminClient } from '$lib/supabase.server';

export const load: PageServerLoad = async ({ locals: { supabase } }) => {
  const { data } = await supabase
    .from('user_profiles')
    .select('id, display_name, created_at, updated_at, deactivated_at')
    .eq('role', 'admin')
    .order('deactivated_at', { ascending: true, nullsFirst: true })
    .order('created_at', { ascending: false });

  return { admins: data ?? [] };
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const actions: Actions = {
  invite: async ({ request }) => {
    const form = await request.formData();
    const email = String(form.get('email') ?? '')
      .trim()
      .toLowerCase();
    const display_name = String(form.get('display_name') ?? '').trim();

    if (!email || !EMAIL_RE.test(email)) {
      return fail(400, { message: 'Enter a valid email address.', code: undefined });
    }

    const adminClient = createSupabaseAdminClient();
    const { error } = await adminClient.auth.admin.inviteUserByEmail(email, {
      data: { display_name: display_name || undefined, role: 'admin' }
    });

    if (error) {
      return fail(400, {
        message: error.message ?? 'Invite failed.',
        code: undefined
      });
    }
    return { saved: true, message: undefined, code: undefined };
  },

  deactivate: async ({ request, locals: { supabase, user } }) => {
    const form = await request.formData();
    const id = String(form.get('id') ?? '').trim();

    if (!id) return fail(400, { message: 'Missing user id.', code: undefined });
    if (!user) return fail(401, { message: 'Not signed in.', code: undefined });
    if (user.id === id) {
      return fail(400, { message: 'You cannot deactivate your own account.', code: undefined });
    }

    const { error } = await supabase
      .from('user_profiles')
      .update({ deactivated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      return fail(400, {
        message: error.message ?? 'Deactivate failed.',
        code: undefined
      });
    }
    return { saved: true, message: undefined, code: undefined };
  },

  delete: async ({ request, locals: { supabase, user } }) => {
    const form = await request.formData();
    const id = String(form.get('id') ?? '').trim();

    if (!id) return fail(400, { message: 'Missing user id.', code: undefined });
    if (!user) return fail(401, { message: 'Not signed in.', code: undefined });
    if (user.id === id) {
      return fail(400, { message: 'You cannot delete your own account.', code: undefined });
    }

    const { error } = await supabase.from('user_profiles').delete().eq('id', id);

    if (error) {
      return fail(400, {
        message: error.message ?? 'Delete failed.',
        code: undefined
      });
    }
    return { saved: true, message: undefined, code: undefined };
  }
};

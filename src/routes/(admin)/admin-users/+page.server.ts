import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { callApi } from '$lib/api';

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
  invite: async ({ request, locals }) => {
    const form = await request.formData();
    const email = String(form.get('email') ?? '').trim().toLowerCase();
    const display_name = String(form.get('display_name') ?? '').trim();

    if (!email || !EMAIL_RE.test(email)) {
      return fail(400, { message: 'Enter a valid email address.', code: undefined });
    }
    if (!locals.session) return fail(401, { message: 'Not signed in.', code: undefined });

    const res = await callApi({
      path: '/api/v1/admin/users/invite',
      method: 'POST',
      body: { email, display_name: display_name || undefined, role: 'admin' },
      accessToken: locals.session.access_token
    });

    if (!res.ok) {
      return fail(res.status || 500, {
        message: res.error?.message ?? 'Invite failed.',
        code: res.error?.code
      });
    }
    return { saved: true, message: undefined, code: undefined };
  },

  deactivate: async ({ request, locals }) => {
    const form = await request.formData();
    const id = String(form.get('id') ?? '').trim();

    if (!id) return fail(400, { message: 'Missing user id.', code: undefined });
    if (!locals.session) return fail(401, { message: 'Not signed in.', code: undefined });
    if (locals.user?.id === id) {
      return fail(400, { message: 'You cannot deactivate your own account.', code: undefined });
    }

    const res = await callApi({
      path: `/api/v1/admin/users/${id}/deactivate`,
      method: 'POST',
      accessToken: locals.session.access_token
    });

    if (!res.ok) {
      return fail(res.status || 500, {
        message: res.error?.message ?? 'Deactivate failed.',
        code: res.error?.code
      });
    }
    return { saved: true, message: undefined, code: undefined };
  }
};

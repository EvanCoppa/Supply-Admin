import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { createSupabaseAdminClient } from '$lib/supabase.server';

export const load: PageServerLoad = async ({ locals: { supabase } }) => {
  const { data } = await supabase
    .from('user_profiles')
    .select('id, display_name, role, created_at, updated_at, deactivated_at')
    .neq('role', 'customer')
    .order('deactivated_at', { ascending: true, nullsFirst: true })
    .order('created_at', { ascending: false });

  const profiles = data ?? [];
  const adminClient = createSupabaseAdminClient();
  const emails = new Map<string, string>();
  let page = 1;
  while (true) {
    const { data: list, error } = await adminClient.auth.admin.listUsers({ page, perPage: 200 });
    if (error || !list?.users.length) break;
    for (const u of list.users) if (u.email) emails.set(u.id, u.email);
    if (list.users.length < 200) break;
    page += 1;
  }

  const admins = profiles.map((p) => ({ ...p, email: emails.get(p.id) ?? null }));
  return { admins };
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const actions: Actions = {
  create: async ({ request }) => {
    const form = await request.formData();
    const email = String(form.get('email') ?? '')
      .trim()
      .toLowerCase();
    const display_name = String(form.get('display_name') ?? '').trim();
    const password = String(form.get('password') ?? '');
    const role = String(form.get('role') ?? 'admin').trim();

    const validRoles = ['admin', 'sales_rep', 'warehouse_staff', 'accounting', 'new_hire'];
    if (!validRoles.includes(role)) {
      return fail(400, { message: 'Invalid role selected.', code: undefined });
    }

    if (!email || !EMAIL_RE.test(email)) {
      return fail(400, { message: 'Enter a valid email address.', code: undefined });
    }
    if (password.length < 8) {
      return fail(400, { message: 'Password must be at least 8 characters.', code: undefined });
    }

    const adminClient = createSupabaseAdminClient();
    const { data: created, error } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: display_name || undefined, role }
    });

    if (error || !created.user) {
      return fail(400, {
        message: error?.message ?? 'Create failed.',
        code: undefined
      });
    }

    const { error: profileError } = await adminClient.from('user_profiles').insert({
      id: created.user.id,
      role,
      display_name: display_name || null
    });

    if (profileError) {
      await adminClient.auth.admin.deleteUser(created.user.id);
      return fail(400, {
        message: profileError.message ?? 'Create failed.',
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

  delete: async ({ request, locals: { user } }) => {
    const form = await request.formData();
    const id = String(form.get('id') ?? '').trim();

    if (!id) return fail(400, { message: 'Missing user id.', code: undefined });
    if (!user) return fail(401, { message: 'Not signed in.', code: undefined });
    if (user.id === id) {
      return fail(400, { message: 'You cannot delete your own account.', code: undefined });
    }

    const adminClient = createSupabaseAdminClient();

    const { error } = await adminClient.from('user_profiles').delete().eq('id', id);

    if (error) {
      return fail(400, {
        message: error.message ?? 'Delete failed.',
        code: undefined
      });
    }

    // Remove the underlying auth user so the email can be reused.
    const { error: authError } = await adminClient.auth.admin.deleteUser(id);
    if (authError) {
      return fail(400, {
        message: `Profile removed, but the auth account could not be deleted: ${authError.message}`,
        code: undefined
      });
    }

    return { saved: true, message: undefined, code: undefined };
  }
};

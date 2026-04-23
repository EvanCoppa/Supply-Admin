import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  if (locals.session) throw redirect(302, '/dashboard');
  return {};
};

export const actions: Actions = {
  default: async ({ request, locals }) => {
    const form = await request.formData();
    const email = String(form.get('email') ?? '').trim();
    const password = String(form.get('password') ?? '');
    if (!email || !password) {
      return fail(400, { error: 'Email and password are required.' });
    }

    const { data, error } = await locals.supabase.auth.signInWithPassword({
      email,
      password
    });
    if (error || !data.user) {
      return fail(401, { error: 'Invalid email or password.' });
    }

    const { data: profile } = await locals.supabase
      .from('user_profiles')
      .select('role')
      .eq('id', data.user.id)
      .maybeSingle();

    if (profile?.role !== 'admin') {
      await locals.supabase.auth.signOut();
      return fail(403, { error: 'This account is not an admin.' });
    }

    throw redirect(303, '/dashboard');
  }
};

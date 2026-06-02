import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
  const error = url.searchParams.get('error');
  const next = url.searchParams.get('next') ?? '/';
  return {
    errorCode: error,
    next
  };
};

export const actions: Actions = {
  login: async ({ request, locals: { supabase } }) => {
    const form = await request.formData();
    const email = String(form.get('email') ?? '').trim();
    const password = String(form.get('password') ?? '');
    const next = String(form.get('next') ?? '/');

    if (!email || !password) {
      return fail(400, { email, message: 'Email and password are required.' });
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) {
      return fail(401, { email, message: error?.message ?? 'Invalid credentials.' });
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role, deactivated_at')
      .eq('id', data.user.id)
      .maybeSingle();

    if (!profile) {
      await supabase.auth.signOut();
      return fail(403, { email, message: 'This account does not have application access.' });
    }

    if (profile.deactivated_at) {
      await supabase.auth.signOut();
      return fail(403, { email, message: 'This account has been deactivated.' });
    }

    if (profile.role === 'customer') {
      if (!profile.customer_id) {
        await supabase.auth.signOut();
        return fail(403, { email, message: 'This customer account is not linked to a business.' });
      }
      throw redirect(303, next.startsWith('/portal') ? next : '/portal/invoices');
    }

    // All staff roles (admin, sales_rep, accounting, warehouse_staff, new_hire) can sign in;
    // per-route access is enforced by the route guard in hooks.server.ts.
    throw redirect(303, next.startsWith('/') && !next.startsWith('/portal') ? next : '/');
  },

  reset: async ({ request, locals: { supabase }, url }) => {
    const form = await request.formData();
    const email = String(form.get('email') ?? '').trim();
    if (!email) return fail(400, { email, message: 'Enter your email to reset.' });

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${url.origin}/login`
    });
    if (error) return fail(400, { email, message: error.message });

    return { email, message: 'Password reset email sent.' };
  }
};

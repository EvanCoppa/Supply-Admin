import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, url }) => {
  if (!locals.session || !locals.user) {
    throw redirect(303, `/login?next=${encodeURIComponent(url.pathname)}`);
  }

  const { data: profile } = await locals.supabase
    .from('user_profiles')
    .select('role, display_name')
    .eq('id', locals.user.id)
    .maybeSingle();

  if (profile?.role !== 'admin') {
    await locals.supabase.auth.signOut();
    throw redirect(303, '/login');
  }

  return { profile };
};

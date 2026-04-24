import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { supabase } }) => {
  const { data } = await supabase
    .from('user_profiles')
    .select('id, display_name, created_at, updated_at')
    .eq('role', 'admin')
    .order('created_at', { ascending: false });

  return { admins: data ?? [] };
};

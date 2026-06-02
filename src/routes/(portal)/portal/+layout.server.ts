import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { createSupabaseAdminClient } from '$lib/supabase.server';

export const load: LayoutServerLoad = async ({ locals: { customerProfile } }) => {
  if (!customerProfile || customerProfile.deactivated_at) throw redirect(303, '/login');

  const adminSupabase = createSupabaseAdminClient();
  const { data: customer } = await adminSupabase
    .from('customers')
    .select('id, business_name, email, status')
    .eq('id', customerProfile.customer_id)
    .maybeSingle();

  if (customer?.status !== 'active') throw redirect(303, '/login?error=not_customer');

  return { customer };
};

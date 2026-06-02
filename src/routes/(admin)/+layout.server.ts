import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
  const adminRoles = ['admin', 'sales_rep', 'warehouse_staff', 'accounting', 'new_hire'];
  if (!locals.user || !adminRoles.includes(locals.profile?.role ?? '')) {
    throw redirect(303, '/login');
  }
  return {
    user: locals.user,
    profile: locals.profile
  };
};

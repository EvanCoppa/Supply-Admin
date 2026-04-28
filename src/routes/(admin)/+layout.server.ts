import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
  if (!locals.user || locals.profile?.role !== 'admin') {
    throw redirect(303, '/login');
  }
  return {
    user: locals.user,
    profile: locals.profile
  };
};

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  const supabase = locals.supabase;

  const { data: customers, error } = await supabase
    .from('customers')
    .select('id, business_name')
    .order('business_name');

  if (error) {
    console.error('Failed to fetch customers:', error);
    throw error;
  }

  return {
    customers: customers || []
  };
};

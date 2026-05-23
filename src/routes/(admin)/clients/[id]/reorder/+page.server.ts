import type { PageServerLoad } from './$types';
import { getReorderPlan, readReorderPlannerOptions } from '$lib/server/reorder-planner';

export const load: PageServerLoad = async ({ params, locals: { supabase }, url }) => {
  const options = readReorderPlannerOptions(url);
  const plan = await getReorderPlan(supabase, params.id, options);

  return {
    plan,
    filters: options
  };
};

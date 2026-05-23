import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createSupabaseAdminClient } from '$lib/supabase.server';
import { requireSupplyCustomer } from '$lib/server/supply-auth';
import { getReorderPlan, readReorderPlannerOptions } from '$lib/server/reorder-planner';

export const GET: RequestHandler = async ({ request, url }) => {
  const supabase = createSupabaseAdminClient();
  const { customerId } = await requireSupplyCustomer(request, supabase);
  const plan = await getReorderPlan(supabase, customerId, readReorderPlannerOptions(url));
  return json(plan);
};

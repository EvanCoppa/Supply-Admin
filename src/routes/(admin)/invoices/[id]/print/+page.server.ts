import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { loadInvoiceBundle } from '$lib/server/invoices';

export const load: PageServerLoad = async ({ params, locals: { supabase } }) => {
  const bundle = await loadInvoiceBundle(supabase, params.id);
  if (!bundle) throw error(404, 'Invoice not found');
  return bundle;
};

import { error, fail } from '@sveltejs/kit';
import { env as publicEnv } from '$env/dynamic/public';
import type { Actions, PageServerLoad } from './$types';
import type { Invoice } from '$lib/types/db';
import { createPaymentIntent, loadInvoiceBundle } from '$lib/server/invoices';
import { createSupabaseAdminClient } from '$lib/supabase.server';

export const load: PageServerLoad = async ({ params, locals: { profile, supabase } }) => {
  const customerId = profile?.customer_id;
  const bundle = await loadInvoiceBundle(supabase, params.id, customerId ?? undefined);
  if (!bundle || bundle.invoice.status === 'draft') throw error(404, 'Invoice not found');
  return bundle;
};

export const actions: Actions = {
  preparePayment: async ({ params, locals: { profile }, url }) => {
    const customerId = profile?.customer_id;
    const adminSupabase = createSupabaseAdminClient();
    const { data: invoice, error: invoiceError } = await adminSupabase
      .from('invoices')
      .select('*')
      .eq('id', params.id)
      .eq('customer_id', customerId)
      .neq('status', 'draft')
      .maybeSingle();
    if (invoiceError || !invoice) {
      return fail(404, { message: invoiceError?.message ?? 'Invoice not found.' });
    }

    try {
      const appUrl = publicEnv.PUBLIC_APP_URL || url.origin;
      await createPaymentIntent(adminSupabase, invoice as Invoice, appUrl, {
        created_by_role: 'customer'
      });
    } catch (err) {
      return fail(400, {
        message: err instanceof Error ? err.message : 'Payment could not be started.'
      });
    }

    return { saved: true, message: 'Payment request prepared.' };
  }
};

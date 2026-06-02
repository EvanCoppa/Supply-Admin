import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env as publicEnv } from '$env/dynamic/public';
import type { Invoice } from '$lib/types/db';
import { createPaymentIntent } from '$lib/server/invoices';
import { createSupabaseAdminClient } from '$lib/supabase.server';

export const POST: RequestHandler = async ({ params, locals, url }) => {
  const { profile, customerProfile } = locals;
  const isShopper = !!customerProfile && !customerProfile.deactivated_at;
  if (!profile && !isShopper) throw error(401, 'Not signed in.');
  if (profile && profile.role !== 'admin' && !isShopper) throw error(403, 'Forbidden.');

  const supabase = createSupabaseAdminClient();
  let query = supabase.from('invoices').select('*').eq('id', params.id);
  if (isShopper) query = query.eq('customer_id', customerProfile.customer_id);

  const { data: invoice, error: invoiceError } = await query.maybeSingle();
  if (invoiceError) throw error(500, invoiceError.message);
  if (!invoice) throw error(404, 'Invoice not found.');

  try {
    const appUrl = publicEnv['PUBLIC_APP_URL'] || url.origin;
    const intent = await createPaymentIntent(supabase, invoice as Invoice, appUrl, {
      created_by_role: isShopper ? 'customer' : 'admin'
    });
    return json({
      intent: {
        id: intent.id,
        amount: intent.amount,
        currency: intent.currency,
        status: intent.status,
        payment_url: intent.payment_url
      }
    });
  } catch (err) {
    throw error(400, err instanceof Error ? err.message : 'Payment intent failed.');
  }
};

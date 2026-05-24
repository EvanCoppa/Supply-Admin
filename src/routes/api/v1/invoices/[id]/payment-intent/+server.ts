import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { z } from 'zod';
import { env as publicEnv } from '$env/dynamic/public';
import type { Invoice } from '$lib/types/db';
import {
  chargeInvoice,
  createPaymentIntent,
  type ChargeInvoiceCredential
} from '$lib/server/invoices';
import { createSupabaseAdminClient } from '$lib/supabase.server';

const cardSchema = z.object({
  card_number: z.string().trim().min(12).max(19),
  expiration_date: z
    .string()
    .trim()
    .regex(/^\d{2}\/?\d{2}$/, 'expiration_date must be MMYY or MM/YY'),
  cvv: z.string().trim().min(3).max(4),
  name_on_card: z.string().trim().min(1).max(128).optional(),
  street: z.string().trim().min(1).max(128).optional(),
  zip_code: z.string().trim().min(3).max(16).optional()
});

const tokenSchema = z.object({ token: z.string().trim().min(1).max(128) });

const bodySchema = z.object({ payment: z.union([cardSchema, tokenSchema]).optional() }).optional();

export const POST: RequestHandler = async ({ params, locals, request, url }) => {
  const profile = locals.profile;
  if (!profile) throw error(401, 'Not signed in.');
  if (profile.role !== 'admin' && profile.role !== 'customer') throw error(403, 'Forbidden.');
  if (profile.role === 'customer' && !profile.customer_id)
    throw error(403, 'Customer profile is not linked.');

  const rawBody = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(rawBody ?? {});
  if (!parsed.success) {
    throw error(400, parsed.error.issues[0]?.message ?? 'Invalid payment payload');
  }
  const payment = parsed.data?.payment;

  const supabase = createSupabaseAdminClient();
  let query = supabase.from('invoices').select('*').eq('id', params.id);
  if (profile.role === 'customer') query = query.eq('customer_id', profile.customer_id);

  const { data: invoice, error: invoiceError } = await query.maybeSingle();
  if (invoiceError) throw error(500, invoiceError.message);
  if (!invoice) throw error(404, 'Invoice not found.');

  if (payment) {
    let credential: ChargeInvoiceCredential;
    if ('token' in payment) {
      credential = { token: payment.token };
    } else {
      const card: ChargeInvoiceCredential = {
        cardNumber: payment.card_number,
        expirationDate: payment.expiration_date,
        cvv: payment.cvv
      };
      if (payment.name_on_card) card.nameOnCard = payment.name_on_card;
      if (payment.street) card.street = payment.street;
      if (payment.zip_code) card.zipCode = payment.zip_code;
      credential = card;
    }
    try {
      const result = await chargeInvoice(supabase, invoice as Invoice, credential, {
        created_by_role: profile.role
      });
      return json({
        intent: {
          id: result.intent.id,
          amount: result.intent.amount,
          currency: result.intent.currency,
          status: result.intent.status,
          provider: result.intent.provider,
          provider_reference: result.intent.provider_reference
        },
        invoice: {
          id: (invoice as Invoice).id,
          status: result.status,
          amount_paid: result.amountPaid
        }
      });
    } catch (err) {
      throw error(402, err instanceof Error ? err.message : 'Payment failed.');
    }
  }

  try {
    const appUrl = publicEnv['PUBLIC_APP_URL'] || url.origin;
    const intent = await createPaymentIntent(supabase, invoice as Invoice, appUrl, {
      created_by_role: profile.role
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

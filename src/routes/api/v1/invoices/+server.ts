import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createSupabaseAdminClient } from '$lib/supabase.server';
import { requireSupplyCustomer } from '$lib/server/supply-auth';
import type { Invoice, InvoiceStatus, InvoicePaymentStatus } from '$lib/types/db';

const ALLOWED_STATUSES: ReadonlySet<InvoiceStatus> = new Set([
  'draft',
  'issued',
  'paid',
  'partially_paid',
  'overdue',
  'void',
  'refunded'
] satisfies InvoiceStatus[]);

const ALLOWED_PAYMENT_STATUSES: ReadonlySet<InvoicePaymentStatus> = new Set([
  'not_started',
  'intent_created',
  'processing',
  'paid',
  'failed',
  'cancelled'
] satisfies InvoicePaymentStatus[]);

function toApiInvoice(invoice: Invoice) {
  return {
    id: invoice.id,
    invoice_number: invoice.invoice_number,
    order_id: invoice.order_id,
    status: invoice.status,
    payment_status: invoice.payment_status,
    subtotal: Number(invoice.subtotal ?? 0),
    tax: Number(invoice.tax ?? 0),
    shipping: Number(invoice.shipping ?? 0),
    discount: Number(invoice.discount ?? 0),
    total: Number(invoice.total ?? 0),
    amount_paid: Number(invoice.amount_paid ?? 0),
    amount_due: Math.max(Number(invoice.total ?? 0) - Number(invoice.amount_paid ?? 0), 0),
    terms: invoice.terms,
    issued_at: invoice.issued_at,
    due_at: invoice.due_at,
    paid_at: invoice.paid_at,
    sent_at: invoice.sent_at,
    billing_email: invoice.billing_email,
    customer_memo: invoice.customer_memo,
    payment_url: invoice.payment_url,
    created_at: invoice.created_at,
    updated_at: invoice.updated_at
  };
}

export const GET: RequestHandler = async ({ request, url }) => {
  const supabase = createSupabaseAdminClient();
  const { customerId } = await requireSupplyCustomer(request, supabase);

  const limit = Math.min(Math.max(Number(url.searchParams.get('limit') ?? '24') || 24, 1), 100);
  const offset = Math.max(Number(url.searchParams.get('cursor') ?? '0') || 0, 0);
  const status = (url.searchParams.get('status') ?? '').trim() as InvoiceStatus | '';
  const paymentStatus = (url.searchParams.get('payment_status') ?? '').trim() as
    | InvoicePaymentStatus
    | '';

  if (status && !ALLOWED_STATUSES.has(status)) {
    throw error(400, `Invalid status: ${status}`);
  }
  if (paymentStatus && !ALLOWED_PAYMENT_STATUSES.has(paymentStatus)) {
    throw error(400, `Invalid payment_status: ${paymentStatus}`);
  }

  let query = supabase
    .from('invoices')
    .select('*')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) query = query.eq('status', status);
  if (paymentStatus) query = query.eq('payment_status', paymentStatus);

  const { data, error: invoiceError } = await query;
  if (invoiceError) {
    console.error('[supply-api] invoice list failed', invoiceError);
    throw error(500, 'Failed to fetch invoices');
  }

  const rows = (data ?? []) as Invoice[];
  return json({
    items: rows.map(toApiInvoice),
    next_cursor: rows.length === limit ? String(offset + limit) : null
  });
};

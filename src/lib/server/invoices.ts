import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  Invoice,
  InvoiceLineItem,
  InvoicePaymentIntent,
  InvoiceStatus,
  InvoiceTerms
} from '$lib/types/db';
import type { InvoiceLineInput } from '$lib/schemas/invoice';

type InvoiceWritable = Partial<Invoice> & {
  customer_id: string;
  order_id?: string | null;
};

export interface InvoiceTotals {
  subtotal: number;
  tax: number;
  shipping: number;
  discount: number;
  total: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function defaultDueDate(terms: InvoiceTerms | null | undefined, issuedAt = new Date()) {
  const daysByTerm: Record<InvoiceTerms, number> = {
    due_on_receipt: 0,
    net_15: 15,
    net_30: 30,
    net_60: 60,
    prepaid: 0
  };
  const days = daysByTerm[terms ?? 'net_30'] ?? 30;
  return new Date(issuedAt.getTime() + days * DAY_MS);
}

export function balanceDue(invoice: Pick<Invoice, 'total' | 'amount_paid'>) {
  return Math.max(0, roundMoney(Number(invoice.total) - Number(invoice.amount_paid)));
}

export function lineTotal(
  line: Pick<InvoiceLineInput, 'quantity' | 'unit_price' | 'discount' | 'tax'>
) {
  const base = Number(line.quantity) * Number(line.unit_price);
  return Math.max(0, roundMoney(base - Number(line.discount ?? 0) + Number(line.tax ?? 0)));
}

export function calculateInvoiceTotals(
  lines: Pick<InvoiceLineInput, 'quantity' | 'unit_price' | 'discount' | 'tax'>[],
  shipping = 0,
  headerDiscount = 0
): InvoiceTotals {
  const subtotal = roundMoney(
    lines.reduce((sum, line) => sum + Number(line.quantity) * Number(line.unit_price), 0)
  );
  const lineDiscount = roundMoney(lines.reduce((sum, line) => sum + Number(line.discount ?? 0), 0));
  const tax = roundMoney(lines.reduce((sum, line) => sum + Number(line.tax ?? 0), 0));
  const discount = roundMoney(Number(headerDiscount ?? 0));
  const total = Math.max(0, roundMoney(subtotal - discount + tax + Number(shipping ?? 0)));
  const totalWithLineDiscounts = Math.max(0, roundMoney(total - lineDiscount));
  return {
    subtotal,
    tax,
    shipping: roundMoney(Number(shipping ?? 0)),
    discount,
    total: totalWithLineDiscounts
  };
}

export function normalizeInvoiceLines(lines: InvoiceLineInput[]) {
  return lines.map((line, index) => ({
    order_line_item_id: line.order_line_item_id ?? null,
    product_id: line.product_id ?? null,
    product_sku_snapshot: line.product_sku_snapshot?.trim() || null,
    product_name_snapshot: line.product_name_snapshot?.trim() || null,
    description: line.description.trim(),
    quantity: roundMoney(Number(line.quantity)),
    unit_price: roundMoney(Number(line.unit_price)),
    discount: roundMoney(Number(line.discount ?? 0)),
    tax: roundMoney(Number(line.tax ?? 0)),
    line_total: lineTotal(line),
    display_order: index
  }));
}

export function statusAfterPayment(
  invoice: Pick<Invoice, 'total'>,
  amountPaid: number
): InvoiceStatus {
  return amountPaid >= Number(invoice.total) ? 'paid' : 'partially_paid';
}

export async function createInvoiceWithLines(
  supabase: SupabaseClient,
  invoice: InvoiceWritable,
  lines: InvoiceLineInput[],
  options: { shipping?: number; discount?: number } = {}
) {
  const normalizedLines = normalizeInvoiceLines(lines);
  const totals = calculateInvoiceTotals(
    normalizedLines,
    options.shipping ?? invoice.shipping ?? 0,
    options.discount ?? 0
  );

  const { data: created, error: invoiceError } = await supabase
    .from('invoices')
    .insert({
      ...invoice,
      subtotal: totals.subtotal,
      tax: totals.tax,
      shipping: totals.shipping,
      discount: totals.discount,
      total: totals.total,
      amount_paid: invoice.amount_paid ?? 0
    })
    .select('*')
    .single();

  if (invoiceError || !created) throw new Error(invoiceError?.message ?? 'Invoice create failed.');

  const { error: lineError } = await supabase.from('invoice_line_items').insert(
    normalizedLines.map((line) => ({
      ...line,
      invoice_id: created.id
    }))
  );

  if (lineError) {
    await supabase.from('invoices').delete().eq('id', created.id);
    throw new Error(lineError.message);
  }

  return created as Invoice;
}

export async function replaceInvoiceLines(
  supabase: SupabaseClient,
  invoiceId: string,
  lines: InvoiceLineInput[],
  options: { shipping?: number; discount?: number }
) {
  const normalizedLines = normalizeInvoiceLines(lines);
  const totals = calculateInvoiceTotals(
    normalizedLines,
    options.shipping ?? 0,
    options.discount ?? 0
  );

  const { error: deleteError } = await supabase
    .from('invoice_line_items')
    .delete()
    .eq('invoice_id', invoiceId);
  if (deleteError) throw new Error(deleteError.message);

  const { error: insertError } = await supabase.from('invoice_line_items').insert(
    normalizedLines.map((line) => ({
      ...line,
      invoice_id: invoiceId
    }))
  );
  if (insertError) throw new Error(insertError.message);

  const { error: updateError } = await supabase
    .from('invoices')
    .update({
      subtotal: totals.subtotal,
      tax: totals.tax,
      shipping: totals.shipping,
      discount: totals.discount,
      total: totals.total
    })
    .eq('id', invoiceId);
  if (updateError) throw new Error(updateError.message);

  return totals;
}

export async function loadInvoiceBundle(
  supabase: SupabaseClient,
  invoiceId: string,
  customerId?: string
) {
  let invoiceQuery = supabase
    .from('invoices')
    .select('*, customer:customers(id, business_name, email, primary_contact_name)')
    .eq('id', invoiceId);
  if (customerId) invoiceQuery = invoiceQuery.eq('customer_id', customerId);

  const [invoiceRes, linesRes, emailRes, paymentRes] = await Promise.all([
    invoiceQuery.maybeSingle(),
    supabase
      .from('invoice_line_items')
      .select('*')
      .eq('invoice_id', invoiceId)
      .order('display_order', { ascending: true }),
    supabase
      .from('invoice_email_events')
      .select('*')
      .eq('invoice_id', invoiceId)
      .order('created_at', { ascending: false }),
    supabase
      .from('invoice_payment_intents')
      .select('*')
      .eq('invoice_id', invoiceId)
      .order('created_at', { ascending: false })
  ]);

  if (invoiceRes.error) throw new Error(invoiceRes.error.message);
  if (!invoiceRes.data) return null;

  return {
    invoice: invoiceRes.data as Invoice & {
      customer: {
        id: string;
        business_name: string;
        email: string | null;
        primary_contact_name: string | null;
      } | null;
    },
    lines: (linesRes.data ?? []) as InvoiceLineItem[],
    emailEvents: emailRes.data ?? [],
    paymentIntents: (paymentRes.data ?? []) as InvoicePaymentIntent[]
  };
}

export async function createPaymentIntent(
  supabase: SupabaseClient,
  invoice: Invoice,
  appUrl: string,
  metadata: Record<string, unknown> = {}
) {
  const amount = balanceDue(invoice);
  if (amount <= 0) throw new Error('Invoice does not have a balance due.');
  if (['void', 'refunded'].includes(invoice.status)) {
    throw new Error('This invoice cannot be paid.');
  }

  const providerReference = `manual_${crypto.randomUUID()}`;
  const paymentUrl = `${appUrl.replace(/\/$/, '')}/portal/invoices/${invoice.id}?intent=${providerReference}`;

  const { data, error } = await supabase
    .from('invoice_payment_intents')
    .insert({
      invoice_id: invoice.id,
      customer_id: invoice.customer_id,
      amount,
      currency: 'usd',
      status: 'created',
      provider: 'manual_api',
      provider_reference: providerReference,
      payment_url: paymentUrl,
      metadata
    })
    .select('*')
    .single();

  if (error || !data) throw new Error(error?.message ?? 'Payment intent create failed.');

  const { error: updateError } = await supabase
    .from('invoices')
    .update({
      payment_url: paymentUrl,
      payment_status: 'intent_created'
    })
    .eq('id', invoice.id);
  if (updateError) throw new Error(updateError.message);

  return data as InvoicePaymentIntent;
}

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createSupabaseAdminClient } from '$lib/supabase.server';
import { requireSupplyCustomer } from '$lib/server/supply-auth';
import type { Invoice, InvoiceLineItem } from '$lib/types/db';

export const GET: RequestHandler = async ({ request, params }) => {
  const supabase = createSupabaseAdminClient();
  const { customerId } = await requireSupplyCustomer(request, supabase);

  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .select('*')
    .eq('id', params.id)
    .eq('customer_id', customerId)
    .maybeSingle();

  if (invoiceError) {
    console.error('[supply-api] invoice fetch failed', invoiceError);
    throw error(500, 'Failed to fetch invoice');
  }
  if (!invoice) throw error(404, 'Invoice not found');

  const { data: lines, error: linesError } = await supabase
    .from('invoice_line_items')
    .select('*')
    .eq('invoice_id', params.id)
    .order('display_order', { ascending: true });

  if (linesError) {
    console.error('[supply-api] invoice lines fetch failed', linesError);
    throw error(500, 'Failed to fetch invoice line items');
  }

  const inv = invoice as Invoice;
  return json({
    invoice: {
      id: inv.id,
      invoice_number: inv.invoice_number,
      order_id: inv.order_id,
      status: inv.status,
      payment_status: inv.payment_status,
      subtotal: Number(inv.subtotal ?? 0),
      tax: Number(inv.tax ?? 0),
      shipping: Number(inv.shipping ?? 0),
      discount: Number(inv.discount ?? 0),
      total: Number(inv.total ?? 0),
      amount_paid: Number(inv.amount_paid ?? 0),
      amount_due: Math.max(Number(inv.total ?? 0) - Number(inv.amount_paid ?? 0), 0),
      terms: inv.terms,
      issued_at: inv.issued_at,
      due_at: inv.due_at,
      paid_at: inv.paid_at,
      sent_at: inv.sent_at,
      billing_email: inv.billing_email,
      billing_address: inv.billing_address_snapshot,
      customer_memo: inv.customer_memo,
      notes: inv.notes,
      payment_url: inv.payment_url,
      created_at: inv.created_at,
      updated_at: inv.updated_at,
      line_items: ((lines ?? []) as InvoiceLineItem[]).map((line) => ({
        id: line.id,
        product_id: line.product_id,
        product_sku: line.product_sku_snapshot,
        product_name: line.product_name_snapshot,
        description: line.description,
        quantity: Number(line.quantity ?? 0),
        unit_price: Number(line.unit_price ?? 0),
        discount: Number(line.discount ?? 0),
        tax: Number(line.tax ?? 0),
        line_total: Number(line.line_total ?? 0),
        display_order: line.display_order
      }))
    }
  });
};

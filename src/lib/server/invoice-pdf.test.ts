import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import type { Invoice, InvoiceLineItem } from '$lib/types/db';
import { invoicePdfFilename, renderInvoicePdf } from './invoice-pdf';

function makeInvoice(overrides: Partial<Invoice> = {}) {
  return {
    id: 'inv-1',
    customer_id: 'cust-1',
    order_id: null,
    invoice_number: 'INV-2026-0001',
    status: 'issued',
    subtotal: 100,
    tax: 8.25,
    shipping: 12,
    discount: 5,
    total: 115.25,
    amount_paid: 0,
    terms: 'net_30',
    issued_at: '2026-06-01T00:00:00Z',
    due_at: '2026-07-01T00:00:00Z',
    paid_at: null,
    sent_at: null,
    last_reminded_at: null,
    billing_email: 'billing@example.com',
    billing_address_snapshot: null,
    customer_memo: null,
    internal_notes: null,
    notes: null,
    payment_url: null,
    payment_status: 'unpaid',
    created_at: '2026-06-01T00:00:00Z',
    updated_at: '2026-06-01T00:00:00Z',
    customer: {
      business_name: 'Bright Smiles Dental',
      email: 'office@example.com',
      primary_contact_name: 'Dana Vu'
    },
    ...overrides
  } as Invoice & {
    customer: { business_name: string; email: string | null; primary_contact_name: string | null };
  };
}

function makeLine(overrides: Partial<InvoiceLineItem> = {}): InvoiceLineItem {
  return {
    id: 'line-1',
    invoice_id: 'inv-1',
    order_line_item_id: null,
    product_id: null,
    product_sku_snapshot: 'SKU-100',
    product_name_snapshot: 'Nitrile Gloves (M)',
    description: 'Nitrile exam gloves, medium, box of 100',
    quantity: 4,
    unit_price: 25,
    discount: 5,
    tax: 8.25,
    line_total: 103.25,
    display_order: 0,
    created_at: '2026-06-01T00:00:00Z',
    updated_at: '2026-06-01T00:00:00Z',
    ...overrides
  };
}

describe('renderInvoicePdf', () => {
  it('produces a valid single-page PDF for a typical invoice', async () => {
    const bytes = await renderInvoicePdf({ invoice: makeInvoice(), lines: [makeLine()] });
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-');

    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
    expect(doc.getTitle()).toBe('Invoice INV-2026-0001');
  });

  it('flows long invoices onto additional pages', async () => {
    const lines = Array.from({ length: 80 }, (_, i) =>
      makeLine({
        id: `line-${i}`,
        description: `Line item ${i} with a reasonably long description`,
        display_order: i
      })
    );
    const bytes = await renderInvoicePdf({ invoice: makeInvoice(), lines });

    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBeGreaterThan(1);
  });

  it('survives characters outside WinAnsi encoding', async () => {
    const invoice = makeInvoice({
      customer_memo: 'Curly “quotes”, em—dash, ellipsis…, emoji 🦷 and CJK 歯科'
    });
    const lines = [makeLine({ description: 'Gloves — nitrile 🧤 “premium”' })];

    const bytes = await renderInvoicePdf({ invoice, lines });
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-');
  });

  it('handles an invoice with no line items', async () => {
    const bytes = await renderInvoicePdf({ invoice: makeInvoice(), lines: [] });
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
  });
});

describe('invoicePdfFilename', () => {
  it('uses the invoice number', () => {
    expect(invoicePdfFilename({ invoice_number: 'INV-2026-0001' })).toBe(
      'invoice-INV-2026-0001.pdf'
    );
  });

  it('strips characters that are unsafe in filenames', () => {
    expect(invoicePdfFilename({ invoice_number: 'INV 2026/00:01"' })).toBe(
      'invoice-INV-2026-00-01-.pdf'
    );
  });
});

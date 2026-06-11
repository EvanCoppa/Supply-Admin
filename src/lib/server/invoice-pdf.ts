import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import type { Invoice, InvoiceLineItem } from '$lib/types/db';
import { balanceDue } from './invoices';

export interface InvoicePdfInput {
  invoice: Invoice & {
    customer?: {
      business_name: string;
      email: string | null;
      primary_contact_name?: string | null;
    } | null;
  };
  lines: InvoiceLineItem[];
}

const PAGE_WIDTH = 612; // US Letter
const PAGE_HEIGHT = 792;
const MARGIN = 54;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

const SLATE_900 = rgb(0.06, 0.09, 0.16);
const SLATE_500 = rgb(0.39, 0.45, 0.55);
const SLATE_300 = rgb(0.8, 0.84, 0.88);
const SKY_700 = rgb(0.01, 0.41, 0.56);
const RED_700 = rgb(0.73, 0.11, 0.11);

const TERMS_LABEL: Record<string, string> = {
  due_on_receipt: 'Due on receipt',
  net_15: 'Net 15',
  net_30: 'Net 30',
  net_60: 'Net 60',
  prepaid: 'Prepaid'
};

const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft',
  issued: 'Issued',
  paid: 'Paid',
  partially_paid: 'Partially paid',
  overdue: 'Overdue',
  void: 'Void',
  refunded: 'Refunded'
};

const currencyFormat = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

function money(value: number | string | null | undefined) {
  const n = Number(value ?? 0);
  return currencyFormat.format(Number.isNaN(n) ? 0 : n);
}

function dateShort(value: string | null | undefined) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

// Standard PDF fonts only encode WinAnsi; swap common typographic characters
// and drop the rest so encoding never throws on user-entered text.
function sanitizeText(value: string) {
  return value
    .replaceAll('\u2013', '-')
    .replaceAll(/[\u2018\u2019]/g, "'")
    .replaceAll(/[\u201C\u201D]/g, '"')
    .replaceAll('\u2026', '...')
    .replaceAll('\u00A0', ' ')
    .replaceAll(/[^\x20-\x7E\xA1-\xFF\u2014]/g, '')
    .trim();
}

export function invoicePdfFilename(invoice: Pick<Invoice, 'invoice_number'>) {
  const safe = invoice.invoice_number.replaceAll(/[^A-Za-z0-9._-]/g, '-');
  return `invoice-${safe}.pdf`;
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = sanitizeText(text).split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth || !current) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

interface RenderContext {
  doc: PDFDocument;
  page: PDFPage;
  y: number;
  font: PDFFont;
  bold: PDFFont;
}

// Line item table column layout: x is the left edge (or right edge for
// right-aligned numeric columns), measured from the page's left margin.
const COLS = {
  sku: { x: 0, width: 64 },
  description: { x: 72, width: 178 },
  qty: { right: 290 },
  unit: { right: 348 },
  discount: { right: 410 },
  tax: { right: 458 },
  total: { right: CONTENT_WIDTH }
};

function drawRightAligned(
  ctx: RenderContext,
  text: string,
  rightEdge: number,
  size: number,
  options: { font?: PDFFont; color?: ReturnType<typeof rgb> } = {}
) {
  const font = options.font ?? ctx.font;
  const width = font.widthOfTextAtSize(text, size);
  ctx.page.drawText(text, {
    x: MARGIN + rightEdge - width,
    y: ctx.y,
    size,
    font,
    color: options.color ?? SLATE_900
  });
}

function drawRule(ctx: RenderContext, yOffset = 0, color = SLATE_300) {
  ctx.page.drawLine({
    start: { x: MARGIN, y: ctx.y + yOffset },
    end: { x: PAGE_WIDTH - MARGIN, y: ctx.y + yOffset },
    thickness: 0.75,
    color
  });
}

function addPage(ctx: RenderContext) {
  ctx.page = ctx.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  ctx.y = PAGE_HEIGHT - MARGIN;
}

function ensureRoom(ctx: RenderContext, needed: number) {
  if (ctx.y - needed < MARGIN) {
    addPage(ctx);
    return true;
  }
  return false;
}

function drawTableHeader(ctx: RenderContext) {
  drawRule(ctx, 12);
  const size = 7.5;
  const draw = (text: string, x: number) =>
    ctx.page.drawText(text, { x: MARGIN + x, y: ctx.y, size, font: ctx.bold, color: SLATE_500 });
  draw('ITEM', COLS.sku.x);
  draw('DESCRIPTION', COLS.description.x);
  drawRightAligned(ctx, 'QTY', COLS.qty.right, size, { font: ctx.bold, color: SLATE_500 });
  drawRightAligned(ctx, 'UNIT', COLS.unit.right, size, { font: ctx.bold, color: SLATE_500 });
  drawRightAligned(ctx, 'DISCOUNT', COLS.discount.right, size, {
    font: ctx.bold,
    color: SLATE_500
  });
  drawRightAligned(ctx, 'TAX', COLS.tax.right, size, { font: ctx.bold, color: SLATE_500 });
  drawRightAligned(ctx, 'TOTAL', COLS.total.right, size, { font: ctx.bold, color: SLATE_500 });
  drawRule(ctx, -6);
  ctx.y -= 22;
}

function drawLineItem(ctx: RenderContext, line: InvoiceLineItem) {
  const size = 9;
  const lineHeight = 12;
  const descriptionLines = wrapText(line.description, ctx.font, size, COLS.description.width);
  const subtitle =
    line.product_name_snapshot && line.product_name_snapshot !== line.description
      ? wrapText(line.product_name_snapshot, ctx.font, 7.5, COLS.description.width)
      : [];
  const skuLines = line.product_sku_snapshot
    ? wrapText(line.product_sku_snapshot, ctx.font, 7.5, COLS.sku.width)
    : [];
  const rowHeight =
    Math.max(descriptionLines.length * lineHeight + subtitle.length * 10, skuLines.length * 10) + 8;

  if (ensureRoom(ctx, rowHeight + 20)) drawTableHeader(ctx);

  const top = ctx.y;
  skuLines.forEach((text, i) => {
    ctx.page.drawText(text, {
      x: MARGIN + COLS.sku.x,
      y: top - i * 10,
      size: 7.5,
      font: ctx.font,
      color: SLATE_500
    });
  });
  descriptionLines.forEach((text, i) => {
    ctx.page.drawText(text, {
      x: MARGIN + COLS.description.x,
      y: top - i * lineHeight,
      size,
      font: ctx.font,
      color: SLATE_900
    });
  });
  subtitle.forEach((text, i) => {
    ctx.page.drawText(text, {
      x: MARGIN + COLS.description.x,
      y: top - descriptionLines.length * lineHeight - i * 10,
      size: 7.5,
      font: ctx.font,
      color: SLATE_500
    });
  });

  drawRightAligned(ctx, String(Number(line.quantity)), COLS.qty.right, size);
  drawRightAligned(ctx, money(line.unit_price), COLS.unit.right, size);
  drawRightAligned(ctx, money(line.discount), COLS.discount.right, size);
  drawRightAligned(ctx, money(line.tax), COLS.tax.right, size);
  drawRightAligned(ctx, money(line.line_total), COLS.total.right, size, { font: ctx.bold });

  ctx.y -= rowHeight;
}

function drawTotals(ctx: RenderContext, invoice: InvoicePdfInput['invoice']) {
  const labelRight = COLS.total.right - 110;
  const size = 9;
  const row = (
    label: string,
    value: string,
    options: { bold?: boolean; color?: ReturnType<typeof rgb>; rule?: boolean } = {}
  ) => {
    ensureRoom(ctx, 16);
    if (options.rule) {
      ctx.page.drawLine({
        start: { x: MARGIN + labelRight - 60, y: ctx.y + 5 },
        end: { x: PAGE_WIDTH - MARGIN, y: ctx.y + 5 },
        thickness: 0.75,
        color: SLATE_300
      });
    }
    drawRightAligned(ctx, label, labelRight, size, {
      font: options.bold ? ctx.bold : ctx.font,
      color: options.color ?? (options.bold ? SLATE_900 : SLATE_500)
    });
    drawRightAligned(ctx, value, COLS.total.right, size, {
      font: options.bold ? ctx.bold : ctx.font,
      color: options.color ?? SLATE_900
    });
    ctx.y -= 15;
  };

  const balance = balanceDue(invoice);
  row('Subtotal', money(invoice.subtotal));
  row('Discount', money(invoice.discount));
  row('Tax', money(invoice.tax));
  row('Shipping', money(invoice.shipping));
  row('Total', money(invoice.total), { bold: true, rule: true });
  if (Number(invoice.amount_paid) > 0) row('Paid', money(invoice.amount_paid));
  row('Balance due', money(balance), {
    bold: true,
    rule: true,
    color: balance > 0 ? RED_700 : SLATE_900
  });
}

export async function renderInvoicePdf(input: InvoicePdfInput): Promise<Uint8Array> {
  const { invoice, lines } = input;
  const doc = await PDFDocument.create();
  doc.setTitle(`Invoice ${invoice.invoice_number}`);
  doc.setAuthor('Evolution Supply');

  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const ctx: RenderContext = {
    doc,
    page: doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]),
    y: 0,
    font,
    bold
  };
  ctx.y = PAGE_HEIGHT - MARGIN - 10;

  // Header
  ctx.page.drawText('EVOLUTION SUPPLY', {
    x: MARGIN,
    y: ctx.y,
    size: 9,
    font: bold,
    color: SKY_700
  });
  drawRightAligned(ctx, 'INVOICE #', COLS.total.right, 7.5, { font: bold, color: SLATE_500 });
  ctx.y -= 24;
  ctx.page.drawText('Invoice', { x: MARGIN, y: ctx.y, size: 22, font: bold, color: SLATE_900 });
  drawRightAligned(ctx, sanitizeText(invoice.invoice_number), COLS.total.right, 12, {
    font: bold
  });
  ctx.y -= 16;
  drawRightAligned(ctx, STATUS_LABEL[invoice.status] ?? invoice.status, COLS.total.right, 9, {
    color: SLATE_500
  });
  ctx.y -= 14;
  drawRule(ctx);
  ctx.y -= 24;

  // Bill-to (left) and dates (right)
  const blockTop = ctx.y;
  ctx.page.drawText('BILL TO', { x: MARGIN, y: ctx.y, size: 7.5, font: bold, color: SLATE_500 });
  ctx.y -= 13;
  const billTo = [
    invoice.customer?.business_name ?? '—',
    invoice.customer?.primary_contact_name ?? null,
    invoice.billing_email ?? invoice.customer?.email ?? null
  ].filter((value): value is string => Boolean(value));
  billTo.forEach((text, i) => {
    ctx.page.drawText(sanitizeText(text), {
      x: MARGIN,
      y: ctx.y,
      size: 9,
      font: i === 0 ? bold : font,
      color: i === 0 ? SLATE_900 : SLATE_500
    });
    ctx.y -= 13;
  });
  const billToBottom = ctx.y;

  ctx.y = blockTop;
  const meta: [string, string][] = [
    ['Issued', dateShort(invoice.issued_at)],
    ['Due', dateShort(invoice.due_at)],
    ['Terms', (invoice.terms && TERMS_LABEL[invoice.terms]) ?? invoice.terms ?? '—']
  ];
  for (const [label, value] of meta) {
    drawRightAligned(ctx, label, COLS.total.right - 90, 9, { color: SLATE_500 });
    drawRightAligned(ctx, sanitizeText(value), COLS.total.right, 9);
    ctx.y -= 13;
  }
  ctx.y = Math.min(billToBottom, ctx.y) - 16;

  // Line items
  drawTableHeader(ctx);
  for (const line of lines) drawLineItem(ctx, line);
  drawRule(ctx, 8);
  ctx.y -= 14;

  // Totals
  ensureRoom(ctx, 130);
  drawTotals(ctx, invoice);

  // Memo
  if (invoice.customer_memo) {
    ctx.y -= 10;
    const memoLines = wrapText(invoice.customer_memo, font, 9, CONTENT_WIDTH);
    ensureRoom(ctx, 20 + memoLines.length * 12);
    ctx.page.drawText('NOTES', { x: MARGIN, y: ctx.y, size: 7.5, font: bold, color: SLATE_500 });
    ctx.y -= 13;
    for (const text of memoLines) {
      ensureRoom(ctx, 12);
      ctx.page.drawText(text, { x: MARGIN, y: ctx.y, size: 9, font, color: SLATE_900 });
      ctx.y -= 12;
    }
  }

  // Footer
  ensureRoom(ctx, 30);
  ctx.y -= 18;
  drawRule(ctx, 10);
  ctx.page.drawText('Thank you for your business.', {
    x: MARGIN,
    y: ctx.y,
    size: 8,
    font,
    color: SLATE_500
  });

  return doc.save();
}

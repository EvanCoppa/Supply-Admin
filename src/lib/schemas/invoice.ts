import { z } from 'zod';
import { optionalNumber, optionalTrimmed, requiredNumber, requiredTrimmed } from './helpers';

export const INVOICE_STATUSES = [
  'draft',
  'issued',
  'paid',
  'partially_paid',
  'overdue',
  'void',
  'refunded'
] as const;

export const INVOICE_TERMS = ['due_on_receipt', 'net_15', 'net_30', 'net_60', 'prepaid'] as const;

const optionalEmail = optionalTrimmed.refine(
  (v) => v === null || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
  { message: 'Invalid email address.' }
);

const optionalDate = optionalTrimmed.refine((v) => v === null || !Number.isNaN(Date.parse(v)), {
  message: 'Invalid date.'
});

const money = z.coerce.number().finite().nonnegative();

export const invoiceLineInputSchema = z.object({
  id: z.string().uuid().optional().nullable(),
  order_line_item_id: z.string().uuid().optional().nullable(),
  product_id: z.string().uuid().optional().nullable(),
  product_sku_snapshot: z.string().trim().optional().nullable(),
  product_name_snapshot: z.string().trim().optional().nullable(),
  description: z.string().trim().min(1, 'Line description is required.'),
  quantity: z.coerce.number().finite().positive('Quantity must be positive.'),
  unit_price: money,
  discount: money.default(0),
  tax: money.default(0)
});

export type InvoiceLineInput = z.infer<typeof invoiceLineInputSchema>;

export const invoiceCreateSchema = z.object({
  customer_id: requiredTrimmed('Customer is required.'),
  terms: z.enum(INVOICE_TERMS).default('net_30'),
  due_at: optionalDate,
  billing_email: optionalEmail,
  customer_memo: optionalTrimmed,
  internal_notes: optionalTrimmed,
  shipping: optionalNumber.transform((v) => v ?? 0),
  discount: optionalNumber.transform((v) => v ?? 0),
  issue_now: z.union([z.string(), z.undefined()]).transform((v) => v === 'on' || v === 'true'),
  line_items_json: requiredTrimmed('Add at least one invoice line.')
});

export const invoiceUpdateSchema = invoiceCreateSchema.omit({ customer_id: true }).extend({
  status: z.enum(INVOICE_STATUSES).optional()
});

export const invoiceFromOrderSchema = z.object({
  order_id: requiredTrimmed('Pick an order.'),
  terms: z.enum(INVOICE_TERMS).default('net_30'),
  due_days: requiredNumber('Due days must be a number.').refine((v) => v >= 0 && v <= 365, {
    message: 'Due days must be between 0 and 365.'
  }),
  billing_email: optionalEmail,
  customer_memo: optionalTrimmed,
  internal_notes: optionalTrimmed,
  issue_now: z.union([z.string(), z.undefined()]).transform((v) => v !== 'false')
});

export const invoiceStatusSchema = z.object({
  status: z.enum(INVOICE_STATUSES)
});

export const invoicePaymentRecordSchema = z.object({
  amount: requiredNumber('Payment amount must be a number.').refine((v) => v > 0, {
    message: 'Payment amount must be positive.'
  })
});

export const invoiceSendSchema = z.object({
  recipient: optionalEmail,
  reminder: z.union([z.string(), z.undefined()]).transform((v) => v === 'on' || v === 'true')
});

export function parseInvoiceLineItems(raw: string): InvoiceLineInput[] {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new Error('Invoice lines must be valid JSON.');
  }

  const result = z.array(invoiceLineInputSchema).min(1, 'Add at least one invoice line.').safeParse(json);
  if (!result.success) {
    throw new Error(result.error.issues[0]?.message ?? 'Invalid invoice line item.');
  }

  return result.data;
}

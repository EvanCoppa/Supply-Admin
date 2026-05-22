import { z } from 'zod';
import { optionalNumber, optionalTrimmed, requiredNumber, requiredTrimmed } from './helpers';

export const PURCHASE_STATUSES = ['draft', 'ordered', 'received', 'cancelled'] as const;
export const PURCHASE_PAYMENT_STATUSES = ['unpaid', 'partial', 'paid'] as const;

const optionalDate = optionalTrimmed.refine((v) => v === null || !Number.isNaN(Date.parse(v)), {
  message: 'Invalid date.'
});

const optionalDateOnly = optionalTrimmed.refine(
  (v) => v === null || /^\d{4}-\d{2}-\d{2}$/.test(v),
  { message: 'Use YYYY-MM-DD.' }
);

const money = z.coerce.number().finite().nonnegative();

const optionalUuid = optionalTrimmed.refine(
  (v) => v === null || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v),
  { message: 'Invalid id.' }
);

export const purchaseCreateSchema = z.object({
  supplier_id: requiredTrimmed('Supplier is required.'),
  order_id: optionalUuid,
  ordered_at: optionalDate,
  received_at: optionalDate,
  subtotal: requiredNumber('Subtotal must be a number.').refine((v) => v >= 0, {
    message: 'Subtotal must be ≥ 0.'
  }),
  freight: optionalNumber.transform((v) => v ?? 0),
  distribution_fee_pct: optionalNumber.transform((v) => (v ?? 0) / 100),
  tax: optionalNumber.transform((v) => v ?? 0),
  status: z.enum(PURCHASE_STATUSES).default('ordered'),
  payment_status: z.enum(PURCHASE_PAYMENT_STATUSES).default('unpaid'),
  due_date: optionalDateOnly,
  invoice_ref: optionalTrimmed,
  notes: optionalTrimmed
});

export const purchaseUpdateSchema = purchaseCreateSchema.partial({
  supplier_id: true,
  subtotal: true
});

export const purchaseMarkPaidSchema = z.object({
  paid_on: optionalDateOnly
});

export type PurchaseCreateInput = z.infer<typeof purchaseCreateSchema>;

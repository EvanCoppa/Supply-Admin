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

const optionalUuid = optionalTrimmed.refine(
  (v) => v === null || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v),
  { message: 'Invalid id.' }
);

const money = z.coerce.number().finite().nonnegative();

export const purchaseLineInputSchema = z.object({
  product_id: z.string().uuid().optional().nullable(),
  order_line_item_id: z.string().uuid().optional().nullable(),
  product_sku_snapshot: z.string().trim().optional().nullable(),
  product_name_snapshot: z.string().trim().optional().nullable(),
  description: z.string().trim().optional().nullable(),
  quantity: z.coerce.number().finite().positive('Quantity must be positive.'),
  unit_cost: money
});

export type PurchaseLineInput = z.infer<typeof purchaseLineInputSchema>;

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
  notes: optionalTrimmed,
  line_items_json: optionalTrimmed
});

export function parsePurchaseLineItems(raw: string | null | undefined): PurchaseLineInput[] {
  if (!raw) return [];
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new Error('Purchase lines must be valid JSON.');
  }
  const result = z.array(purchaseLineInputSchema).safeParse(json);
  if (!result.success) {
    throw new Error(result.error.issues[0]?.message ?? 'Invalid purchase line item.');
  }
  return result.data;
}

export const purchaseUpdateSchema = purchaseCreateSchema.partial({
  supplier_id: true,
  subtotal: true
});

export const purchaseMarkPaidSchema = z.object({
  paid_on: optionalDateOnly
});

export type PurchaseCreateInput = z.infer<typeof purchaseCreateSchema>;

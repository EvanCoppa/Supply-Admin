import { z } from 'zod';
import { optionalNumber, optionalTrimmed, requiredNumber, requiredTrimmed } from './helpers';

export const ORDER_STATUSES = [
  'pending_payment',
  'paid',
  'fulfilled',
  'shipped',
  'delivered',
  'cancelled',
  'refunded'
] as const;

export const ORDER_PAYMENT_METHODS = [
  'credit_card',
  'debit_card',
  'check',
  'ach',
  'wire_transfer',
  'cash',
  'other'
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const orderTransitionSchema = z.object({
  to: z.enum(ORDER_STATUSES, {
    errorMap: () => ({ message: 'Invalid target status.' })
  }),
  tracking: optionalTrimmed
});

export const orderRefundSchema = z.object({
  amount: z.union([z.string(), z.number(), z.undefined()]).transform((v, ctx) => {
    if (v === undefined || v === '' || v === null) return null;
    const n = typeof v === 'number' ? v : Number(v);
    if (!Number.isFinite(n) || n <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Refund amount must be positive.'
      });
      return z.NEVER;
    }
    return n;
  })
});

export const shippingRateRequestSchema = z.object({
  weight_oz: requiredNumber('Package weight is required.').refine((n) => n > 0, {
    message: 'Weight must be greater than 0.'
  })
});

export const buyLabelSchema = z.object({
  shipment_id: requiredTrimmed('Missing shipment reference — fetch rates again.'),
  rate_id: requiredTrimmed('Select a shipping rate.')
});

export const orderLineInputSchema = z.object({
  product_id: z.string().uuid().optional().nullable(),
  product_sku_snapshot: z.string().trim().optional().nullable(),
  product_name_snapshot: z.string().trim().min(1, 'Item name is required.'),
  quantity: z.coerce.number().finite().positive('Quantity must be positive.'),
  unit_price: z.coerce.number().finite().nonnegative('Unit price must be ≥ 0.')
});

export type OrderLineInput = z.infer<typeof orderLineInputSchema>;

export const adminOrderCreateSchema = z.object({
  customer_id: requiredTrimmed('Customer is required.'),
  status: z.enum(ORDER_STATUSES).default('pending_payment'),
  payment_method: optionalTrimmed,
  shipping_address_id: optionalTrimmed,
  shipping: optionalNumber.transform((v) => v ?? 0),
  notes: optionalTrimmed,
  line_items_json: optionalTrimmed
});

export function parseOrderLineItems(raw: string | null | undefined): OrderLineInput[] {
  if (!raw) return [];
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new Error('Order lines must be valid JSON.');
  }
  const result = z.array(orderLineInputSchema).safeParse(json);
  if (!result.success) {
    throw new Error(result.error.issues[0]?.message ?? 'Invalid order line item.');
  }
  return result.data;
}

export type AdminOrderCreateInput = z.infer<typeof adminOrderCreateSchema>;

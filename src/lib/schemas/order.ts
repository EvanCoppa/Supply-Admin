import { z } from 'zod';
import { optionalTrimmed } from './helpers';

export const ORDER_STATUSES = [
  'pending_payment',
  'paid',
  'fulfilled',
  'shipped',
  'delivered',
  'cancelled',
  'refunded'
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const orderTransitionSchema = z.object({
  to: z.enum(ORDER_STATUSES, {
    errorMap: () => ({ message: 'Invalid target status.' })
  }),
  tracking: optionalTrimmed
});

export const orderRefundSchema = z.object({
  amount: z
    .union([z.string(), z.number(), z.undefined()])
    .transform((v, ctx) => {
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

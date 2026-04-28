import { z } from 'zod';
import { optionalTrimmed } from './helpers';

export const REASON_CODES = [
  'receipt',
  'manual_adjustment',
  'cycle_count',
  'damage',
  'other'
] as const;

export type ReasonCode = (typeof REASON_CODES)[number];

export const inventoryAdjustSchema = z.object({
  delta: z.union([z.string(), z.number()]).transform((v, ctx) => {
    if (v === '' || v === null || v === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Delta must be a non-zero integer.'
      });
      return z.NEVER;
    }
    const n = typeof v === 'number' ? v : Number(v);
    if (!Number.isInteger(n) || n === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Delta must be a non-zero integer.'
      });
      return z.NEVER;
    }
    return n;
  }),
  reason: z.enum(REASON_CODES, {
    errorMap: () => ({ message: 'Select a reason code.' })
  }),
  notes: optionalTrimmed
});

export type InventoryAdjustInput = z.infer<typeof inventoryAdjustSchema>;

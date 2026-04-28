import { z } from 'zod';
import { optionalTrimmed } from './helpers';

const optionalNonNegativeNumber = z
  .union([z.string(), z.number(), z.undefined()])
  .transform((v, ctx) => {
    if (v === undefined || v === '' || v === null) return null;
    const n = typeof v === 'number' ? v : Number(v);
    if (!Number.isFinite(n)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Must be a number.' });
      return z.NEVER;
    }
    return n;
  });

export const pricingRuleSchema = z
  .object({
    scope: z.enum(['product', 'category'], {
      errorMap: () => ({ message: 'Choose a scope.' })
    }),
    product_id: optionalTrimmed,
    category_id: optionalTrimmed,
    override_type: z.enum(['absolute_price', 'percent_discount'], {
      errorMap: () => ({ message: 'Choose an override type.' })
    }),
    absolute_price: optionalNonNegativeNumber,
    percent_discount: optionalNonNegativeNumber,
    effective_start: optionalTrimmed,
    effective_end: optionalTrimmed
  })
  .superRefine((val, ctx) => {
    if (val.scope === 'product' && !val.product_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['product_id'],
        message: 'Pick a product.'
      });
    }
    if (val.scope === 'category' && !val.category_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['category_id'],
        message: 'Pick a category.'
      });
    }
    if (val.override_type === 'absolute_price') {
      if (val.absolute_price === null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['absolute_price'],
          message: 'Absolute price is required.'
        });
      } else if (val.absolute_price < 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['absolute_price'],
          message: 'Absolute price must be ≥ 0.'
        });
      }
    }
    if (val.override_type === 'percent_discount') {
      if (val.percent_discount === null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['percent_discount'],
          message: 'Percent discount is required.'
        });
      } else if (val.percent_discount < 0 || val.percent_discount > 100) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['percent_discount'],
          message: 'Percent discount must be between 0 and 100.'
        });
      }
    }
    if (val.effective_start && val.effective_end) {
      const start = Date.parse(val.effective_start);
      const end = Date.parse(val.effective_end);
      if (Number.isFinite(start) && Number.isFinite(end) && end < start) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['effective_end'],
          message: 'Effective end must be after start.'
        });
      }
    }
  });

export type PricingRuleInput = z.infer<typeof pricingRuleSchema>;

export const pricingPreviewSchema = z.object({
  product_id: z
    .string({ required_error: 'Pick a product to preview.' })
    .trim()
    .min(1, 'Pick a product to preview.')
});

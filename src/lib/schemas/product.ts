import { z } from 'zod';
import {
  enumWithDefault,
  optionalNumber,
  optionalTrimmed,
  requiredNumber,
  requiredTrimmed
} from './helpers';

export const PRODUCT_STATUSES = ['active', 'archived'] as const;

export const productSchema = z.object({
  sku: requiredTrimmed('SKU is required.'),
  name: requiredTrimmed('Name is required.'),
  description: optionalTrimmed,
  category_id: optionalTrimmed,
  manufacturer: optionalTrimmed,
  unit_of_measure: optionalTrimmed,
  pack_size: optionalNumber,
  base_price: requiredNumber('Base price is required.').refine((n) => n >= 0, {
    message: 'Base price must be ≥ 0.'
  }),
  tax_class: optionalTrimmed,
  weight_grams: optionalNumber,
  status: enumWithDefault(PRODUCT_STATUSES, 'active', 'Invalid status.')
});

export type ProductInput = z.infer<typeof productSchema>;

export const lowStockThresholdSchema = z.object({
  low_stock_threshold: requiredNumber('Threshold is required.').refine((n) => n >= 0, {
    message: 'Threshold must be ≥ 0.'
  })
});

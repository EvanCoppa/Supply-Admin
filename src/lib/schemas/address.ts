import { z } from 'zod';
import { checkbox, optionalTrimmed, requiredTrimmed } from './helpers';

export const addressSchema = z.object({
  label: optionalTrimmed,
  line1: requiredTrimmed('Line 1 is required.'),
  line2: optionalTrimmed,
  city: requiredTrimmed('City is required.'),
  region: requiredTrimmed('Region is required.'),
  postal_code: requiredTrimmed('Postal code is required.'),
  country: z
    .string({ required_error: 'Country is required.' })
    .transform((v) => v.trim().toUpperCase())
    .refine((v) => /^[A-Z]{2}$/.test(v), {
      message: 'Country must be a 2-letter ISO code.'
    }),
  is_default_shipping: checkbox
});

export type AddressInput = z.infer<typeof addressSchema>;

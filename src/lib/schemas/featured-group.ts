import { z } from 'zod';
import { optionalTrimmed, requiredTrimmed } from './helpers';

export const featuredGroupSchema = z.object({
  name: requiredTrimmed('Name is required.'),
  description: optionalTrimmed
});

export const featuredGroupProductSchema = z.object({
  product_id: requiredTrimmed('Pick a product.')
});

export const featuredGroupReorderSchema = z.object({
  product_id: requiredTrimmed('Pick a product.'),
  direction: z.enum(['up', 'down'], {
    errorMap: () => ({ message: 'Invalid direction.' })
  })
});

import { z } from 'zod';

export const customerProfileCreateSchema = z.object({
  email: z
    .string()
    .email()
    .transform((s) => s.trim().toLowerCase()),
  first_name: z.string().trim().min(1, 'First name is required'),
  last_name: z.string().trim().min(1, 'Last name is required'),
  phone: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((v) => (v ? v : null)),
  role: z.enum(['owner', 'buyer', 'viewer']).default('buyer'),
  is_primary: z.coerce.boolean().default(false)
});

export type CustomerProfileCreateInput = z.infer<typeof customerProfileCreateSchema>;

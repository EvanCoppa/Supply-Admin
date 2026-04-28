import { z } from 'zod';
import { enumWithDefault, optionalTrimmed, requiredTrimmed, stringArray } from './helpers';

export const CUSTOMER_STATUSES = ['active', 'suspended', 'archived'] as const;
export const LIFECYCLE_STAGES = [
  'lead',
  'prospect',
  'active',
  'at_risk',
  'churned'
] as const;

const optionalEmail = optionalTrimmed.refine(
  (v) => v === null || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
  { message: 'Invalid email address.' }
);

export const customerCreateSchema = z.object({
  business_name: requiredTrimmed('Business name is required.'),
  primary_contact_name: optionalTrimmed,
  email: optionalEmail,
  phone: optionalTrimmed
});

export const customerUpdateSchema = z.object({
  business_name: requiredTrimmed('Business name is required.'),
  primary_contact_name: optionalTrimmed,
  email: optionalEmail,
  phone: optionalTrimmed,
  assigned_sales_rep_id: optionalTrimmed,
  territory_id: optionalTrimmed,
  status: enumWithDefault(CUSTOMER_STATUSES, 'active', 'Invalid status.'),
  lifecycle_stage: enumWithDefault(
    LIFECYCLE_STAGES,
    'active',
    'Invalid lifecycle stage.'
  ),
  tag_id: stringArray
});

export type CustomerCreateInput = z.infer<typeof customerCreateSchema>;
export type CustomerUpdateInput = z.infer<typeof customerUpdateSchema>;

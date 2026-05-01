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

const optionalExternalCode = optionalTrimmed.refine(
  (v) => v === null || /^[a-zA-Z0-9_-]{3,64}$/.test(v),
  { message: 'External code must be 3-64 chars: letters, digits, _ or -.' }
);

export const customerCreateSchema = z.object({
  business_name: requiredTrimmed('Business name is required.'),
  primary_contact_name: optionalTrimmed,
  email: optionalEmail,
  phone: optionalTrimmed,
  external_code: optionalExternalCode
});

export const customerUpdateSchema = z.object({
  business_name: requiredTrimmed('Business name is required.'),
  primary_contact_name: optionalTrimmed,
  email: optionalEmail,
  phone: optionalTrimmed,
  assigned_sales_rep_id: optionalTrimmed,
  territory_id: optionalTrimmed,
  external_code: optionalExternalCode,
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

/**
 * Generates a default external_code from a business name when the admin
 * leaves the field blank on the create form. Slugifies and adds a short
 * random suffix to avoid collisions on businesses with similar names.
 */
export function deriveExternalCode(businessName: string): string {
  const slug = businessName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);
  const suffix = Math.random().toString(36).slice(2, 8);
  const base = slug.length >= 3 ? slug : 'cust';
  return `${base}_${suffix}`;
}

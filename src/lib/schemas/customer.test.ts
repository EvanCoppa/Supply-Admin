import { describe, expect, it } from 'vitest';
import {
  CUSTOMER_STATUSES,
  LIFECYCLE_STAGES,
  customerCreateSchema,
  customerUpdateSchema,
  deriveExternalCode
} from './customer';

describe('customerCreateSchema', () => {
  it('accepts minimal valid input', () => {
    const result = customerCreateSchema.parse({ business_name: 'Acme' });
    expect(result.business_name).toBe('Acme');
    expect(result.email).toBeNull();
    expect(result.external_code).toBeNull();
  });

  it('rejects missing business_name', () => {
    expect(customerCreateSchema.safeParse({ business_name: '   ' }).success).toBe(false);
  });

  it('accepts a valid email and external code', () => {
    const result = customerCreateSchema.parse({
      business_name: 'Acme',
      email: '  hi@example.com ',
      external_code: 'ACME_001'
    });
    expect(result.email).toBe('hi@example.com');
    expect(result.external_code).toBe('ACME_001');
  });

  it('rejects malformed email', () => {
    expect(
      customerCreateSchema.safeParse({ business_name: 'Acme', email: 'not-an-email' }).success
    ).toBe(false);
  });

  it.each([
    ['ab', false],
    ['abc', true],
    ['contains spaces', false],
    ['contains!chars', false],
    ['a'.repeat(65), false],
    ['a'.repeat(64), true],
    ['valid_code-1', true]
  ])('external_code "%s" -> valid=%s', (code, valid) => {
    expect(
      customerCreateSchema.safeParse({ business_name: 'Acme', external_code: code }).success
    ).toBe(valid);
  });
});

describe('customerUpdateSchema', () => {
  it('applies status and lifecycle defaults when blank', () => {
    const result = customerUpdateSchema.parse({ business_name: 'Acme' });
    expect(result.status).toBe('active');
    expect(result.lifecycle_stage).toBe('active');
    expect(result.tag_id).toEqual([]);
  });

  it('accepts all defined statuses and stages', () => {
    for (const status of CUSTOMER_STATUSES) {
      expect(customerUpdateSchema.parse({ business_name: 'Acme', status }).status).toBe(status);
    }
    for (const stage of LIFECYCLE_STAGES) {
      expect(
        customerUpdateSchema.parse({ business_name: 'Acme', lifecycle_stage: stage })
          .lifecycle_stage
      ).toBe(stage);
    }
  });

  it('rejects invalid statuses', () => {
    expect(customerUpdateSchema.safeParse({ business_name: 'Acme', status: 'bogus' }).success).toBe(
      false
    );
  });

  it('collects multiple tag values', () => {
    expect(
      customerUpdateSchema.parse({
        business_name: 'Acme',
        tag_id: ['  a  ', 'b', '']
      }).tag_id
    ).toEqual(['a', 'b']);
  });
});

describe('deriveExternalCode', () => {
  it('slugifies a normal name and appends a random suffix', () => {
    const code = deriveExternalCode('Acme Dental Supply!');
    expect(code).toMatch(/^acme_dental_supply_[a-z0-9]{1,6}$/);
  });

  it('falls back to "cust" prefix for short names', () => {
    expect(deriveExternalCode('A')).toMatch(/^cust_[a-z0-9]{1,6}$/);
  });

  it('strips leading and trailing underscores from slug', () => {
    expect(deriveExternalCode('!!!Acme!!!')).toMatch(/^acme_[a-z0-9]{1,6}$/);
  });

  it('produces different suffixes across calls', () => {
    const a = deriveExternalCode('Acme');
    const b = deriveExternalCode('Acme');
    expect(a).not.toBe(b);
  });

  it('clamps very long names to 48-char slug', () => {
    const long = 'a'.repeat(80);
    const code = deriveExternalCode(long);
    const slugPart = code.split('_').slice(0, -1).join('_');
    expect(slugPart.length).toBe(48);
  });
});

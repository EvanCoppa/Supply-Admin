import { describe, expect, it } from 'vitest';
import { addressSchema } from './address';

const validBase = {
  line1: '123 Main St',
  city: 'Austin',
  region: 'TX',
  postal_code: '78701',
  country: 'us'
};

describe('addressSchema', () => {
  it('accepts a valid address and uppercases country', () => {
    const result = addressSchema.parse({ ...validBase });
    expect(result.country).toBe('US');
    expect(result.line1).toBe('123 Main St');
    expect(result.is_default_shipping).toBe(false);
  });

  it('trims country whitespace before validating', () => {
    expect(addressSchema.parse({ ...validBase, country: '  ca  ' }).country).toBe('CA');
  });

  it('rejects country codes that are not 2 letters', () => {
    expect(addressSchema.safeParse({ ...validBase, country: 'USA' }).success).toBe(false);
    expect(addressSchema.safeParse({ ...validBase, country: 'u' }).success).toBe(false);
    expect(addressSchema.safeParse({ ...validBase, country: '12' }).success).toBe(false);
  });

  it('rejects missing required fields', () => {
    expect(addressSchema.safeParse({ ...validBase, line1: '' }).success).toBe(false);
    expect(addressSchema.safeParse({ ...validBase, city: '   ' }).success).toBe(false);
    expect(addressSchema.safeParse({ ...validBase, region: '' }).success).toBe(false);
    expect(addressSchema.safeParse({ ...validBase, postal_code: '' }).success).toBe(false);
  });

  it('treats blank label and line2 as null', () => {
    const result = addressSchema.parse({ ...validBase, label: '', line2: '   ' });
    expect(result.label).toBeNull();
    expect(result.line2).toBeNull();
  });

  it('parses is_default_shipping checkbox values', () => {
    expect(
      addressSchema.parse({ ...validBase, is_default_shipping: 'on' }).is_default_shipping
    ).toBe(true);
    expect(addressSchema.parse({ ...validBase, is_default_shipping: '' }).is_default_shipping).toBe(
      false
    );
  });
});

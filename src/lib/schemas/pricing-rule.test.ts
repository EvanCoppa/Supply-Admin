import { describe, expect, it } from 'vitest';
import { pricingPreviewSchema, pricingRuleSchema } from './pricing-rule';

const validProductRule = {
  scope: 'product' as const,
  product_id: 'p-1',
  override_type: 'absolute_price' as const,
  absolute_price: 9.99
};

const validCategoryRule = {
  scope: 'category' as const,
  category_id: 'c-1',
  override_type: 'percent_discount' as const,
  percent_discount: 10
};

function flattenErrors(input: unknown) {
  const result = pricingRuleSchema.safeParse(input);
  if (result.success) return null;
  return result.error.flatten().fieldErrors;
}

describe('pricingRuleSchema', () => {
  it('accepts a valid product/absolute_price rule', () => {
    const r = pricingRuleSchema.parse(validProductRule);
    expect(r.scope).toBe('product');
    expect(r.absolute_price).toBe(9.99);
  });

  it('accepts a valid category/percent_discount rule', () => {
    expect(pricingRuleSchema.parse(validCategoryRule).percent_discount).toBe(10);
  });

  it('requires product_id when scope is product', () => {
    expect(flattenErrors({ ...validProductRule, product_id: '' })?.product_id).toBeDefined();
  });

  it('requires category_id when scope is category', () => {
    expect(flattenErrors({ ...validCategoryRule, category_id: '' })?.category_id).toBeDefined();
  });

  it('requires absolute_price when override is absolute_price', () => {
    expect(
      flattenErrors({ ...validProductRule, absolute_price: '' })?.absolute_price
    ).toBeDefined();
  });

  it('rejects negative absolute_price', () => {
    expect(
      flattenErrors({ ...validProductRule, absolute_price: -1 })?.absolute_price
    ).toBeDefined();
  });

  it('requires percent_discount when override is percent_discount', () => {
    expect(
      flattenErrors({ ...validCategoryRule, percent_discount: '' })?.percent_discount
    ).toBeDefined();
  });

  it('rejects percent_discount outside 0-100', () => {
    expect(
      flattenErrors({ ...validCategoryRule, percent_discount: -5 })?.percent_discount
    ).toBeDefined();
    expect(
      flattenErrors({ ...validCategoryRule, percent_discount: 150 })?.percent_discount
    ).toBeDefined();
  });

  it('rejects effective_end before effective_start', () => {
    expect(
      flattenErrors({
        ...validProductRule,
        effective_start: '2026-02-01',
        effective_end: '2026-01-01'
      })?.effective_end
    ).toBeDefined();
  });

  it('accepts effective_end after start', () => {
    expect(
      pricingRuleSchema.safeParse({
        ...validProductRule,
        effective_start: '2026-01-01',
        effective_end: '2026-02-01'
      }).success
    ).toBe(true);
  });

  it('rejects unknown scope', () => {
    expect(
      pricingRuleSchema.safeParse({ ...validProductRule, scope: 'global' as never }).success
    ).toBe(false);
  });

  it('rejects non-numeric absolute_price', () => {
    expect(
      pricingRuleSchema.safeParse({ ...validProductRule, absolute_price: 'abc' }).success
    ).toBe(false);
  });
});

describe('pricingPreviewSchema', () => {
  it('requires a product_id', () => {
    expect(pricingPreviewSchema.safeParse({ product_id: '   ' }).success).toBe(false);
    expect(pricingPreviewSchema.parse({ product_id: ' p-1 ' }).product_id).toBe('p-1');
  });
});

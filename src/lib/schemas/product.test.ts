import { describe, expect, it } from 'vitest';
import { PRODUCT_STATUSES, lowStockThresholdSchema, productSchema } from './product';

const valid = { sku: 'SKU1', name: 'Widget', base_price: 9.99 };

describe('productSchema', () => {
  it('accepts a valid product with defaults', () => {
    const r = productSchema.parse(valid);
    expect(r.status).toBe('active');
    expect(r.pack_size).toBeNull();
    expect(r.weight_grams).toBeNull();
  });

  it('rejects missing sku and name', () => {
    expect(productSchema.safeParse({ ...valid, sku: '' }).success).toBe(false);
    expect(productSchema.safeParse({ ...valid, name: '   ' }).success).toBe(false);
  });

  it('rejects negative base_price', () => {
    expect(productSchema.safeParse({ ...valid, base_price: -1 }).success).toBe(false);
  });

  it('accepts numeric strings for base_price', () => {
    expect(productSchema.parse({ ...valid, base_price: '12.50' }).base_price).toBe(12.5);
  });

  it('accepts all status values', () => {
    for (const status of PRODUCT_STATUSES) {
      expect(productSchema.parse({ ...valid, status }).status).toBe(status);
    }
  });

  it('rejects unknown status', () => {
    expect(productSchema.safeParse({ ...valid, status: 'deleted' as never }).success).toBe(false);
  });

  it('coerces optional pack_size and weight_grams', () => {
    const r = productSchema.parse({ ...valid, pack_size: '12', weight_grams: '500' });
    expect(r.pack_size).toBe(12);
    expect(r.weight_grams).toBe(500);
  });
});

describe('lowStockThresholdSchema', () => {
  it('requires a non-negative threshold', () => {
    expect(lowStockThresholdSchema.parse({ low_stock_threshold: 0 }).low_stock_threshold).toBe(0);
    expect(lowStockThresholdSchema.safeParse({ low_stock_threshold: -1 }).success).toBe(false);
    expect(lowStockThresholdSchema.safeParse({ low_stock_threshold: '' }).success).toBe(false);
  });
});

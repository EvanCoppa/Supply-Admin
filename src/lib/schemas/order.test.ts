import { describe, expect, it } from 'vitest';
import { ORDER_STATUSES, orderRefundSchema, orderTransitionSchema } from './order';

describe('orderTransitionSchema', () => {
  for (const status of ORDER_STATUSES) {
    it(`accepts target status ${status}`, () => {
      expect(orderTransitionSchema.parse({ to: status }).to).toBe(status);
    });
  }

  it('rejects an unknown status', () => {
    expect(orderTransitionSchema.safeParse({ to: 'archived' as never }).success).toBe(false);
  });

  it('keeps optional tracking trimmed', () => {
    expect(orderTransitionSchema.parse({ to: 'shipped', tracking: '  1Z  ' }).tracking).toBe('1Z');
    expect(orderTransitionSchema.parse({ to: 'shipped' }).tracking).toBeNull();
  });
});

describe('orderRefundSchema', () => {
  it('treats empty / undefined as null', () => {
    expect(orderRefundSchema.parse({ amount: '' }).amount).toBeNull();
    expect(orderRefundSchema.parse({}).amount).toBeNull();
  });

  it('rejects non-positive amounts', () => {
    expect(orderRefundSchema.safeParse({ amount: 0 }).success).toBe(false);
    expect(orderRefundSchema.safeParse({ amount: -1 }).success).toBe(false);
  });

  it('rejects non-numeric strings', () => {
    expect(orderRefundSchema.safeParse({ amount: 'abc' }).success).toBe(false);
  });

  it('accepts positive numeric input as string or number', () => {
    expect(orderRefundSchema.parse({ amount: 12.5 }).amount).toBe(12.5);
    expect(orderRefundSchema.parse({ amount: '20' }).amount).toBe(20);
  });
});

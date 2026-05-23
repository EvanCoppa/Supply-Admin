import { describe, expect, it } from 'vitest';
import {
  PURCHASE_PAYMENT_STATUSES,
  PURCHASE_STATUSES,
  purchaseCreateSchema,
  purchaseMarkPaidSchema,
  purchaseUpdateSchema
} from './purchase';

const valid = {
  supplier_id: 'sup-1',
  subtotal: 100
};

describe('purchaseCreateSchema', () => {
  it('accepts minimal valid input and applies defaults', () => {
    const r = purchaseCreateSchema.parse(valid);
    expect(r.status).toBe('ordered');
    expect(r.payment_status).toBe('unpaid');
    expect(r.freight).toBe(0);
    expect(r.tax).toBe(0);
    expect(r.distribution_fee_pct).toBe(0);
  });

  it('rejects missing supplier_id', () => {
    expect(purchaseCreateSchema.safeParse({ ...valid, supplier_id: '' }).success).toBe(false);
  });

  it('rejects negative subtotal', () => {
    expect(purchaseCreateSchema.safeParse({ ...valid, subtotal: -1 }).success).toBe(false);
  });

  it('divides distribution_fee_pct by 100', () => {
    expect(
      purchaseCreateSchema.parse({ ...valid, distribution_fee_pct: 25 }).distribution_fee_pct
    ).toBe(0.25);
  });

  it('validates due_date format YYYY-MM-DD', () => {
    expect(purchaseCreateSchema.safeParse({ ...valid, due_date: '01/02/2026' }).success).toBe(
      false
    );
    expect(purchaseCreateSchema.parse({ ...valid, due_date: '2026-01-02' }).due_date).toBe(
      '2026-01-02'
    );
  });

  it('validates order_id as UUID', () => {
    expect(purchaseCreateSchema.safeParse({ ...valid, order_id: 'not-a-uuid' }).success).toBe(
      false
    );
    const uuid = '11111111-2222-3333-4444-555555555555';
    expect(purchaseCreateSchema.parse({ ...valid, order_id: uuid }).order_id).toBe(uuid);
  });

  it('accepts ISO datetimes for ordered_at / received_at', () => {
    expect(
      purchaseCreateSchema.parse({ ...valid, ordered_at: '2026-01-01T10:00:00Z' }).ordered_at
    ).toBe('2026-01-01T10:00:00Z');
  });

  it('rejects nonsense ordered_at', () => {
    expect(purchaseCreateSchema.safeParse({ ...valid, ordered_at: 'nope' }).success).toBe(false);
  });

  it('accepts each defined status / payment_status', () => {
    for (const s of PURCHASE_STATUSES) {
      expect(purchaseCreateSchema.parse({ ...valid, status: s }).status).toBe(s);
    }
    for (const s of PURCHASE_PAYMENT_STATUSES) {
      expect(purchaseCreateSchema.parse({ ...valid, payment_status: s }).payment_status).toBe(s);
    }
  });
});

describe('purchaseUpdateSchema', () => {
  it('allows omitting supplier_id and subtotal', () => {
    const r = purchaseUpdateSchema.parse({});
    expect(r.supplier_id).toBeUndefined();
    expect(r.subtotal).toBeUndefined();
  });
});

describe('purchaseMarkPaidSchema', () => {
  it('accepts blank or valid date-only string', () => {
    expect(purchaseMarkPaidSchema.parse({}).paid_on).toBeNull();
    expect(purchaseMarkPaidSchema.parse({ paid_on: '2026-01-01' }).paid_on).toBe('2026-01-01');
  });

  it('rejects bad date format', () => {
    expect(purchaseMarkPaidSchema.safeParse({ paid_on: '2026/01/01' }).success).toBe(false);
  });
});

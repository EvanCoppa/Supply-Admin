import { describe, expect, it } from 'vitest';
import { defaultDueDate, roundMoney } from './invoices';

describe('roundMoney', () => {
  it('rounds to two decimal places', () => {
    expect(roundMoney(1.005)).toBe(1.01);
    expect(roundMoney(1.004)).toBe(1.0);
    expect(roundMoney(123.456)).toBe(123.46);
  });

  it('handles zero', () => {
    expect(roundMoney(0)).toBe(0);
  });
});

describe('defaultDueDate', () => {
  const issuedAt = new Date('2026-01-01T00:00:00Z');

  it('returns same day for due_on_receipt', () => {
    expect(defaultDueDate('due_on_receipt', issuedAt).toISOString()).toBe(
      '2026-01-01T00:00:00.000Z'
    );
  });

  it('adds 15 days for net_15', () => {
    expect(defaultDueDate('net_15', issuedAt).toISOString()).toBe('2026-01-16T00:00:00.000Z');
  });

  it('adds 30 days for net_30', () => {
    expect(defaultDueDate('net_30', issuedAt).toISOString()).toBe('2026-01-31T00:00:00.000Z');
  });

  it('adds 60 days for net_60', () => {
    expect(defaultDueDate('net_60', issuedAt).toISOString()).toBe('2026-03-02T00:00:00.000Z');
  });

  it('defaults to net_30 when terms is null', () => {
    expect(defaultDueDate(null, issuedAt).toISOString()).toBe('2026-01-31T00:00:00.000Z');
  });
});

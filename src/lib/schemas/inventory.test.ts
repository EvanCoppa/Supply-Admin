import { describe, expect, it } from 'vitest';
import { REASON_CODES, inventoryAdjustSchema } from './inventory';

describe('inventoryAdjustSchema', () => {
  it('accepts a positive integer delta', () => {
    const r = inventoryAdjustSchema.parse({ delta: 5, reason: 'receipt' });
    expect(r.delta).toBe(5);
    expect(r.reason).toBe('receipt');
    expect(r.notes).toBeNull();
  });

  it('coerces numeric strings', () => {
    expect(inventoryAdjustSchema.parse({ delta: '-3', reason: 'damage' }).delta).toBe(-3);
  });

  it.each([['', 0, '0', 'abc', '1.5', 1.5, undefined, null]])(
    'rejects invalid delta values: %j',
    (input) => {
      expect(
        inventoryAdjustSchema.safeParse({ delta: input as unknown as number, reason: 'other' })
          .success
      ).toBe(false);
    }
  );

  it('accepts every reason code', () => {
    for (const reason of REASON_CODES) {
      expect(inventoryAdjustSchema.parse({ delta: 1, reason }).reason).toBe(reason);
    }
  });

  it('rejects unknown reason codes', () => {
    expect(inventoryAdjustSchema.safeParse({ delta: 1, reason: 'made_up' as never }).success).toBe(
      false
    );
  });

  it('keeps trimmed notes', () => {
    expect(
      inventoryAdjustSchema.parse({ delta: 1, reason: 'receipt', notes: '  hello  ' }).notes
    ).toBe('hello');
  });
});

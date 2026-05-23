import { describe, expect, it } from 'vitest';
import { currency, dateShort, dateTime } from './format';

describe('currency', () => {
  it('formats positive numbers as USD', () => {
    expect(currency(1234.5)).toBe('$1,234.50');
  });

  it('parses numeric strings', () => {
    expect(currency('42')).toBe('$42.00');
  });

  it('returns em-dash for nullish input', () => {
    expect(currency(null)).toBe('—');
    expect(currency(undefined)).toBe('—');
  });

  it('returns em-dash for non-numeric strings', () => {
    expect(currency('not a number')).toBe('—');
  });
});

describe('dateShort', () => {
  it('formats valid ISO dates', () => {
    expect(dateShort('2026-01-15T00:00:00Z')).toMatch(/Jan 14|Jan 15/);
  });

  it('returns em-dash for nullish input', () => {
    expect(dateShort(null)).toBe('—');
    expect(dateShort(undefined)).toBe('—');
  });

  it('returns em-dash for invalid input', () => {
    expect(dateShort('not a date')).toBe('—');
  });
});

describe('dateTime', () => {
  it('returns em-dash for nullish input', () => {
    expect(dateTime(null)).toBe('—');
  });

  it('formats valid timestamps', () => {
    const result = dateTime('2026-01-15T14:30:00Z');
    expect(result).not.toBe('—');
    expect(result).toContain('2026');
  });
});

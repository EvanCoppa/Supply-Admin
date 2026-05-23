import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  checkbox,
  enumWithDefault,
  optionalNumber,
  optionalTrimmed,
  parseForm,
  requiredNumber,
  requiredTrimmed,
  stringArray
} from './helpers';

function toForm(record: Record<string, string | string[]>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(record)) {
    if (Array.isArray(value)) {
      for (const v of value) fd.append(key, v);
    } else {
      fd.set(key, value);
    }
  }
  return fd;
}

describe('parseForm', () => {
  const schema = z.object({
    name: requiredTrimmed('Name required.'),
    note: optionalTrimmed
  });

  it('succeeds on valid input', () => {
    const result = parseForm(schema, toForm({ name: '  Acme  ', note: '' }));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('Acme');
      expect(result.data.note).toBeNull();
    }
  });

  it('fails with field errors on invalid input', () => {
    const result = parseForm(schema, toForm({ name: '   ' }));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.message).toBe('Name required.');
      expect(result.fieldErrors['name']).toEqual(['Name required.']);
    }
  });
});

describe('optionalTrimmed', () => {
  it('returns null for empty string', () => {
    expect(optionalTrimmed.parse('')).toBeNull();
    expect(optionalTrimmed.parse('   ')).toBeNull();
  });

  it('trims valid strings', () => {
    expect(optionalTrimmed.parse('  hi  ')).toBe('hi');
  });

  it('returns null for undefined', () => {
    expect(optionalTrimmed.parse(undefined)).toBeNull();
  });
});

describe('requiredTrimmed', () => {
  const schema = requiredTrimmed('Need it.');

  it('rejects empty / whitespace-only strings', () => {
    expect(schema.safeParse('').success).toBe(false);
    expect(schema.safeParse('   ').success).toBe(false);
  });

  it('accepts and trims valid input', () => {
    expect(schema.parse('  ok  ')).toBe('ok');
  });
});

describe('optionalNumber', () => {
  it('returns null for blank values', () => {
    expect(optionalNumber.parse('')).toBeNull();
    expect(optionalNumber.parse(undefined)).toBeNull();
  });

  it('coerces numeric strings', () => {
    expect(optionalNumber.parse('42.5')).toBe(42.5);
  });

  it('rejects non-numeric strings', () => {
    expect(optionalNumber.safeParse('abc').success).toBe(false);
  });
});

describe('requiredNumber', () => {
  const schema = requiredNumber('Must be numeric.');

  it('rejects blank input', () => {
    expect(schema.safeParse('').success).toBe(false);
    expect(schema.safeParse(undefined).success).toBe(false);
  });

  it('accepts valid numbers', () => {
    expect(schema.parse('123.45')).toBe(123.45);
    expect(schema.parse(42)).toBe(42);
  });

  it('rejects Infinity and NaN', () => {
    expect(schema.safeParse('Infinity').success).toBe(false);
    expect(schema.safeParse('NaN').success).toBe(false);
  });
});

describe('checkbox', () => {
  it.each([
    ['on', true],
    ['true', true],
    ['1', true],
    ['', false],
    ['off', false],
    [undefined, false]
  ])('parses %s as %s', (input, expected) => {
    expect(checkbox.parse(input)).toBe(expected);
  });
});

describe('stringArray', () => {
  it('returns empty array for nullish', () => {
    expect(stringArray.parse(undefined)).toEqual([]);
    expect(stringArray.parse('')).toEqual([]);
  });

  it('wraps single string', () => {
    expect(stringArray.parse('a')).toEqual(['a']);
  });

  it('trims and drops empty entries', () => {
    expect(stringArray.parse(['  a ', '', ' b'])).toEqual(['a', 'b']);
  });
});

describe('enumWithDefault', () => {
  const schema = enumWithDefault(['red', 'blue', 'green'] as const, 'red');

  it('uses default for empty input', () => {
    expect(schema.parse('')).toBe('red');
    expect(schema.parse(undefined)).toBe('red');
  });

  it('accepts valid values', () => {
    expect(schema.parse('blue')).toBe('blue');
  });

  it('rejects invalid values', () => {
    expect(schema.safeParse('purple').success).toBe(false);
  });
});

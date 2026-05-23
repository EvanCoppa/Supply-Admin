import { describe, expect, it } from 'vitest';
import { tokenCreateSchema } from './token';

describe('tokenCreateSchema', () => {
  it('accepts blank label as null', () => {
    expect(tokenCreateSchema.parse({}).label).toBeNull();
    expect(tokenCreateSchema.parse({ label: '   ' }).label).toBeNull();
  });

  it('trims label', () => {
    expect(tokenCreateSchema.parse({ label: '  hi  ' }).label).toBe('hi');
  });
});

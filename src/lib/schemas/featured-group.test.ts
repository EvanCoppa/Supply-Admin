import { describe, expect, it } from 'vitest';
import {
  featuredGroupProductSchema,
  featuredGroupReorderSchema,
  featuredGroupSchema
} from './featured-group';

describe('featuredGroupSchema', () => {
  it('accepts name with optional description', () => {
    const result = featuredGroupSchema.parse({ name: 'Summer Picks', description: '' });
    expect(result.name).toBe('Summer Picks');
    expect(result.description).toBeNull();
  });

  it('rejects blank name', () => {
    expect(featuredGroupSchema.safeParse({ name: '   ' }).success).toBe(false);
  });
});

describe('featuredGroupProductSchema', () => {
  it('requires a product_id', () => {
    expect(featuredGroupProductSchema.safeParse({ product_id: '' }).success).toBe(false);
    expect(featuredGroupProductSchema.parse({ product_id: 'prod-1' }).product_id).toBe('prod-1');
  });
});

describe('featuredGroupReorderSchema', () => {
  it('accepts up and down directions', () => {
    expect(featuredGroupReorderSchema.parse({ product_id: 'p', direction: 'up' }).direction).toBe(
      'up'
    );
    expect(featuredGroupReorderSchema.parse({ product_id: 'p', direction: 'down' }).direction).toBe(
      'down'
    );
  });

  it('rejects other directions', () => {
    expect(
      featuredGroupReorderSchema.safeParse({ product_id: 'p', direction: 'left' }).success
    ).toBe(false);
  });
});

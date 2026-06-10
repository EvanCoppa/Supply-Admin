import { describe, expect, it } from 'vitest';
import { addressLines } from './address';

describe('addressLines', () => {
  it('formats a customer_addresses snapshot', () => {
    expect(
      addressLines({
        label: 'Warehouse',
        line1: '123 Main St',
        line2: 'Suite 4',
        city: 'Austin',
        region: 'TX',
        postal_code: '78701',
        country: 'US'
      })
    ).toEqual(['123 Main St', 'Suite 4', 'Austin, TX 78701', 'US']);
  });

  it('handles common API aliases', () => {
    expect(
      addressLines({ address1: '9 Elm Ave', state: 'CA', zip: '90210', city: 'Beverly Hills' })
    ).toEqual(['9 Elm Ave', 'Beverly Hills, CA 90210']);
  });

  it('skips blank and non-string values', () => {
    expect(addressLines({ line1: '1 Oak Rd', line2: '  ', city: 'Reno', extra: 42 })).toEqual([
      '1 Oak Rd',
      'Reno'
    ]);
  });

  it('returns empty for nullish input', () => {
    expect(addressLines(null)).toEqual([]);
    expect(addressLines(undefined)).toEqual([]);
  });

  it('falls back to string values for unrecognized shapes', () => {
    expect(addressLines({ full: '500 Pine St, Seattle WA' })).toEqual(['500 Pine St, Seattle WA']);
  });
});

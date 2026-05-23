import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  generateSupplyToken,
  hashSupplyToken,
  readBearerToken,
  requireSupplyCustomer
} from './supply-auth';

function makeRequest(authHeader?: string): Request {
  const headers = new Headers();
  if (authHeader) headers.set('authorization', authHeader);
  return new Request('http://localhost/', { headers });
}

describe('generateSupplyToken', () => {
  it('returns a supply_-prefixed 64-char hex token', () => {
    const token = generateSupplyToken();
    expect(token.startsWith('supply_')).toBe(true);
    const hex = token.slice('supply_'.length);
    expect(hex).toMatch(/^[0-9a-f]{64}$/);
  });

  it('produces distinct tokens across calls', () => {
    expect(generateSupplyToken()).not.toBe(generateSupplyToken());
  });
});

describe('hashSupplyToken', () => {
  it('returns a 64-char hex digest', async () => {
    const hash = await hashSupplyToken('supply_abc');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is deterministic for the same input', async () => {
    expect(await hashSupplyToken('supply_abc')).toBe(await hashSupplyToken('supply_abc'));
  });

  it('differs for different input', async () => {
    const a = await hashSupplyToken('supply_a');
    const b = await hashSupplyToken('supply_b');
    expect(a).not.toBe(b);
  });
});

describe('readBearerToken', () => {
  it('returns the token from a valid bearer header', () => {
    expect(readBearerToken(makeRequest('Bearer abc'))).toBe('abc');
    expect(readBearerToken(makeRequest('bearer abc'))).toBe('abc');
  });

  it('throws 401 when header is missing', () => {
    expect(() => readBearerToken(makeRequest())).toThrow();
  });

  it('throws 401 when scheme is wrong', () => {
    expect(() => readBearerToken(makeRequest('Basic abc'))).toThrow();
  });

  it('throws 401 when token portion is empty', () => {
    expect(() => readBearerToken(makeRequest('Bearer '))).toThrow();
  });
});

function makeSupabaseForToken(
  fetchResult:
    | { data: { id: string; customer_id: string; revoked_at: string | null }; error: null }
    | { data: null; error: { message: string } | null }
): SupabaseClient {
  const maybeSingle = vi.fn().mockResolvedValue(fetchResult);
  const eqSelect = { maybeSingle };
  const select = vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue(eqSelect) });
  const update = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
  const from = vi.fn().mockImplementation(() => ({ select, update }));
  return { from } as unknown as SupabaseClient;
}

describe('requireSupplyCustomer', () => {
  it('throws when token does not have supply_ prefix', async () => {
    const supabase = makeSupabaseForToken({
      data: { id: 't', customer_id: 'c', revoked_at: null },
      error: null
    });
    await expect(
      requireSupplyCustomer(makeRequest('Bearer other_token'), supabase)
    ).rejects.toBeTruthy();
  });

  it('throws when supabase returns error', async () => {
    const supabase = makeSupabaseForToken({ data: null, error: { message: 'db down' } });
    await expect(
      requireSupplyCustomer(makeRequest('Bearer supply_x'), supabase)
    ).rejects.toBeTruthy();
  });

  it('throws when token is not found', async () => {
    const supabase = makeSupabaseForToken({ data: null, error: null });
    await expect(
      requireSupplyCustomer(makeRequest('Bearer supply_x'), supabase)
    ).rejects.toBeTruthy();
  });

  it('throws when token is revoked', async () => {
    const supabase = makeSupabaseForToken({
      data: { id: 't', customer_id: 'c', revoked_at: '2025-01-01' },
      error: null
    });
    await expect(
      requireSupplyCustomer(makeRequest('Bearer supply_x'), supabase)
    ).rejects.toBeTruthy();
  });

  it('returns customer + token id on success', async () => {
    const supabase = makeSupabaseForToken({
      data: { id: 'token-1', customer_id: 'cust-1', revoked_at: null },
      error: null
    });
    const result = await requireSupplyCustomer(makeRequest('Bearer supply_xyz'), supabase);
    expect(result).toEqual({ customerId: 'cust-1', tokenId: 'token-1' });
  });
});

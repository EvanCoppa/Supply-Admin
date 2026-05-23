import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  canBuyProduct,
  canViewProduct,
  getAccessMap,
  getCatalogCustomer,
  resolveCustomerPrice
} from './supply-catalog';

function customerSupabase(result: {
  data: { id: string; catalog_access_mode: string | null } | null;
  error: { message: string } | null;
}): SupabaseClient {
  const maybeSingle = vi.fn().mockResolvedValue(result);
  const eq = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ eq });
  return {
    from: vi.fn().mockReturnValue({ select })
  } as unknown as SupabaseClient;
}

function accessSupabase(result: {
  data: { product_id: string; can_view: boolean; can_buy: boolean }[] | null;
  error: { message: string } | null;
}): SupabaseClient {
  const eq = vi.fn().mockResolvedValue(result);
  const select = vi.fn().mockReturnValue({ eq });
  return {
    from: vi.fn().mockReturnValue({ select })
  } as unknown as SupabaseClient;
}

describe('getCatalogCustomer', () => {
  it('throws 500 when supabase errors', async () => {
    const supabase = customerSupabase({ data: null, error: { message: 'fail' } });
    await expect(getCatalogCustomer(supabase, 'c-1')).rejects.toBeTruthy();
  });

  it('throws 404 when customer is missing', async () => {
    const supabase = customerSupabase({ data: null, error: null });
    await expect(getCatalogCustomer(supabase, 'c-1')).rejects.toBeTruthy();
  });

  it('returns allowlist mode by default', async () => {
    const supabase = customerSupabase({
      data: { id: 'c-1', catalog_access_mode: null },
      error: null
    });
    const result = await getCatalogCustomer(supabase, 'c-1');
    expect(result.catalog_access_mode).toBe('allowlist');
  });

  it('returns all_active mode when set', async () => {
    const supabase = customerSupabase({
      data: { id: 'c-1', catalog_access_mode: 'all_active' },
      error: null
    });
    const result = await getCatalogCustomer(supabase, 'c-1');
    expect(result.catalog_access_mode).toBe('all_active');
  });
});

describe('getAccessMap', () => {
  it('throws on supabase error', async () => {
    const supabase = accessSupabase({ data: null, error: { message: 'err' } });
    await expect(getAccessMap(supabase, 'c-1')).rejects.toBeTruthy();
  });

  it('returns an empty map for null data', async () => {
    const supabase = accessSupabase({ data: null, error: null });
    const map = await getAccessMap(supabase, 'c-1');
    expect(map.size).toBe(0);
  });

  it('keys access rows by product_id', async () => {
    const supabase = accessSupabase({
      data: [
        { product_id: 'p1', can_view: true, can_buy: false },
        { product_id: 'p2', can_view: false, can_buy: false }
      ],
      error: null
    });
    const map = await getAccessMap(supabase, 'c-1');
    expect(map.size).toBe(2);
    expect(map.get('p1')?.can_buy).toBe(false);
    expect(map.get('p2')?.can_view).toBe(false);
  });
});

describe('canViewProduct', () => {
  it('allowlist requires explicit can_view=true', () => {
    expect(canViewProduct('allowlist', undefined)).toBe(false);
    expect(canViewProduct('allowlist', { product_id: 'p', can_view: false, can_buy: false })).toBe(
      false
    );
    expect(canViewProduct('allowlist', { product_id: 'p', can_view: true, can_buy: false })).toBe(
      true
    );
  });

  it('all_active allows by default unless explicitly false', () => {
    expect(canViewProduct('all_active', undefined)).toBe(true);
    expect(canViewProduct('all_active', { product_id: 'p', can_view: true, can_buy: true })).toBe(
      true
    );
    expect(canViewProduct('all_active', { product_id: 'p', can_view: false, can_buy: true })).toBe(
      false
    );
  });
});

describe('canBuyProduct', () => {
  it('returns false when view is denied', () => {
    expect(canBuyProduct('allowlist', undefined)).toBe(false);
  });

  it('respects can_buy when viewable', () => {
    expect(canBuyProduct('allowlist', { product_id: 'p', can_view: true, can_buy: false })).toBe(
      false
    );
    expect(canBuyProduct('allowlist', { product_id: 'p', can_view: true, can_buy: true })).toBe(
      true
    );
  });

  it('all_active defaults to buyable unless can_buy=false', () => {
    expect(canBuyProduct('all_active', undefined)).toBe(true);
    expect(canBuyProduct('all_active', { product_id: 'p', can_view: true, can_buy: false })).toBe(
      false
    );
  });
});

describe('resolveCustomerPrice', () => {
  function rpcSupabase(rpcResult: { data: unknown; error: unknown }): SupabaseClient {
    return {
      rpc: vi.fn(async () => rpcResult)
    } as unknown as SupabaseClient;
  }

  it('falls back to base_price on RPC error', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const supabase = rpcSupabase({ data: null, error: { message: 'rpc broke' } });
    const price = await resolveCustomerPrice(supabase, 'c-1', { id: 'p', base_price: 9.5 });
    expect(price).toBe(9.5);
    warn.mockRestore();
  });

  it('falls back to base_price when data is null', async () => {
    const supabase = rpcSupabase({ data: null, error: null });
    const price = await resolveCustomerPrice(supabase, 'c-1', { id: 'p', base_price: '7' });
    expect(price).toBe(7);
  });

  it('uses resolved price from RPC', async () => {
    const supabase = rpcSupabase({ data: 4.99, error: null });
    expect(await resolveCustomerPrice(supabase, 'c-1', { id: 'p', base_price: 10 })).toBe(4.99);
  });

  it('falls back when RPC returns non-finite value', async () => {
    const supabase = rpcSupabase({ data: 'NaN', error: null });
    expect(await resolveCustomerPrice(supabase, 'c-1', { id: 'p', base_price: 5 })).toBe(5);
  });

  it('treats null base_price as 0', async () => {
    const supabase = rpcSupabase({ data: null, error: null });
    expect(await resolveCustomerPrice(supabase, 'c-1', { id: 'p', base_price: null })).toBe(0);
  });
});

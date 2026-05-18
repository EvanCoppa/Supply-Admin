import { error } from '@sveltejs/kit';
import type { SupabaseClient } from '@supabase/supabase-js';

export type ProductAccess = {
  product_id: string;
  can_view: boolean;
  can_buy: boolean;
};

export type CatalogCustomer = {
  id: string;
  catalog_access_mode: 'all_active' | 'allowlist';
};

export async function getCatalogCustomer(
  supabase: SupabaseClient,
  customerId: string
): Promise<CatalogCustomer> {
  const { data, error: customerError } = await supabase
    .from('customers')
    .select('id, catalog_access_mode')
    .eq('id', customerId)
    .maybeSingle();

  if (customerError) {
    console.error('[supply-api] customer lookup failed', customerError);
    throw error(500, 'Customer lookup failed');
  }
  if (!data) throw error(404, 'Customer not found');

  return {
    id: data.id,
    catalog_access_mode:
      data.catalog_access_mode === 'all_active' ? 'all_active' : 'allowlist'
  };
}

export async function getAccessMap(
  supabase: SupabaseClient,
  customerId: string
): Promise<Map<string, ProductAccess>> {
  const { data, error: accessError } = await supabase
    .from('customer_product_access')
    .select('product_id, can_view, can_buy')
    .eq('customer_id', customerId);

  if (accessError) {
    console.error('[supply-api] access lookup failed', accessError);
    throw error(500, 'Product access lookup failed');
  }

  return new Map((data ?? []).map((row: ProductAccess) => [row.product_id, row]));
}

export function canViewProduct(
  mode: CatalogCustomer['catalog_access_mode'],
  access: ProductAccess | undefined
): boolean {
  if (mode === 'allowlist') return !!access?.can_view;
  return access?.can_view !== false;
}

export function canBuyProduct(
  mode: CatalogCustomer['catalog_access_mode'],
  access: ProductAccess | undefined
): boolean {
  if (!canViewProduct(mode, access)) return false;
  return access?.can_buy !== false;
}

export async function resolveCustomerPrice(
  supabase: SupabaseClient,
  customerId: string,
  product: { id: string; base_price: number | string | null }
): Promise<number> {
  const basePrice = Number(product.base_price ?? 0);
  const { data, error: priceError } = await supabase.rpc('resolve_customer_price', {
    p_customer_id: customerId,
    p_product_id: product.id
  });

  if (priceError || data === null || data === undefined) {
    if (priceError) console.warn('[supply-api] price RPC failed, using base price', priceError);
    return basePrice;
  }

  const resolved = Number(data);
  return Number.isFinite(resolved) ? resolved : basePrice;
}

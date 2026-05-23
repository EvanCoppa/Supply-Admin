import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createSupabaseAdminClient } from '$lib/supabase.server';
import { requireSupplyCustomer } from '$lib/server/supply-auth';
import {
  canBuyProduct,
  canViewProduct,
  getAccessMap,
  getCatalogCustomer,
  resolveCustomerPrice
} from '$lib/server/supply-catalog';
import { getFirstProductImagePath, getProductImagePublicUrl } from '$lib/server/product-images';

type ProductRow = {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  manufacturer: string | null;
  unit_of_measure: string | null;
  pack_size: number | null;
  image_paths: string[] | null;
  base_price: number | string;
  category_id: string | null;
};

export const GET: RequestHandler = async ({ request, url }) => {
  const supabase = createSupabaseAdminClient();
  const { customerId } = await requireSupplyCustomer(request, supabase);
  const customer = await getCatalogCustomer(supabase, customerId);
  const accessMap = await getAccessMap(supabase, customerId);

  const limit = Math.min(Math.max(Number(url.searchParams.get('limit') ?? '24') || 24, 1), 100);
  const offset = Math.max(Number(url.searchParams.get('cursor') ?? '0') || 0, 0);
  const search = (url.searchParams.get('q') ?? '').trim();
  const categoryId = (url.searchParams.get('category_id') ?? '').trim();

  let query = supabase
    .from('products')
    .select(
      'id, sku, name, description, manufacturer, unit_of_measure, pack_size, image_paths, base_price, category_id'
    )
    .eq('status', 'active')
    .order('name', { ascending: true })
    .range(offset, offset + limit - 1);

  if (search) {
    const escaped = search.replaceAll('%', '\\%').replaceAll('_', '\\_');
    query = query.or(
      `name.ilike.%${escaped}%,sku.ilike.%${escaped}%,description.ilike.%${escaped}%`
    );
  }
  if (categoryId) query = query.eq('category_id', categoryId);

  if (customer.catalog_access_mode === 'allowlist') {
    const allowedIds = [...accessMap.values()]
      .filter((access) => access.can_view)
      .map((access) => access.product_id);
    if (allowedIds.length === 0) {
      return json({ items: [], next_cursor: null });
    }
    query = query.in('id', allowedIds);
  }

  const { data, error: productError } = await query;
  if (productError) {
    console.error('[supply-api] product list failed', productError);
    return json({ error: 'Failed to fetch products' }, { status: 500 });
  }

  const visibleProducts = ((data ?? []) as ProductRow[]).filter((product) =>
    canViewProduct(customer.catalog_access_mode, accessMap.get(product.id))
  );

  const items = await Promise.all(
    visibleProducts.map(async (product) => ({
      id: product.id,
      sku: product.sku,
      name: product.name,
      description: product.description,
      manufacturer: product.manufacturer,
      unit_of_measure: product.unit_of_measure,
      pack_size: product.pack_size,
      image_paths: product.image_paths ?? [],
      image_url: getProductImagePublicUrl(supabase, getFirstProductImagePath(product.image_paths)),
      base_price: Number(product.base_price ?? 0),
      customer_price: await resolveCustomerPrice(supabase, customerId, product),
      can_buy: canBuyProduct(customer.catalog_access_mode, accessMap.get(product.id))
    }))
  );

  return json({
    items,
    next_cursor: (data ?? []).length === limit ? String(offset + limit) : null
  });
};

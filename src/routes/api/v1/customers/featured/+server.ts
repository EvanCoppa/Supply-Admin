import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createSupabaseAdminClient } from '$lib/supabase.server';
import { requireSupplyCustomer } from '$lib/server/supply-auth';
import { canViewProduct, getAccessMap, getCatalogCustomer } from '$lib/server/supply-catalog';
import { getFirstProductImagePath, getProductImagePublicUrl } from '$lib/server/product-images';

type FeaturedItem = {
  id: string;
  product_id: string | null;
  group_id: string | null;
  display_order: number;
  product: {
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
  } | null;
  group: {
    id: string;
    name: string;
    product_ids: string[] | null;
  } | null;
};

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

export const GET: RequestHandler = async ({ request }) => {
  const supabase = createSupabaseAdminClient();
  const { customerId } = await requireSupplyCustomer(request, supabase);
  const customer = await getCatalogCustomer(supabase, customerId);
  const accessMap = await getAccessMap(supabase, customerId);

  const { data: featuredItems, error: itemsError } = await supabase
    .from('customer_featured_items')
    .select(
      `id,
       product_id,
       group_id,
       display_order,
       product:products(id, sku, name, description, manufacturer, unit_of_measure, pack_size, image_paths, base_price, category_id),
       group:featured_groups(id, name, product_ids)`
    )
    .eq('customer_id', customerId)
    .order('display_order', { ascending: true });

  if (itemsError) {
    console.error('[supply-api] featured items list failed', itemsError);
    return json({ error: 'Failed to fetch featured items' }, { status: 500 });
  }

  const items = (featuredItems ?? []) as unknown as FeaturedItem[];
  const result: {
    id: string;
    type: 'product' | 'group';
    product?: object;
    group?: object;
  }[] = [];

  for (const item of items) {
    if (item.product_id && item.product) {
      const product = item.product;
      const access = accessMap.get(product.id);

      if (canViewProduct(customer.catalog_access_mode, access)) {
        result.push({
          id: item.id,
          type: 'product',
          product: {
            id: product.id,
            sku: product.sku,
            name: product.name,
            description: product.description,
            manufacturer: product.manufacturer,
            unit_of_measure: product.unit_of_measure,
            pack_size: product.pack_size,
            image_paths: product.image_paths ?? [],
            image_url: getProductImagePublicUrl(
              supabase,
              getFirstProductImagePath(product.image_paths)
            ),
            base_price: Number(product.base_price ?? 0),
            category_id: product.category_id,
            can_buy: access?.can_buy ?? customer.catalog_access_mode === 'all_active'
          }
        });
      }
    } else if (item.group_id && item.group) {
      const groupProductIds = (item.group.product_ids ?? []).filter(Boolean);

      if (groupProductIds.length > 0) {
        const { data: groupProducts } = await supabase
          .from('products')
          .select(
            'id, sku, name, description, manufacturer, unit_of_measure, pack_size, image_paths, base_price, category_id'
          )
          .in('id', groupProductIds)
          .eq('status', 'active');

        const visibleProducts = ((groupProducts ?? []) as unknown as ProductRow[])
          .filter((product) =>
            canViewProduct(customer.catalog_access_mode, accessMap.get(product.id))
          )
          .map((product) => ({
            id: product.id,
            sku: product.sku,
            name: product.name,
            description: product.description,
            manufacturer: product.manufacturer,
            unit_of_measure: product.unit_of_measure,
            pack_size: product.pack_size,
            image_paths: product.image_paths ?? [],
            image_url: getProductImagePublicUrl(
              supabase,
              getFirstProductImagePath(product.image_paths)
            ),
            base_price: Number(product.base_price ?? 0),
            category_id: product.category_id,
            can_buy:
              accessMap.get(product.id)?.can_buy ?? customer.catalog_access_mode === 'all_active'
          }));

        if (visibleProducts.length > 0) {
          result.push({
            id: item.id,
            type: 'group',
            group: {
              id: item.group.id,
              name: item.group.name,
              products: visibleProducts
            }
          });
        }
      }
    }
  }

  return json({ items: result });
};

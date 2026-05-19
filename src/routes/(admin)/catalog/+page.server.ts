import type { PageServerLoad } from './$types';
import { getFirstProductImagePath, getProductImagePublicUrl } from '$lib/server/product-images';

const PAGE_SIZE = 25;

export const load: PageServerLoad = async ({ locals: { supabase }, url }) => {
  const search = url.searchParams.get('q')?.trim() ?? '';
  const status = url.searchParams.get('status') ?? '';
  const categoryId = url.searchParams.get('category') ?? '';
  const page = Math.max(1, Number(url.searchParams.get('page') ?? '1'));
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabase
    .from('products')
    .select(
      'id, sku, name, manufacturer, base_price, status, image_paths, category:categories(id, name), inventory:inventory(quantity_on_hand, low_stock_threshold)',
      { count: 'exact' }
    )
    .order('name', { ascending: true })
    .range(from, to);

  if (search) {
    query = query.or(`name.ilike.%${search}%,sku.ilike.%${search}%`);
  }
  if (status === 'active' || status === 'archived') {
    query = query.eq('status', status);
  }
  if (categoryId) {
    query = query.eq('category_id', categoryId);
  }

  const [productsRes, categoriesRes] = await Promise.all([
    query,
    supabase.from('categories').select('id, name').order('name')
  ]);

  type ProductRow = {
    id: string;
    sku: string;
    name: string;
    manufacturer: string | null;
    base_price: number;
    status: 'active' | 'archived';
    image_paths: string[] | null;
    image_url: string | null;
    category: { id: string; name: string } | null;
    inventory: { quantity_on_hand: number; low_stock_threshold: number } | null;
  };

  const products = ((productsRes.data ?? []) as unknown as Omit<ProductRow, 'image_url'>[]).map(
    (product) => ({
      ...product,
      image_url: getProductImagePublicUrl(supabase, getFirstProductImagePath(product.image_paths))
    })
  );

  return {
    products,
    total: productsRes.count ?? 0,
    page,
    pageSize: PAGE_SIZE,
    categories: (categoriesRes.data ?? []) as Array<{ id: string; name: string }>,
    filters: { search, status, categoryId }
  };
};

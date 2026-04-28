import type { PageServerLoad } from './$types';

const PAGE_SIZE = 50;

export const load: PageServerLoad = async ({ locals: { supabase }, url }) => {
  const filter = url.searchParams.get('filter') ?? '';
  const search = url.searchParams.get('q')?.trim() ?? '';
  const page = Math.max(1, Number(url.searchParams.get('page') ?? '1'));
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabase
    .from('inventory')
    .select(
      'product_id, quantity_on_hand, quantity_reserved, low_stock_threshold, updated_at, product:products!inner(id, sku, name, status, category:categories(name))',
      { count: 'exact' }
    )
    .order('updated_at', { ascending: false })
    .range(from, to);

  if (filter === 'low') {
    query = query.filter('quantity_on_hand', 'lte', 'low_stock_threshold');
  } else if (filter === 'out') {
    query = query.eq('quantity_on_hand', 0);
  }
  if (search) {
    query = query.or(`name.ilike.%${search}%,sku.ilike.%${search}%`, {
      referencedTable: 'products'
    });
  }

  const res = await query;

  type InventoryRow = {
    product_id: string;
    quantity_on_hand: number;
    quantity_reserved: number;
    low_stock_threshold: number;
    updated_at: string;
    product: {
      id: string;
      sku: string;
      name: string;
      status: 'active' | 'archived';
      category: { name: string } | null;
    } | null;
  };

  return {
    rows: (res.data ?? []) as unknown as InventoryRow[],
    total: res.count ?? 0,
    page,
    pageSize: PAGE_SIZE,
    filters: { filter, search }
  };
};

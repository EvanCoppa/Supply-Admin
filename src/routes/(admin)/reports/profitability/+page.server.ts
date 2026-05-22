import type { PageServerLoad } from './$types';

type ProductRow = {
  product_id: string;
  sku: string;
  name: string;
  qty_sold: number;
  revenue: number;
  qty_purchased: number;
  cost: number;
  gross_profit: number;
  margin: number | null;
};

type SupplierRow = {
  supplier_id: string;
  name: string;
  key: string;
  purchase_count: number;
  total_spend: number;
  total_subtotal: number;
  total_freight: number;
  total_distribution_fee: number;
  outstanding_ap: number;
  orders_fulfilled: number;
};

const SORTS = {
  margin_asc: { col: 'margin', asc: true },
  margin_desc: { col: 'margin', asc: false },
  revenue_desc: { col: 'revenue', asc: false },
  gp_desc: { col: 'gross_profit', asc: false }
} as const;
type SortKey = keyof typeof SORTS;

export const load: PageServerLoad = async ({ locals: { supabase }, url }) => {
  const sortParam = (url.searchParams.get('sort') ?? 'gp_desc') as SortKey;
  const sort = SORTS[sortParam] ? sortParam : 'gp_desc';
  const { col, asc } = SORTS[sort];

  const [productsRes, suppliersRes] = await Promise.all([
    supabase
      .from('v_product_profitability')
      .select(
        'product_id, sku, name, qty_sold, revenue, qty_purchased, cost, gross_profit, margin'
      )
      .order(col, { ascending: asc, nullsFirst: false })
      .limit(50),
    supabase
      .from('v_supplier_spend')
      .select(
        'supplier_id, name, key, purchase_count, total_spend, total_subtotal, total_freight, total_distribution_fee, outstanding_ap, orders_fulfilled'
      )
      .order('total_spend', { ascending: false })
  ]);

  return {
    products: (productsRes.data ?? []) as ProductRow[],
    suppliers: (suppliersRes.data ?? []) as SupplierRow[],
    sort
  };
};

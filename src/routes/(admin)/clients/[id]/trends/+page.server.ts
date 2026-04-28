import type { PageServerLoad } from './$types';

const REVENUE_STATUSES = ['paid', 'fulfilled', 'shipped', 'delivered'];
const TOP_PRODUCT_LIMIT = 10;
const FREQUENCY_MONTHS = 12;

type LineItemRow = {
  quantity: number;
  line_total: number;
  unit_price_snapshot: number;
  product_sku_snapshot: string;
  product_name_snapshot: string;
  product: {
    id: string;
    name: string;
    sku: string;
    category_id: string | null;
    category: { id: string; name: string } | null;
  } | null;
  order: {
    id: string;
    customer_id: string;
    status: string;
    placed_at: string;
  } | null;
};

type ProductAgg = {
  product_id: string;
  sku: string;
  name: string;
  quantity: number;
  revenue: number;
  last_ordered_at: string | null;
};

type CategoryAgg = {
  category_id: string;
  name: string;
  revenue: number;
};

export const load: PageServerLoad = async ({ params, locals: { supabase }, url }) => {
  const lapsedDays = Math.max(
    1,
    Math.min(365, Number(url.searchParams.get('lapsedDays') ?? '90'))
  );

  const now = new Date();
  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const frequencyStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (FREQUENCY_MONTHS - 1), 1)
  );
  const lapsedCutoff = new Date(now.getTime() - lapsedDays * 24 * 60 * 60 * 1000);

  const lineItemsRes = await supabase
    .from('order_line_items')
    .select(
      'quantity, line_total, unit_price_snapshot, product_sku_snapshot, product_name_snapshot,' +
        ' product:products(id, name, sku, category_id, category:categories(id, name)),' +
        ' order:orders!inner(id, customer_id, status, placed_at)'
    )
    .eq('order.customer_id', params.id)
    .in('order.status', REVENUE_STATUSES);

  const lineItems = ((lineItemsRes.data ?? []) as unknown as LineItemRow[]).filter(
    (li) => li.order !== null
  );

  // Order frequency: orders per month for the last 12 months.
  const monthBuckets = new Map<string, { orderIds: Set<string>; revenue: number }>();
  for (let i = 0; i < FREQUENCY_MONTHS; i++) {
    const d = new Date(
      Date.UTC(frequencyStart.getUTCFullYear(), frequencyStart.getUTCMonth() + i, 1)
    );
    monthBuckets.set(monthKey(d), { orderIds: new Set(), revenue: 0 });
  }
  for (const li of lineItems) {
    const placed = new Date(li.order!.placed_at);
    if (placed < frequencyStart) continue;
    const key = monthKey(placed);
    const bucket = monthBuckets.get(key);
    if (!bucket) continue;
    bucket.orderIds.add(li.order!.id);
    bucket.revenue += Number(li.line_total);
  }
  const orderFrequency = Array.from(monthBuckets.entries()).map(([key, b]) => ({
    month: key,
    orders: b.orderIds.size,
    revenue: b.revenue
  }));

  // Per-product aggregation (lifetime, used by top tables and lapsed items).
  const productMap = new Map<string, ProductAgg>();
  const categoryMap = new Map<string, CategoryAgg>();
  let totalRevenue = 0;
  let uncategorizedRevenue = 0;
  const orderIds = new Set<string>();
  let firstOrderAt: string | null = null;
  let lastOrderAt: string | null = null;

  for (const li of lineItems) {
    const placedAt = li.order!.placed_at;
    orderIds.add(li.order!.id);
    if (!firstOrderAt || placedAt < firstOrderAt) firstOrderAt = placedAt;
    if (!lastOrderAt || placedAt > lastOrderAt) lastOrderAt = placedAt;

    const productId = li.product?.id ?? li.product_sku_snapshot;
    const sku = li.product?.sku ?? li.product_sku_snapshot;
    const name = li.product?.name ?? li.product_name_snapshot;
    const existing = productMap.get(productId);
    const lineTotal = Number(li.line_total);
    const qty = Number(li.quantity);
    if (existing) {
      existing.quantity += qty;
      existing.revenue += lineTotal;
      if (!existing.last_ordered_at || placedAt > existing.last_ordered_at) {
        existing.last_ordered_at = placedAt;
      }
    } else {
      productMap.set(productId, {
        product_id: productId,
        sku,
        name,
        quantity: qty,
        revenue: lineTotal,
        last_ordered_at: placedAt
      });
    }

    totalRevenue += lineTotal;
    const category = li.product?.category;
    if (category) {
      const cat = categoryMap.get(category.id);
      if (cat) cat.revenue += lineTotal;
      else
        categoryMap.set(category.id, {
          category_id: category.id,
          name: category.name,
          revenue: lineTotal
        });
    } else {
      uncategorizedRevenue += lineTotal;
    }
  }

  const allProducts = Array.from(productMap.values());

  const topByQuantity = [...allProducts]
    .sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue)
    .slice(0, TOP_PRODUCT_LIMIT);

  const topByRevenue = [...allProducts]
    .sort((a, b) => b.revenue - a.revenue || b.quantity - a.quantity)
    .slice(0, TOP_PRODUCT_LIMIT);

  const categoryMix = Array.from(categoryMap.values()).sort((a, b) => b.revenue - a.revenue);
  if (uncategorizedRevenue > 0) {
    categoryMix.push({
      category_id: 'uncategorized',
      name: 'Uncategorized',
      revenue: uncategorizedRevenue
    });
  }

  const lapsedItems = allProducts
    .filter((p) => p.last_ordered_at !== null && new Date(p.last_ordered_at) < lapsedCutoff)
    .sort((a, b) => b.revenue - a.revenue);

  return {
    summary: {
      total_orders: orderIds.size,
      total_revenue: totalRevenue,
      first_order_at: firstOrderAt,
      last_order_at: lastOrderAt,
      this_month_revenue: monthBuckets.get(monthKey(startOfMonth))?.revenue ?? 0,
      this_month_orders: monthBuckets.get(monthKey(startOfMonth))?.orderIds.size ?? 0
    },
    orderFrequency,
    topByQuantity,
    topByRevenue,
    categoryMix,
    lapsedItems,
    lapsedDays,
    lapsedCutoff: lapsedCutoff.toISOString()
  };
};

function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

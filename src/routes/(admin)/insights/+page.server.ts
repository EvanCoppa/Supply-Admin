import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

type VelocityRow = {
  product_id: string;
  sku: string | null;
  name: string | null;
  total_qty: number;
  unique_customers: number;
  order_count: number;
  revenue: number;
};

type RepeatRow = {
  customer_id: string;
  product_id: string;
  product_name: string | null;
  product_sku: string | null;
  order_count: number;
  total_qty: number;
  last_ordered_at: string;
};

type OrderRow = {
  id: string;
  customer_id: string;
  status: string;
  total: number;
  placed_at: string;
};

type LineItemRow = {
  order_id: string;
  product_id: string;
  quantity: number;
  line_total: number;
};

type ProductCatRow = {
  id: string;
  category_id: string | null;
};

type CategoryRow = { id: string; name: string };

const COUNTED_STATUSES = new Set(['pending_payment', 'paid', 'fulfilled', 'shipped', 'delivered']);

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function isoDay(d: Date): string {
  return startOfDay(d).toISOString().slice(0, 10);
}

export const load: PageServerLoad = async ({ locals: { supabase } }) => {
  const now = new Date();
  const windowStart = new Date(now.getTime() - 30 * 86_400_000);
  const priorStart = new Date(now.getTime() - 60 * 86_400_000);

  const [velocityRes, repeatsRes, watchlistRes, ordersRes, productsRes, categoriesRes] =
    await Promise.all([
      supabase
        .from('v_product_velocity_30d')
        .select('product_id, sku, name, total_qty, unique_customers, order_count, revenue')
        .order('total_qty', { ascending: false })
        .limit(20),
      supabase
        .from('v_client_product_repeats_30d')
        .select(
          'customer_id, product_id, product_name, product_sku, order_count, total_qty, last_ordered_at'
        )
        .order('order_count', { ascending: false })
        .limit(50),
      supabase
        .from('watchlist_items')
        .select('id, product_id, notes, created_at, product:products(id, sku, name)')
        .order('created_at', { ascending: false }),
      supabase
        .from('orders')
        .select('id, customer_id, status, total, placed_at')
        .gte('placed_at', priorStart.toISOString())
        .order('placed_at', { ascending: true }),
      supabase.from('products').select('id, category_id'),
      supabase.from('categories').select('id, name')
    ]);

  const velocity = (velocityRes.data ?? []) as VelocityRow[];
  const repeats = (repeatsRes.data ?? []) as RepeatRow[];
  const orders = (ordersRes.data ?? []) as OrderRow[];
  const products = (productsRes.data ?? []) as ProductCatRow[];
  const categories = (categoriesRes.data ?? []) as CategoryRow[];

  const customerIds = Array.from(
    new Set([...repeats.map((r) => r.customer_id), ...orders.map((o) => o.customer_id)])
  );
  const customersRes = customerIds.length
    ? await supabase.from('customers').select('id, business_name').in('id', customerIds)
    : { data: [] };
  const customerMap = new Map<string, string>(
    ((customersRes.data ?? []) as { id: string; business_name: string }[]).map((c) => [
      c.id,
      c.business_name
    ])
  );

  const recentOrderIds = orders
    .filter((o) => new Date(o.placed_at) >= windowStart && COUNTED_STATUSES.has(o.status))
    .map((o) => o.id);

  const lineItemsRes = recentOrderIds.length
    ? await supabase
        .from('order_line_items')
        .select('order_id, product_id, quantity, line_total')
        .in('order_id', recentOrderIds)
    : { data: [] };
  const lineItems = (lineItemsRes.data ?? []) as LineItemRow[];

  const repeatsWithCustomer = repeats.map((r) => ({
    ...r,
    customer_name: customerMap.get(r.customer_id) ?? 'Unknown'
  }));

  const windowOrders = orders.filter(
    (o) => new Date(o.placed_at) >= windowStart && COUNTED_STATUSES.has(o.status)
  );
  const priorOrders = orders.filter(
    (o) =>
      new Date(o.placed_at) >= priorStart &&
      new Date(o.placed_at) < windowStart &&
      COUNTED_STATUSES.has(o.status)
  );

  const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);
  const revenue = sum(windowOrders.map((o) => Number(o.total)));
  const priorRevenue = sum(priorOrders.map((o) => Number(o.total)));
  const orderCount = windowOrders.length;
  const priorOrderCount = priorOrders.length;
  const uniqueCustomers = new Set(windowOrders.map((o) => o.customer_id)).size;
  const priorUniqueCustomers = new Set(priorOrders.map((o) => o.customer_id)).size;
  const aov = orderCount > 0 ? revenue / orderCount : 0;
  const priorAov = priorOrderCount > 0 ? priorRevenue / priorOrderCount : 0;

  const dailyMap = new Map<string, { revenue: number; orders: number }>();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86_400_000);
    dailyMap.set(isoDay(d), { revenue: 0, orders: 0 });
  }
  for (const o of windowOrders) {
    const key = isoDay(new Date(o.placed_at));
    const bucket = dailyMap.get(key);
    if (bucket) {
      bucket.revenue += Number(o.total);
      bucket.orders += 1;
    }
  }
  const daily = Array.from(dailyMap.entries()).map(([day, v]) => ({
    day,
    revenue: Math.round(v.revenue * 100) / 100,
    orders: v.orders
  }));

  const statusMix = new Map<string, number>();
  for (const o of windowOrders) {
    statusMix.set(o.status, (statusMix.get(o.status) ?? 0) + 1);
  }
  const statusBreakdown = Array.from(statusMix.entries())
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => b.count - a.count);

  const customerRevenueMap = new Map<string, { revenue: number; orders: number }>();
  for (const o of windowOrders) {
    const cur = customerRevenueMap.get(o.customer_id) ?? { revenue: 0, orders: 0 };
    cur.revenue += Number(o.total);
    cur.orders += 1;
    customerRevenueMap.set(o.customer_id, cur);
  }
  const topCustomers = Array.from(customerRevenueMap.entries())
    .map(([id, v]) => ({
      customer_id: id,
      customer_name: customerMap.get(id) ?? 'Unknown',
      revenue: Math.round(v.revenue * 100) / 100,
      orders: v.orders
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 8);

  const productCatMap = new Map(products.map((p) => [p.id, p.category_id]));
  const categoryMap = new Map(categories.map((c) => [c.id, c.name]));
  const catRevenue = new Map<string, number>();
  for (const li of lineItems) {
    const catId = productCatMap.get(li.product_id) ?? null;
    const label = catId ? (categoryMap.get(catId) ?? 'Uncategorized') : 'Uncategorized';
    catRevenue.set(label, (catRevenue.get(label) ?? 0) + Number(li.line_total));
  }
  const categoryBreakdown = Array.from(catRevenue.entries())
    .map(([name, rev]) => ({ name, revenue: Math.round(rev * 100) / 100 }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 6);

  const velocitySparkMap = new Map<string, number[]>();
  for (const v of velocity) velocitySparkMap.set(v.product_id, new Array(14).fill(0));
  const sparkStart = new Date(now.getTime() - 13 * 86_400_000);
  const orderIdToDay = new Map<string, string>();
  for (const o of windowOrders) {
    if (new Date(o.placed_at) >= sparkStart) orderIdToDay.set(o.id, isoDay(new Date(o.placed_at)));
  }
  for (const li of lineItems) {
    const day = orderIdToDay.get(li.order_id);
    if (!day) continue;
    const arr = velocitySparkMap.get(li.product_id);
    if (!arr) continue;
    const idx = Math.floor((new Date(day).getTime() - sparkStart.getTime()) / 86_400_000);
    if (idx >= 0 && idx < 14) arr[idx] = (arr[idx] ?? 0) + Number(li.quantity);
  }
  const velocityWithSpark = velocity.map((v) => ({
    ...v,
    spark: velocitySparkMap.get(v.product_id) ?? new Array(14).fill(0)
  }));

  return {
    velocity: velocityWithSpark,
    repeats: repeatsWithCustomer,
    watchlist: (watchlistRes.data ?? []) as unknown as {
      id: string;
      product_id: string;
      notes: string | null;
      created_at: string;
      product: { id: string; sku: string; name: string } | null;
    }[],
    kpis: {
      revenue,
      priorRevenue,
      orderCount,
      priorOrderCount,
      uniqueCustomers,
      priorUniqueCustomers,
      aov,
      priorAov
    },
    daily,
    statusBreakdown,
    topCustomers,
    categoryBreakdown
  };
};

export const actions: Actions = {
  watch: async ({ request, locals: { supabase, user } }) => {
    const form = await request.formData();
    const productId = String(form.get('product_id') ?? '').trim();
    const notes = String(form.get('notes') ?? '').trim() || null;
    if (!productId) return fail(400, { message: 'Product is required.' });

    const { error } = await supabase
      .from('watchlist_items')
      .upsert(
        { product_id: productId, notes, added_by: user?.id ?? null },
        { onConflict: 'product_id' }
      );
    if (error) return fail(400, { message: error.message });
    return { saved: true };
  },

  unwatch: async ({ request, locals: { supabase } }) => {
    const form = await request.formData();
    const id = String(form.get('id') ?? '').trim();
    if (!id) return fail(400, { message: 'Missing id.' });
    const { error } = await supabase.from('watchlist_items').delete().eq('id', id);
    if (error) return fail(400, { message: error.message });
    return { saved: true };
  }
};

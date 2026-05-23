import type { SupabaseClient } from '@supabase/supabase-js';
import {
  canBuyProduct,
  getAccessMap,
  getCatalogCustomer,
  resolveCustomerPrice
} from '$lib/server/supply-catalog';

const REVENUE_STATUSES = ['paid', 'fulfilled', 'shipped', 'delivered'];

const DEFAULT_LOOKBACK_DAYS = 180;
const DEFAULT_HORIZON_DAYS = 30;
const DEFAULT_LIMIT = 25;
const MAX_LOOKBACK_DAYS = 730;
const MAX_HORIZON_DAYS = 180;
const MAX_LIMIT = 100;

type Confidence = 'low' | 'medium' | 'high';
type StockStatus = 'in_stock' | 'low_stock' | 'out_of_stock';

type InventoryRow = {
  quantity_on_hand: number | string | null;
  quantity_reserved: number | string | null;
  low_stock_threshold: number | string | null;
  updated_at: string | null;
};

type ProductRow = {
  id: string;
  sku: string;
  name: string;
  manufacturer: string | null;
  unit_of_measure: string | null;
  pack_size: number | string | null;
  base_price: number | string | null;
  status: string;
  category: { id: string; name: string } | null;
  inventory: InventoryRow | InventoryRow[] | null;
};

type LineItemRow = {
  product_id: string;
  quantity: number | string;
  line_total: number | string;
  unit_price_snapshot: number | string;
  product_sku_snapshot: string;
  product_name_snapshot: string;
  order: {
    id: string;
    customer_id: string;
    status: string;
    placed_at: string;
  } | null;
  product: ProductRow | null;
};

type ProductAggregate = {
  product: ProductRow;
  totalQuantity: number;
  totalRevenue: number;
  orderIds: Set<string>;
  firstOrderedAt: string;
  lastOrderedAt: string;
  lastOrderQuantity: number;
};

export type ReorderPlannerOptions = {
  lookbackDays: number;
  horizonDays: number;
  limit: number;
  includeUnavailable: boolean;
  includeNotDue: boolean;
};

export type ReorderPlanItem = {
  product: {
    id: string;
    sku: string;
    name: string;
    manufacturer: string | null;
    category: { id: string; name: string } | null;
    unit_of_measure: string | null;
    pack_size: number | null;
  };
  usage: {
    order_count: number;
    total_quantity: number;
    total_spend: number;
    first_ordered_at: string;
    last_ordered_at: string;
    last_order_quantity: number;
    avg_daily_quantity: number;
    avg_30_day_quantity: number;
    days_since_last_order: number;
    estimated_customer_remaining_quantity: number;
  };
  recommendation: {
    recommended_quantity: number;
    recommended_value: number;
    fulfillable_quantity: number;
    confidence: Confidence;
    next_reorder_at: string | null;
    days_until_reorder: number | null;
    reasons: string[];
  };
  inventory: {
    quantity_on_hand: number;
    quantity_reserved: number;
    available_quantity: number;
    low_stock_threshold: number;
    stock_status: StockStatus;
    updated_at: string | null;
  };
  customer_price: number;
};

export type ReorderPlan = {
  customer_id: string;
  generated_at: string;
  lookback_days: number;
  horizon_days: number;
  window_start: string;
  items: ReorderPlanItem[];
  summary: {
    recommended_count: number;
    out_of_stock_count: number;
    low_stock_count: number;
    not_due_count: number;
  };
};

export function readReorderPlannerOptions(url: URL): ReorderPlannerOptions {
  return {
    lookbackDays: readBoundedInt(
      url.searchParams.get('lookback_days'),
      DEFAULT_LOOKBACK_DAYS,
      30,
      MAX_LOOKBACK_DAYS
    ),
    horizonDays: readBoundedInt(
      url.searchParams.get('horizon_days'),
      DEFAULT_HORIZON_DAYS,
      7,
      MAX_HORIZON_DAYS
    ),
    limit: readBoundedInt(url.searchParams.get('limit'), DEFAULT_LIMIT, 1, MAX_LIMIT),
    includeUnavailable: readBoolean(url.searchParams.get('include_unavailable'), true),
    includeNotDue: readBoolean(url.searchParams.get('include_not_due'), false)
  };
}

export async function getReorderPlan(
  supabase: SupabaseClient,
  customerId: string,
  options: ReorderPlannerOptions
): Promise<ReorderPlan> {
  const generatedAt = new Date();
  const windowStart = new Date(generatedAt.getTime() - options.lookbackDays * 24 * 60 * 60 * 1000);

  const [customer, accessMap, lineItemsRes] = await Promise.all([
    getCatalogCustomer(supabase, customerId),
    getAccessMap(supabase, customerId),
    supabase
      .from('order_line_items')
      .select(
        'product_id, quantity, line_total, unit_price_snapshot, product_sku_snapshot, product_name_snapshot,' +
          ' order:orders!inner(id, customer_id, status, placed_at),' +
          ' product:products(id, sku, name, manufacturer, unit_of_measure, pack_size, base_price, status,' +
          ' category:categories(id, name),' +
          ' inventory:inventory(quantity_on_hand, quantity_reserved, low_stock_threshold, updated_at))'
      )
      .eq('order.customer_id', customerId)
      .gte('order.placed_at', windowStart.toISOString())
      .in('order.status', REVENUE_STATUSES)
  ]);

  if (lineItemsRes.error) {
    console.error('[reorder-planner] order history lookup failed', lineItemsRes.error);
    throw new Error('Order history lookup failed');
  }

  const aggregateMap = new Map<string, ProductAggregate>();

  for (const row of (lineItemsRes.data ?? []) as unknown as LineItemRow[]) {
    const product = row.product;
    const order = row.order;
    if (!product || !order || product.status !== 'active') continue;
    if (!canBuyProduct(customer.catalog_access_mode, accessMap.get(product.id))) continue;

    const quantity = Math.max(0, Number(row.quantity) || 0);
    if (quantity <= 0) continue;

    const total = Math.max(0, Number(row.line_total) || 0);
    const existing = aggregateMap.get(product.id);

    if (existing) {
      existing.totalQuantity += quantity;
      existing.totalRevenue += total;
      existing.orderIds.add(order.id);
      if (order.placed_at < existing.firstOrderedAt) existing.firstOrderedAt = order.placed_at;
      if (order.placed_at > existing.lastOrderedAt) {
        existing.lastOrderedAt = order.placed_at;
        existing.lastOrderQuantity = quantity;
      } else if (order.placed_at === existing.lastOrderedAt) {
        existing.lastOrderQuantity += quantity;
      }
    } else {
      aggregateMap.set(product.id, {
        product,
        totalQuantity: quantity,
        totalRevenue: total,
        orderIds: new Set([order.id]),
        firstOrderedAt: order.placed_at,
        lastOrderedAt: order.placed_at,
        lastOrderQuantity: quantity
      });
    }
  }

  const baseItems = Array.from(aggregateMap.values()).map((agg) =>
    buildUnpricedRecommendation(agg, generatedAt, options.horizonDays)
  );

  const filteredItems = baseItems.filter((item) => {
    if (!options.includeUnavailable && item.inventory.available_quantity <= 0) return false;
    return options.includeNotDue || item.recommendation.recommended_quantity > 0;
  });

  const sortedItems = filteredItems.sort(compareRecommendations).slice(0, options.limit);

  const items = await Promise.all(
    sortedItems.map(async (item) => {
      const customerPrice = await resolveCustomerPrice(supabase, customerId, {
        id: item.product.id,
        base_price: item.customer_price
      });
      return {
        ...item,
        customer_price: customerPrice,
        recommendation: {
          ...item.recommendation,
          recommended_value: roundMoney(customerPrice * item.recommendation.recommended_quantity)
        }
      };
    })
  );

  return {
    customer_id: customerId,
    generated_at: generatedAt.toISOString(),
    lookback_days: options.lookbackDays,
    horizon_days: options.horizonDays,
    window_start: windowStart.toISOString(),
    items,
    summary: {
      recommended_count: baseItems.filter((item) => item.recommendation.recommended_quantity > 0)
        .length,
      out_of_stock_count: baseItems.filter((item) => item.inventory.stock_status === 'out_of_stock')
        .length,
      low_stock_count: baseItems.filter((item) => item.inventory.stock_status === 'low_stock')
        .length,
      not_due_count: baseItems.filter((item) => item.recommendation.recommended_quantity === 0)
        .length
    }
  };
}

function buildUnpricedRecommendation(
  agg: ProductAggregate,
  now: Date,
  horizonDays: number
): ReorderPlanItem {
  const product = agg.product;
  const inventory = normalizeInventory(product.inventory);
  const quantityOnHand = Math.max(0, Number(inventory?.quantity_on_hand) || 0);
  const quantityReserved = Math.max(0, Number(inventory?.quantity_reserved) || 0);
  const lowStockThreshold = Math.max(0, Number(inventory?.low_stock_threshold) || 0);
  const availableQuantity = Math.max(0, quantityOnHand - quantityReserved);
  const stockStatus: StockStatus =
    availableQuantity <= 0
      ? 'out_of_stock'
      : quantityOnHand <= lowStockThreshold
        ? 'low_stock'
        : 'in_stock';

  const firstOrderedAt = new Date(agg.firstOrderedAt);
  const lastOrderedAt = new Date(agg.lastOrderedAt);
  const activeDays = Math.max(30, daysBetween(firstOrderedAt, now));
  const daysSinceLastOrder = Math.max(0, daysBetween(lastOrderedAt, now));
  const avgDailyQuantity = agg.totalQuantity / activeDays;
  const avg30DayQuantity = avgDailyQuantity * 30;
  const estimatedRemaining = Math.max(
    0,
    agg.lastOrderQuantity - avgDailyQuantity * daysSinceLastOrder
  );
  const projectedNeed = avgDailyQuantity * horizonDays;
  const recommendedQuantity = Math.ceil(Math.max(0, projectedNeed - estimatedRemaining));
  const fulfillableQuantity = Math.min(recommendedQuantity, availableQuantity);
  const daysUntilReorder =
    avgDailyQuantity > 0 ? Math.ceil(estimatedRemaining / avgDailyQuantity) : null;
  const nextReorderAt =
    daysUntilReorder === null
      ? null
      : new Date(now.getTime() + daysUntilReorder * 24 * 60 * 60 * 1000).toISOString();
  const confidence = confidenceFor(agg.orderIds.size, activeDays);
  const reasons = recommendationReasons({
    recommendedQuantity,
    horizonDays,
    orderCount: agg.orderIds.size,
    lookbackDays: activeDays,
    stockStatus
  });
  const basePrice = Math.max(0, Number(product.base_price) || 0);

  return {
    product: {
      id: product.id,
      sku: product.sku,
      name: product.name,
      manufacturer: product.manufacturer,
      category: product.category,
      unit_of_measure: product.unit_of_measure,
      pack_size: product.pack_size === null ? null : Number(product.pack_size)
    },
    usage: {
      order_count: agg.orderIds.size,
      total_quantity: roundQuantity(agg.totalQuantity),
      total_spend: roundMoney(agg.totalRevenue),
      first_ordered_at: agg.firstOrderedAt,
      last_ordered_at: agg.lastOrderedAt,
      last_order_quantity: roundQuantity(agg.lastOrderQuantity),
      avg_daily_quantity: roundQuantity(avgDailyQuantity),
      avg_30_day_quantity: roundQuantity(avg30DayQuantity),
      days_since_last_order: daysSinceLastOrder,
      estimated_customer_remaining_quantity: roundQuantity(estimatedRemaining)
    },
    recommendation: {
      recommended_quantity: recommendedQuantity,
      recommended_value: roundMoney(basePrice * recommendedQuantity),
      fulfillable_quantity: fulfillableQuantity,
      confidence,
      next_reorder_at: nextReorderAt,
      days_until_reorder: daysUntilReorder,
      reasons
    },
    inventory: {
      quantity_on_hand: quantityOnHand,
      quantity_reserved: quantityReserved,
      available_quantity: availableQuantity,
      low_stock_threshold: lowStockThreshold,
      stock_status: stockStatus,
      updated_at: inventory?.updated_at ?? null
    },
    customer_price: basePrice
  };
}

function compareRecommendations(a: ReorderPlanItem, b: ReorderPlanItem): number {
  const aDue = a.recommendation.recommended_quantity > 0 ? 1 : 0;
  const bDue = b.recommendation.recommended_quantity > 0 ? 1 : 0;
  if (aDue !== bDue) return bDue - aDue;

  const aDays = a.recommendation.days_until_reorder ?? Number.POSITIVE_INFINITY;
  const bDays = b.recommendation.days_until_reorder ?? Number.POSITIVE_INFINITY;
  if (aDays !== bDays) return aDays - bDays;

  const aConfidence = confidenceRank(a.recommendation.confidence);
  const bConfidence = confidenceRank(b.recommendation.confidence);
  if (aConfidence !== bConfidence) return bConfidence - aConfidence;

  return b.usage.avg_30_day_quantity - a.usage.avg_30_day_quantity;
}

function recommendationReasons(input: {
  recommendedQuantity: number;
  horizonDays: number;
  orderCount: number;
  lookbackDays: number;
  stockStatus: StockStatus;
}): string[] {
  const reasons = [
    input.recommendedQuantity > 0
      ? `Likely needed within ${input.horizonDays} days`
      : `No reorder needed within ${input.horizonDays} days`,
    `Purchased ${input.orderCount} time${input.orderCount === 1 ? '' : 's'} across ${Math.round(
      input.lookbackDays
    )} active days`
  ];

  if (input.stockStatus === 'out_of_stock') reasons.push('Supplier inventory is out of stock');
  if (input.stockStatus === 'low_stock') reasons.push('Supplier inventory is below threshold');

  return reasons;
}

function confidenceFor(orderCount: number, activeDays: number): Confidence {
  if (orderCount >= 4 && activeDays >= 60) return 'high';
  if (orderCount >= 2) return 'medium';
  return 'low';
}

function confidenceRank(confidence: Confidence): number {
  if (confidence === 'high') return 3;
  if (confidence === 'medium') return 2;
  return 1;
}

function normalizeInventory(value: ProductRow['inventory']): InventoryRow | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

function daysBetween(a: Date, b: Date): number {
  return Math.max(0, Math.floor((b.getTime() - a.getTime()) / (24 * 60 * 60 * 1000)));
}

function roundQuantity(value: number): number {
  return Math.round(value * 100) / 100;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function readBoundedInt(raw: string | null, fallback: number, min: number, max: number): number {
  const value = Number(raw);
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(value)));
}

function readBoolean(raw: string | null, fallback: boolean): boolean {
  if (raw === null) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(raw.toLowerCase());
}

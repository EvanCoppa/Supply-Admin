import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getReorderPlan, readReorderPlannerOptions } from './reorder-planner';
import type * as SupplyCatalog from './supply-catalog';

vi.mock('./supply-catalog', async () => {
  const actual = await vi.importActual<typeof SupplyCatalog>('./supply-catalog');
  return {
    ...actual,
    getCatalogCustomer: vi.fn(async () => ({ id: 'cust-1', catalog_access_mode: 'all_active' })),
    getAccessMap: vi.fn(async () => new Map()),
    resolveCustomerPrice: vi.fn(async (_s, _c, p: { base_price: number | string | null }) =>
      Number(p.base_price ?? 0)
    )
  };
});

function makeUrl(search: Record<string, string> = {}): URL {
  const url = new URL('http://app/');
  for (const [k, v] of Object.entries(search)) url.searchParams.set(k, v);
  return url;
}

describe('readReorderPlannerOptions', () => {
  it('clamps to the minimum when params are absent (Number(null) === 0)', () => {
    const opts = readReorderPlannerOptions(makeUrl());
    expect(opts.lookbackDays).toBe(30); // min
    expect(opts.horizonDays).toBe(7); // min
    expect(opts.limit).toBe(1); // min
    expect(opts.includeUnavailable).toBe(true);
    expect(opts.includeNotDue).toBe(false);
  });

  it('uses fallback for explicit non-numeric inputs', () => {
    const opts = readReorderPlannerOptions(
      makeUrl({ lookback_days: 'abc', horizon_days: 'NaN', limit: 'nope' })
    );
    expect(opts.lookbackDays).toBe(180);
    expect(opts.horizonDays).toBe(30);
    expect(opts.limit).toBe(25);
  });

  it('clamps lookback / horizon / limit to bounds', () => {
    const opts = readReorderPlannerOptions(
      makeUrl({ lookback_days: '10', horizon_days: '500', limit: '1000' })
    );
    expect(opts.lookbackDays).toBe(30); // min 30
    expect(opts.horizonDays).toBe(180); // max 180
    expect(opts.limit).toBe(100); // max 100
  });

  it('parses boolean params', () => {
    expect(
      readReorderPlannerOptions(makeUrl({ include_unavailable: 'false' })).includeUnavailable
    ).toBe(false);
    expect(readReorderPlannerOptions(makeUrl({ include_not_due: 'true' })).includeNotDue).toBe(
      true
    );
    expect(readReorderPlannerOptions(makeUrl({ include_not_due: 'YES' })).includeNotDue).toBe(true);
    expect(readReorderPlannerOptions(makeUrl({ include_not_due: 'on' })).includeNotDue).toBe(true);
  });
});

type LineItemRow = {
  product_id: string;
  quantity: number;
  line_total: number;
  unit_price_snapshot: number;
  product_sku_snapshot: string;
  product_name_snapshot: string;
  order: { id: string; customer_id: string; status: string; placed_at: string } | null;
  product: {
    id: string;
    sku: string;
    name: string;
    manufacturer: string | null;
    unit_of_measure: string | null;
    pack_size: number | null;
    base_price: number;
    status: string;
    category: { id: string; name: string } | null;
    inventory: {
      quantity_on_hand: number;
      quantity_reserved: number;
      low_stock_threshold: number;
      updated_at: string | null;
    } | null;
  } | null;
};

function buildSupabase(
  rows: LineItemRow[],
  error: { message: string } | null = null
): SupabaseClient {
  const inFn = vi.fn().mockResolvedValue({ data: rows, error });
  const gte = vi.fn().mockReturnValue({ in: inFn });
  const eq = vi.fn().mockReturnValue({ gte });
  const select = vi.fn().mockReturnValue({ eq });
  return {
    from: vi.fn().mockReturnValue({ select })
  } as unknown as SupabaseClient;
}

function makeRow(overrides: Partial<LineItemRow> = {}): LineItemRow {
  return {
    product_id: 'p1',
    quantity: 10,
    line_total: 100,
    unit_price_snapshot: 10,
    product_sku_snapshot: 'SKU',
    product_name_snapshot: 'Widget',
    order: {
      id: 'o1',
      customer_id: 'cust-1',
      status: 'paid',
      placed_at: '2025-01-01T00:00:00Z'
    },
    product: {
      id: 'p1',
      sku: 'SKU',
      name: 'Widget',
      manufacturer: 'ACo',
      unit_of_measure: 'each',
      pack_size: 1,
      base_price: 10,
      status: 'active',
      category: { id: 'cat-1', name: 'Cat' },
      inventory: {
        quantity_on_hand: 100,
        quantity_reserved: 10,
        low_stock_threshold: 5,
        updated_at: '2025-06-01T00:00:00Z'
      }
    },
    ...overrides
  };
}

describe('getReorderPlan', () => {
  const defaultOptions = {
    lookbackDays: 180,
    horizonDays: 30,
    limit: 25,
    includeUnavailable: true,
    includeNotDue: true
  };

  it('throws when line item lookup errors', async () => {
    const supabase = buildSupabase([], { message: 'db down' });
    await expect(getReorderPlan(supabase, 'cust-1', defaultOptions)).rejects.toThrow(
      /Order history lookup failed/
    );
  });

  it('aggregates multiple rows of the same product across orders', async () => {
    const rows = [
      makeRow({
        order: {
          id: 'o1',
          customer_id: 'cust-1',
          status: 'paid',
          placed_at: '2025-01-01T00:00:00Z'
        },
        quantity: 5,
        line_total: 50
      }),
      makeRow({
        order: {
          id: 'o2',
          customer_id: 'cust-1',
          status: 'shipped',
          placed_at: '2025-03-01T00:00:00Z'
        },
        quantity: 5,
        line_total: 50
      })
    ];
    const supabase = buildSupabase(rows);
    const plan = await getReorderPlan(supabase, 'cust-1', defaultOptions);
    expect(plan.items).toHaveLength(1);
    expect(plan.items[0]!.usage.order_count).toBe(2);
    expect(plan.items[0]!.usage.total_quantity).toBe(10);
    expect(plan.items[0]!.usage.last_ordered_at).toBe('2025-03-01T00:00:00Z');
    expect(plan.items[0]!.usage.first_ordered_at).toBe('2025-01-01T00:00:00Z');
  });

  it('skips rows with archived products or missing product/order', async () => {
    const rows = [
      makeRow({ product: null }),
      makeRow({ order: null }),
      makeRow({
        product_id: 'p2',
        product: { ...makeRow().product!, id: 'p2', status: 'archived' }
      })
    ];
    const supabase = buildSupabase(rows);
    const plan = await getReorderPlan(supabase, 'cust-1', defaultOptions);
    expect(plan.items).toHaveLength(0);
  });

  it('classifies stock status correctly', async () => {
    const supabase = buildSupabase([
      makeRow({
        product_id: 'out',
        product: {
          ...makeRow().product!,
          id: 'out',
          inventory: {
            quantity_on_hand: 0,
            quantity_reserved: 0,
            low_stock_threshold: 0,
            updated_at: null
          }
        }
      })
    ]);
    const plan = await getReorderPlan(supabase, 'cust-1', defaultOptions);
    expect(plan.items[0]!.inventory.stock_status).toBe('out_of_stock');
    expect(plan.summary.out_of_stock_count).toBeGreaterThanOrEqual(1);
  });

  it('handles inventory delivered as an array', async () => {
    const supabase = buildSupabase([
      makeRow({
        product: {
          ...makeRow().product!,
          inventory: [
            {
              quantity_on_hand: 50,
              quantity_reserved: 0,
              low_stock_threshold: 0,
              updated_at: null
            }
          ] as never
        }
      })
    ]);
    const plan = await getReorderPlan(supabase, 'cust-1', defaultOptions);
    expect(plan.items[0]!.inventory.quantity_on_hand).toBe(50);
  });

  it('filters out unavailable items when includeUnavailable=false', async () => {
    const supabase = buildSupabase([
      makeRow({
        product: {
          ...makeRow().product!,
          inventory: {
            quantity_on_hand: 0,
            quantity_reserved: 0,
            low_stock_threshold: 0,
            updated_at: null
          }
        }
      })
    ]);
    const plan = await getReorderPlan(supabase, 'cust-1', {
      ...defaultOptions,
      includeUnavailable: false
    });
    expect(plan.items).toHaveLength(0);
  });

  it('filters not-due items when includeNotDue=false', async () => {
    // High inventory + recent large order => no reorder due.
    const supabase = buildSupabase([
      makeRow({
        order: {
          id: 'o1',
          customer_id: 'cust-1',
          status: 'paid',
          placed_at: new Date().toISOString()
        },
        quantity: 10000,
        line_total: 10000
      })
    ]);
    const plan = await getReorderPlan(supabase, 'cust-1', {
      ...defaultOptions,
      includeNotDue: false
    });
    // recommended_quantity should be 0 → filtered out
    expect(plan.items.every((i) => i.recommendation.recommended_quantity > 0)).toBe(true);
  });

  it('honors the limit', async () => {
    const rows: LineItemRow[] = [];
    for (let i = 0; i < 5; i++) {
      rows.push(
        makeRow({
          product_id: `p${i}`,
          product: { ...makeRow().product!, id: `p${i}`, sku: `SKU${i}` }
        })
      );
    }
    const supabase = buildSupabase(rows);
    const plan = await getReorderPlan(supabase, 'cust-1', { ...defaultOptions, limit: 2 });
    expect(plan.items.length).toBeLessThanOrEqual(2);
  });

  it('sets confidence high when many orders across many days', async () => {
    const rows: LineItemRow[] = [];
    for (let i = 0; i < 6; i++) {
      const d = new Date(2025, 0, 1 + i * 20).toISOString();
      rows.push(
        makeRow({
          order: { id: `o${i}`, customer_id: 'cust-1', status: 'paid', placed_at: d }
        })
      );
    }
    const supabase = buildSupabase(rows);
    const plan = await getReorderPlan(supabase, 'cust-1', defaultOptions);
    expect(plan.items[0]!.recommendation.confidence).toBe('high');
  });

  it('includes summary counts and metadata', async () => {
    const supabase = buildSupabase([makeRow()]);
    const plan = await getReorderPlan(supabase, 'cust-1', defaultOptions);
    expect(plan.customer_id).toBe('cust-1');
    expect(plan.lookback_days).toBe(180);
    expect(plan.horizon_days).toBe(30);
    expect(plan.window_start).toBeTruthy();
    expect(plan.generated_at).toBeTruthy();
    expect(plan.summary).toHaveProperty('recommended_count');
    expect(plan.summary).toHaveProperty('not_due_count');
  });

  it('rejects items where quantity is 0', async () => {
    const supabase = buildSupabase([makeRow({ quantity: 0 })]);
    const plan = await getReorderPlan(supabase, 'cust-1', defaultOptions);
    expect(plan.items).toHaveLength(0);
  });
});

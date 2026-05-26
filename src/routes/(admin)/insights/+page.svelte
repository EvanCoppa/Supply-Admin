<script lang="ts">
  import { enhance } from '$app/forms';
  import { currency, dateShort } from '$lib/format';
  import AreaChart from '$lib/components/charts/AreaChart.svelte';
  import HorizontalBar from '$lib/components/charts/HorizontalBar.svelte';
  import Donut from '$lib/components/charts/Donut.svelte';
  import Sparkline from '$lib/components/charts/Sparkline.svelte';

  let { data, form } = $props();

  const watchedIds = $derived(new Set(data.watchlist.map((w) => w.product_id)));

  function daysSince(iso: string): number {
    const d = new Date(iso);
    return Math.floor((Date.now() - d.getTime()) / 86_400_000);
  }

  function compact(n: number): string {
    if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
    if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(1)}k`;
    return `$${n.toFixed(0)}`;
  }

  function delta(current: number, prior: number): { pct: number; dir: 'up' | 'down' | 'flat' } {
    if (prior === 0) {
      if (current === 0) return { pct: 0, dir: 'flat' };
      return { pct: 100, dir: 'up' };
    }
    const pct = ((current - prior) / prior) * 100;
    const dir = pct > 0.5 ? 'up' : pct < -0.5 ? 'down' : 'flat';
    return { pct, dir };
  }

  const dailyChart = $derived(
    data.daily.map((d) => {
      const dt = new Date(d.day);
      return {
        label: dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        value: d.revenue,
        secondary: d.orders
      };
    })
  );

  const customerBars = $derived(
    data.topCustomers.map((c) => ({
      label: c.customer_name,
      value: c.revenue,
      sub: `${c.orders} order${c.orders === 1 ? '' : 's'}`,
      href: `/clients/${c.customer_id}`
    }))
  );

  const STATUS_COLORS: Record<string, string> = {
    pending_payment: '#fbbf24',
    paid: '#0ea5e9',
    fulfilled: '#8b5cf6',
    shipped: '#6366f1',
    delivered: '#10b981',
    cancelled: '#94a3b8',
    refunded: '#f43f5e'
  };

  const STATUS_LABELS: Record<string, string> = {
    pending_payment: 'Pending payment',
    paid: 'Paid',
    fulfilled: 'Fulfilled',
    shipped: 'Shipped',
    delivered: 'Delivered',
    cancelled: 'Cancelled',
    refunded: 'Refunded'
  };

  const statusSlices = $derived(
    data.statusBreakdown.map((s) => ({
      label: STATUS_LABELS[s.status] ?? s.status,
      value: s.count,
      color: STATUS_COLORS[s.status] ?? '#94a3b8'
    }))
  );

  const CATEGORY_PALETTE = [
    '#0ea5e9',
    '#10b981',
    '#8b5cf6',
    '#f59e0b',
    '#ef4444',
    '#14b8a6',
    '#6366f1'
  ];

  const categorySlices = $derived(
    data.categoryBreakdown.map((c, i) => ({
      label: c.name,
      value: c.revenue,
      color: CATEGORY_PALETTE[i % CATEGORY_PALETTE.length] ?? '#94a3b8'
    }))
  );

  const totalOrders = $derived(data.statusBreakdown.reduce((a, b) => a + b.count, 0));
  const totalCategoryRev = $derived(data.categoryBreakdown.reduce((a, b) => a + b.revenue, 0));

  const revenueDelta = $derived(delta(data.kpis.revenue, data.kpis.priorRevenue));
  const orderDelta = $derived(delta(data.kpis.orderCount, data.kpis.priorOrderCount));
  const customerDelta = $derived(delta(data.kpis.uniqueCustomers, data.kpis.priorUniqueCustomers));
  const aovDelta = $derived(delta(data.kpis.aov, data.kpis.priorAov));

  function deltaClass(dir: 'up' | 'down' | 'flat'): string {
    if (dir === 'up') return 'text-emerald-700 bg-emerald-50';
    if (dir === 'down') return 'text-red-700 bg-red-50';
    return 'text-slate-500 bg-slate-100';
  }

  function deltaSymbol(dir: 'up' | 'down' | 'flat'): string {
    if (dir === 'up') return '▲';
    if (dir === 'down') return '▼';
    return '–';
  }
</script>

<svelte:head><title>Insights · Supply Admin</title></svelte:head>

<section class="space-y-6">
  <header class="flex flex-wrap items-end justify-between gap-3">
    <div>
      <h1 class="text-2xl font-semibold">Business insights</h1>
      <p class="text-sm text-slate-500">
        Revenue, demand, and customer trends across the last 30 days.
      </p>
    </div>
    <div class="text-xs text-slate-500">
      Compared to prior 30 days · updated {dateShort(new Date().toISOString())}
    </div>
  </header>

  {#if form?.message}
    <div class="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">
      {form.message}
    </div>
  {/if}

  <!-- KPI tiles -->
  <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
    {#each [{ label: 'Revenue', value: currency(data.kpis.revenue), d: revenueDelta }, { label: 'Orders', value: data.kpis.orderCount.toLocaleString(), d: orderDelta }, { label: 'Active customers', value: data.kpis.uniqueCustomers.toLocaleString(), d: customerDelta }, { label: 'Avg order value', value: currency(data.kpis.aov), d: aovDelta }] as k}
      <div class="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <p class="text-xs font-medium uppercase tracking-wider text-slate-500">{k.label}</p>
        <div class="mt-1 flex items-baseline justify-between gap-2">
          <p class="text-2xl font-semibold text-slate-900">{k.value}</p>
          <span class="rounded px-1.5 py-0.5 text-xs font-medium {deltaClass(k.d.dir)}">
            {deltaSymbol(k.d.dir)}
            {Math.abs(k.d.pct).toFixed(0)}%
          </span>
        </div>
        <p class="mt-1 text-xs text-slate-400">vs prior 30 days</p>
      </div>
    {/each}
  </div>

  <!-- Revenue trend -->
  <div class="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
    <div class="mb-1 flex items-center justify-between">
      <div>
        <h2 class="text-sm font-semibold uppercase tracking-wider text-slate-500">Revenue trend</h2>
        <p class="text-xs text-slate-400">Daily revenue (solid) and order count (dashed)</p>
      </div>
      <div class="flex items-center gap-3 text-xs text-slate-600">
        <span class="flex items-center gap-1.5"
          ><span class="h-2 w-3 rounded-sm bg-sky-500"></span> Revenue</span
        >
        <span class="flex items-center gap-1.5"
          ><span class="h-0.5 w-3 border-t border-dashed border-slate-400"></span> Orders</span
        >
      </div>
    </div>
    {#if dailyChart.every((d) => d.value === 0 && d.secondary === 0)}
      <p class="py-12 text-center text-sm text-slate-500">
        No orders in the last 30 days to chart.
      </p>
    {:else}
      <AreaChart
        data={dailyChart}
        height={240}
        formatValue={compact}
        formatSecondary={(v) => `${v} orders`}
      />
    {/if}
  </div>

  <!-- Mix charts -->
  <div class="grid gap-5 lg:grid-cols-3">
    <div class="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h2 class="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-500">
        Order status mix
      </h2>
      {#if statusSlices.length === 0}
        <p class="text-sm text-slate-500">No orders in the window.</p>
      {:else}
        <Donut
          data={statusSlices}
          centerValue={totalOrders.toLocaleString()}
          centerLabel="orders"
        />
      {/if}
    </div>

    <div class="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h2 class="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-500">
        Revenue by category
      </h2>
      {#if categorySlices.length === 0}
        <p class="text-sm text-slate-500">No category revenue yet.</p>
      {:else}
        <Donut
          data={categorySlices}
          centerValue={compact(totalCategoryRev)}
          centerLabel="revenue"
          formatValue={(v) => currency(v)}
        />
      {/if}
    </div>

    <div class="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h2 class="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-500">
        Top customers
      </h2>
      {#if customerBars.length === 0}
        <p class="text-sm text-slate-500">No customer revenue in the window.</p>
      {:else}
        <HorizontalBar data={customerBars} formatValue={(v) => currency(v)} color="#10b981" />
      {/if}
    </div>
  </div>

  <!-- Item velocity table -->
  <div class="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
    <div class="mb-3 flex items-center justify-between">
      <div>
        <h2 class="text-sm font-semibold uppercase tracking-wider text-slate-500">
          Trending items
        </h2>
        <p class="text-xs text-slate-400">Top sellers by quantity, last 30 days</p>
      </div>
      <span class="text-xs text-slate-500">{data.velocity.length} items</span>
    </div>
    {#if data.velocity.length === 0}
      <p class="text-sm text-slate-500">No orders in the last 30 days.</p>
    {:else}
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th class="px-3 py-2 text-left font-medium">#</th>
              <th class="px-3 py-2 text-left font-medium">Item</th>
              <th class="px-3 py-2 text-left font-medium">14d trend</th>
              <th class="px-3 py-2 text-right font-medium">Qty</th>
              <th class="px-3 py-2 text-right font-medium">Orders</th>
              <th class="px-3 py-2 text-right font-medium">Clients</th>
              <th class="px-3 py-2 text-right font-medium">Revenue</th>
              <th class="px-3 py-2 text-right font-medium">Watch</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            {#each data.velocity as v, i (v.product_id)}
              <tr class="hover:bg-slate-50">
                <td class="px-3 py-2 text-xs text-slate-400">{i + 1}</td>
                <td class="px-3 py-2">
                  <a
                    class="font-medium text-sky-700 hover:underline"
                    href="/catalog/{v.product_id}"
                  >
                    {v.name ?? '—'}
                  </a>
                  <p class="font-mono text-[10px] text-slate-400">{v.sku ?? ''}</p>
                </td>
                <td class="px-3 py-2">
                  <Sparkline values={v.spark} width={90} height={22} />
                </td>
                <td class="px-3 py-2 text-right font-medium tabular-nums"
                  >{Number(v.total_qty).toLocaleString()}</td
                >
                <td class="px-3 py-2 text-right tabular-nums text-slate-600">{v.order_count}</td>
                <td class="px-3 py-2 text-right tabular-nums text-slate-600"
                  >{v.unique_customers}</td
                >
                <td class="px-3 py-2 text-right tabular-nums text-slate-600"
                  >{currency(v.revenue)}</td
                >
                <td class="px-3 py-2 text-right">
                  {#if watchedIds.has(v.product_id)}
                    <span class="rounded bg-amber-50 px-2 py-0.5 text-xs text-amber-800"
                      >★ watching</span
                    >
                  {:else}
                    <form method="POST" action="?/watch" use:enhance class="inline">
                      <input type="hidden" name="product_id" value={v.product_id} />
                      <button
                        type="submit"
                        class="rounded border border-slate-300 px-2 py-0.5 text-xs text-slate-700 hover:bg-slate-100"
                      >
                        + Watch
                      </button>
                    </form>
                  {/if}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </div>

  <!-- Repeat patterns + Watchlist -->
  <div class="grid gap-5 lg:grid-cols-2">
    <div class="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div class="mb-3">
        <h2 class="text-sm font-semibold uppercase tracking-wider text-slate-500">
          Repeat patterns
        </h2>
        <p class="text-xs text-slate-400">Customers reordering the same item 2+ times in 30 days</p>
      </div>
      {#if data.repeats.length === 0}
        <p class="text-sm text-slate-500">No repeat-order patterns yet.</p>
      {:else}
        <ul class="space-y-2 text-sm">
          {#each data.repeats.slice(0, 12) as r (`${r.customer_id}-${r.product_id}`)}
            <li class="rounded border border-slate-100 px-3 py-2 hover:border-slate-200">
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <p class="truncate font-medium">
                    <a class="text-sky-700 hover:underline" href="/clients/{r.customer_id}/trends">
                      {r.customer_name}
                    </a>
                    <span class="text-slate-500"> · </span>
                    <a class="text-slate-800 hover:underline" href="/catalog/{r.product_id}">
                      {r.product_name ?? r.product_sku ?? '—'}
                    </a>
                  </p>
                  <p class="text-xs text-slate-500">
                    <span class="font-medium text-slate-700">{r.order_count}×</span>
                    · {Number(r.total_qty).toLocaleString()} units · last
                    {daysSince(r.last_ordered_at)}d ago
                  </p>
                </div>
                {#if !watchedIds.has(r.product_id)}
                  <form method="POST" action="?/watch" use:enhance>
                    <input type="hidden" name="product_id" value={r.product_id} />
                    <button
                      type="submit"
                      class="shrink-0 rounded border border-slate-300 px-2 py-0.5 text-xs text-slate-700 hover:bg-slate-100"
                    >
                      + Watch
                    </button>
                  </form>
                {/if}
              </div>
            </li>
          {/each}
        </ul>
      {/if}
    </div>

    <div class="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div class="mb-3 flex items-center justify-between">
        <h2 class="text-sm font-semibold uppercase tracking-wider text-slate-500">Watch list</h2>
        <span class="rounded bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800"
          >{data.watchlist.length} items</span
        >
      </div>
      {#if data.watchlist.length === 0}
        <p class="text-sm text-slate-500">
          Nothing on the watch list. Add items from the trending or repeat tables to flag them for
          stock-up consideration.
        </p>
      {:else}
        <ul class="divide-y divide-slate-100 text-sm">
          {#each data.watchlist as w (w.id)}
            <li class="flex items-center justify-between gap-3 py-2">
              <div class="min-w-0">
                <a
                  class="font-medium text-sky-700 hover:underline"
                  href="/catalog/{w.product?.id ?? w.product_id}"
                >
                  {w.product?.name ?? '—'}
                </a>
                <p class="font-mono text-[10px] text-slate-400">{w.product?.sku ?? ''}</p>
                {#if w.notes}
                  <p class="text-xs text-slate-500">{w.notes}</p>
                {/if}
              </div>
              <div class="flex items-center gap-2 text-xs text-slate-500">
                <span>added {dateShort(w.created_at)}</span>
                <form method="POST" action="?/unwatch" use:enhance>
                  <input type="hidden" name="id" value={w.id} />
                  <button
                    type="submit"
                    class="rounded border border-slate-300 px-2 py-0.5 hover:bg-slate-100"
                  >
                    Remove
                  </button>
                </form>
              </div>
            </li>
          {/each}
        </ul>
      {/if}
    </div>
  </div>
</section>

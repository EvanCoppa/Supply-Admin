<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { currency, dateShort } from '$lib/format';

  let { data } = $props();

  const monthLabels = $derived(
    data.orderFrequency.map((m) => {
      const [y, mm] = m.month.split('-');
      const d = new Date(Date.UTC(Number(y), Number(mm) - 1, 1));
      return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' });
    })
  );
  const maxMonthlyOrders = $derived(
    Math.max(1, ...data.orderFrequency.map((m) => m.orders))
  );
  const maxQty = $derived(Math.max(1, ...data.topByQuantity.map((p) => p.quantity)));
  const maxRev = $derived(Math.max(1, ...data.topByRevenue.map((p) => p.revenue)));
  const categoryTotal = $derived(
    Math.max(1, data.categoryMix.reduce((acc, c) => acc + c.revenue, 0))
  );

  const hasOrders = $derived(data.summary.total_orders > 0);

  let lapsedDaysInput = $state('');
  $effect(() => {
    lapsedDaysInput = String(data.lapsedDays);
  });

  function applyLapsedDays(e: Event) {
    e.preventDefault();
    const next = Math.max(1, Math.min(365, Number(lapsedDaysInput) || 90));
    const url = new URL(page.url);
    url.searchParams.set('lapsedDays', String(next));
    goto(url.pathname + url.search, { keepFocus: true, noScroll: true });
  }

  function downloadCsv(filename: string, rows: (string | number)[][]) {
    const csv = rows
      .map((row) =>
        row
          .map((cell) => {
            const s = String(cell ?? '');
            return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
          })
          .join(',')
      )
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function exportFrequency() {
    downloadCsv('order-frequency.csv', [
      ['Month', 'Orders', 'Revenue'],
      ...data.orderFrequency.map((m) => [m.month, m.orders, m.revenue.toFixed(2)])
    ]);
  }

  function exportTopByQuantity() {
    downloadCsv('top-products-by-quantity.csv', [
      ['SKU', 'Name', 'Quantity', 'Revenue'],
      ...data.topByQuantity.map((p) => [p.sku, p.name, p.quantity, p.revenue.toFixed(2)])
    ]);
  }

  function exportTopByRevenue() {
    downloadCsv('top-products-by-revenue.csv', [
      ['SKU', 'Name', 'Quantity', 'Revenue'],
      ...data.topByRevenue.map((p) => [p.sku, p.name, p.quantity, p.revenue.toFixed(2)])
    ]);
  }

  function exportCategoryMix() {
    downloadCsv('category-mix.csv', [
      ['Category', 'Revenue', 'Share'],
      ...data.categoryMix.map((c) => [
        c.name,
        c.revenue.toFixed(2),
        ((c.revenue / categoryTotal) * 100).toFixed(2) + '%'
      ])
    ]);
  }

  function exportLapsed() {
    downloadCsv(`lapsed-items-${data.lapsedDays}d.csv`, [
      ['SKU', 'Name', 'Last ordered', 'Lifetime quantity', 'Lifetime revenue'],
      ...data.lapsedItems.map((p) => [
        p.sku,
        p.name,
        p.last_ordered_at ?? '',
        p.quantity,
        p.revenue.toFixed(2)
      ])
    ]);
  }
</script>

{#if !hasOrders}
  <div class="rounded-lg border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
    <p class="text-sm font-medium text-slate-700">No order history yet</p>
    <p class="mt-1 text-sm text-slate-500">
      Trends will appear here once this client has paid or fulfilled orders.
    </p>
  </div>
{:else}
  <div class="space-y-6">
    <!-- Summary tiles -->
    <dl class="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <div class="rounded-lg border border-slate-200 bg-white p-4">
        <dt class="text-xs uppercase tracking-wider text-slate-500">Lifetime orders</dt>
        <dd class="mt-1 text-2xl font-semibold text-slate-900">{data.summary.total_orders}</dd>
      </div>
      <div class="rounded-lg border border-slate-200 bg-white p-4">
        <dt class="text-xs uppercase tracking-wider text-slate-500">Lifetime revenue</dt>
        <dd class="mt-1 text-2xl font-semibold text-slate-900">
          {currency(data.summary.total_revenue)}
        </dd>
      </div>
      <div class="rounded-lg border border-slate-200 bg-white p-4">
        <dt class="text-xs uppercase tracking-wider text-slate-500">This month</dt>
        <dd class="mt-1 text-2xl font-semibold text-slate-900">
          {currency(data.summary.this_month_revenue)}
        </dd>
        <p class="mt-1 text-xs text-slate-500">
          {data.summary.this_month_orders}
          {data.summary.this_month_orders === 1 ? 'order' : 'orders'}
        </p>
      </div>
      <div class="rounded-lg border border-slate-200 bg-white p-4">
        <dt class="text-xs uppercase tracking-wider text-slate-500">Last order</dt>
        <dd class="mt-1 text-2xl font-semibold text-slate-900">
          {dateShort(data.summary.last_order_at)}
        </dd>
        {#if data.summary.first_order_at}
          <p class="mt-1 text-xs text-slate-500">
            since {dateShort(data.summary.first_order_at)}
          </p>
        {/if}
      </div>
    </dl>

    <!-- Order frequency -->
    <section class="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <header class="mb-4 flex items-baseline justify-between">
        <div>
          <h2 class="text-base font-semibold text-slate-900">Order frequency</h2>
          <p class="text-xs text-slate-500">Orders per month, last 12 months</p>
        </div>
        <button
          type="button"
          class="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-100"
          onclick={exportFrequency}
        >
          Export CSV
        </button>
      </header>
      <div class="flex items-end gap-2 h-40">
        {#each data.orderFrequency as m, i}
          <div class="flex flex-1 flex-col items-center gap-1">
            <div
              class="flex w-full flex-col-reverse rounded-t bg-sky-100 transition-colors hover:bg-sky-200"
              style="height: {(m.orders / maxMonthlyOrders) * 100}%; min-height: 2px;"
              title="{monthLabels[i]}: {m.orders} orders, {currency(m.revenue)}"
            >
              <span class="px-1 pt-1 text-center text-[10px] font-medium text-sky-900">
                {m.orders > 0 ? m.orders : ''}
              </span>
            </div>
            <span class="text-[10px] text-slate-500">{monthLabels[i]}</span>
          </div>
        {/each}
      </div>
    </section>

    <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <!-- Top by quantity -->
      <section class="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <header class="mb-3 flex items-baseline justify-between">
          <h2 class="text-base font-semibold text-slate-900">Top products by quantity</h2>
          <button
            type="button"
            class="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-100"
            onclick={exportTopByQuantity}
          >
            Export CSV
          </button>
        </header>
        {#if data.topByQuantity.length === 0}
          <p class="py-6 text-center text-sm text-slate-500">No product data.</p>
        {:else}
          <ul class="space-y-2">
            {#each data.topByQuantity as p}
              <li>
                <div class="flex items-baseline justify-between text-sm">
                  <span class="truncate pr-2">
                    <span class="font-mono text-xs text-slate-500">{p.sku}</span>
                    <span class="ml-2 text-slate-800">{p.name}</span>
                  </span>
                  <span class="shrink-0 tabular-nums text-slate-700">{p.quantity}</span>
                </div>
                <div class="mt-1 h-1.5 w-full rounded bg-slate-100">
                  <div
                    class="h-full rounded bg-emerald-500"
                    style="width: {(p.quantity / maxQty) * 100}%"
                  ></div>
                </div>
              </li>
            {/each}
          </ul>
        {/if}
      </section>

      <!-- Top by revenue -->
      <section class="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <header class="mb-3 flex items-baseline justify-between">
          <h2 class="text-base font-semibold text-slate-900">Top products by revenue</h2>
          <button
            type="button"
            class="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-100"
            onclick={exportTopByRevenue}
          >
            Export CSV
          </button>
        </header>
        {#if data.topByRevenue.length === 0}
          <p class="py-6 text-center text-sm text-slate-500">No product data.</p>
        {:else}
          <ul class="space-y-2">
            {#each data.topByRevenue as p}
              <li>
                <div class="flex items-baseline justify-between text-sm">
                  <span class="truncate pr-2">
                    <span class="font-mono text-xs text-slate-500">{p.sku}</span>
                    <span class="ml-2 text-slate-800">{p.name}</span>
                  </span>
                  <span class="shrink-0 tabular-nums text-slate-700">{currency(p.revenue)}</span>
                </div>
                <div class="mt-1 h-1.5 w-full rounded bg-slate-100">
                  <div
                    class="h-full rounded bg-indigo-500"
                    style="width: {(p.revenue / maxRev) * 100}%"
                  ></div>
                </div>
              </li>
            {/each}
          </ul>
        {/if}
      </section>
    </div>

    <!-- Category mix -->
    <section class="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <header class="mb-3 flex items-baseline justify-between">
        <div>
          <h2 class="text-base font-semibold text-slate-900">Category mix</h2>
          <p class="text-xs text-slate-500">Share of revenue by category</p>
        </div>
        <button
          type="button"
          class="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-100"
          onclick={exportCategoryMix}
        >
          Export CSV
        </button>
      </header>
      {#if data.categoryMix.length === 0}
        <p class="py-6 text-center text-sm text-slate-500">No category data.</p>
      {:else}
        <ul class="space-y-3">
          {#each data.categoryMix as c}
            {@const share = (c.revenue / categoryTotal) * 100}
            <li>
              <div class="flex items-baseline justify-between text-sm">
                <span class="truncate pr-2 text-slate-800">{c.name}</span>
                <span class="shrink-0 tabular-nums text-slate-500">
                  {currency(c.revenue)} · {share.toFixed(1)}%
                </span>
              </div>
              <div class="mt-1 h-2 w-full rounded bg-slate-100">
                <div class="h-full rounded bg-amber-500" style="width: {share}%"></div>
              </div>
            </li>
          {/each}
        </ul>
      {/if}
    </section>

    <!-- Lapsed items -->
    <section class="rounded-lg border border-slate-200 bg-white shadow-sm">
      <header class="flex flex-wrap items-baseline justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <div>
          <h2 class="text-base font-semibold text-slate-900">Lapsed items</h2>
          <p class="text-xs text-slate-500">
            Products previously ordered but not in the last
            <span class="font-medium">{data.lapsedDays}</span> days
          </p>
        </div>
        <div class="flex items-center gap-2">
          <form class="flex items-center gap-2 text-xs" onsubmit={applyLapsedDays}>
            <label class="text-slate-500" for="lapsedDays">Window</label>
            <input
              id="lapsedDays"
              type="number"
              min="1"
              max="365"
              bind:value={lapsedDaysInput}
              class="w-16 rounded border border-slate-300 px-2 py-1 text-right"
            />
            <span class="text-slate-500">days</span>
            <button
              type="submit"
              class="rounded border border-slate-300 px-2 py-1 hover:bg-slate-100"
            >
              Apply
            </button>
          </form>
          <button
            type="button"
            class="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-100"
            onclick={exportLapsed}
            disabled={data.lapsedItems.length === 0}
          >
            Export CSV
          </button>
        </div>
      </header>
      {#if data.lapsedItems.length === 0}
        <p class="px-4 py-10 text-center text-sm text-slate-500">
          No lapsed items in this window.
        </p>
      {:else}
        <table class="w-full text-sm">
          <thead class="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th class="px-4 py-2 text-left font-medium">SKU</th>
              <th class="px-4 py-2 text-left font-medium">Product</th>
              <th class="px-4 py-2 text-right font-medium">Last ordered</th>
              <th class="px-4 py-2 text-right font-medium">Lifetime qty</th>
              <th class="px-4 py-2 text-right font-medium">Lifetime revenue</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            {#each data.lapsedItems as p}
              <tr class="hover:bg-slate-50">
                <td class="px-4 py-2 font-mono text-xs text-slate-500">{p.sku}</td>
                <td class="px-4 py-2 text-slate-800">{p.name}</td>
                <td class="px-4 py-2 text-right text-slate-500">
                  {dateShort(p.last_ordered_at)}
                </td>
                <td class="px-4 py-2 text-right tabular-nums">{p.quantity}</td>
                <td class="px-4 py-2 text-right tabular-nums">{currency(p.revenue)}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      {/if}
    </section>
  </div>
{/if}

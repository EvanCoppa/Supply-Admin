<script lang="ts">
  import { currency } from '$lib/format';
  import Select from '$lib/components/Select.svelte';
  import HelpTooltip from '$lib/components/HelpTooltip.svelte';

  let { data } = $props();

  function pct(v: number | null): string {
    if (v === null || v === undefined) return '—';
    return `${(Number(v) * 100).toFixed(1)}%`;
  }
  function marginClass(v: number | null): string {
    if (v === null) return 'text-slate-400';
    if (v >= 0.4) return 'text-emerald-700';
    if (v >= 0.25) return 'text-amber-700';
    return 'text-red-700';
  }
</script>

<svelte:head><title>Profitability · Supply Admin</title></svelte:head>

<section class="space-y-6">
  <header>
    <h1 class="text-2xl font-semibold">Profitability</h1>
    <p class="text-sm text-slate-500">
      Lifetime per-product margin and per-supplier spend. Sourced from orders and purchases.
    </p>
  </header>

  <div class="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
    <div class="mb-3 flex items-center justify-between">
      <h2 class="text-sm font-semibold uppercase tracking-wider text-slate-500">Products</h2>
      <form class="flex items-center gap-2 text-xs">
        <label for="sort" class="text-slate-600">Sort by</label>
        <Select
          id="sort"
          name="sort"
          value={data.sort}
          onchange={(e) => {
            const sp = new URLSearchParams(window.location.search);
            sp.set('sort', (e.currentTarget as HTMLSelectElement).value);
            window.location.search = sp.toString();
          }}
        >
          <option value="gp_desc">Highest GP</option>
          <option value="margin_desc">Highest margin</option>
          <option value="margin_asc">Lowest margin</option>
          <option value="revenue_desc">Highest revenue</option>
        </Select>
      </form>
    </div>

    {#if data.products.length === 0}
      <p class="text-sm text-slate-500">
        No data yet. Once orders ship and purchases are logged with matching products, this fills
        in.
      </p>
    {:else}
      <table class="w-full text-sm">
        <thead class="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
          <tr>
            <th class="px-2 py-2 text-left font-medium">Item</th>
            <th class="px-2 py-2 text-right font-medium">Sold</th>
            <th class="px-2 py-2 text-right font-medium">Revenue</th>
            <th class="px-2 py-2 text-right font-medium">Purchased</th>
            <th class="px-2 py-2 text-right font-medium">Cost</th>
            <th class="px-2 py-2 text-right font-medium">GP</th>
            <th class="flex items-center justify-end gap-1 px-2 py-2 text-right font-medium">
              Margin
              <HelpTooltip text="(Revenue - Cost) ÷ Revenue. Green ≥40%, Amber ≥25%, Red <25%" />
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          {#each data.products as p (p.product_id)}
            <tr class="hover:bg-slate-50">
              <td class="px-2 py-2">
                <a class="text-sky-700 hover:underline" href="/catalog/{p.product_id}">
                  {p.name ?? '—'}
                </a>
                <p class="font-mono text-[10px] text-slate-400">{p.sku ?? ''}</p>
              </td>
              <td class="px-2 py-2 text-right">{Number(p.qty_sold).toLocaleString()}</td>
              <td class="px-2 py-2 text-right">{currency(p.revenue)}</td>
              <td class="px-2 py-2 text-right text-slate-500"
                >{Number(p.qty_purchased).toLocaleString()}</td
              >
              <td class="px-2 py-2 text-right text-slate-500">{currency(p.cost)}</td>
              <td class="px-2 py-2 text-right font-medium">{currency(p.gross_profit)}</td>
              <td class="px-2 py-2 text-right font-semibold {marginClass(p.margin)}"
                >{pct(p.margin)}</td
              >
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
  </div>

  <div class="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
    <h2 class="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-500">Suppliers</h2>
    <table class="w-full text-sm">
      <thead class="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
        <tr>
          <th class="px-2 py-2 text-left font-medium">Supplier</th>
          <th class="px-2 py-2 text-right font-medium">Purchases</th>
          <th class="px-2 py-2 text-right font-medium">Orders fulfilled</th>
          <th class="px-2 py-2 text-right font-medium">Subtotal</th>
          <th class="px-2 py-2 text-right font-medium">Freight</th>
          <th class="px-2 py-2 text-right font-medium">Dist. fee</th>
          <th class="px-2 py-2 text-right font-medium">Total spend</th>
          <th class="px-2 py-2 text-right font-medium">Outstanding AP</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-slate-100">
        {#each data.suppliers as s (s.supplier_id)}
          <tr class="hover:bg-slate-50">
            <td class="px-2 py-2 font-medium">{s.name}</td>
            <td class="px-2 py-2 text-right">{s.purchase_count}</td>
            <td class="px-2 py-2 text-right text-slate-600">{s.orders_fulfilled}</td>
            <td class="px-2 py-2 text-right text-slate-500">{currency(s.total_subtotal)}</td>
            <td class="px-2 py-2 text-right text-slate-500">{currency(s.total_freight)}</td>
            <td class="px-2 py-2 text-right text-slate-500">{currency(s.total_distribution_fee)}</td
            >
            <td class="px-2 py-2 text-right font-medium">{currency(s.total_spend)}</td>
            <td
              class="px-2 py-2 text-right {Number(s.outstanding_ap) > 0
                ? 'text-red-700'
                : 'text-slate-400'}"
            >
              {currency(s.outstanding_ap)}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</section>

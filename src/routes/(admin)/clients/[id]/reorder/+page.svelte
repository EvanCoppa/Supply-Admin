<script lang="ts">
  import { currency, dateShort } from '$lib/format';

  let { data } = $props();
  const plan = $derived(data.plan);

  const confidenceClass: Record<string, string> = {
    high: 'bg-emerald-50 text-emerald-700',
    medium: 'bg-sky-50 text-sky-700',
    low: 'bg-slate-100 text-slate-600'
  };

  const stockClass: Record<string, string> = {
    in_stock: 'bg-emerald-50 text-emerald-700',
    low_stock: 'bg-amber-50 text-amber-700',
    out_of_stock: 'bg-red-50 text-red-700'
  };

  function label(value: string) {
    return value.replaceAll('_', ' ');
  }
</script>

<svelte:head><title>Reorder planner · Supply Admin</title></svelte:head>

<div class="space-y-5">
  <form
    method="GET"
    class="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
  >
    <label class="block">
      <span class="mb-1 block text-xs font-medium uppercase tracking-wider text-slate-500"
        >Lookback</span
      >
      <select name="lookback_days" class="rounded border border-slate-300 px-2 py-1.5 text-sm">
        <option value="90" selected={data.filters.lookbackDays === 90}>90 days</option>
        <option value="180" selected={data.filters.lookbackDays === 180}>180 days</option>
        <option value="365" selected={data.filters.lookbackDays === 365}>365 days</option>
        <option value="730" selected={data.filters.lookbackDays === 730}>730 days</option>
      </select>
    </label>
    <label class="block">
      <span class="mb-1 block text-xs font-medium uppercase tracking-wider text-slate-500"
        >Horizon</span
      >
      <select name="horizon_days" class="rounded border border-slate-300 px-2 py-1.5 text-sm">
        <option value="14" selected={data.filters.horizonDays === 14}>14 days</option>
        <option value="30" selected={data.filters.horizonDays === 30}>30 days</option>
        <option value="60" selected={data.filters.horizonDays === 60}>60 days</option>
        <option value="90" selected={data.filters.horizonDays === 90}>90 days</option>
      </select>
    </label>
    <label class="block">
      <span class="mb-1 block text-xs font-medium uppercase tracking-wider text-slate-500"
        >Rows</span
      >
      <select name="limit" class="rounded border border-slate-300 px-2 py-1.5 text-sm">
        <option value="10" selected={data.filters.limit === 10}>10</option>
        <option value="25" selected={data.filters.limit === 25}>25</option>
        <option value="50" selected={data.filters.limit === 50}>50</option>
        <option value="100" selected={data.filters.limit === 100}>100</option>
      </select>
    </label>
    <label class="block">
      <span class="mb-1 block text-xs font-medium uppercase tracking-wider text-slate-500"
        >Unavailable</span
      >
      <select
        name="include_unavailable"
        class="rounded border border-slate-300 px-2 py-1.5 text-sm"
      >
        <option value="true" selected={data.filters.includeUnavailable}>Show</option>
        <option value="false" selected={!data.filters.includeUnavailable}>Hide</option>
      </select>
    </label>
    <label class="block">
      <span class="mb-1 block text-xs font-medium uppercase tracking-wider text-slate-500"
        >Not due</span
      >
      <select name="include_not_due" class="rounded border border-slate-300 px-2 py-1.5 text-sm">
        <option value="false" selected={!data.filters.includeNotDue}>Hide</option>
        <option value="true" selected={data.filters.includeNotDue}>Show</option>
      </select>
    </label>
    <button
      type="submit"
      class="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
    >
      Apply
    </button>
  </form>

  <dl class="grid gap-3 sm:grid-cols-4">
    <div class="rounded-lg border border-slate-200 bg-white p-4">
      <dt class="text-xs uppercase tracking-wider text-slate-500">Suggestions</dt>
      <dd class="mt-1 text-2xl font-semibold text-slate-900">{plan.summary.recommended_count}</dd>
    </div>
    <div class="rounded-lg border border-slate-200 bg-white p-4">
      <dt class="text-xs uppercase tracking-wider text-slate-500">Low supply</dt>
      <dd class="mt-1 text-2xl font-semibold text-amber-700">{plan.summary.low_stock_count}</dd>
    </div>
    <div class="rounded-lg border border-slate-200 bg-white p-4">
      <dt class="text-xs uppercase tracking-wider text-slate-500">Out of stock</dt>
      <dd class="mt-1 text-2xl font-semibold text-red-700">{plan.summary.out_of_stock_count}</dd>
    </div>
    <div class="rounded-lg border border-slate-200 bg-white p-4">
      <dt class="text-xs uppercase tracking-wider text-slate-500">Generated</dt>
      <dd class="mt-1 text-2xl font-semibold text-slate-900">{dateShort(plan.generated_at)}</dd>
    </div>
  </dl>

  <section class="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
    <div
      class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3"
    >
      <h2 class="font-semibold text-slate-900">Recommended items</h2>
      <p class="text-xs text-slate-500">
        {plan.lookback_days}d lookback · {plan.horizon_days}d horizon
      </p>
    </div>

    {#if plan.items.length === 0}
      <p class="px-4 py-10 text-center text-sm text-slate-500">
        No reorder suggestions for this window.
      </p>
    {:else}
      <div class="overflow-x-auto">
        <table class="w-full min-w-[980px] text-sm">
          <thead class="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th class="px-4 py-2 text-left font-medium">Product</th>
              <th class="px-4 py-2 text-right font-medium">Suggest</th>
              <th class="px-4 py-2 text-right font-medium">Value</th>
              <th class="px-4 py-2 text-right font-medium">30d avg</th>
              <th class="px-4 py-2 text-right font-medium">Last order</th>
              <th class="px-4 py-2 text-right font-medium">Next</th>
              <th class="px-4 py-2 text-right font-medium">Available</th>
              <th class="px-4 py-2 text-left font-medium">Stock</th>
              <th class="px-4 py-2 text-left font-medium">Confidence</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            {#each plan.items as item}
              <tr class="hover:bg-slate-50">
                <td class="px-4 py-3">
                  <a
                    class="font-medium text-sky-700 hover:underline"
                    href="/catalog/{item.product.id}"
                  >
                    {item.product.name}
                  </a>
                  <p class="mt-0.5 text-xs text-slate-500">
                    <span class="font-mono">{item.product.sku}</span>
                    {#if item.product.category}
                      · {item.product.category.name}{/if}
                  </p>
                </td>
                <td class="px-4 py-3 text-right">
                  <span class="text-base font-semibold text-slate-900">
                    {item.recommendation.recommended_quantity}
                  </span>
                  {#if item.product.unit_of_measure}
                    <span class="text-xs text-slate-500">{item.product.unit_of_measure}</span>
                  {/if}
                </td>
                <td class="px-4 py-3 text-right tabular-nums">
                  {currency(item.recommendation.recommended_value)}
                </td>
                <td class="px-4 py-3 text-right tabular-nums">
                  {item.usage.avg_30_day_quantity}
                </td>
                <td class="px-4 py-3 text-right">
                  <span class="block tabular-nums">{item.usage.last_order_quantity}</span>
                  <span class="text-xs text-slate-500">{dateShort(item.usage.last_ordered_at)}</span
                  >
                </td>
                <td class="px-4 py-3 text-right">
                  {#if item.recommendation.days_until_reorder === null}
                    —
                  {:else if item.recommendation.days_until_reorder <= 0}
                    now
                  {:else}
                    {item.recommendation.days_until_reorder}d
                  {/if}
                </td>
                <td class="px-4 py-3 text-right tabular-nums">
                  {item.inventory.available_quantity}
                  <span class="text-xs text-slate-500">/ {item.inventory.quantity_on_hand}</span>
                </td>
                <td class="px-4 py-3">
                  <span
                    class="rounded px-2 py-0.5 text-xs {stockClass[item.inventory.stock_status]}"
                  >
                    {label(item.inventory.stock_status)}
                  </span>
                </td>
                <td class="px-4 py-3">
                  <span
                    class="rounded px-2 py-0.5 text-xs {confidenceClass[
                      item.recommendation.confidence
                    ]}"
                  >
                    {item.recommendation.confidence}
                  </span>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </section>
</div>

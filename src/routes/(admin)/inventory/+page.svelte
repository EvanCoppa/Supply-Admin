<script lang="ts">
  import { dateTime } from '$lib/format';

  let { data } = $props();

  const totalPages = $derived(Math.max(1, Math.ceil(data.total / data.pageSize)));
</script>

<svelte:head><title>Inventory · Supply Admin</title></svelte:head>

<section class="space-y-4">
  <header>
    <h1 class="text-2xl font-semibold">Inventory</h1>
    <p class="text-sm text-slate-500">{data.total} item{data.total === 1 ? '' : 's'}</p>
  </header>

  <form method="GET" class="flex flex-wrap gap-2 rounded border border-slate-200 bg-white p-3">
    <input
      type="search"
      name="q"
      placeholder="Search SKU or product"
      value={data.filters.search}
      class="min-w-[240px] flex-1 rounded border border-slate-300 px-2 py-1.5 text-sm"
    />
    <select
      name="filter"
      class="rounded border border-slate-300 px-2 py-1.5 text-sm"
    >
      <option value="">All items</option>
      <option value="low" selected={data.filters.filter === 'low'}>Low stock only</option>
      <option value="out" selected={data.filters.filter === 'out'}>Out of stock only</option>
    </select>
    <button
      type="submit"
      class="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
    >
      Filter
    </button>
  </form>

  <div class="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
    {#if data.rows.length === 0}
      <p class="px-4 py-10 text-center text-sm text-slate-500">Nothing to show.</p>
    {:else}
      <table class="w-full text-sm">
        <thead class="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
          <tr>
            <th class="px-4 py-2 text-left font-medium">SKU</th>
            <th class="px-4 py-2 text-left font-medium">Product</th>
            <th class="px-4 py-2 text-left font-medium">Category</th>
            <th class="px-4 py-2 text-right font-medium">On hand</th>
            <th class="px-4 py-2 text-right font-medium">Reserved</th>
            <th class="px-4 py-2 text-right font-medium">Threshold</th>
            <th class="px-4 py-2 text-right font-medium">Updated</th>
            <th class="px-4 py-2"></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          {#each data.rows as row}
            {@const low = row.quantity_on_hand <= row.low_stock_threshold}
            <tr class="hover:bg-slate-50">
              <td class="px-4 py-2 font-mono text-xs">{row.product?.sku}</td>
              <td class="px-4 py-2">
                <a class="text-sky-700 hover:underline" href="/catalog/{row.product?.id}">
                  {row.product?.name}
                </a>
              </td>
              <td class="px-4 py-2 text-slate-600">{row.product?.category?.name ?? '—'}</td>
              <td
                class="px-4 py-2 text-right"
                class:text-amber-700={low}
                class:font-semibold={low}
              >
                {row.quantity_on_hand}
              </td>
              <td class="px-4 py-2 text-right text-slate-600">{row.quantity_reserved}</td>
              <td class="px-4 py-2 text-right text-slate-500">{row.low_stock_threshold}</td>
              <td class="px-4 py-2 text-right text-slate-500">{dateTime(row.updated_at)}</td>
              <td class="px-4 py-2 text-right">
                <a
                  class="text-xs text-sky-700 hover:underline"
                  href="/inventory/{row.product_id}/ledger"
                >
                  Ledger
                </a>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
  </div>

  {#if totalPages > 1}
    <nav class="flex justify-end gap-2 text-sm">
      {#if data.page > 1}
        <a
          class="rounded border border-slate-300 px-3 py-1 hover:bg-slate-100"
          href="?{new URLSearchParams({ ...data.filters, page: String(data.page - 1) })}">
          Previous
        </a>
      {/if}
      <span class="px-2 py-1 text-slate-500">Page {data.page} of {totalPages}</span>
      {#if data.page < totalPages}
        <a
          class="rounded border border-slate-300 px-3 py-1 hover:bg-slate-100"
          href="?{new URLSearchParams({ ...data.filters, page: String(data.page + 1) })}">
          Next
        </a>
      {/if}
    </nav>
  {/if}
</section>

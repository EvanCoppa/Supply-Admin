<script lang="ts">
  import { currency, dateTime } from '$lib/format';

  let { data } = $props();
  const totalPages = $derived(Math.max(1, Math.ceil(data.total / data.pageSize)));
</script>

<svelte:head><title>Orders · Supply Admin</title></svelte:head>

<section class="space-y-4">
  <header>
    <h1 class="text-2xl font-semibold">Orders</h1>
    <p class="text-sm text-slate-500">{data.total} order{data.total === 1 ? '' : 's'}</p>
  </header>

  <form method="GET" class="grid gap-2 rounded border border-slate-200 bg-white p-3 sm:grid-cols-6">
    <select
      name="status"
      class="rounded border border-slate-300 px-2 py-1.5 text-sm sm:col-span-1"
    >
      <option value="">All statuses</option>
      {#each data.statuses as s}
        <option value={s} selected={data.filters.status === s}>{s}</option>
      {/each}
    </select>
    <select
      name="customer"
      class="rounded border border-slate-300 px-2 py-1.5 text-sm sm:col-span-2"
    >
      <option value="">All clients</option>
      {#each data.customers as c}
        <option value={c.id} selected={data.filters.customerId === c.id}>{c.business_name}</option>
      {/each}
    </select>
    <select
      name="source"
      class="rounded border border-slate-300 px-2 py-1.5 text-sm sm:col-span-1"
    >
      <option value="">Any source</option>
      <option value="storefront" selected={data.filters.source === 'storefront'}>Storefront</option>
      <option value="api" selected={data.filters.source === 'api'}>API</option>
    </select>
    <input
      type="date"
      name="from"
      value={data.filters.from}
      class="rounded border border-slate-300 px-2 py-1.5 text-sm"
    />
    <input
      type="date"
      name="to"
      value={data.filters.to}
      class="rounded border border-slate-300 px-2 py-1.5 text-sm"
    />
    <div class="sm:col-span-6 flex justify-end">
      <button
        type="submit"
        class="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
      >
        Filter
      </button>
    </div>
  </form>

  <div class="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
    {#if data.orders.length === 0}
      <p class="px-4 py-10 text-center text-sm text-slate-500">No orders match these filters.</p>
    {:else}
      <table class="w-full text-sm">
        <thead class="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
          <tr>
            <th class="px-4 py-2 text-left font-medium">Order</th>
            <th class="px-4 py-2 text-left font-medium">Customer</th>
            <th class="px-4 py-2 text-left font-medium">Status</th>
            <th class="px-4 py-2 text-right font-medium">Total</th>
            <th class="px-4 py-2 text-left font-medium">Source</th>
            <th class="px-4 py-2 text-right font-medium">Placed</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          {#each data.orders as o}
            <tr class="hover:bg-slate-50">
              <td class="px-4 py-2">
                <a class="font-mono text-xs text-sky-700 hover:underline" href="/orders/{o.id}">
                  {o.id.slice(0, 8)}
                </a>
              </td>
              <td class="px-4 py-2">
                <a class="text-sky-700 hover:underline" href="/clients/{o.customer?.id}">
                  {o.customer?.business_name ?? '—'}
                </a>
              </td>
              <td class="px-4 py-2">{o.status}</td>
              <td class="px-4 py-2 text-right">{currency(o.total)}</td>
              <td class="px-4 py-2">{o.source}</td>
              <td class="px-4 py-2 text-right text-slate-500">{dateTime(o.placed_at)}</td>
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

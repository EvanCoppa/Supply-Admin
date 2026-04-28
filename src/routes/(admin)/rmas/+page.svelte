<script lang="ts">
  import { currency, dateShort } from '$lib/format';

  let { data } = $props();
  const totalPages = $derived(Math.max(1, Math.ceil(data.total / data.pageSize)));

  const statusClass: Record<string, string> = {
    requested: 'bg-slate-100 text-slate-600',
    approved: 'bg-sky-50 text-sky-700',
    received: 'bg-indigo-50 text-indigo-700',
    refunded: 'bg-emerald-50 text-emerald-700',
    rejected: 'bg-red-50 text-red-700',
    cancelled: 'bg-slate-200 text-slate-700'
  };
</script>

<svelte:head><title>RMAs · Supply Admin</title></svelte:head>

<section class="space-y-4">
  <header>
    <h1 class="text-2xl font-semibold">RMAs</h1>
    <p class="text-sm text-slate-500">{data.total} total returns.</p>
  </header>

  <form method="GET" class="flex flex-wrap gap-2 rounded border border-slate-200 bg-white p-3 text-sm">
    <select name="status" class="rounded border border-slate-300 px-2 py-1.5">
      <option value="">All statuses</option>
      {#each ['requested', 'approved', 'received', 'refunded', 'rejected', 'cancelled'] as s}
        <option value={s} selected={data.filters.status === s}>{s}</option>
      {/each}
    </select>
    <button type="submit" class="rounded bg-slate-900 px-3 py-1.5 font-medium text-white hover:bg-slate-800">
      Filter
    </button>
  </form>

  <div class="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
    {#if data.rmas.length === 0}
      <p class="px-4 py-10 text-center text-sm text-slate-500">No RMAs match these filters.</p>
    {:else}
      <table class="w-full text-sm">
        <thead class="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
          <tr>
            <th class="px-3 py-2 text-left font-medium">Number</th>
            <th class="px-3 py-2 text-left font-medium">Customer</th>
            <th class="px-3 py-2 text-left font-medium">Status</th>
            <th class="px-3 py-2 text-left font-medium">Reason</th>
            <th class="px-3 py-2 text-right font-medium">Refund</th>
            <th class="px-3 py-2 text-right font-medium">Fee</th>
            <th class="px-3 py-2 text-right font-medium">Created</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          {#each data.rmas as r}
            <tr class="hover:bg-slate-50">
              <td class="px-3 py-2 font-mono text-xs">
                <a class="text-sky-700 hover:underline" href="/clients/{r.customer_id}/rmas">{r.rma_number}</a>
              </td>
              <td class="px-3 py-2">
                <a class="text-sky-700 hover:underline" href="/clients/{r.customer_id}">
                  {r.customer?.business_name ?? '—'}
                </a>
              </td>
              <td class="px-3 py-2">
                <span class="rounded px-1.5 py-0.5 text-xs {statusClass[r.status] ?? ''}">{r.status}</span>
              </td>
              <td class="px-3 py-2 text-slate-600">{r.reason ?? '—'}</td>
              <td class="px-3 py-2 text-right">{currency(r.refund_amount)}</td>
              <td class="px-3 py-2 text-right">{currency(r.restocking_fee)}</td>
              <td class="px-3 py-2 text-right text-slate-500">{dateShort(r.created_at)}</td>
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
          href="?{new URLSearchParams({ ...data.filters, page: String(data.page - 1) })}"
        >
          Previous
        </a>
      {/if}
      <span class="px-2 py-1 text-slate-500">Page {data.page} of {totalPages}</span>
      {#if data.page < totalPages}
        <a
          class="rounded border border-slate-300 px-3 py-1 hover:bg-slate-100"
          href="?{new URLSearchParams({ ...data.filters, page: String(data.page + 1) })}"
        >
          Next
        </a>
      {/if}
    </nav>
  {/if}
</section>

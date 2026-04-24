<script lang="ts">
  import { currency, dateShort } from '$lib/format';

  let { data } = $props();
  const totalPages = $derived(Math.max(1, Math.ceil(data.total / data.pageSize)));

  const statusClass: Record<string, string> = {
    draft: 'bg-slate-100 text-slate-600',
    issued: 'bg-sky-50 text-sky-700',
    paid: 'bg-emerald-50 text-emerald-700',
    partially_paid: 'bg-amber-50 text-amber-700',
    overdue: 'bg-red-50 text-red-700',
    void: 'bg-slate-200 text-slate-700',
    refunded: 'bg-indigo-50 text-indigo-700'
  };

  function isOverdue(inv: { status: string; due_at: string | null }) {
    return (
      !!inv.due_at &&
      ['issued', 'partially_paid', 'overdue'].includes(inv.status) &&
      new Date(inv.due_at).getTime() < Date.now()
    );
  }
</script>

<svelte:head><title>Invoices · Supply Admin</title></svelte:head>

<section class="space-y-4">
  <header class="flex items-end justify-between">
    <div>
      <h1 class="text-2xl font-semibold">Invoices</h1>
      <p class="text-sm text-slate-500">{data.total} total</p>
    </div>
  </header>

  <form method="GET" class="flex flex-wrap gap-2 rounded border border-slate-200 bg-white p-3 text-sm">
    <input
      type="search"
      name="q"
      placeholder="Search invoice number"
      value={data.filters.q}
      class="min-w-[240px] flex-1 rounded border border-slate-300 px-2 py-1.5"
    />
    <select name="status" class="rounded border border-slate-300 px-2 py-1.5">
      <option value="">All statuses</option>
      <option value="outstanding" selected={data.filters.status === 'outstanding'}>Outstanding</option>
      <option value="draft" selected={data.filters.status === 'draft'}>Draft</option>
      <option value="issued" selected={data.filters.status === 'issued'}>Issued</option>
      <option value="paid" selected={data.filters.status === 'paid'}>Paid</option>
      <option value="partially_paid" selected={data.filters.status === 'partially_paid'}>Partially paid</option>
      <option value="overdue" selected={data.filters.status === 'overdue'}>Overdue</option>
      <option value="void" selected={data.filters.status === 'void'}>Void</option>
      <option value="refunded" selected={data.filters.status === 'refunded'}>Refunded</option>
    </select>
    <button type="submit" class="rounded bg-slate-900 px-3 py-1.5 font-medium text-white hover:bg-slate-800">
      Filter
    </button>
  </form>

  <div class="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
    {#if data.invoices.length === 0}
      <p class="px-4 py-10 text-center text-sm text-slate-500">No invoices match these filters.</p>
    {:else}
      <table class="w-full text-sm">
        <thead class="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
          <tr>
            <th class="px-3 py-2 text-left font-medium">Number</th>
            <th class="px-3 py-2 text-left font-medium">Customer</th>
            <th class="px-3 py-2 text-left font-medium">Status</th>
            <th class="px-3 py-2 text-right font-medium">Total</th>
            <th class="px-3 py-2 text-right font-medium">Balance</th>
            <th class="px-3 py-2 text-right font-medium">Due</th>
            <th class="px-3 py-2 text-right font-medium">Issued</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          {#each data.invoices as inv}
            <tr class="hover:bg-slate-50" class:bg-red-50={isOverdue(inv)}>
              <td class="px-3 py-2 font-mono text-xs">
                <a class="text-sky-700 hover:underline" href="/clients/{inv.customer_id}/invoices">
                  {inv.invoice_number}
                </a>
              </td>
              <td class="px-3 py-2">
                <a class="text-sky-700 hover:underline" href="/clients/{inv.customer_id}">
                  {inv.customer?.business_name ?? '—'}
                </a>
              </td>
              <td class="px-3 py-2">
                <span class="rounded px-1.5 py-0.5 text-xs {statusClass[inv.status] ?? ''}">{inv.status}</span>
              </td>
              <td class="px-3 py-2 text-right">{currency(inv.total)}</td>
              <td class="px-3 py-2 text-right font-medium">
                {currency(Number(inv.total) - Number(inv.amount_paid))}
              </td>
              <td class="px-3 py-2 text-right" class:text-red-700={isOverdue(inv)}>
                {dateShort(inv.due_at)}
              </td>
              <td class="px-3 py-2 text-right text-slate-500">{dateShort(inv.issued_at)}</td>
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

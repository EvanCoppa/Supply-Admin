<script lang="ts">
  import { currency, dateShort } from '$lib/format';
  import Select from '$lib/components/Select.svelte';

  let { data } = $props();
  const totalPages = $derived(Math.max(1, Math.ceil(data.total / data.pageSize)));

  const statusClass: Record<string, string> = {
    issued: 'bg-sky-50 text-sky-700',
    paid: 'bg-emerald-50 text-emerald-700',
    partially_paid: 'bg-amber-50 text-amber-700',
    overdue: 'bg-red-50 text-red-700',
    void: 'bg-slate-200 text-slate-700',
    refunded: 'bg-indigo-50 text-indigo-700'
  };

  function balance(inv: { total: number; amount_paid: number }) {
    return Math.max(0, Number(inv.total) - Number(inv.amount_paid));
  }
</script>

<section class="space-y-4">
  <header class="flex flex-wrap items-end justify-between gap-3">
    <div>
      <h1 class="text-2xl font-semibold">Invoices</h1>
      <p class="text-sm text-slate-500">{data.total} invoice{data.total === 1 ? '' : 's'}</p>
    </div>
    <form method="GET" class="flex gap-2 text-sm">
      <Select name="status">
        <option value="">All</option>
        <option value="open" selected={data.filters.status === 'open'}>Open</option>
        <option value="paid" selected={data.filters.status === 'paid'}>Paid</option>
      </Select>
      <button class="rounded bg-slate-900 px-3 py-1.5 font-medium text-white hover:bg-slate-800"
        >Filter</button
      >
    </form>
  </header>

  <div class="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
    {#if data.invoices.length === 0}
      <p class="px-4 py-12 text-center text-sm text-slate-500">No invoices match this view.</p>
    {:else}
      <table class="w-full text-sm">
        <thead class="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
          <tr>
            <th class="px-3 py-2 text-left font-medium">Invoice</th>
            <th class="px-3 py-2 text-left font-medium">Status</th>
            <th class="px-3 py-2 text-right font-medium">Total</th>
            <th class="px-3 py-2 text-right font-medium">Balance</th>
            <th class="px-3 py-2 text-right font-medium">Due</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          {#each data.invoices as inv}
            <tr class="hover:bg-slate-50">
              <td class="px-3 py-2 font-mono text-xs">
                <a class="text-sky-700 hover:underline" href="/portal/invoices/{inv.id}">
                  {inv.invoice_number}
                </a>
              </td>
              <td class="px-3 py-2">
                <span class="rounded px-1.5 py-0.5 text-xs {statusClass[inv.status] ?? ''}">
                  {inv.status.replace('_', ' ')}
                </span>
              </td>
              <td class="px-3 py-2 text-right">{currency(inv.total)}</td>
              <td class="px-3 py-2 text-right font-medium" class:text-red-700={balance(inv) > 0}>
                {currency(balance(inv))}
              </td>
              <td class="px-3 py-2 text-right text-slate-600">{dateShort(inv.due_at)}</td>
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
          href="?page={data.page - 1}&status={data.filters.status}"
        >
          Previous
        </a>
      {/if}
      <span class="px-2 py-1 text-slate-500">Page {data.page} of {totalPages}</span>
      {#if data.page < totalPages}
        <a
          class="rounded border border-slate-300 px-3 py-1 hover:bg-slate-100"
          href="?page={data.page + 1}&status={data.filters.status}"
        >
          Next
        </a>
      {/if}
    </nav>
  {/if}
</section>

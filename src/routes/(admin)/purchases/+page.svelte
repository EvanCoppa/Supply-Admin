<script lang="ts">
  import { currency, dateShort } from '$lib/format';

  let { data } = $props();

  const statusClass: Record<string, string> = {
    draft: 'bg-slate-100 text-slate-700',
    ordered: 'bg-sky-50 text-sky-800',
    received: 'bg-emerald-50 text-emerald-800',
    cancelled: 'bg-slate-100 text-slate-500 line-through'
  };
  const paymentClass: Record<string, string> = {
    unpaid: 'bg-red-50 text-red-800',
    partial: 'bg-amber-50 text-amber-800',
    paid: 'bg-emerald-50 text-emerald-800'
  };

  const lastPage = $derived(Math.max(1, Math.ceil(data.total / data.pageSize)));

  function buildHref(params: Record<string, string | number>): string {
    const sp = new URLSearchParams();
    if (data.filters.supplierId) sp.set('supplier', data.filters.supplierId);
    if (data.filters.status) sp.set('status', data.filters.status);
    if (data.filters.paymentStatus) sp.set('payment_status', data.filters.paymentStatus);
    for (const [k, v] of Object.entries(params)) {
      if (v === '' || v === 0) sp.delete(k);
      else sp.set(k, String(v));
    }
    const qs = sp.toString();
    return qs ? `?${qs}` : '?';
  }
</script>

<svelte:head><title>Purchases · Supply Admin</title></svelte:head>

<section class="space-y-5">
  <header class="flex items-center justify-between">
    <div>
      <h1 class="text-2xl font-semibold">Purchases</h1>
      <p class="text-sm text-slate-500">Supplier POs feeding COGS and AP.</p>
    </div>
    <a
      href="/purchases/new"
      class="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
    >
      New purchase
    </a>
  </header>

  <form class="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-3 text-sm">
    <label class="block">
      <span class="mb-1 block text-xs font-medium text-slate-600">Supplier</span>
      <select
        name="supplier"
        value={data.filters.supplierId}
        class="rounded border border-slate-300 px-2 py-1"
      >
        <option value="">All</option>
        {#each data.suppliers as s}
          <option value={s.id}>{s.name}</option>
        {/each}
      </select>
    </label>
    <label class="block">
      <span class="mb-1 block text-xs font-medium text-slate-600">Status</span>
      <select
        name="status"
        value={data.filters.status}
        class="rounded border border-slate-300 px-2 py-1"
      >
        <option value="">All</option>
        {#each data.statuses as s}
          <option value={s}>{s}</option>
        {/each}
      </select>
    </label>
    <label class="block">
      <span class="mb-1 block text-xs font-medium text-slate-600">Payment</span>
      <select
        name="payment_status"
        value={data.filters.paymentStatus}
        class="rounded border border-slate-300 px-2 py-1"
      >
        <option value="">All</option>
        {#each data.paymentStatuses as s}
          <option value={s}>{s}</option>
        {/each}
      </select>
    </label>
    <button class="rounded bg-slate-900 px-3 py-1.5 text-xs font-medium text-white" type="submit">
      Apply
    </button>
    <a href="/purchases" class="text-xs text-slate-600 hover:underline">Reset</a>
  </form>

  <div class="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
    <table class="w-full text-sm">
      <thead class="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
        <tr>
          <th class="px-3 py-2 text-left font-medium">Ordered</th>
          <th class="px-3 py-2 text-left font-medium">Supplier</th>
          <th class="px-3 py-2 text-left font-medium">For order</th>
          <th class="px-3 py-2 text-left font-medium">Status</th>
          <th class="px-3 py-2 text-left font-medium">Payment</th>
          <th class="px-3 py-2 text-right font-medium">Subtotal</th>
          <th class="px-3 py-2 text-right font-medium">Total</th>
          <th class="px-3 py-2 text-left font-medium">Due</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-slate-100">
        {#each data.purchases as p (p.id)}
          <tr class="hover:bg-slate-50">
            <td class="px-3 py-2 text-slate-500">
              <a class="hover:underline" href="/purchases/{p.id}">{dateShort(p.ordered_at)}</a>
            </td>
            <td class="px-3 py-2">{p.supplier?.name ?? '—'}</td>
            <td class="px-3 py-2">
              {#if p.order}
                <a class="text-sky-700 hover:underline" href="/orders/{p.order.id}">
                  {p.order.customer?.business_name ?? p.order.id.slice(0, 8)}
                </a>
              {:else}
                <span class="text-slate-400">—</span>
              {/if}
            </td>
            <td class="px-3 py-2">
              <span class="rounded px-2 py-0.5 text-xs {statusClass[p.status] ?? ''}">{p.status}</span>
            </td>
            <td class="px-3 py-2">
              <span class="rounded px-2 py-0.5 text-xs {paymentClass[p.payment_status] ?? ''}">{p.payment_status}</span>
            </td>
            <td class="px-3 py-2 text-right">{currency(p.subtotal)}</td>
            <td class="px-3 py-2 text-right font-medium">{currency(p.total)}</td>
            <td class="px-3 py-2 text-slate-500">{dateShort(p.due_date)}</td>
          </tr>
        {:else}
          <tr>
            <td class="px-3 py-10 text-center text-sm text-slate-500" colspan="8">
              No purchases yet. <a class="text-sky-700 hover:underline" href="/purchases/new">Log the first one →</a>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>

  {#if data.total > data.pageSize}
    <div class="flex items-center justify-between text-sm text-slate-600">
      <span>Page {data.page} of {lastPage} · {data.total} purchases</span>
      <div class="flex gap-2">
        {#if data.page > 1}
          <a class="rounded border border-slate-300 px-2 py-1 hover:bg-slate-100" href={buildHref({ page: data.page - 1 })}>Prev</a>
        {/if}
        {#if data.page < lastPage}
          <a class="rounded border border-slate-300 px-2 py-1 hover:bg-slate-100" href={buildHref({ page: data.page + 1 })}>Next</a>
        {/if}
      </div>
    </div>
  {/if}
</section>

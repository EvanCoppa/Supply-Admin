<script lang="ts">
  import { currency, dateTime } from '$lib/format';
  import OrderStatusBadge from '$lib/components/OrderStatusBadge.svelte';

  let { data } = $props();
  const totalPages = $derived(Math.max(1, Math.ceil(data.total / data.pageSize)));
</script>

<div class="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
  {#if data.orders.length === 0}
    <p class="px-4 py-10 text-center text-sm text-slate-500">No orders for this client yet.</p>
  {:else}
    <table class="w-full text-sm">
      <thead class="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
        <tr>
          <th class="px-4 py-2 text-left font-medium">Order</th>
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
            <td class="px-4 py-2"><OrderStatusBadge status={o.status} /></td>
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
  <nav class="mt-4 flex justify-end gap-2 text-sm">
    {#if data.page > 1}
      <a
        class="rounded border border-slate-300 px-3 py-1 hover:bg-slate-100"
        href="?page={data.page - 1}">Previous</a
      >
    {/if}
    <span class="px-2 py-1 text-slate-500">Page {data.page} of {totalPages}</span>
    {#if data.page < totalPages}
      <a
        class="rounded border border-slate-300 px-3 py-1 hover:bg-slate-100"
        href="?page={data.page + 1}">Next</a
      >
    {/if}
  </nav>
{/if}

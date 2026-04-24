<script lang="ts">
  import { enhance } from '$app/forms';
  import { currency, dateTime } from '$lib/format';
  import OrderStatusBadge from '$lib/components/OrderStatusBadge.svelte';

  let { data, form } = $props();
  let o = $derived(data.order);

  const nextStatus = $derived(
    (
      {
        paid: 'fulfilled',
        fulfilled: 'shipped',
        shipped: 'delivered'
      } as Record<string, string>
    )[o.status] ?? null
  );

  const canCancel = $derived(!['delivered', 'cancelled', 'refunded'].includes(o.status));
  const canRefund = $derived(['paid', 'fulfilled', 'shipped', 'delivered'].includes(o.status));
</script>

<svelte:head><title>Order {o.id.slice(0, 8)} · Supply Admin</title></svelte:head>

<section class="space-y-5">
  <header>
    <a class="text-sm text-sky-700 hover:underline" href="/orders">← Orders</a>
    <div class="flex items-center gap-3">
      <h1 class="text-2xl font-semibold font-mono">{o.id.slice(0, 8)}</h1>
      <OrderStatusBadge status={o.status} />
      <span class="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700">{o.source}</span>
    </div>
    <p class="text-sm text-slate-500">Placed {dateTime(o.placed_at)}</p>
  </header>

  {#if form?.message}
    <div class="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">
      {form.message}{form.code ? ` (${form.code})` : ''}
    </div>
  {/if}
  {#if form?.saved}
    <div class="rounded border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
      Saved.
    </div>
  {/if}

  <div class="grid gap-5 lg:grid-cols-3">
    <div class="space-y-5 lg:col-span-2">
      <div class="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 class="mb-3 font-semibold">Line items</h2>
        <table class="w-full text-sm">
          <thead class="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th class="px-3 py-2 text-left font-medium">SKU</th>
              <th class="px-3 py-2 text-left font-medium">Name</th>
              <th class="px-3 py-2 text-right font-medium">Qty</th>
              <th class="px-3 py-2 text-right font-medium">Unit</th>
              <th class="px-3 py-2 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            {#each data.lineItems as li}
              <tr>
                <td class="px-3 py-2 font-mono text-xs">{li.product_sku_snapshot}</td>
                <td class="px-3 py-2">{li.product_name_snapshot}</td>
                <td class="px-3 py-2 text-right">{li.quantity}</td>
                <td class="px-3 py-2 text-right">{currency(li.unit_price_snapshot)}</td>
                <td class="px-3 py-2 text-right font-medium">{currency(li.line_total)}</td>
              </tr>
            {/each}
          </tbody>
          <tfoot class="bg-slate-50 text-sm">
            <tr>
              <td class="px-3 py-2" colspan="4">Subtotal</td>
              <td class="px-3 py-2 text-right">{currency(o.subtotal)}</td>
            </tr>
            <tr>
              <td class="px-3 py-2" colspan="4">Tax</td>
              <td class="px-3 py-2 text-right">{currency(o.tax)}</td>
            </tr>
            <tr>
              <td class="px-3 py-2" colspan="4">Shipping</td>
              <td class="px-3 py-2 text-right">{currency(o.shipping)}</td>
            </tr>
            <tr class="font-semibold">
              <td class="px-3 py-2" colspan="4">Total</td>
              <td class="px-3 py-2 text-right">{currency(o.total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div class="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 class="mb-3 font-semibold">Payments</h2>
        {#if data.payments.length === 0}
          <p class="text-sm text-slate-500">No payment attempts recorded.</p>
        {:else}
          <table class="w-full text-sm">
            <thead class="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th class="px-3 py-2 text-left font-medium">When</th>
                <th class="px-3 py-2 text-left font-medium">Status</th>
                <th class="px-3 py-2 text-right font-medium">Amount</th>
                <th class="px-3 py-2 text-left font-medium">Gateway ref</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              {#each data.payments as p}
                <tr>
                  <td class="px-3 py-2 text-slate-500">{dateTime(p.created_at)}</td>
                  <td class="px-3 py-2">{p.status}</td>
                  <td class="px-3 py-2 text-right">{currency(p.amount)}</td>
                  <td class="px-3 py-2 font-mono text-xs">{p.gateway_reference ?? '—'}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        {/if}
      </div>
    </div>

    <aside class="space-y-4">
      <div class="rounded-lg border border-slate-200 bg-white p-4 shadow-sm text-sm">
        <h3 class="mb-2 font-semibold">Customer</h3>
        <a class="text-sky-700 hover:underline" href="/clients/{o.customer?.id}">
          {o.customer?.business_name ?? '—'}
        </a>
        {#if o.customer?.email}
          <p class="text-slate-500">{o.customer.email}</p>
        {/if}
      </div>

      <div class="rounded-lg border border-slate-200 bg-white p-4 shadow-sm text-sm">
        <h3 class="mb-2 font-semibold">Shipping address</h3>
        {#if o.shipping_address_snapshot}
          <pre class="whitespace-pre-wrap text-xs text-slate-600">{JSON.stringify(
              o.shipping_address_snapshot,
              null,
              2
            )}</pre>
        {:else}
          <p class="text-slate-500">No snapshot.</p>
        {/if}
      </div>

      <div class="rounded-lg border border-slate-200 bg-white p-4 shadow-sm text-sm">
        <h3 class="mb-2 font-semibold">Metadata</h3>
        <dl class="space-y-1">
          <div class="flex justify-between">
            <dt class="text-slate-500">Payment ref</dt>
            <dd class="font-mono text-xs">{o.payment_reference ?? '—'}</dd>
          </div>
          <div class="flex justify-between">
            <dt class="text-slate-500">Idempotency</dt>
            <dd class="font-mono text-xs">{o.idempotency_key ?? '—'}</dd>
          </div>
        </dl>
      </div>

      <div class="rounded-lg border border-slate-200 bg-white p-4 shadow-sm text-sm space-y-3">
        <h3 class="font-semibold">Actions</h3>
        {#if nextStatus}
          <form method="POST" action="?/transition" use:enhance class="space-y-2">
            <input type="hidden" name="to" value={nextStatus} />
            {#if nextStatus === 'shipped'}
              <label class="block">
                <span class="mb-1 block text-xs font-medium">Tracking #</span>
                <input
                  name="tracking"
                  class="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                />
              </label>
            {/if}
            <button
              type="submit"
              class="w-full rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
            >
              Mark {nextStatus}
            </button>
          </form>
        {:else}
          <p class="text-xs text-slate-500">No next-status transition available.</p>
        {/if}

        {#if canCancel}
          <form method="POST" action="?/cancel" use:enhance>
            <button
              type="submit"
              onclick={(e) => {
                if (!confirm('Cancel this order? Inventory will be released.')) e.preventDefault();
              }}
              class="w-full rounded border border-red-300 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50"
            >
              Cancel order
            </button>
          </form>
        {/if}

        {#if canRefund}
          <form method="POST" action="?/refund" use:enhance class="space-y-2">
            <label class="block">
              <span class="mb-1 block text-xs font-medium">Refund amount (blank = full)</span>
              <input
                type="number"
                step="0.01"
                min="0"
                name="amount"
                class="w-full rounded border border-slate-300 px-2 py-1 text-sm"
              />
            </label>
            <button
              type="submit"
              onclick={(e) => {
                if (!confirm('Issue refund via API?')) e.preventDefault();
              }}
              class="w-full rounded border border-red-300 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50"
            >
              Issue refund
            </button>
          </form>
        {/if}
      </div>
    </aside>
  </div>
</section>

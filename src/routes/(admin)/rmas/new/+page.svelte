<script lang="ts">
  import { enhance } from '$app/forms';
  import { currency, dateShort } from '$lib/format';
  import Breadcrumbs from '$lib/components/Breadcrumbs.svelte';
  import Select from '$lib/components/Select.svelte';

  let { data, form } = $props();

  // svelte-ignore state_referenced_locally
  let customerId = $state(data.defaultCustomerId);
  // svelte-ignore state_referenced_locally
  let orderId = $state(data.defaultOrderId);
  let reason = $state('');
  let refundAmount = $state(0);
  let restockingFee = $state(0);
  let notes = $state('');

  const customerOrders = $derived(data.ordersByCustomer[customerId] ?? []);
  const netRefund = $derived(
    Math.round(
      (Math.max(0, Number(refundAmount || 0)) - Math.max(0, Number(restockingFee || 0))) * 100
    ) / 100
  );

  $effect(() => {
    if (customerOrders.length === 0) {
      orderId = '';
      return;
    }
    const stillThere = customerOrders.some((o) => o.id === orderId);
    if (!stillThere) orderId = '';
  });

  function orderLabel(o: (typeof customerOrders)[number]) {
    const date = o.placed_at ? dateShort(o.placed_at) : '—';
    return `${date} · ${currency(o.total)} · ${o.status}`;
  }
</script>

<svelte:head><title>New RMA · Supply Admin</title></svelte:head>

<section class="space-y-5">
  <Breadcrumbs items={[{ label: 'RMAs', href: '/rmas' }, { label: 'New' }]} />

  {#if form?.message}
    <div class="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">
      {form.message}
    </div>
  {/if}

  <div class="mx-auto max-w-5xl">
    <form method="POST" action="?/create" use:enhance class="space-y-5">
      <div class="space-y-3 rounded-lg border border-slate-200 bg-white p-4 text-sm shadow-sm">
        <h2 class="font-semibold">Customer &amp; order</h2>
        <label class="block">
          <span class="mb-1 block text-xs font-medium text-slate-600">Customer</span>
          <Select name="customer_id" bind:value={customerId} required class="w-full">
            <option value="">Select a customer</option>
            {#each data.customers as customer (customer.id)}
              <option value={customer.id}>{customer.business_name}</option>
            {/each}
          </Select>
        </label>

        <div class="block">
          <span class="mb-1 block text-xs font-medium text-slate-600">Order</span>
          {#if !customerId}
            <p
              class="rounded border border-dashed border-slate-300 px-3 py-2 text-xs text-slate-500"
            >
              Pick a customer to see their orders.
            </p>
          {:else if customerOrders.length === 0}
            <p
              class="rounded border border-dashed border-slate-300 px-3 py-2 text-xs text-slate-500"
            >
              No recent orders for this customer.
              <a class="text-sky-700 hover:underline" href={`/clients/${customerId}/orders`}>
                View all orders
              </a>
            </p>
          {:else}
            <Select name="order_id" bind:value={orderId} required class="w-full">
              <option value="">— Pick an order —</option>
              {#each customerOrders as o (o.id)}
                <option value={o.id}>{orderLabel(o)}</option>
              {/each}
            </Select>
          {/if}
        </div>
      </div>

      <div class="space-y-3 rounded-lg border border-slate-200 bg-white p-4 text-sm shadow-sm">
        <h2 class="font-semibold">Refund details</h2>
        <div class="grid gap-3 sm:grid-cols-2">
          <label class="block">
            <span class="mb-1 block text-xs font-medium text-slate-600">Refund amount</span>
            <input
              type="number"
              step="0.01"
              min="0"
              name="refund_amount"
              bind:value={refundAmount}
              class="w-full rounded border border-slate-300 px-2 py-1.5"
            />
          </label>
          <label class="block">
            <span class="mb-1 block text-xs font-medium text-slate-600">Restocking fee</span>
            <input
              type="number"
              step="0.01"
              min="0"
              name="restocking_fee"
              bind:value={restockingFee}
              class="w-full rounded border border-slate-300 px-2 py-1.5"
            />
          </label>
        </div>

        <label class="block">
          <span class="mb-1 block text-xs font-medium text-slate-600">Reason</span>
          <input
            name="reason"
            bind:value={reason}
            placeholder="e.g. damaged in transit"
            class="w-full rounded border border-slate-300 px-2 py-1.5"
          />
        </label>

        <label class="block">
          <span class="mb-1 block text-xs font-medium text-slate-600">Internal notes</span>
          <textarea
            name="notes"
            rows="3"
            bind:value={notes}
            class="w-full rounded border border-slate-300 px-2 py-1.5"
          ></textarea>
        </label>
      </div>

      <div class="rounded-lg border border-slate-200 bg-white p-4 text-sm shadow-sm">
        <h3 class="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Summary</h3>
        <dl class="space-y-1">
          <div class="flex justify-between">
            <dt class="text-slate-600">Refund amount</dt>
            <dd>{currency(Math.max(0, Number(refundAmount || 0)))}</dd>
          </div>
          <div class="flex justify-between">
            <dt class="text-slate-600">Restocking fee</dt>
            <dd>− {currency(Math.max(0, Number(restockingFee || 0)))}</dd>
          </div>
          <div class="flex justify-between border-t border-slate-200 pt-1 font-semibold">
            <dt>Net refund</dt>
            <dd>{currency(Math.max(0, netRefund))}</dd>
          </div>
        </dl>
        <p class="mt-3 rounded bg-slate-50 px-2 py-1 text-xs text-slate-600">
          The RMA opens in <span class="font-mono">requested</span> status. You can add line items and
          progress it on the next screen.
        </p>
      </div>

      <div class="flex gap-2">
        <a
          href="/rmas"
          class="flex-1 rounded border border-slate-300 px-3 py-2 text-center text-sm text-slate-700 hover:bg-slate-100"
        >
          Cancel
        </a>
        <button
          type="submit"
          class="flex-1 rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          Create RMA
        </button>
      </div>
    </form>
  </div>
</section>

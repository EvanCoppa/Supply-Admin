<script lang="ts">
  import { enhance } from '$app/forms';
  import { currency, dateShort } from '$lib/format';
  import Breadcrumbs from '$lib/components/Breadcrumbs.svelte';

  let { data, form } = $props();

  // svelte-ignore state_referenced_locally
  let supplierId = $state(data.suppliers[0]?.id ?? '');
  // svelte-ignore state_referenced_locally
  let orderId = $state(data.defaultOrderId);
  let subtotal = $state(0);
  let freight = $state(0);
  let distributionFeePct = $state(0);
  let tax = $state(0);

  $effect(() => {
    const s = data.suppliers.find((x) => x.id === supplierId);
    if (s) distributionFeePct = Number(s.distribution_fee_pct) * 100;
  });

  const linkedOrder = $derived(
    orderId
      ? data.recentOrders.find((o) => o.id === orderId) ?? data.linkedOrder
      : null
  );

  const distributionFee = $derived(
    Math.round((Number(subtotal) || 0) * (Number(distributionFeePct) / 100) * 100) / 100
  );
  const total = $derived(
    Math.round(
      ((Number(subtotal) || 0) +
        (Number(freight) || 0) +
        distributionFee +
        (Number(tax) || 0)) *
        100
    ) / 100
  );

  const projectedCogs = $derived(linkedOrder ? data.existingCogs + total : 0);
  const projectedMargin = $derived(
    linkedOrder && linkedOrder.total > 0
      ? (Number(linkedOrder.total) - projectedCogs) / Number(linkedOrder.total)
      : 0
  );

  function pct(v: number) {
    return `${(v * 100).toFixed(1)}%`;
  }
  function marginClass(v: number) {
    if (v >= 0.4) return 'text-emerald-700';
    if (v >= 0.25) return 'text-amber-700';
    return 'text-red-700';
  }
</script>

<svelte:head><title>New purchase · Supply Admin</title></svelte:head>

<section class="space-y-5">
  <Breadcrumbs items={[{ label: 'Purchases', href: '/purchases' }, { label: 'New' }]} />
  <h1 class="text-2xl font-semibold">New purchase</h1>

  {#if form?.message}
    <div class="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">
      {form.message}
    </div>
  {/if}

  <form method="POST" action="?/create" use:enhance class="grid gap-5 lg:grid-cols-3">
    <div class="space-y-4 lg:col-span-2">
      <div class="rounded-lg border border-slate-200 bg-white p-4 shadow-sm space-y-3 text-sm">
        <label class="block">
          <span class="mb-1 block text-xs font-medium text-slate-600">Supplier</span>
          <select
            name="supplier_id"
            bind:value={supplierId}
            required
            class="w-full rounded border border-slate-300 px-2 py-1.5"
          >
            {#each data.suppliers as s (s.id)}
              <option value={s.id}>{s.name}</option>
            {/each}
          </select>
        </label>

        <label class="block">
          <span class="mb-1 block text-xs font-medium text-slate-600">For client order (optional)</span>
          <select
            name="order_id"
            bind:value={orderId}
            class="w-full rounded border border-slate-300 px-2 py-1.5"
          >
            <option value="">— not tied to a client order —</option>
            {#each data.recentOrders as o (o.id)}
              <option value={o.id}>
                {o.customer?.business_name ?? o.id.slice(0, 8)} · {dateShort(o.placed_at)} · {currency(o.total)}
              </option>
            {/each}
          </select>
        </label>

        <div class="grid gap-3 sm:grid-cols-2">
          <label class="block">
            <span class="mb-1 block text-xs font-medium text-slate-600">Ordered at</span>
            <input
              type="datetime-local"
              name="ordered_at"
              class="w-full rounded border border-slate-300 px-2 py-1.5"
            />
          </label>
          <label class="block">
            <span class="mb-1 block text-xs font-medium text-slate-600">Received at</span>
            <input
              type="datetime-local"
              name="received_at"
              class="w-full rounded border border-slate-300 px-2 py-1.5"
            />
          </label>
        </div>

        <label class="block">
          <span class="mb-1 block text-xs font-medium text-slate-600">Supplier invoice / PO ref</span>
          <input
            name="invoice_ref"
            class="w-full rounded border border-slate-300 px-2 py-1.5"
            placeholder="e.g. MCK-44219"
          />
        </label>

        <label class="block">
          <span class="mb-1 block text-xs font-medium text-slate-600">Notes</span>
          <textarea
            name="notes"
            rows="3"
            class="w-full rounded border border-slate-300 px-2 py-1.5"
          ></textarea>
        </label>
      </div>

      <div class="rounded-lg border border-slate-200 bg-white p-4 shadow-sm space-y-3 text-sm">
        <h2 class="font-semibold">Costs</h2>
        <div class="grid gap-3 sm:grid-cols-2">
          <label class="block">
            <span class="mb-1 block text-xs font-medium text-slate-600">Subtotal</span>
            <input
              type="number"
              step="0.01"
              min="0"
              name="subtotal"
              bind:value={subtotal}
              required
              class="w-full rounded border border-slate-300 px-2 py-1.5"
            />
          </label>
          <label class="block">
            <span class="mb-1 block text-xs font-medium text-slate-600">Freight / shipping</span>
            <input
              type="number"
              step="0.01"
              min="0"
              name="freight"
              bind:value={freight}
              class="w-full rounded border border-slate-300 px-2 py-1.5"
            />
          </label>
          <label class="block">
            <span class="mb-1 block text-xs font-medium text-slate-600">Distribution fee %</span>
            <input
              type="number"
              step="0.001"
              min="0"
              max="100"
              name="distribution_fee_pct"
              bind:value={distributionFeePct}
              class="w-full rounded border border-slate-300 px-2 py-1.5"
            />
            <span class="text-xs text-slate-500">Auto-fills from supplier; override if needed.</span>
          </label>
          <label class="block">
            <span class="mb-1 block text-xs font-medium text-slate-600">Tax</span>
            <input
              type="number"
              step="0.01"
              min="0"
              name="tax"
              bind:value={tax}
              class="w-full rounded border border-slate-300 px-2 py-1.5"
            />
          </label>
        </div>

        <dl class="mt-2 rounded border border-slate-100 bg-slate-50 p-3 text-sm space-y-1">
          <div class="flex justify-between">
            <dt class="text-slate-600">Distribution fee</dt>
            <dd>{currency(distributionFee)}</dd>
          </div>
          <div class="flex justify-between border-t border-slate-200 pt-1 font-semibold">
            <dt>Total</dt>
            <dd>{currency(total)}</dd>
          </div>
        </dl>
      </div>

      <div class="rounded-lg border border-slate-200 bg-white p-4 shadow-sm space-y-3 text-sm">
        <h2 class="font-semibold">Status</h2>
        <div class="grid gap-3 sm:grid-cols-3">
          <label class="block">
            <span class="mb-1 block text-xs font-medium text-slate-600">Status</span>
            <select name="status" class="w-full rounded border border-slate-300 px-2 py-1.5">
              <option value="draft">draft</option>
              <option value="ordered" selected>ordered</option>
              <option value="received">received</option>
              <option value="cancelled">cancelled</option>
            </select>
          </label>
          <label class="block">
            <span class="mb-1 block text-xs font-medium text-slate-600">Payment status</span>
            <select
              name="payment_status"
              class="w-full rounded border border-slate-300 px-2 py-1.5"
            >
              <option value="unpaid" selected>unpaid</option>
              <option value="partial">partial</option>
              <option value="paid">paid</option>
            </select>
          </label>
          <label class="block">
            <span class="mb-1 block text-xs font-medium text-slate-600">Due date</span>
            <input
              type="date"
              name="due_date"
              class="w-full rounded border border-slate-300 px-2 py-1.5"
            />
          </label>
        </div>
      </div>
    </div>

    <aside class="space-y-4">
      {#if linkedOrder}
        <div class="rounded-lg border border-slate-200 bg-white p-4 shadow-sm text-sm">
          <h3 class="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Margin preview
          </h3>
          <dl class="space-y-1">
            <div class="flex justify-between">
              <dt class="text-slate-600">Order revenue</dt>
              <dd>{currency(linkedOrder.total)}</dd>
            </div>
            <div class="flex justify-between">
              <dt class="text-slate-600">Existing COGS</dt>
              <dd>{currency(data.existingCogs)}</dd>
            </div>
            <div class="flex justify-between">
              <dt class="text-slate-600">This purchase</dt>
              <dd>{currency(total)}</dd>
            </div>
            <div class="flex justify-between border-t border-slate-200 pt-1">
              <dt class="font-medium">Projected COGS</dt>
              <dd>{currency(projectedCogs)}</dd>
            </div>
            <div class="flex justify-between">
              <dt class="font-medium">Projected GP</dt>
              <dd>{currency(Number(linkedOrder.total) - projectedCogs)}</dd>
            </div>
            <div class="flex justify-between">
              <dt class="font-medium">Projected margin</dt>
              <dd class={marginClass(projectedMargin)}>{pct(projectedMargin)}</dd>
            </div>
          </dl>
          {#if projectedMargin < 0.4}
            <p class="mt-2 rounded bg-amber-50 px-2 py-1 text-xs text-amber-800">
              Below 40% target.
            </p>
          {/if}
        </div>
      {/if}

      <button
        type="submit"
        class="w-full rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
      >
        Create purchase
      </button>
      <a
        href="/purchases"
        class="block w-full rounded border border-slate-300 px-3 py-2 text-center text-sm text-slate-700 hover:bg-slate-100"
      >
        Cancel
      </a>
    </aside>
  </form>
</section>

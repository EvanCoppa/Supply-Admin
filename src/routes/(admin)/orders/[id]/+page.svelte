<script lang="ts">
  import { enhance } from '$app/forms';
  import { currency, dateTime } from '$lib/format';
  import OrderStatusBadge from '$lib/components/OrderStatusBadge.svelte';
  import TaxDetails from '$lib/components/TaxDetails.svelte';
  import Breadcrumbs from '$lib/components/Breadcrumbs.svelte';

  let { data, form } = $props();
  let o = $derived(data.order);

  const TIMELINE: { status: string; label: string }[] = [
    { status: 'pending_payment', label: 'Payment pending' },
    { status: 'paid', label: 'Paid' },
    { status: 'fulfilled', label: 'Fulfilled' },
    { status: 'shipped', label: 'Shipped' },
    { status: 'delivered', label: 'Delivered' }
  ];
  const TERMINAL = new Set(['cancelled', 'refunded']);

  function timelineState(step: string, current: string) {
    if (TERMINAL.has(current)) return 'inactive';
    const order = TIMELINE.map((t) => t.status);
    const curIdx = order.indexOf(current);
    const stepIdx = order.indexOf(step);
    if (stepIdx < curIdx) return 'done';
    if (stepIdx === curIdx) return 'current';
    return 'pending';
  }

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

  let refundOpen = $state(false);
  let refundFull = $state(true);
  let refundAmount = $state('');
  let refundSubmitting = $state(false);
  const orderTotal = $derived(Number(o.total));
  const refundAmountNum = $derived(Number(refundAmount));
  const refundValid = $derived(
    refundFull ||
      (refundAmount !== '' &&
        Number.isFinite(refundAmountNum) &&
        refundAmountNum > 0 &&
        refundAmountNum <= orderTotal)
  );

  function openRefund() {
    refundFull = true;
    refundAmount = '';
    refundOpen = true;
  }
  function closeRefund() {
    refundOpen = false;
    refundSubmitting = false;
  }

  const cogsTotal = $derived(
    data.purchases
      .filter((p) => p.status !== 'cancelled')
      .reduce((acc, p) => acc + Number(p.total), 0)
  );
  const grossProfit = $derived(Number(o.total) - cogsTotal);
  const margin = $derived(Number(o.total) > 0 ? grossProfit / Number(o.total) : 0);

  const purchaseStatusClass: Record<string, string> = {
    draft: 'bg-slate-100 text-slate-700',
    ordered: 'bg-sky-50 text-sky-800',
    received: 'bg-emerald-50 text-emerald-800',
    cancelled: 'bg-slate-100 text-slate-500'
  };

  function pct(v: number) {
    return `${(v * 100).toFixed(1)}%`;
  }
  function marginClass(v: number) {
    if (v >= 0.4) return 'text-emerald-700';
    if (v >= 0.25) return 'text-amber-700';
    return 'text-red-700';
  }
</script>

<svelte:head><title>Order {o.id.slice(0, 8)} · Supply Admin</title></svelte:head>

<section class="space-y-5">
  <header class="space-y-2">
    <Breadcrumbs items={[{ label: 'Orders', href: '/orders' }, { label: o.id.slice(0, 8) }]} />
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
        <div class="mb-3 flex items-center justify-between">
          <h2 class="font-semibold">Purchases for this order</h2>
          <a
            href={`/purchases/new?order=${o.id}`}
            class="rounded bg-slate-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-slate-800"
          >
            Add purchase
          </a>
        </div>

        {#if data.purchases.length === 0}
          <p class="text-sm text-slate-500">
            No purchases logged. Split across suppliers as needed.
          </p>
        {:else}
          <table class="w-full text-sm">
            <thead class="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th class="px-3 py-2 text-left font-medium">Ordered</th>
                <th class="px-3 py-2 text-left font-medium">Supplier</th>
                <th class="px-3 py-2 text-left font-medium">Status</th>
                <th class="px-3 py-2 text-left font-medium">Payment</th>
                <th class="px-3 py-2 text-right font-medium">Freight + fee</th>
                <th class="px-3 py-2 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              {#each data.purchases as p (p.id)}
                <tr class="hover:bg-slate-50">
                  <td class="px-3 py-2 text-slate-500">
                    <a class="hover:underline" href="/purchases/{p.id}">{dateTime(p.ordered_at)}</a>
                  </td>
                  <td class="px-3 py-2">{p.supplier?.name ?? '—'}</td>
                  <td class="px-3 py-2">
                    <span class="rounded px-2 py-0.5 text-xs {purchaseStatusClass[p.status] ?? ''}"
                      >{p.status}</span
                    >
                  </td>
                  <td class="px-3 py-2">{p.payment_status}</td>
                  <td class="px-3 py-2 text-right text-slate-600">
                    {currency(Number(p.freight) + Number(p.distribution_fee))}
                  </td>
                  <td class="px-3 py-2 text-right font-medium">{currency(p.total)}</td>
                </tr>
              {/each}
            </tbody>
            <tfoot class="bg-slate-50 text-sm">
              <tr class="font-semibold">
                <td class="px-3 py-2" colspan="5">COGS</td>
                <td class="px-3 py-2 text-right">{currency(cogsTotal)}</td>
              </tr>
              <tr>
                <td class="px-3 py-2" colspan="5">Gross profit</td>
                <td class="px-3 py-2 text-right">{currency(grossProfit)}</td>
              </tr>
              <tr>
                <td class="px-3 py-2" colspan="5">Margin</td>
                <td class="px-3 py-2 text-right {marginClass(margin)}">{pct(margin)}</td>
              </tr>
            </tfoot>
          </table>
        {/if}
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

      {#if o.tax > 0 || o.tax_rate}
        <TaxDetails
          subtotal={o.subtotal}
          taxAmount={o.tax}
          taxRate={o.tax_rate || 0}
          state={o.shipping_state}
          county={null}
        />
      {/if}

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

      <div class="rounded-lg border border-slate-200 bg-white p-4 shadow-sm text-sm space-y-4">
        <h3 class="font-semibold">Lifecycle</h3>
        {#if TERMINAL.has(o.status)}
          <p class="rounded bg-slate-50 px-3 py-2 text-xs text-slate-600">
            Order is <span class="font-semibold">{o.status}</span> — no further transitions.
          </p>
        {:else}
          <ol class="space-y-2">
            {#each TIMELINE as step}
              {@const state = timelineState(step.status, o.status)}
              <li class="flex items-center gap-2">
                <span
                  class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold"
                  class:bg-emerald-500={state === 'done'}
                  class:text-white={state === 'done' || state === 'current'}
                  class:bg-sky-600={state === 'current'}
                  class:bg-slate-100={state === 'pending'}
                  class:text-slate-500={state === 'pending'}
                >
                  {#if state === 'done'}✓{:else}·{/if}
                </span>
                <span
                  class="text-sm"
                  class:font-semibold={state === 'current'}
                  class:text-slate-500={state === 'pending'}
                >
                  {step.label}
                </span>
              </li>
            {/each}
          </ol>
        {/if}

        {#if nextStatus}
          <form
            method="POST"
            action="?/transition"
            use:enhance
            class="space-y-2 border-t border-slate-100 pt-3"
          >
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
              Advance to {nextStatus}
            </button>
          </form>
        {/if}

        {#if canCancel || canRefund}
          <div class="space-y-2 border-t border-slate-100 pt-3">
            {#if canCancel}
              <form method="POST" action="?/cancel" use:enhance>
                <button
                  type="submit"
                  onclick={(e) => {
                    if (!confirm('Cancel this order? Inventory will be released.'))
                      e.preventDefault();
                  }}
                  class="w-full rounded border border-red-300 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50"
                >
                  Cancel order
                </button>
              </form>
            {/if}

            {#if canRefund}
              <button
                type="button"
                onclick={openRefund}
                class="w-full rounded border border-red-300 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50"
              >
                Refund…
              </button>
            {/if}
          </div>
        {/if}
      </div>
    </aside>
  </div>

  {#if refundOpen}
    <div
      class="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="refund-title"
      tabindex="-1"
      onclick={(e) => {
        if (e.target === e.currentTarget) closeRefund();
      }}
      onkeydown={(e) => {
        if (e.key === 'Escape') closeRefund();
      }}
    >
      <form
        method="POST"
        action="?/refund"
        use:enhance={() => {
          refundSubmitting = true;
          return ({ update }) => {
            void update().finally(() => closeRefund());
          };
        }}
        class="w-full max-w-md space-y-4 rounded-lg bg-white p-5 shadow-xl"
      >
        <header>
          <h2 id="refund-title" class="text-lg font-semibold">Issue refund</h2>
          <p class="text-xs text-slate-500">Order total: {currency(orderTotal)}</p>
        </header>

        <fieldset class="space-y-2">
          <label class="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="refund_mode"
              checked={refundFull}
              onchange={() => {
                refundFull = true;
                refundAmount = '';
              }}
            />
            Full refund ({currency(orderTotal)})
          </label>
          <label class="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="refund_mode"
              checked={!refundFull}
              onchange={() => {
                refundFull = false;
              }}
            />
            Partial refund
          </label>
        </fieldset>

        {#if !refundFull}
          <label class="block">
            <span class="mb-1 block text-xs font-medium">Refund amount</span>
            <input
              type="number"
              step="1"
              min="1"
              max={orderTotal}
              name="amount"
              bind:value={refundAmount}
              placeholder="0"
              required
              class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
            />
            {#if refundAmount !== '' && !refundValid}
              <p class="mt-1 text-xs text-red-700">
                Enter an amount between $0.01 and {currency(orderTotal)}.
              </p>
            {/if}
          </label>
        {/if}

        <p class="rounded bg-amber-50 px-3 py-2 text-xs text-amber-800">
          This issues a refund against the payment gateway. The action cannot be undone.
        </p>

        <div class="flex justify-end gap-2">
          <button
            type="button"
            onclick={closeRefund}
            class="rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!refundValid || refundSubmitting}
            class="rounded bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-red-300"
          >
            {refundSubmitting
              ? 'Processing…'
              : refundFull
                ? 'Refund full'
                : `Refund ${refundAmount ? currency(refundAmountNum) : ''}`}
          </button>
        </div>
      </form>
    </div>
  {/if}
</section>

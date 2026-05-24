<script lang="ts">
  import { enhance } from '$app/forms';
  import { currency, dateTime } from '$lib/format';
  import Breadcrumbs from '$lib/components/Breadcrumbs.svelte';

  let { data, form } = $props();
  let r = $derived(data.rma);

  let showAddItem = $state(false);

  const statusClass: Record<string, string> = {
    requested: 'bg-slate-100 text-slate-700',
    approved: 'bg-sky-50 text-sky-700',
    received: 'bg-indigo-50 text-indigo-700',
    refunded: 'bg-emerald-50 text-emerald-700',
    rejected: 'bg-red-50 text-red-700',
    cancelled: 'bg-slate-200 text-slate-700'
  };

  const TIMELINE: { status: string; label: string }[] = [
    { status: 'requested', label: 'Requested' },
    { status: 'approved', label: 'Approved' },
    { status: 'received', label: 'Received' },
    { status: 'refunded', label: 'Refunded' }
  ];

  const TERMINAL = new Set(['rejected', 'cancelled']);

  function timelineState(status: string, current: string) {
    if (TERMINAL.has(current)) return 'inactive';
    const order = TIMELINE.map((t) => t.status);
    const curIdx = order.indexOf(current);
    const stepIdx = order.indexOf(status);
    if (stepIdx < curIdx) return 'done';
    if (stepIdx === curIdx) return 'current';
    return 'pending';
  }

  const itemsRefundTotal = $derived(
    r.items.reduce((acc, it) => acc + Number(it.unit_refund) * it.quantity, 0)
  );
</script>

<svelte:head><title>RMA {r.rma_number} · Supply Admin</title></svelte:head>

<section class="space-y-5">
  <header class="space-y-2">
    <Breadcrumbs
      items={[{ label: 'RMAs', href: '/rmas' }, { label: r.rma_number }]}
    />
    <div class="flex flex-wrap items-center gap-3">
      <h1 class="font-mono text-2xl font-semibold">{r.rma_number}</h1>
      <span class="rounded px-2 py-0.5 text-xs {statusClass[r.status] ?? ''}">{r.status}</span>
    </div>
    <p class="text-sm text-slate-500">Created {dateTime(r.created_at)}</p>
  </header>

  {#if form?.message}
    <div class="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">
      {form.message}
    </div>
  {/if}
  {#if form?.saved}
    <div class="rounded border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
      Saved.
    </div>
  {/if}

  <!-- Timeline -->
  <div class="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
    <h2 class="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-500">Status</h2>
    {#if TERMINAL.has(r.status)}
      <p class="text-sm">
        This RMA was <span class="font-semibold">{r.status}</span> and is no longer in the workflow.
      </p>
    {:else}
      <ol class="flex flex-wrap items-center gap-2 sm:gap-0">
        {#each TIMELINE as step, i}
          {@const state = timelineState(step.status, r.status)}
          <li class="flex items-center">
            <div class="flex items-center gap-2">
              <span
                class="flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold"
                class:bg-emerald-500={state === 'done'}
                class:text-white={state === 'done' || state === 'current'}
                class:bg-sky-600={state === 'current'}
                class:bg-slate-100={state === 'pending'}
                class:text-slate-500={state === 'pending'}
              >
                {#if state === 'done'}
                  ✓
                {:else}
                  {i + 1}
                {/if}
              </span>
              <span
                class="text-sm"
                class:font-semibold={state === 'current'}
                class:text-slate-500={state === 'pending'}
              >
                {step.label}
              </span>
            </div>
            {#if i < TIMELINE.length - 1}
              <span
                class="mx-3 hidden h-px w-10 sm:inline-block"
                class:bg-emerald-500={state === 'done'}
                class:bg-slate-200={state !== 'done'}
              ></span>
            {/if}
          </li>
        {/each}
      </ol>
    {/if}

    {#if data.allowedNextStatuses.length > 0}
      <div class="mt-5 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
        {#each data.allowedNextStatuses as s}
          <form method="POST" action="?/setStatus" use:enhance>
            <input type="hidden" name="status" value={s} />
            <button
              type="submit"
              class="rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100"
              onclick={(e) => {
                if (s === 'rejected' || s === 'cancelled') {
                  if (!confirm(`Mark RMA as ${s}?`)) e.preventDefault();
                }
              }}
            >
              Mark {s}
            </button>
          </form>
        {/each}
      </div>
    {/if}
  </div>

  <div class="grid gap-5 lg:grid-cols-3">
    <div class="space-y-5 lg:col-span-2">
      <!-- Editable RMA details -->
      <form
        method="POST"
        action="?/updateRma"
        use:enhance
        class="grid gap-3 rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-2"
      >
        <p class="sm:col-span-2 font-semibold">RMA details</p>
        <label class="block sm:col-span-2">
          <span class="mb-1 block text-xs font-medium">Reason</span>
          <input
            name="reason"
            value={r.reason ?? ''}
            class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
          />
        </label>
        <label class="block">
          <span class="mb-1 block text-xs font-medium">Refund amount</span>
          <input
            type="number"
            step="0.01"
            min="0"
            name="refund_amount"
            value={Number(r.refund_amount)}
            class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
          />
        </label>
        <label class="block">
          <span class="mb-1 block text-xs font-medium">Restocking fee</span>
          <input
            type="number"
            step="0.01"
            min="0"
            name="restocking_fee"
            value={Number(r.restocking_fee)}
            class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
          />
        </label>
        <label class="block sm:col-span-2">
          <span class="mb-1 block text-xs font-medium">Notes</span>
          <textarea
            name="notes"
            rows="2"
            class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
          >{r.notes ?? ''}</textarea>
        </label>
        <div class="sm:col-span-2 flex justify-end">
          <button
            type="submit"
            class="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
          >
            Save changes
          </button>
        </div>
      </form>

      <!-- Items -->
      <div class="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div class="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <h2 class="font-semibold">Line items</h2>
          <button
            type="button"
            onclick={() => (showAddItem = !showAddItem)}
            class="rounded bg-slate-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-slate-800"
            disabled={data.orderLineItems.length === 0}
          >
            {showAddItem ? 'Cancel' : 'Add item'}
          </button>
        </div>

        {#if showAddItem}
          <form
            method="POST"
            action="?/addItem"
            use:enhance={() => () => {
              showAddItem = false;
            }}
            class="grid gap-3 border-b border-slate-100 bg-slate-50 px-5 py-4 sm:grid-cols-6"
          >
            <label class="block sm:col-span-3">
              <span class="mb-1 block text-xs font-medium">Order line</span>
              <select
                name="order_line_item_id"
                required
                class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
              >
                <option value="">— Pick a line —</option>
                {#each data.orderLineItems as li}
                  <option value={li.id}>
                    {li.product_sku_snapshot} · {li.product_name_snapshot} · qty {li.quantity}
                  </option>
                {/each}
              </select>
            </label>
            <label class="block">
              <span class="mb-1 block text-xs font-medium">Quantity</span>
              <input
                type="number"
                step="1"
                min="1"
                name="quantity"
                value="1"
                required
                class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
              />
            </label>
            <label class="block">
              <span class="mb-1 block text-xs font-medium">Unit refund</span>
              <input
                type="number"
                step="0.01"
                min="0"
                name="unit_refund"
                value="0"
                required
                class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
              />
            </label>
            <label class="flex items-center gap-2 self-end pb-1">
              <input type="checkbox" name="restock" checked />
              <span class="text-xs font-medium">Restock</span>
            </label>
            <label class="block sm:col-span-6">
              <span class="mb-1 block text-xs font-medium">Reason</span>
              <input
                name="reason"
                class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
              />
            </label>
            <div class="sm:col-span-6 flex justify-end">
              <button
                type="submit"
                class="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
              >
                Add to RMA
              </button>
            </div>
          </form>
        {/if}

        {#if r.items.length === 0}
          <p class="px-5 py-8 text-center text-sm text-slate-500">No items on this RMA yet.</p>
        {:else}
          <table class="w-full text-sm">
            <thead class="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th class="px-5 py-2 text-left font-medium">Product</th>
                <th class="px-3 py-2 text-right font-medium">Qty</th>
                <th class="px-3 py-2 text-right font-medium">Unit refund</th>
                <th class="px-3 py-2 text-right font-medium">Subtotal</th>
                <th class="px-3 py-2 text-center font-medium">Restock</th>
                <th class="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              {#each r.items as it (it.id)}
                <tr>
                  <td class="px-5 py-2">
                    <span class="font-mono text-xs text-slate-500"
                      >{it.product?.sku ?? ''}</span
                    >
                    <span class="ml-1">{it.product?.name ?? '—'}</span>
                    {#if it.reason}
                      <p class="text-xs text-slate-500">{it.reason}</p>
                    {/if}
                  </td>
                  <td class="px-3 py-2 text-right tabular-nums">{it.quantity}</td>
                  <td class="px-3 py-2 text-right tabular-nums">{currency(it.unit_refund)}</td>
                  <td class="px-3 py-2 text-right tabular-nums font-medium">
                    {currency(Number(it.unit_refund) * it.quantity)}
                  </td>
                  <td class="px-3 py-2 text-center text-xs">
                    {it.restock ? 'Yes' : 'No'}
                  </td>
                  <td class="px-3 py-2 text-right">
                    <form method="POST" action="?/removeItem" use:enhance class="inline">
                      <input type="hidden" name="id" value={it.id} />
                      <button
                        type="submit"
                        class="rounded border border-red-300 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                        onclick={(e) => {
                          if (!confirm('Remove this item?')) e.preventDefault();
                        }}
                      >
                        Remove
                      </button>
                    </form>
                  </td>
                </tr>
              {/each}
            </tbody>
            <tfoot class="bg-slate-50 text-sm font-semibold">
              <tr>
                <td class="px-5 py-2" colspan="3">Items total</td>
                <td class="px-3 py-2 text-right">{currency(itemsRefundTotal)}</td>
                <td colspan="2"></td>
              </tr>
            </tfoot>
          </table>
        {/if}
      </div>
    </div>

    <aside class="space-y-4">
      <div class="rounded-lg border border-slate-200 bg-white p-4 shadow-sm text-sm">
        <h3 class="mb-2 font-semibold">Customer</h3>
        {#if r.customer}
          <a class="text-sky-700 hover:underline" href="/clients/{r.customer.id}">
            {r.customer.business_name}
          </a>
          {#if r.customer.email}
            <p class="text-slate-500">{r.customer.email}</p>
          {/if}
        {:else}
          <p class="text-slate-500">—</p>
        {/if}
      </div>

      <div class="rounded-lg border border-slate-200 bg-white p-4 shadow-sm text-sm">
        <h3 class="mb-2 font-semibold">Order</h3>
        {#if r.order}
          <a class="font-mono text-xs text-sky-700 hover:underline" href="/orders/{r.order.id}">
            {r.order.id.slice(0, 8)}
          </a>
          <p class="mt-1 text-slate-500">{dateTime(r.order.placed_at)}</p>
          <p class="text-slate-500">{currency(r.order.total)} · {r.order.status}</p>
        {:else}
          <p class="text-slate-500">—</p>
        {/if}
      </div>

      <div class="rounded-lg border border-slate-200 bg-white p-4 shadow-sm text-sm">
        <h3 class="mb-2 font-semibold">Totals</h3>
        <dl class="space-y-1">
          <div class="flex justify-between">
            <dt class="text-slate-500">Refund</dt>
            <dd class="font-medium">{currency(r.refund_amount)}</dd>
          </div>
          <div class="flex justify-between">
            <dt class="text-slate-500">Restocking fee</dt>
            <dd>{currency(r.restocking_fee)}</dd>
          </div>
          <div class="flex justify-between border-t border-slate-100 pt-1">
            <dt class="text-slate-500">Net</dt>
            <dd class="font-semibold">
              {currency(Number(r.refund_amount) - Number(r.restocking_fee))}
            </dd>
          </div>
        </dl>
      </div>
    </aside>
  </div>
</section>

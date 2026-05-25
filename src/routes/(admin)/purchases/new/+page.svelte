<script lang="ts">
  import { enhance } from '$app/forms';
  import { currency, dateShort } from '$lib/format';
  import Breadcrumbs from '$lib/components/Breadcrumbs.svelte';
  import Select from '$lib/components/Select.svelte';
  import LineItemProductSearch, {
    type LineProductHit
  } from '$lib/components/LineItemProductSearch.svelte';

  let { data, form } = $props();

  type DraftLine = {
    product_id: string | null;
    product_sku_snapshot: string | null;
    product_name_snapshot: string | null;
    description: string;
    quantity: number;
    unit_cost: number;
  };

  function emptyLine(): DraftLine {
    return {
      product_id: null,
      product_sku_snapshot: null,
      product_name_snapshot: null,
      description: '',
      quantity: 1,
      unit_cost: 0
    };
  }

  // svelte-ignore state_referenced_locally
  let supplierId = $state(data.suppliers[0]?.id ?? '');
  // svelte-ignore state_referenced_locally
  let orderId = $state(data.defaultOrderId);
  let orderQuery = $state('');
  let orderOpen = $state(false);
  let subtotal = $state(0);
  let freight = $state(0);
  let distributionFeePct = $state(0);
  let tax = $state(0);
  let lines = $state<DraftLine[]>([]);

  const linesSubtotal = $derived(
    lines.reduce(
      (sum, l) =>
        sum + Math.max(0, Number(l.quantity || 0)) * Math.max(0, Number(l.unit_cost || 0)),
      0
    )
  );
  const lineItemsJson = $derived(JSON.stringify(lines));

  $effect(() => {
    if (lines.length > 0) {
      subtotal = Math.round(linesSubtotal * 100) / 100;
    }
  });

  function addLine() {
    lines = [...lines, emptyLine()];
  }

  function removeLine(index: number) {
    lines = lines.filter((_, i) => i !== index);
  }

  function applyProductToLine(index: number, product: LineProductHit) {
    const current = lines[index];
    if (!current) return;
    const target: DraftLine = { ...current };
    target.product_id = product.id;
    target.product_sku_snapshot = product.sku;
    target.product_name_snapshot = product.name;
    if (!target.description.trim()) {
      const parts = [product.name];
      if (product.description) parts.push(product.description);
      target.description = parts.join(' — ');
    }
    const next = [...lines];
    next[index] = target;
    lines = next;
  }

  function clearProductFromLine(index: number) {
    const current = lines[index];
    if (!current) return;
    const next = [...lines];
    next[index] = {
      ...current,
      product_id: null,
      product_sku_snapshot: null,
      product_name_snapshot: null
    };
    lines = next;
  }

  function lineTotal(line: DraftLine) {
    return Math.max(0, Number(line.quantity || 0)) * Math.max(0, Number(line.unit_cost || 0));
  }

  $effect(() => {
    const s = data.suppliers.find((x) => x.id === supplierId);
    if (s) distributionFeePct = Number(s.distribution_fee_pct) * 100;
  });

  const linkedOrder = $derived(
    orderId ? (data.recentOrders.find((o) => o.id === orderId) ?? data.linkedOrder) : null
  );

  const distributionFee = $derived(
    Math.round((Number(subtotal) || 0) * (Number(distributionFeePct) / 100) * 100) / 100
  );
  const total = $derived(
    Math.round(
      ((Number(subtotal) || 0) + (Number(freight) || 0) + distributionFee + (Number(tax) || 0)) *
        100
    ) / 100
  );

  const projectedCogs = $derived(linkedOrder ? data.existingCogs + total : 0);
  const projectedMargin = $derived(
    linkedOrder && linkedOrder.total > 0
      ? (Number(linkedOrder.total) - projectedCogs) / Number(linkedOrder.total)
      : 0
  );

  function orderLabel(o: (typeof data.recentOrders)[number]) {
    const who = o.customer?.business_name ?? '—';
    return `${o.id.slice(0, 8)} · ${who} · ${dateShort(o.placed_at)} · ${currency(o.total)}`;
  }

  const filteredOrders = $derived.by(() => {
    const term = orderQuery.trim().toLowerCase();
    if (term === '') return data.recentOrders.slice(0, 50);
    return data.recentOrders.filter((o) => orderLabel(o).toLowerCase().includes(term)).slice(0, 50);
  });

  function selectOrder(id: string) {
    orderId = id;
    const o = data.recentOrders.find((x) => x.id === id);
    orderQuery = o ? orderLabel(o) : '';
    orderOpen = false;
  }

  function clearOrder() {
    orderId = '';
    orderQuery = '';
    orderOpen = false;
  }

  $effect(() => {
    if (orderId && orderQuery === '') {
      const o = data.recentOrders.find((x) => x.id === orderId);
      if (o) orderQuery = orderLabel(o);
    }
  });

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

  {#if form?.message}
    <div class="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">
      {form.message}
    </div>
  {/if}

  <div class="mx-auto max-w-5xl">
    <form method="POST" action="?/create" use:enhance class="grid gap-5 lg:grid-cols-3">
      <input type="hidden" name="line_items_json" value={lineItemsJson} />
      <div class="space-y-4 lg:col-span-2">
        <div class="rounded-lg border border-slate-200 bg-white p-4 shadow-sm space-y-3 text-sm">
          <label class="block">
            <span class="mb-1 block text-xs font-medium text-slate-600">Supplier</span>
            <Select name="supplier_id" bind:value={supplierId} required class="w-full">
              {#each data.suppliers as s (s.id)}
                <option value={s.id}>{s.name}</option>
              {/each}
            </Select>
          </label>

          <div class="block">
            <span class="mb-1 block text-xs font-medium text-slate-600"
              >For client order (optional)</span
            >
            <div class="relative">
              <input type="hidden" name="order_id" value={orderId} />
              <input
                type="text"
                role="combobox"
                aria-controls="order-list"
                aria-expanded={orderOpen}
                aria-autocomplete="list"
                autocomplete="off"
                placeholder="— not tied to a client order —"
                bind:value={orderQuery}
                oninput={() => {
                  orderId = '';
                  orderOpen = true;
                }}
                onfocus={() => (orderOpen = true)}
                onblur={() => setTimeout(() => (orderOpen = false), 150)}
                class="w-full rounded border border-slate-300 px-2 py-1.5 pr-8"
              />
              {#if orderQuery}
                <button
                  type="button"
                  aria-label="Clear"
                  onclick={clearOrder}
                  class="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                >
                  ×
                </button>
              {/if}
              {#if orderOpen && filteredOrders.length > 0}
                <ul
                  id="order-list"
                  class="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded border border-slate-200 bg-white shadow-lg"
                >
                  {#each filteredOrders as o (o.id)}
                    <li>
                      <button
                        type="button"
                        onmousedown={(e) => e.preventDefault()}
                        onclick={() => selectOrder(o.id)}
                        class="block w-full px-3 py-1.5 text-left text-sm hover:bg-slate-50"
                      >
                        {orderLabel(o)}
                      </button>
                    </li>
                  {/each}
                </ul>
              {/if}
            </div>
          </div>

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
            <span class="mb-1 block text-xs font-medium text-slate-600"
              >Supplier invoice / PO ref</span
            >
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

        <div class="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <header class="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <div>
              <h2 class="font-semibold">Line items</h2>
              <p class="text-xs text-slate-500">
                Optional. If you add lines, subtotal auto-fills from line totals.
              </p>
            </div>
            <button
              type="button"
              class="rounded border border-slate-300 px-3 py-1 text-sm hover:bg-slate-100"
              onclick={addLine}
            >
              Add line
            </button>
          </header>
          {#if lines.length === 0}
            <p class="px-4 py-6 text-center text-sm text-slate-500">
              No line items. Click "Add line" to log items in this purchase.
            </p>
          {:else}
            <div class="overflow-x-auto">
              <table class="w-full min-w-[760px] text-sm">
                <thead class="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                  <tr>
                    <th class="px-3 py-2 text-left font-medium">Item</th>
                    <th class="px-3 py-2 text-left font-medium">Description</th>
                    <th class="px-3 py-2 text-right font-medium">Qty</th>
                    <th class="px-3 py-2 text-right font-medium">Unit cost</th>
                    <th class="px-3 py-2 text-right font-medium">Total</th>
                    <th class="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100">
                  {#each lines as line, i}
                    <tr>
                      <td class="px-3 py-2 align-top">
                        <LineItemProductSearch
                          selectedSku={line.product_sku_snapshot}
                          onSelect={(product) => applyProductToLine(i, product)}
                          onClear={() => clearProductFromLine(i)}
                        />
                      </td>
                      <td class="px-3 py-2">
                        <input
                          bind:value={line.description}
                          class="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                        />
                      </td>
                      <td class="px-3 py-2">
                        <input
                          bind:value={line.quantity}
                          type="number"
                          min="0.01"
                          step="0.01"
                          class="w-20 rounded border border-slate-300 px-2 py-1 text-right text-sm"
                        />
                      </td>
                      <td class="px-3 py-2">
                        <input
                          bind:value={line.unit_cost}
                          type="number"
                          min="0"
                          step="0.01"
                          class="w-28 rounded border border-slate-300 px-2 py-1 text-right text-sm"
                        />
                      </td>
                      <td class="px-3 py-2 text-right font-medium">{currency(lineTotal(line))}</td>
                      <td class="px-3 py-2 text-right">
                        <button
                          type="button"
                          class="rounded border border-red-300 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                          onclick={() => removeLine(i)}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  {/each}
                </tbody>
                <tfoot>
                  <tr class="border-t border-slate-200 bg-slate-50 text-sm">
                    <td colspan="4" class="px-3 py-2 text-right font-medium text-slate-600">
                      Lines subtotal
                    </td>
                    <td class="px-3 py-2 text-right font-semibold">{currency(linesSubtotal)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          {/if}
        </div>

        <div class="rounded-lg border border-slate-200 bg-white p-4 shadow-sm space-y-3 text-sm">
          <h2 class="font-semibold">Costs</h2>
          <div class="grid gap-3 sm:grid-cols-2">
            <label class="block">
              <span class="mb-1 block text-xs font-medium text-slate-600">Subtotal</span>
              <input
                type="number"
                step="1"
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
                step="1"
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
              <span class="text-xs text-slate-500"
                >Auto-fills from supplier; override if needed.</span
              >
            </label>
            <label class="block">
              <span class="mb-1 block text-xs font-medium text-slate-600">Tax</span>
              <input
                type="number"
                step="1"
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
              <Select name="status" class="w-full">
                <option value="draft">draft</option>
                <option value="ordered" selected>ordered</option>
                <option value="received">received</option>
                <option value="cancelled">cancelled</option>
              </Select>
            </label>
            <label class="block">
              <span class="mb-1 block text-xs font-medium text-slate-600">Payment status</span>
              <Select name="payment_status" class="w-full">
                <option value="unpaid" selected>unpaid</option>
                <option value="partial">partial</option>
                <option value="paid">paid</option>
              </Select>
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
      </aside>

      <div class="flex gap-2 lg:col-span-2">
        <a
          href="/purchases"
          class="flex-1 rounded border border-slate-300 px-3 py-2 text-center text-sm text-slate-700 hover:bg-slate-100"
        >
          Cancel
        </a>
        <button
          type="submit"
          class="flex-1 rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          Create purchase
        </button>
      </div>
    </form>
  </div>
</section>

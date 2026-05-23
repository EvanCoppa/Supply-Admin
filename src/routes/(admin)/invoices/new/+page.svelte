<script lang="ts">
  import { enhance } from '$app/forms';
  import { currency } from '$lib/format';
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
    unit_price: number;
    discount: number;
    tax: number;
  };

  const todayPlus30 = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  function emptyLine(): DraftLine {
    return {
      product_id: null,
      product_sku_snapshot: null,
      product_name_snapshot: null,
      description: '',
      quantity: 1,
      unit_price: 0,
      discount: 0,
      tax: 0
    };
  }

  let customerId = $state('');
  let billingEmail = $state('');
  let dueAt = $state(todayPlus30);
  let shipping = $state(0);
  let invoiceDiscount = $state(0);
  let lines = $state<DraftLine[]>([emptyLine()]);
  let initialized = $state(false);

  $effect(() => {
    if (!initialized) {
      customerId = data.defaultCustomerId;
      initialized = true;
    }
  });

  const selectedCustomer = $derived(data.customers.find((c) => c.id === customerId));
  const lineItemsJson = $derived(JSON.stringify(lines));
  const subtotal = $derived(
    lines.reduce((sum, line) => sum + Number(line.quantity || 0) * Number(line.unit_price || 0), 0)
  );
  const lineDiscount = $derived(lines.reduce((sum, line) => sum + Number(line.discount || 0), 0));
  const tax = $derived(lines.reduce((sum, line) => sum + Number(line.tax || 0), 0));
  const total = $derived(
    Math.max(
      0,
      subtotal - lineDiscount - Number(invoiceDiscount || 0) + tax + Number(shipping || 0)
    )
  );

  function addLine() {
    lines = [...lines, emptyLine()];
  }

  function removeLine(index: number) {
    lines = lines.filter((_, i) => i !== index);
  }

  function applyProductToLine(index: number, product: LineProductHit) {
    const next = [...lines];
    const target = { ...next[index] };
    target.product_id = product.id;
    target.product_sku_snapshot = product.sku;
    target.product_name_snapshot = product.name;
    if (!target.description.trim()) {
      const parts = [product.name];
      if (product.description) parts.push(product.description);
      target.description = parts.join(' — ');
    }
    target.unit_price = Number(product.base_price ?? 0);
    next[index] = target;
    lines = next;
  }

  function clearProductFromLine(index: number) {
    const next = [...lines];
    next[index] = { ...next[index], product_id: null, product_sku_snapshot: null, product_name_snapshot: null };
    lines = next;
  }

  function maybeUseCustomerEmail() {
    if (!billingEmail && selectedCustomer?.email) billingEmail = selectedCustomer.email;
  }

  function lineTotal(line: DraftLine) {
    return Math.max(
      0,
      Number(line.quantity || 0) * Number(line.unit_price || 0) -
        Number(line.discount || 0) +
        Number(line.tax || 0)
    );
  }
</script>

<svelte:head><title>New Invoice · Supply Admin</title></svelte:head>

<section class="space-y-5">
  <header class="flex items-end justify-between gap-4">
    <div>
      <h1 class="text-2xl font-semibold">New invoice</h1>
      <p class="text-sm text-slate-500">Create a standalone invoice with custom line items.</p>
    </div>
    <a
      class="rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100"
      href="/invoices"
    >
      Back to invoices
    </a>
  </header>

  {#if form?.message}
    <div class="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">
      {form.message}
    </div>
  {/if}

  <form method="POST" action="?/create" use:enhance class="space-y-5">
    <input type="hidden" name="line_items_json" value={lineItemsJson} />

    <section
      class="grid gap-3 rounded-lg border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-4"
    >
      <label class="block md:col-span-2">
        <span class="mb-1 block text-xs font-medium">Customer</span>
        <select
          name="customer_id"
          required
          bind:value={customerId}
          onchange={maybeUseCustomerEmail}
          class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
        >
          <option value="">Pick a customer</option>
          {#each data.customers as customer}
            <option value={customer.id}>{customer.business_name}</option>
          {/each}
        </select>
      </label>
      <label class="block">
        <span class="mb-1 block text-xs font-medium">Terms</span>
        <select name="terms" class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm">
          <option value="due_on_receipt">Due on receipt</option>
          <option value="net_15">Net 15</option>
          <option value="net_30" selected>Net 30</option>
          <option value="net_60">Net 60</option>
          <option value="prepaid">Prepaid</option>
        </select>
      </label>
      <label class="block">
        <span class="mb-1 block text-xs font-medium">Due date</span>
        <input
          name="due_at"
          type="date"
          bind:value={dueAt}
          class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
        />
      </label>
      <label class="block md:col-span-2">
        <span class="mb-1 block text-xs font-medium">Billing email</span>
        <input
          name="billing_email"
          type="email"
          bind:value={billingEmail}
          placeholder={selectedCustomer?.email ?? ''}
          class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
        />
      </label>
      <label class="block">
        <span class="mb-1 block text-xs font-medium">Shipping</span>
        <input
          name="shipping"
          type="number"
          min="0"
          step="0.01"
          bind:value={shipping}
          class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
        />
      </label>
      <label class="block">
        <span class="mb-1 block text-xs font-medium">Invoice discount</span>
        <input
          name="discount"
          type="number"
          min="0"
          step="0.01"
          bind:value={invoiceDiscount}
          class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
        />
      </label>
    </section>

    <section class="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <header class="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <h2 class="font-semibold">Line items</h2>
        <button
          type="button"
          class="rounded border border-slate-300 px-3 py-1 text-sm hover:bg-slate-100"
          onclick={addLine}
        >
          Add line
        </button>
      </header>
      <div class="overflow-x-auto">
        <table class="w-full min-w-[1000px] text-sm">
          <thead class="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th class="px-3 py-2 text-left font-medium">Item</th>
              <th class="px-3 py-2 text-left font-medium">Description</th>
              <th class="px-3 py-2 text-right font-medium">Qty</th>
              <th class="px-3 py-2 text-right font-medium">Unit price</th>
              <th class="px-3 py-2 text-right font-medium">Discount</th>
              <th class="px-3 py-2 text-right font-medium">Tax</th>
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
                    required
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
                    bind:value={line.unit_price}
                    type="number"
                    min="0"
                    step="0.01"
                    class="w-28 rounded border border-slate-300 px-2 py-1 text-right text-sm"
                  />
                </td>
                <td class="px-3 py-2">
                  <input
                    bind:value={line.discount}
                    type="number"
                    min="0"
                    step="0.01"
                    class="w-24 rounded border border-slate-300 px-2 py-1 text-right text-sm"
                  />
                </td>
                <td class="px-3 py-2">
                  <input
                    bind:value={line.tax}
                    type="number"
                    min="0"
                    step="0.01"
                    class="w-24 rounded border border-slate-300 px-2 py-1 text-right text-sm"
                  />
                </td>
                <td class="px-3 py-2 text-right font-medium">{currency(lineTotal(line))}</td>
                <td class="px-3 py-2 text-right">
                  {#if lines.length > 1}
                    <button
                      type="button"
                      class="rounded border border-red-300 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                      onclick={() => removeLine(i)}
                    >
                      Remove
                    </button>
                  {/if}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </section>

    <section class="grid gap-4 md:grid-cols-[1fr_320px]">
      <div class="space-y-3 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <label class="block">
          <span class="mb-1 block text-xs font-medium">Customer memo</span>
          <textarea
            name="customer_memo"
            rows="3"
            class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
          ></textarea>
        </label>
        <label class="block">
          <span class="mb-1 block text-xs font-medium">Internal notes</span>
          <textarea
            name="internal_notes"
            rows="3"
            class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
          ></textarea>
        </label>
      </div>

      <div class="rounded-lg border border-slate-200 bg-white p-5 text-sm shadow-sm">
        <dl class="space-y-2">
          <div class="flex justify-between">
            <dt>Subtotal</dt>
            <dd>{currency(subtotal)}</dd>
          </div>
          <div class="flex justify-between">
            <dt>Discount</dt>
            <dd>{currency(lineDiscount + Number(invoiceDiscount || 0))}</dd>
          </div>
          <div class="flex justify-between">
            <dt>Tax</dt>
            <dd>{currency(tax)}</dd>
          </div>
          <div class="flex justify-between">
            <dt>Shipping</dt>
            <dd>{currency(shipping)}</dd>
          </div>
          <div class="flex justify-between border-t border-slate-200 pt-2 text-base font-semibold">
            <dt>Total</dt>
            <dd>{currency(total)}</dd>
          </div>
        </dl>
        <label class="mt-4 flex items-center gap-2 text-sm">
          <input type="checkbox" name="issue_now" checked class="rounded border-slate-300" />
          Issue invoice now
        </label>
        <button
          type="submit"
          class="mt-4 w-full rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          Create invoice
        </button>
      </div>
    </section>
  </form>
</section>

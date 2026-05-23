<script lang="ts">
  import { enhance } from '$app/forms';
  import { currency, dateShort } from '$lib/format';
  import LineItemProductSearch, {
    type LineProductHit
  } from '$lib/components/LineItemProductSearch.svelte';

  let { data, form } = $props();

  type DraftLine = {
    order_line_item_id: string | null;
    product_id: string | null;
    product_sku_snapshot: string | null;
    product_name_snapshot: string | null;
    description: string;
    quantity: number;
    unit_price: number;
    discount: number;
    tax: number;
  };

  let lines = $state<DraftLine[]>([]);
  let shipping = $state(0);
  let invoiceDiscount = $state(0);
  let loadedInvoiceId = $state('');

  $effect(() => {
    if (loadedInvoiceId !== data.invoice.id) {
      lines = data.lines.length
        ? data.lines.map((line) => ({
            order_line_item_id: line.order_line_item_id,
            product_id: line.product_id,
            product_sku_snapshot: line.product_sku_snapshot,
            product_name_snapshot: line.product_name_snapshot,
            description: line.description,
            quantity: Number(line.quantity),
            unit_price: Number(line.unit_price),
            discount: Number(line.discount),
            tax: Number(line.tax)
          }))
        : [
            {
              order_line_item_id: null,
              product_id: null,
              product_sku_snapshot: null,
              product_name_snapshot: null,
              description: '',
              quantity: 1,
              unit_price: 0,
              discount: 0,
              tax: 0
            }
          ];
      shipping = Number(data.invoice.shipping ?? 0);
      invoiceDiscount = Number(data.invoice.discount ?? 0);
      loadedInvoiceId = data.invoice.id;
    }
  });

  const editable = $derived(data.invoice.status === 'draft');
  const lineItemsJson = $derived(JSON.stringify(lines));
  const subtotal = $derived(
    lines.reduce((sum, line) => sum + Number(line.quantity || 0) * Number(line.unit_price || 0), 0)
  );
  const lineDiscount = $derived(lines.reduce((sum, line) => sum + Number(line.discount || 0), 0));
  const tax = $derived(lines.reduce((sum, line) => sum + Number(line.tax || 0), 0));
  const total = $derived(Math.max(0, subtotal - lineDiscount - Number(invoiceDiscount || 0) + tax + Number(shipping || 0)));
  const balance = $derived(Math.max(0, Number(data.invoice.total) - Number(data.invoice.amount_paid)));

  const statusClass: Record<string, string> = {
    draft: 'bg-slate-100 text-slate-600',
    issued: 'bg-sky-50 text-sky-700',
    paid: 'bg-emerald-50 text-emerald-700',
    partially_paid: 'bg-amber-50 text-amber-700',
    overdue: 'bg-red-50 text-red-700',
    void: 'bg-slate-200 text-slate-700',
    refunded: 'bg-indigo-50 text-indigo-700'
  };

  function addLine() {
    lines = [...lines, { order_line_item_id: null, product_id: null, product_sku_snapshot: null, product_name_snapshot: null, description: '', quantity: 1, unit_price: 0, discount: 0, tax: 0 }];
  }

  function removeLine(index: number) {
    lines = lines.filter((_, i) => i !== index);
  }

  function lineTotal(line: DraftLine) {
    return Math.max(
      0,
      Number(line.quantity || 0) * Number(line.unit_price || 0) -
        Number(line.discount || 0) +
        Number(line.tax || 0)
    );
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
    next[index] = {
      ...next[index],
      product_id: null,
      product_sku_snapshot: null,
      product_name_snapshot: null
    };
    lines = next;
  }
</script>

<svelte:head><title>{data.invoice.invoice_number} · Supply Admin</title></svelte:head>

<section class="space-y-5">
  <header class="flex flex-wrap items-start justify-between gap-4">
    <div>
      <a class="text-sm text-sky-700 hover:underline" href="/invoices">Invoices</a>
      <div class="mt-1 flex flex-wrap items-center gap-3">
        <h1 class="text-2xl font-semibold">{data.invoice.invoice_number}</h1>
        <span class="rounded px-2 py-0.5 text-xs {statusClass[data.invoice.status] ?? ''}">
          {data.invoice.status.replace('_', ' ')}
        </span>
      </div>
      <p class="mt-1 text-sm text-slate-500">
        <a class="text-sky-700 hover:underline" href="/clients/{data.invoice.customer_id}">
          {data.invoice.customer?.business_name ?? 'Customer'}
        </a>
        · Issued {dateShort(data.invoice.issued_at)} · Due {dateShort(data.invoice.due_at)}
      </p>
    </div>
    <div class="flex flex-wrap gap-2">
      <a
        class="rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100"
        href="/invoices/{data.invoice.id}/print"
        target="_blank"
        rel="noopener"
      >
        Preview / Print
      </a>
      {#if editable}
        <form method="POST" action="?/issue" use:enhance>
          <button class="rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100">Issue</button>
        </form>
      {/if}
      <form method="POST" action="?/createPaymentIntent" use:enhance>
        <button class="rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100" disabled={balance <= 0}>
          Prepare payment link
        </button>
      </form>
    </div>
  </header>

  {#if form?.message}
    <div
      class="rounded border px-3 py-2 text-sm"
      class:border-emerald-300={form.saved}
      class:bg-emerald-50={form.saved}
      class:text-emerald-900={form.saved}
      class:border-red-300={!form.saved}
      class:bg-red-50={!form.saved}
      class:text-red-900={!form.saved}
    >
      {form.message}
    </div>
  {/if}

  <div class="grid gap-5 xl:grid-cols-[1fr_360px]">
    <div class="space-y-5">
      <form method="POST" action="?/saveDraft" use:enhance class="space-y-5">
        <input type="hidden" name="line_items_json" value={lineItemsJson} />

        <section class="grid gap-3 rounded-lg border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-4">
          <label class="block">
            <span class="mb-1 block text-xs font-medium">Terms</span>
            <select name="terms" disabled={!editable} class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm">
              {#each ['due_on_receipt', 'net_15', 'net_30', 'net_60', 'prepaid'] as term}
                <option value={term} selected={data.invoice.terms === term}>{term.replaceAll('_', ' ')}</option>
              {/each}
            </select>
          </label>
          <label class="block">
            <span class="mb-1 block text-xs font-medium">Due date</span>
            <input
              name="due_at"
              type="date"
              value={data.invoice.due_at?.slice(0, 10) ?? ''}
              disabled={!editable}
              class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
            />
          </label>
          <label class="block md:col-span-2">
            <span class="mb-1 block text-xs font-medium">Billing email</span>
            <input
              name="billing_email"
              type="email"
              value={data.invoice.billing_email ?? data.invoice.customer?.email ?? ''}
              disabled={!editable}
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
              disabled={!editable}
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
              disabled={!editable}
              class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
            />
          </label>
        </section>

        <section class="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <header class="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <h2 class="font-semibold">Line items</h2>
            {#if editable}
              <button type="button" class="rounded border border-slate-300 px-3 py-1 text-sm hover:bg-slate-100" onclick={addLine}>
                Add line
              </button>
            {/if}
          </header>
          <div class="overflow-x-auto">
            <table class="w-full min-w-[1000px] text-sm">
              <thead class="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  {#if editable}
                    <th class="px-3 py-2 text-left font-medium">Item</th>
                  {/if}
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
                    {#if editable}
                      <td class="px-3 py-2 align-top">
                        <LineItemProductSearch
                          selectedSku={line.product_sku_snapshot}
                          onSelect={(product) => applyProductToLine(i, product)}
                          onClear={() => clearProductFromLine(i)}
                        />
                      </td>
                    {/if}
                    <td class="px-3 py-2">
                      {#if editable}
                        <input bind:value={line.description} required class="w-full rounded border border-slate-300 px-2 py-1 text-sm" />
                      {:else}
                        <div class="font-medium text-slate-900">{line.description}</div>
                        {#if line.product_sku_snapshot}
                          <div class="font-mono text-xs text-slate-500">{line.product_sku_snapshot}</div>
                        {/if}
                      {/if}
                    </td>
                    <td class="px-3 py-2 text-right">
                      {#if editable}
                        <input bind:value={line.quantity} type="number" min="0.01" step="0.01" class="w-20 rounded border border-slate-300 px-2 py-1 text-right text-sm" />
                      {:else}
                        {line.quantity}
                      {/if}
                    </td>
                    <td class="px-3 py-2 text-right">
                      {#if editable}
                        <input bind:value={line.unit_price} type="number" min="0" step="0.01" class="w-28 rounded border border-slate-300 px-2 py-1 text-right text-sm" />
                      {:else}
                        {currency(line.unit_price)}
                      {/if}
                    </td>
                    <td class="px-3 py-2 text-right">
                      {#if editable}
                        <input bind:value={line.discount} type="number" min="0" step="0.01" class="w-24 rounded border border-slate-300 px-2 py-1 text-right text-sm" />
                      {:else}
                        {currency(line.discount)}
                      {/if}
                    </td>
                    <td class="px-3 py-2 text-right">
                      {#if editable}
                        <input bind:value={line.tax} type="number" min="0" step="0.01" class="w-24 rounded border border-slate-300 px-2 py-1 text-right text-sm" />
                      {:else}
                        {currency(line.tax)}
                      {/if}
                    </td>
                    <td class="px-3 py-2 text-right font-medium">{currency(lineTotal(line))}</td>
                    <td class="px-3 py-2 text-right">
                      {#if editable && lines.length > 1}
                        <button type="button" class="rounded border border-red-300 px-2 py-1 text-xs text-red-700 hover:bg-red-50" onclick={() => removeLine(i)}>
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

        <section class="grid gap-4 lg:grid-cols-[1fr_280px]">
          <div class="space-y-3 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <label class="block">
              <span class="mb-1 block text-xs font-medium">Customer memo</span>
              <textarea name="customer_memo" rows="3" disabled={!editable} class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm">{data.invoice.customer_memo ?? ''}</textarea>
            </label>
            <label class="block">
              <span class="mb-1 block text-xs font-medium">Internal notes</span>
              <textarea name="internal_notes" rows="3" disabled={!editable} class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm">{data.invoice.internal_notes ?? ''}</textarea>
            </label>
            {#if editable}
              <button class="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800">Save draft</button>
            {/if}
          </div>

          <div class="rounded-lg border border-slate-200 bg-white p-5 text-sm shadow-sm">
            <dl class="space-y-2">
              <div class="flex justify-between"><dt>Subtotal</dt><dd>{currency(editable ? subtotal : data.invoice.subtotal)}</dd></div>
              <div class="flex justify-between"><dt>Discount</dt><dd>{currency(editable ? lineDiscount + Number(invoiceDiscount || 0) : data.invoice.discount)}</dd></div>
              <div class="flex justify-between"><dt>Tax</dt><dd>{currency(editable ? tax : data.invoice.tax)}</dd></div>
              <div class="flex justify-between"><dt>Shipping</dt><dd>{currency(editable ? shipping : data.invoice.shipping)}</dd></div>
              <div class="flex justify-between border-t border-slate-200 pt-2 text-base font-semibold">
                <dt>Total</dt><dd>{currency(editable ? total : data.invoice.total)}</dd>
              </div>
              <div class="flex justify-between"><dt>Paid</dt><dd>{currency(data.invoice.amount_paid)}</dd></div>
              <div class="flex justify-between font-semibold" class:text-red-700={balance > 0}>
                <dt>Balance</dt><dd>{currency(balance)}</dd>
              </div>
            </dl>
          </div>
        </section>
      </form>
    </div>

    <aside class="space-y-5">
      <section class="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 class="font-semibold">Send invoice</h2>
        <form method="POST" action="?/sendEmail" use:enhance class="mt-3 space-y-3">
          <label class="block">
            <span class="mb-1 block text-xs font-medium">Recipient</span>
            <input
              name="recipient"
              type="email"
              value={data.invoice.billing_email ?? data.invoice.customer?.email ?? ''}
              class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
            />
          </label>
          <label class="flex items-center gap-2 text-sm">
            <input type="checkbox" name="reminder" class="rounded border-slate-300" />
            Send as reminder
          </label>
          <button class="w-full rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800">
            Send email
          </button>
        </form>
      </section>

      <section class="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 class="font-semibold">Status</h2>
        <form method="POST" action="?/setStatus" use:enhance class="mt-3 flex gap-2">
          <select name="status" class="min-w-0 flex-1 rounded border border-slate-300 px-2 py-1.5 text-sm">
            {#each ['draft', 'issued', 'paid', 'partially_paid', 'overdue', 'void', 'refunded'] as s}
              <option value={s} selected={data.invoice.status === s}>{s.replace('_', ' ')}</option>
            {/each}
          </select>
          <button class="rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100">Save</button>
        </form>
        {#if balance > 0}
          <form method="POST" action="?/recordPayment" use:enhance class="mt-3 flex gap-2">
            <input
              name="amount"
              type="number"
              min="0.01"
              max={balance}
              step="0.01"
              placeholder="Amount"
              class="min-w-0 flex-1 rounded border border-slate-300 px-2 py-1.5 text-sm"
            />
            <button class="rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100">Record</button>
          </form>
        {/if}
      </section>

      <section class="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 class="font-semibold">Payment</h2>
        <dl class="mt-3 space-y-2 text-sm">
          <div class="flex justify-between"><dt>Status</dt><dd>{data.invoice.payment_status?.replace('_', ' ') ?? 'not started'}</dd></div>
          <div class="flex justify-between"><dt>Link</dt><dd>{data.invoice.payment_url ? 'Prepared' : 'Not prepared'}</dd></div>
        </dl>
        {#if data.paymentIntents.length}
          <div class="mt-3 divide-y divide-slate-100 text-sm">
            {#each data.paymentIntents as intent}
              <div class="py-2">
                <div class="flex justify-between gap-2">
                  <span>{currency(intent.amount)}</span>
                  <span class="text-slate-500">{intent.status}</span>
                </div>
                <p class="font-mono text-xs text-slate-400">{intent.provider_reference}</p>
              </div>
            {/each}
          </div>
        {/if}
      </section>

      <section class="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 class="font-semibold">Email history</h2>
        {#if data.emailEvents.length === 0}
          <p class="mt-3 text-sm text-slate-500">No invoice emails sent yet.</p>
        {:else}
          <div class="mt-3 divide-y divide-slate-100 text-sm">
            {#each data.emailEvents as event}
              <div class="py-2">
                <div class="flex justify-between gap-2">
                  <span>{event.type}</span>
                  <span class="text-slate-500">{event.status}</span>
                </div>
                <p class="truncate text-xs text-slate-500">{event.recipient}</p>
                <p class="text-xs text-slate-400">{dateShort(event.created_at)}</p>
              </div>
            {/each}
          </div>
        {/if}
      </section>
    </aside>
  </div>
</section>

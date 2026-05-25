<script lang="ts">
  import { enhance } from '$app/forms';
  import { currency } from '$lib/format';
  import Breadcrumbs from '$lib/components/Breadcrumbs.svelte';
  import Select from '$lib/components/Select.svelte';
  import LineItemProductSearch, {
    type LineProductHit
  } from '$lib/components/LineItemProductSearch.svelte';

  let { data, form } = $props();

  type DraftLine = {
    product_id: string | null;
    product_sku_snapshot: string | null;
    product_name_snapshot: string;
    quantity: number;
    unit_price: number;
  };

  function emptyLine(): DraftLine {
    return {
      product_id: null,
      product_sku_snapshot: null,
      product_name_snapshot: '',
      quantity: 1,
      unit_price: 0
    };
  }

  // svelte-ignore state_referenced_locally
  let customerId = $state(data.defaultCustomerId);
  let shippingAddressId = $state('');
  let status = $state('pending_payment');
  let paymentMethod = $state('');
  let shipping = $state(0);
  let notes = $state('');
  let lines = $state<DraftLine[]>([emptyLine()]);

  const customerAddresses = $derived(data.addressesByCustomer[customerId] ?? []);

  $effect(() => {
    if (customerAddresses.length === 0) {
      shippingAddressId = '';
      return;
    }
    const stillThere = customerAddresses.some((a) => a.id === shippingAddressId);
    if (!stillThere) {
      const def = customerAddresses.find((a) => a.is_default_shipping);
      shippingAddressId = def?.id ?? customerAddresses[0]?.id ?? '';
    }
  });

  const lineItemsJson = $derived(JSON.stringify(lines));
  const subtotal = $derived(
    lines.reduce(
      (sum, l) =>
        sum + Math.max(0, Number(l.quantity || 0)) * Math.max(0, Number(l.unit_price || 0)),
      0
    )
  );
  const total = $derived(Math.round((subtotal + Math.max(0, Number(shipping || 0))) * 100) / 100);

  function addLine() {
    lines = [...lines, emptyLine()];
  }

  function removeLine(index: number) {
    lines = lines.filter((_, i) => i !== index);
  }

  function addLineFromProduct(product: LineProductHit) {
    const newLine: DraftLine = {
      product_id: product.id,
      product_sku_snapshot: product.sku,
      product_name_snapshot: product.name,
      quantity: 1,
      unit_price: Number(product.base_price ?? 0)
    };
    const last = lines[lines.length - 1];
    const lastIsEmpty = last && !last.product_id && !last.product_name_snapshot.trim();
    lines = lastIsEmpty ? [...lines.slice(0, -1), newLine] : [...lines, newLine];
  }

  function lineTotal(line: DraftLine) {
    return Math.max(0, Number(line.quantity || 0)) * Math.max(0, Number(line.unit_price || 0));
  }

  function addressLabel(a: (typeof customerAddresses)[number]) {
    const head = a.label ? `${a.label} · ` : '';
    return `${head}${a.line1}, ${a.city} ${a.region}`;
  }
</script>

<svelte:head><title>New order · Supply Admin</title></svelte:head>

<section class="space-y-5">
  <Breadcrumbs items={[{ label: 'Orders', href: '/orders' }, { label: 'New' }]} />

  {#if form?.message}
    <div class="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">
      {form.message}
    </div>
  {/if}

  <div class="mx-auto max-w-5xl">
    <form method="POST" action="?/create" use:enhance class="space-y-5">
      <input type="hidden" name="line_items_json" value={lineItemsJson} />

      <div class="space-y-4">
        <div class="space-y-3 rounded-lg border border-slate-200 bg-white p-4 text-sm shadow-sm">
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
            <span class="mb-1 block text-xs font-medium text-slate-600">Shipping address</span>
            {#if !customerId}
              <p
                class="rounded border border-dashed border-slate-300 px-3 py-2 text-xs text-slate-500"
              >
                Pick a customer to see saved addresses.
              </p>
            {:else if customerAddresses.length === 0}
              <p
                class="rounded border border-dashed border-slate-300 px-3 py-2 text-xs text-slate-500"
              >
                No saved addresses for this customer. Order will be created without one — tax will
                not be calculated.
                <a class="text-sky-700 hover:underline" href={`/clients/${customerId}/addresses`}>
                  Add address
                </a>
              </p>
            {:else}
              <Select name="shipping_address_id" bind:value={shippingAddressId} class="w-full">
                <option value="">— No shipping address (no tax) —</option>
                {#each customerAddresses as a (a.id)}
                  <option value={a.id}>
                    {addressLabel(a)}{a.is_default_shipping ? ' (default)' : ''}
                  </option>
                {/each}
              </Select>
            {/if}
          </div>
        </div>

        <div class="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <header class="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <div>
              <h2 class="font-semibold">Line items</h2>
              <p class="text-xs text-slate-500">
                Search a SKU to autofill price, or type a custom item name.
              </p>
            </div>
            <div class="flex items-center gap-2">
              <LineItemProductSearch onSelect={addLineFromProduct} />
              <button
                type="button"
                class="rounded border border-slate-300 px-3 py-1 text-sm hover:bg-slate-100"
                onclick={addLine}
              >
                Add line
              </button>
            </div>
          </header>
          {#if lines.length === 0}
            <p class="px-4 py-6 text-center text-sm text-slate-500">
              No line items. Click "Add line" to add one.
            </p>
          {:else}
            <div class="overflow-x-auto">
              <table class="w-full min-w-[600px] text-sm">
                <thead class="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                  <tr>
                    <th class="px-3 py-2 text-left font-medium">Name</th>
                    <th class="px-3 py-2 text-right font-medium">Qty</th>
                    <th class="px-3 py-2 text-right font-medium">Unit price</th>
                    <th class="px-3 py-2 text-right font-medium">Total</th>
                    <th class="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100">
                  {#each lines as line, i (i)}
                    <tr>
                      <td class="px-3 py-2">
                        <input
                          bind:value={line.product_name_snapshot}
                          required
                          class="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                        />
                        {#if line.product_sku_snapshot}
                          <p class="mt-0.5 font-mono text-[10px] text-slate-500">
                            {line.product_sku_snapshot}
                          </p>
                        {/if}
                      </td>
                      <td class="px-3 py-2 text-right">
                        <input
                          bind:value={line.quantity}
                          type="number"
                          min="0.01"
                          step="0.01"
                          class="w-20 rounded border border-slate-300 px-2 py-1 text-right text-sm"
                        />
                      </td>
                      <td class="px-3 py-2 text-right">
                        <input
                          bind:value={line.unit_price}
                          type="number"
                          min="0"
                          step="0.01"
                          class="w-28 rounded border border-slate-300 px-2 py-1 text-right text-sm"
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
                <tfoot>
                  <tr class="border-t border-slate-200 bg-slate-50 text-sm">
                    <td colspan="3" class="px-3 py-2 text-right font-medium text-slate-600">
                      Subtotal
                    </td>
                    <td class="px-3 py-2 text-right font-semibold">{currency(subtotal)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          {/if}
        </div>

        <div class="space-y-3 rounded-lg border border-slate-200 bg-white p-4 text-sm shadow-sm">
          <h2 class="font-semibold">Status &amp; payment</h2>
          <div class="grid gap-3 sm:grid-cols-3">
            <label class="block">
              <span class="mb-1 block text-xs font-medium text-slate-600">Status</span>
              <Select name="status" bind:value={status} class="w-full">
                <option value="pending_payment">pending payment</option>
                <option value="paid">paid</option>
                <option value="fulfilled">fulfilled</option>
                <option value="shipped">shipped</option>
                <option value="delivered">delivered</option>
                <option value="cancelled">cancelled</option>
              </Select>
            </label>
            <label class="block">
              <span class="mb-1 block text-xs font-medium text-slate-600">Payment method</span>
              <Select name="payment_method" bind:value={paymentMethod} class="w-full">
                <option value="">—</option>
                <option value="credit_card">Credit card</option>
                <option value="debit_card">Debit card</option>
                <option value="check">Check</option>
                <option value="ach">ACH</option>
                <option value="wire_transfer">Wire transfer</option>
                <option value="cash">Cash</option>
                <option value="other">Other</option>
              </Select>
            </label>
            <label class="block">
              <span class="mb-1 block text-xs font-medium text-slate-600">Shipping cost</span>
              <input
                type="number"
                step="0.01"
                min="0"
                name="shipping"
                bind:value={shipping}
                class="w-full rounded border border-slate-300 px-2 py-1.5"
              />
            </label>
          </div>

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
      </div>

      <div class="rounded-lg border border-slate-200 bg-white p-4 text-sm shadow-sm">
        <h3 class="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
          Order total
        </h3>
        <dl class="space-y-1">
          <div class="flex justify-between">
            <dt class="text-slate-600">Subtotal</dt>
            <dd>{currency(subtotal)}</dd>
          </div>
          <div class="flex justify-between">
            <dt class="text-slate-600">Shipping</dt>
            <dd>{currency(Math.max(0, Number(shipping || 0)))}</dd>
          </div>
          <div class="flex justify-between text-slate-500">
            <dt>Tax</dt>
            <dd>calc. on submit</dd>
          </div>
          <div class="flex justify-between border-t border-slate-200 pt-1 font-semibold">
            <dt>Total (pre-tax)</dt>
            <dd>{currency(total)}</dd>
          </div>
        </dl>
        <p class="mt-3 rounded bg-slate-50 px-2 py-1 text-xs text-slate-600">
          Tax is calculated from the shipping address state &amp; county when the order is created.
        </p>
      </div>

      <div class="flex gap-2">
        <a
          href="/orders"
          class="flex-1 rounded border border-slate-300 px-3 py-2 text-center text-sm text-slate-700 hover:bg-slate-100"
        >
          Cancel
        </a>
        <button
          type="submit"
          class="flex-1 rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          Create order
        </button>
      </div>
    </form>
  </div>
</section>

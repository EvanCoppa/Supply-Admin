<script lang="ts">
  import { dateShort } from '$lib/format';
  import { addressLines } from '$lib/address';

  let { data } = $props();

  const order = $derived(data.order);
  const shipTo = $derived(
    addressLines(order.shipping_address_snapshot as Record<string, unknown> | null)
  );
  const totalUnits = $derived(data.lineItems.reduce((sum, li) => sum + Number(li.quantity), 0));

  function printNow() {
    window.print();
  }
</script>

<svelte:head>
  <title>Packing Slip {order.id.slice(0, 8)} · Evolution Supply</title>
</svelte:head>

<div class="slip-wrap mx-auto max-w-[850px] bg-white p-10 text-slate-900 print:p-0">
  <div class="no-print mb-4 flex items-center justify-between gap-3">
    <a href="/orders/{order.id}" class="text-sm text-sky-700 hover:underline">← Back to order</a>
    <button
      type="button"
      onclick={printNow}
      class="rounded bg-slate-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
    >
      Print / Save as PDF
    </button>
  </div>

  <article class="slip-doc border border-slate-200 p-10 shadow-sm print:border-0 print:shadow-none">
    <header class="flex items-start justify-between gap-6 border-b border-slate-200 pb-6">
      <div class="flex items-start gap-3">
        <img src="/favicon.svg" alt="" class="h-9 w-9 rounded-md" />
        <div>
          <p class="text-xs font-semibold uppercase tracking-[0.2em] text-sky-700">
            Evolution Supply
          </p>
          <h1 class="mt-1 text-2xl font-semibold">Packing Slip</h1>
        </div>
      </div>
      <div class="text-right text-sm">
        <p class="text-xs uppercase tracking-wider text-slate-500">Order #</p>
        <p class="font-mono text-base font-semibold">{order.id.slice(0, 8)}</p>
        <p class="mt-2 text-xs uppercase tracking-wider text-slate-500">Order date</p>
        <p>{dateShort(order.placed_at)}</p>
      </div>
    </header>

    <section class="mt-6 grid grid-cols-2 gap-6 text-sm">
      <div>
        <p class="text-xs uppercase tracking-wider text-slate-500">Ship to</p>
        <p class="mt-1 font-semibold">{order.customer?.business_name ?? '—'}</p>
        {#if shipTo.length > 0}
          {#each shipTo as line}
            <p>{line}</p>
          {/each}
        {:else}
          <p class="text-slate-500">No shipping address on file.</p>
        {/if}
      </div>
      <div class="text-right">
        <dl class="space-y-1">
          {#if order.customer?.email}
            <div class="flex justify-end gap-3">
              <dt class="text-slate-500">Contact</dt>
              <dd>{order.customer.email}</dd>
            </div>
          {/if}
          <div class="flex justify-end gap-3">
            <dt class="text-slate-500">Items</dt>
            <dd class="tabular-nums">{data.lineItems.length}</dd>
          </div>
          <div class="flex justify-end gap-3">
            <dt class="text-slate-500">Total units</dt>
            <dd class="tabular-nums">{totalUnits}</dd>
          </div>
        </dl>
      </div>
    </section>

    <section class="mt-8">
      <table class="w-full text-sm">
        <thead>
          <tr
            class="border-y border-slate-300 text-left text-xs uppercase tracking-wider text-slate-500"
          >
            <th class="w-12 py-2 pr-2 text-center font-medium">✓</th>
            <th class="py-2 px-2 font-medium">SKU</th>
            <th class="py-2 px-2 font-medium">Item</th>
            <th class="py-2 pl-2 text-right font-medium">Qty</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          {#each data.lineItems as li (li.id)}
            <tr>
              <td class="py-2.5 pr-2 text-center align-top">
                <span class="inline-block h-4 w-4 rounded-sm border border-slate-400"></span>
              </td>
              <td class="py-2.5 px-2 align-top font-mono text-xs text-slate-500">
                {li.product_sku_snapshot ?? '—'}
              </td>
              <td class="py-2.5 px-2 align-top font-medium">{li.product_name_snapshot}</td>
              <td class="py-2.5 pl-2 text-right align-top tabular-nums font-semibold">
                {Number(li.quantity)}
              </td>
            </tr>
          {/each}
        </tbody>
        <tfoot>
          <tr class="border-t border-slate-300 text-sm font-semibold">
            <td class="py-2 pr-2"></td>
            <td class="py-2 px-2" colspan="2">Total units</td>
            <td class="py-2 pl-2 text-right tabular-nums">{totalUnits}</td>
          </tr>
        </tfoot>
      </table>
    </section>

    <footer class="mt-10 space-y-1 border-t border-slate-200 pt-4 text-xs text-slate-500">
      <p>
        Please check the contents of this shipment against this packing slip. If anything is missing
        or damaged, contact us and reference order #{order.id.slice(0, 8)}.
      </p>
      <p>Thank you for your business — Evolution Supply.</p>
    </footer>
  </article>
</div>

<style>
  :global(body) {
    background: #f1f5f9;
  }

  @media print {
    :global(body) {
      background: white;
    }
    .no-print {
      display: none !important;
    }
    .slip-wrap {
      max-width: none;
      padding: 0;
    }
    .slip-doc {
      box-shadow: none;
      border: none;
      padding: 0;
    }
    @page {
      margin: 0.5in;
    }
  }
</style>

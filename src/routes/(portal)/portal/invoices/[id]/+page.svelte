<script lang="ts">
  import { enhance } from '$app/forms';
  import { currency, dateShort } from '$lib/format';

  let { data, form } = $props();
  const balance = $derived(
    Math.max(0, Number(data.invoice.total) - Number(data.invoice.amount_paid))
  );

  const statusClass: Record<string, string> = {
    issued: 'bg-sky-50 text-sky-700',
    paid: 'bg-emerald-50 text-emerald-700',
    partially_paid: 'bg-amber-50 text-amber-700',
    overdue: 'bg-red-50 text-red-700',
    void: 'bg-slate-200 text-slate-700',
    refunded: 'bg-indigo-50 text-indigo-700'
  };
</script>

<svelte:head><title>{data.invoice.invoice_number} · Supply Portal</title></svelte:head>

<section class="space-y-5">
  <header class="flex flex-wrap items-start justify-between gap-4">
    <div>
      <a class="text-sm text-sky-700 hover:underline" href="/portal/invoices">Invoices</a>
      <div class="mt-1 flex flex-wrap items-center gap-3">
        <h1 class="text-2xl font-semibold">{data.invoice.invoice_number}</h1>
        <span class="rounded px-2 py-0.5 text-xs {statusClass[data.invoice.status] ?? ''}">
          {data.invoice.status.replace('_', ' ')}
        </span>
      </div>
      <p class="mt-1 text-sm text-slate-500">
        Issued {dateShort(data.invoice.issued_at)} · Due {dateShort(data.invoice.due_at)}
      </p>
    </div>
    <div class="flex flex-col items-end gap-2">
      <div class="rounded-lg border border-slate-200 bg-white px-5 py-4 text-right shadow-sm">
        <p class="text-xs uppercase tracking-wider text-slate-500">Balance due</p>
        <p class="text-2xl font-semibold" class:text-red-700={balance > 0}>{currency(balance)}</p>
      </div>
      <a
        class="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-100"
        href="/portal/invoices/{data.invoice.id}/pdf"
        download
      >
        Download PDF
      </a>
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

  <div class="grid gap-5 lg:grid-cols-[1fr_320px]">
    <div class="space-y-5">
      <section class="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <table class="w-full text-sm">
          <thead class="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th class="px-3 py-2 text-left font-medium">Description</th>
              <th class="px-3 py-2 text-right font-medium">Qty</th>
              <th class="px-3 py-2 text-right font-medium">Unit</th>
              <th class="px-3 py-2 text-right font-medium">Discount</th>
              <th class="px-3 py-2 text-right font-medium">Tax</th>
              <th class="px-3 py-2 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            {#each data.lines as line}
              <tr>
                <td class="px-3 py-2">
                  <div class="font-medium">{line.description}</div>
                  {#if line.product_sku_snapshot}
                    <div class="font-mono text-xs text-slate-500">{line.product_sku_snapshot}</div>
                  {/if}
                </td>
                <td class="px-3 py-2 text-right">{Number(line.quantity)}</td>
                <td class="px-3 py-2 text-right">{currency(line.unit_price)}</td>
                <td class="px-3 py-2 text-right">{currency(line.discount)}</td>
                <td class="px-3 py-2 text-right">{currency(line.tax)}</td>
                <td class="px-3 py-2 text-right font-medium">{currency(line.line_total)}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </section>

      {#if data.invoice.customer_memo}
        <section class="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 class="font-semibold">Memo</h2>
          <p class="mt-2 whitespace-pre-wrap text-sm text-slate-700">
            {data.invoice.customer_memo}
          </p>
        </section>
      {/if}
    </div>

    <aside class="space-y-5">
      <section class="rounded-lg border border-slate-200 bg-white p-5 text-sm shadow-sm">
        <h2 class="font-semibold">Summary</h2>
        <dl class="mt-3 space-y-2">
          <div class="flex justify-between">
            <dt>Subtotal</dt>
            <dd>{currency(data.invoice.subtotal)}</dd>
          </div>
          <div class="flex justify-between">
            <dt>Discount</dt>
            <dd>{currency(data.invoice.discount)}</dd>
          </div>
          <div class="flex justify-between">
            <dt>Tax</dt>
            <dd>{currency(data.invoice.tax)}</dd>
          </div>
          <div class="flex justify-between">
            <dt>Shipping</dt>
            <dd>{currency(data.invoice.shipping)}</dd>
          </div>
          <div class="flex justify-between border-t border-slate-200 pt-2 font-semibold">
            <dt>Total</dt>
            <dd>{currency(data.invoice.total)}</dd>
          </div>
          <div class="flex justify-between">
            <dt>Paid</dt>
            <dd>{currency(data.invoice.amount_paid)}</dd>
          </div>
          <div class="flex justify-between font-semibold" class:text-red-700={balance > 0}>
            <dt>Balance</dt>
            <dd>{currency(balance)}</dd>
          </div>
        </dl>
      </section>

      <section class="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 class="font-semibold">Payment</h2>
        {#if balance <= 0}
          <p class="mt-3 text-sm text-emerald-700">This invoice is paid.</p>
        {:else if data.invoice.status === 'void' || data.invoice.status === 'refunded'}
          <p class="mt-3 text-sm text-slate-500">This invoice is not payable.</p>
        {:else}
          <p class="mt-3 text-sm text-slate-600">
            Pay through the Supply payment flow connected to this invoice.
          </p>
          <form method="POST" action="?/preparePayment" use:enhance class="mt-4">
            <button
              class="w-full rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              Pay invoice
            </button>
          </form>
        {/if}
        {#if data.paymentIntents.length}
          <div class="mt-4 divide-y divide-slate-100 text-sm">
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
    </aside>
  </div>
</section>

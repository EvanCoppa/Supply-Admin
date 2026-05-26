<script lang="ts">
  import { currency, dateShort } from '$lib/format';

  let { data } = $props();

  const invoice = $derived(data.invoice);
  const balance = $derived(Math.max(0, Number(invoice.total) - Number(invoice.amount_paid)));

  function printNow() {
    window.print();
  }

  const termsLabel: Record<string, string> = {
    due_on_receipt: 'Due on receipt',
    net_15: 'Net 15',
    net_30: 'Net 30',
    net_60: 'Net 60',
    prepaid: 'Prepaid'
  };

  const statusLabel: Record<string, string> = {
    draft: 'Draft',
    issued: 'Issued',
    paid: 'Paid',
    partially_paid: 'Partially paid',
    overdue: 'Overdue',
    void: 'Void',
    refunded: 'Refunded'
  };
</script>

<svelte:head>
  <title>{invoice.invoice_number} · Invoice</title>
</svelte:head>

<div class="invoice-wrap mx-auto max-w-[850px] bg-white p-10 text-slate-900 print:p-0">
  <div class="no-print mb-4 flex items-center justify-between gap-3">
    <a href="/invoices/{invoice.id}" class="text-sm text-sky-700 hover:underline"
      >← Back to invoice</a
    >
    <button
      type="button"
      onclick={printNow}
      class="rounded bg-slate-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
    >
      Print / Save as PDF
    </button>
  </div>

  <article
    class="invoice-doc border border-slate-200 p-10 shadow-sm print:border-0 print:shadow-none"
  >
    <header class="flex items-start justify-between gap-6 border-b border-slate-200 pb-6">
      <div>
        <p class="text-xs font-semibold uppercase tracking-[0.2em] text-sky-700">
          Evolution Supply
        </p>
        <h1 class="mt-1 text-2xl font-semibold">Invoice</h1>
      </div>
      <div class="text-right text-sm">
        <p class="text-xs uppercase tracking-wider text-slate-500">Invoice #</p>
        <p class="font-mono text-base font-semibold">{invoice.invoice_number}</p>
        <p class="mt-2 text-xs uppercase tracking-wider text-slate-500">Status</p>
        <p>{statusLabel[invoice.status] ?? invoice.status}</p>
      </div>
    </header>

    <section class="mt-6 grid grid-cols-2 gap-6 text-sm">
      <div>
        <p class="text-xs uppercase tracking-wider text-slate-500">Bill to</p>
        <p class="mt-1 font-semibold">{invoice.customer?.business_name ?? '—'}</p>
        {#if invoice.customer?.primary_contact_name}
          <p>{invoice.customer.primary_contact_name}</p>
        {/if}
        {#if invoice.billing_email ?? invoice.customer?.email}
          <p class="text-slate-600">{invoice.billing_email ?? invoice.customer?.email}</p>
        {/if}
      </div>
      <div class="text-right">
        <dl class="space-y-1">
          <div class="flex justify-end gap-3">
            <dt class="text-slate-500">Issued</dt>
            <dd>{dateShort(invoice.issued_at)}</dd>
          </div>
          <div class="flex justify-end gap-3">
            <dt class="text-slate-500">Due</dt>
            <dd>{dateShort(invoice.due_at)}</dd>
          </div>
          <div class="flex justify-end gap-3">
            <dt class="text-slate-500">Terms</dt>
            <dd>{(invoice.terms && termsLabel[invoice.terms]) ?? invoice.terms ?? '—'}</dd>
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
            <th class="py-2 pr-2 font-medium">Item</th>
            <th class="py-2 px-2 font-medium">Description</th>
            <th class="py-2 px-2 text-right font-medium">Qty</th>
            <th class="py-2 px-2 text-right font-medium">Unit</th>
            <th class="py-2 px-2 text-right font-medium">Discount</th>
            <th class="py-2 px-2 text-right font-medium">Tax</th>
            <th class="py-2 pl-2 text-right font-medium">Total</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          {#each data.lines as line}
            <tr>
              <td class="py-2 pr-2 align-top font-mono text-xs text-slate-500">
                {line.product_sku_snapshot ?? ''}
              </td>
              <td class="py-2 px-2 align-top">
                <div class="font-medium text-slate-900">{line.description}</div>
                {#if line.product_name_snapshot && line.product_name_snapshot !== line.description}
                  <div class="text-xs text-slate-500">{line.product_name_snapshot}</div>
                {/if}
              </td>
              <td class="py-2 px-2 text-right align-top tabular-nums">{Number(line.quantity)}</td>
              <td class="py-2 px-2 text-right align-top tabular-nums"
                >{currency(line.unit_price)}</td
              >
              <td class="py-2 px-2 text-right align-top tabular-nums">{currency(line.discount)}</td>
              <td class="py-2 px-2 text-right align-top tabular-nums">{currency(line.tax)}</td>
              <td class="py-2 pl-2 text-right align-top font-medium tabular-nums">
                {currency(line.line_total)}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </section>

    <section class="mt-6 flex justify-end">
      <dl class="w-full max-w-xs space-y-1.5 text-sm">
        <div class="flex justify-between">
          <dt class="text-slate-500">Subtotal</dt>
          <dd class="tabular-nums">{currency(invoice.subtotal)}</dd>
        </div>
        <div class="flex justify-between">
          <dt class="text-slate-500">Discount</dt>
          <dd class="tabular-nums">{currency(invoice.discount)}</dd>
        </div>
        <div class="flex justify-between">
          <dt class="text-slate-500">Tax</dt>
          <dd class="tabular-nums">{currency(invoice.tax)}</dd>
        </div>
        <div class="flex justify-between">
          <dt class="text-slate-500">Shipping</dt>
          <dd class="tabular-nums">{currency(invoice.shipping)}</dd>
        </div>
        <div class="flex justify-between border-t border-slate-300 pt-2 text-base font-semibold">
          <dt>Total</dt>
          <dd class="tabular-nums">{currency(invoice.total)}</dd>
        </div>
        {#if Number(invoice.amount_paid) > 0}
          <div class="flex justify-between">
            <dt class="text-slate-500">Paid</dt>
            <dd class="tabular-nums">{currency(invoice.amount_paid)}</dd>
          </div>
        {/if}
        <div
          class="flex justify-between border-t border-slate-300 pt-2 text-base font-semibold"
          class:text-red-700={balance > 0}
        >
          <dt>Balance due</dt>
          <dd class="tabular-nums">{currency(balance)}</dd>
        </div>
      </dl>
    </section>

    {#if invoice.customer_memo}
      <section class="mt-8 border-t border-slate-200 pt-4 text-sm">
        <p class="text-xs uppercase tracking-wider text-slate-500">Notes</p>
        <p class="mt-1 whitespace-pre-wrap text-slate-700">{invoice.customer_memo}</p>
      </section>
    {/if}

    <footer class="mt-10 border-t border-slate-200 pt-4 text-xs text-slate-500">
      Thank you for your business.
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
    .invoice-wrap {
      max-width: none;
      padding: 0;
    }
    .invoice-doc {
      box-shadow: none;
      border: none;
      padding: 0;
    }
    @page {
      margin: 0.5in;
    }
  }
</style>

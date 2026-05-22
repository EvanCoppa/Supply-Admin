<script lang="ts">
  import { enhance } from '$app/forms';
  import { currency, dateShort, dateTime } from '$lib/format';
  import Breadcrumbs from '$lib/components/Breadcrumbs.svelte';

  let { data, form } = $props();
  const p = $derived(data.purchase);

  const statusClass: Record<string, string> = {
    draft: 'bg-slate-100 text-slate-700',
    ordered: 'bg-sky-50 text-sky-800',
    received: 'bg-emerald-50 text-emerald-800',
    cancelled: 'bg-slate-100 text-slate-500'
  };
  const paymentClass: Record<string, string> = {
    unpaid: 'bg-red-50 text-red-800',
    partial: 'bg-amber-50 text-amber-800',
    paid: 'bg-emerald-50 text-emerald-800'
  };

  function pct(v: number) {
    return `${(Number(v) * 100).toFixed(2)}%`;
  }
  function toLocalDate(value: unknown): string {
    if (typeof value !== 'string' || !value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    const tzOffsetMs = d.getTimezoneOffset() * 60_000;
    return new Date(d.getTime() - tzOffsetMs).toISOString().slice(0, 16);
  }
</script>

<svelte:head><title>Purchase {p.id.slice(0, 8)} · Supply Admin</title></svelte:head>

<section class="space-y-5">
  <Breadcrumbs items={[{ label: 'Purchases', href: '/purchases' }, { label: p.id.slice(0, 8) }]} />

  <header class="flex items-start justify-between gap-3">
    <div class="space-y-1">
      <h1 class="text-2xl font-semibold font-mono">{p.id.slice(0, 8)}</h1>
      <div class="flex items-center gap-2">
        <span class="rounded px-2 py-0.5 text-xs {statusClass[String(p.status)] ?? ''}">{p.status}</span>
        <span class="rounded px-2 py-0.5 text-xs {paymentClass[String(p.payment_status)] ?? ''}">{p.payment_status}</span>
      </div>
      <p class="text-sm text-slate-500">
        {p.supplier?.name ?? '—'} · ordered {dateTime(String(p.ordered_at))}
      </p>
    </div>
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

  <div class="grid gap-5 lg:grid-cols-3">
    <form method="POST" action="?/update" use:enhance class="space-y-4 lg:col-span-2">
      <div class="rounded-lg border border-slate-200 bg-white p-4 shadow-sm space-y-3 text-sm">
        <h2 class="font-semibold">Details</h2>

        <label class="block">
          <span class="mb-1 block text-xs font-medium text-slate-600">Supplier</span>
          <select
            name="supplier_id"
            value={String(p.supplier_id)}
            class="w-full rounded border border-slate-300 px-2 py-1.5"
          >
            {#each data.suppliers as s (s.id)}
              <option value={s.id}>{s.name}</option>
            {/each}
          </select>
        </label>

        <div class="grid gap-3 sm:grid-cols-2">
          <label class="block">
            <span class="mb-1 block text-xs font-medium text-slate-600">Ordered at</span>
            <input
              type="datetime-local"
              name="ordered_at"
              value={toLocalDate(p.ordered_at)}
              class="w-full rounded border border-slate-300 px-2 py-1.5"
            />
          </label>
          <label class="block">
            <span class="mb-1 block text-xs font-medium text-slate-600">Received at</span>
            <input
              type="datetime-local"
              name="received_at"
              value={toLocalDate(p.received_at)}
              class="w-full rounded border border-slate-300 px-2 py-1.5"
            />
          </label>
        </div>

        <label class="block">
          <span class="mb-1 block text-xs font-medium text-slate-600">Supplier invoice / PO ref</span>
          <input
            name="invoice_ref"
            value={String(p.invoice_ref ?? '')}
            class="w-full rounded border border-slate-300 px-2 py-1.5"
          />
        </label>

        <label class="block">
          <span class="mb-1 block text-xs font-medium text-slate-600">Notes</span>
          <textarea
            name="notes"
            rows="3"
            class="w-full rounded border border-slate-300 px-2 py-1.5">{p.notes ?? ''}</textarea>
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
              value={String(p.subtotal ?? 0)}
              class="w-full rounded border border-slate-300 px-2 py-1.5"
            />
          </label>
          <label class="block">
            <span class="mb-1 block text-xs font-medium text-slate-600">Freight</span>
            <input
              type="number"
              step="0.01"
              min="0"
              name="freight"
              value={String(p.freight ?? 0)}
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
              value={String(Number(p.distribution_fee_pct ?? 0) * 100)}
              class="w-full rounded border border-slate-300 px-2 py-1.5"
            />
          </label>
          <label class="block">
            <span class="mb-1 block text-xs font-medium text-slate-600">Tax</span>
            <input
              type="number"
              step="0.01"
              min="0"
              name="tax"
              value={String(p.tax ?? 0)}
              class="w-full rounded border border-slate-300 px-2 py-1.5"
            />
          </label>
        </div>

        <dl class="mt-2 rounded border border-slate-100 bg-slate-50 p-3 text-sm space-y-1">
          <div class="flex justify-between">
            <dt class="text-slate-600">Distribution fee</dt>
            <dd>{currency(Number(p.distribution_fee))} ({pct(Number(p.distribution_fee_pct))})</dd>
          </div>
          <div class="flex justify-between border-t border-slate-200 pt-1 font-semibold">
            <dt>Total</dt>
            <dd>{currency(Number(p.total))}</dd>
          </div>
        </dl>
      </div>

      <div class="rounded-lg border border-slate-200 bg-white p-4 shadow-sm space-y-3 text-sm">
        <h2 class="font-semibold">Status</h2>
        <div class="grid gap-3 sm:grid-cols-3">
          <label class="block">
            <span class="mb-1 block text-xs font-medium text-slate-600">Status</span>
            <select name="status" value={String(p.status)} class="w-full rounded border border-slate-300 px-2 py-1.5">
              <option value="draft">draft</option>
              <option value="ordered">ordered</option>
              <option value="received">received</option>
              <option value="cancelled">cancelled</option>
            </select>
          </label>
          <label class="block">
            <span class="mb-1 block text-xs font-medium text-slate-600">Payment</span>
            <select name="payment_status" value={String(p.payment_status)} class="w-full rounded border border-slate-300 px-2 py-1.5">
              <option value="unpaid">unpaid</option>
              <option value="partial">partial</option>
              <option value="paid">paid</option>
            </select>
          </label>
          <label class="block">
            <span class="mb-1 block text-xs font-medium text-slate-600">Due date</span>
            <input
              type="date"
              name="due_date"
              value={p.due_date ? String(p.due_date) : ''}
              class="w-full rounded border border-slate-300 px-2 py-1.5"
            />
          </label>
        </div>
      </div>

      <button
        type="submit"
        class="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
      >
        Save changes
      </button>
    </form>

    <aside class="space-y-4">
      {#if p.order}
        <div class="rounded-lg border border-slate-200 bg-white p-4 shadow-sm text-sm">
          <h3 class="mb-2 font-semibold">For client order</h3>
          <a class="text-sky-700 hover:underline" href="/orders/{p.order.id}">
            {p.order.customer?.business_name ?? p.order.id.slice(0, 8)}
          </a>
          <p class="text-xs text-slate-500">
            Revenue {currency(p.order.total)} · placed {dateShort(p.order.placed_at)}
          </p>
        </div>
      {/if}

      {#if p.payment_status !== 'paid'}
        <div class="rounded-lg border border-slate-200 bg-white p-4 shadow-sm text-sm">
          <h3 class="mb-2 font-semibold">Mark paid</h3>
          <form method="POST" action="?/markPaid" use:enhance class="space-y-2">
            <label class="block">
              <span class="mb-1 block text-xs font-medium text-slate-600">Paid on</span>
              <input
                type="date"
                name="paid_on"
                class="w-full rounded border border-slate-300 px-2 py-1.5"
              />
            </label>
            <button
              type="submit"
              class="w-full rounded bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-800"
            >
              Record payment
            </button>
            <p class="text-xs text-slate-500">Adds a cash-out entry for {currency(Number(p.total))}.</p>
          </form>
        </div>
      {/if}

      {#if p.status !== 'received' && p.status !== 'cancelled'}
        <form method="POST" action="?/markReceived" use:enhance>
          <button
            type="submit"
            class="w-full rounded border border-slate-300 px-3 py-2 text-sm hover:bg-slate-100"
          >
            Mark received
          </button>
        </form>
      {/if}

      <form method="POST" action="?/delete" use:enhance>
        <button
          type="submit"
          onclick={(e) => {
            if (!confirm('Delete this purchase?')) e.preventDefault();
          }}
          class="w-full rounded border border-red-300 px-3 py-2 text-sm text-red-700 hover:bg-red-50"
        >
          Delete
        </button>
      </form>
    </aside>
  </div>
</section>

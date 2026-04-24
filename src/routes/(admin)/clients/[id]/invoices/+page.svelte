<script lang="ts">
  import { enhance } from '$app/forms';
  import { currency, dateShort } from '$lib/format';

  let { data, form } = $props();

  let showCreate = $state(false);

  const statusClass: Record<string, string> = {
    draft: 'bg-slate-100 text-slate-600',
    issued: 'bg-sky-50 text-sky-700',
    paid: 'bg-emerald-50 text-emerald-700',
    partially_paid: 'bg-amber-50 text-amber-700',
    overdue: 'bg-red-50 text-red-700',
    void: 'bg-slate-200 text-slate-700',
    refunded: 'bg-indigo-50 text-indigo-700'
  };
</script>

<div class="space-y-5">
  {#if form?.message}
    <div class="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">{form.message}</div>
  {/if}

  <div class="flex items-center justify-between">
    <div>
      <h2 class="font-semibold">Invoices</h2>
      <p class="text-sm text-slate-500">{data.invoices.length} total</p>
    </div>
    <button
      type="button"
      onclick={() => (showCreate = !showCreate)}
      class="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
    >
      {showCreate ? 'Cancel' : 'Issue invoice'}
    </button>
  </div>

  {#if showCreate}
    <form
      method="POST"
      action="?/createFromOrder"
      use:enhance={() => () => {
        showCreate = false;
      }}
      class="grid gap-3 rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-3"
    >
      <label class="block sm:col-span-3">
        <span class="mb-1 block text-xs font-medium">Order</span>
        <select name="order_id" required class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm">
          <option value="">— Pick an order —</option>
          {#each data.orders as o}
            <option value={o.id}>
              {dateShort(o.placed_at)} · {currency(o.total)} · {o.status}
            </option>
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
        <span class="mb-1 block text-xs font-medium">Due in (days)</span>
        <input
          type="number"
          min="0"
          name="due_days"
          value="30"
          class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
        />
      </label>
      <div class="flex items-end sm:col-span-1">
        <button
          type="submit"
          class="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
        >
          Create & issue
        </button>
      </div>
    </form>
  {/if}

  <div class="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
    {#if data.invoices.length === 0}
      <p class="px-4 py-10 text-center text-sm text-slate-500">No invoices yet.</p>
    {:else}
      <table class="w-full text-sm">
        <thead class="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
          <tr>
            <th class="px-3 py-2 text-left font-medium">Number</th>
            <th class="px-3 py-2 text-left font-medium">Status</th>
            <th class="px-3 py-2 text-left font-medium">Terms</th>
            <th class="px-3 py-2 text-right font-medium">Total</th>
            <th class="px-3 py-2 text-right font-medium">Paid</th>
            <th class="px-3 py-2 text-right font-medium">Balance</th>
            <th class="px-3 py-2 text-right font-medium">Due</th>
            <th class="px-3 py-2 text-right font-medium"></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          {#each data.invoices as inv}
            <tr class="hover:bg-slate-50">
              <td class="px-3 py-2 font-mono text-xs">{inv.invoice_number}</td>
              <td class="px-3 py-2">
                <form method="POST" action="?/setStatus" use:enhance class="inline">
                  <input type="hidden" name="id" value={inv.id} />
                  <select
                    name="status"
                    class="rounded px-1.5 py-0.5 text-xs {statusClass[inv.status] ?? ''}"
                    onchange={(e) => (e.currentTarget.form as HTMLFormElement).requestSubmit()}
                  >
                    {#each ['draft', 'issued', 'paid', 'partially_paid', 'overdue', 'void', 'refunded'] as s}
                      <option value={s} selected={inv.status === s}>{s}</option>
                    {/each}
                  </select>
                </form>
              </td>
              <td class="px-3 py-2 text-slate-600">{inv.terms ?? '—'}</td>
              <td class="px-3 py-2 text-right">{currency(inv.total)}</td>
              <td class="px-3 py-2 text-right">{currency(inv.amount_paid)}</td>
              <td class="px-3 py-2 text-right font-medium">
                {currency(Number(inv.total) - Number(inv.amount_paid))}
              </td>
              <td class="px-3 py-2 text-right text-slate-600">{dateShort(inv.due_at)}</td>
              <td class="px-3 py-2 text-right">
                {#if inv.status !== 'paid' && inv.status !== 'void' && inv.status !== 'refunded'}
                  <form method="POST" action="?/recordPayment" use:enhance class="inline-flex items-center gap-1">
                    <input type="hidden" name="id" value={inv.id} />
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      name="amount"
                      placeholder="Amount"
                      class="w-20 rounded border border-slate-300 px-1 py-0.5 text-xs"
                    />
                    <button
                      type="submit"
                      class="rounded border border-slate-300 px-2 py-0.5 text-xs hover:bg-slate-100"
                    >
                      Record
                    </button>
                  </form>
                {/if}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
  </div>
</div>

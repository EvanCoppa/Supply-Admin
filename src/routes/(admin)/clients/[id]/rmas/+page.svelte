<script lang="ts">
  import { enhance } from '$app/forms';
  import { currency, dateShort } from '$lib/format';

  let { data, form } = $props();

  let showCreate = $state(false);

  const statusClass: Record<string, string> = {
    requested: 'bg-slate-100 text-slate-600',
    approved: 'bg-sky-50 text-sky-700',
    received: 'bg-indigo-50 text-indigo-700',
    refunded: 'bg-emerald-50 text-emerald-700',
    rejected: 'bg-red-50 text-red-700',
    cancelled: 'bg-slate-200 text-slate-700'
  };
</script>

<div class="space-y-5">
  {#if form?.message}
    <div class="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">{form.message}</div>
  {/if}

  <div class="flex items-center justify-between">
    <div>
      <h2 class="font-semibold">RMAs</h2>
      <p class="text-sm text-slate-500">Return merchandise authorizations for this account.</p>
    </div>
    <button
      type="button"
      onclick={() => (showCreate = !showCreate)}
      class="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
    >
      {showCreate ? 'Cancel' : 'Open RMA'}
    </button>
  </div>

  {#if showCreate}
    <form
      method="POST"
      action="?/create"
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
      <label class="block sm:col-span-3">
        <span class="mb-1 block text-xs font-medium">Reason</span>
        <input name="reason" class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm" />
      </label>
      <label class="block">
        <span class="mb-1 block text-xs font-medium">Refund amount</span>
        <input
          type="number"
          step="0.01"
          min="0"
          name="refund_amount"
          value="0"
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
          value="0"
          class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
        />
      </label>
      <label class="block sm:col-span-3">
        <span class="mb-1 block text-xs font-medium">Notes</span>
        <textarea
          name="notes"
          rows="2"
          class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
        ></textarea>
      </label>
      <div class="sm:col-span-3 flex justify-end">
        <button
          type="submit"
          class="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
        >
          Create RMA
        </button>
      </div>
    </form>
  {/if}

  <div class="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
    {#if data.rmas.length === 0}
      <p class="px-4 py-10 text-center text-sm text-slate-500">No RMAs on file.</p>
    {:else}
      <table class="w-full text-sm">
        <thead class="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
          <tr>
            <th class="px-3 py-2 text-left font-medium">Number</th>
            <th class="px-3 py-2 text-left font-medium">Status</th>
            <th class="px-3 py-2 text-left font-medium">Reason</th>
            <th class="px-3 py-2 text-right font-medium">Refund</th>
            <th class="px-3 py-2 text-right font-medium">Fee</th>
            <th class="px-3 py-2 text-right font-medium">Created</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          {#each data.rmas as r}
            <tr class="hover:bg-slate-50">
              <td class="px-3 py-2 font-mono text-xs">{r.rma_number}</td>
              <td class="px-3 py-2">
                <form method="POST" action="?/setStatus" use:enhance class="inline">
                  <input type="hidden" name="id" value={r.id} />
                  <select
                    name="status"
                    class="rounded px-1.5 py-0.5 text-xs {statusClass[r.status] ?? ''}"
                    onchange={(e) => (e.currentTarget.form as HTMLFormElement).requestSubmit()}
                  >
                    {#each ['requested', 'approved', 'received', 'refunded', 'rejected', 'cancelled'] as s}
                      <option value={s} selected={r.status === s}>{s}</option>
                    {/each}
                  </select>
                </form>
              </td>
              <td class="px-3 py-2 text-slate-600">{r.reason ?? '—'}</td>
              <td class="px-3 py-2 text-right">{currency(r.refund_amount)}</td>
              <td class="px-3 py-2 text-right">{currency(r.restocking_fee)}</td>
              <td class="px-3 py-2 text-right text-slate-500">{dateShort(r.created_at)}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
  </div>
</div>

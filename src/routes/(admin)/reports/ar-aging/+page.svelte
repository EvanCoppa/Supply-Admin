<script lang="ts">
  import { currency, dateShort } from '$lib/format';
  import HelpTooltip from '$lib/components/HelpTooltip.svelte';

  let { data } = $props();

  let expanded = $state<Record<string, boolean>>({});

  function toggle(id: string) {
    expanded[id] = !expanded[id];
  }

  function bucketClass(
    amount: number,
    bucket: 'current' | 'd1_30' | 'd31_60' | 'd61_90' | 'd90_plus'
  ): string {
    if (amount === 0) return 'text-slate-300';
    if (bucket === 'current') return 'text-slate-700';
    if (bucket === 'd1_30') return 'text-amber-700';
    if (bucket === 'd31_60') return 'text-orange-700 font-medium';
    if (bucket === 'd61_90') return 'text-red-700 font-medium';
    return 'text-red-800 font-semibold';
  }

  const summary = $derived([
    {
      key: 'current',
      label: 'Current',
      tone: 'bg-slate-50 border-slate-200',
      amount: data.totals.current
    },
    {
      key: 'd1_30',
      label: '1–30 days',
      tone: 'bg-amber-50 border-amber-200',
      amount: data.totals.d1_30
    },
    {
      key: 'd31_60',
      label: '31–60 days',
      tone: 'bg-orange-50 border-orange-200',
      amount: data.totals.d31_60
    },
    {
      key: 'd61_90',
      label: '61–90 days',
      tone: 'bg-red-50 border-red-200',
      amount: data.totals.d61_90
    },
    {
      key: 'd90_plus',
      label: '90+ days',
      tone: 'bg-red-100 border-red-300',
      amount: data.totals.d90_plus
    }
  ] as const);

  function invoicesForCustomer(customerId: string) {
    return data.rows.filter((r) => r.customer_id === customerId);
  }
</script>

<svelte:head><title>AR Aging · Supply Admin</title></svelte:head>

<section class="space-y-6">
  <header class="flex items-end justify-between">
    <div>
      <h1 class="text-2xl font-semibold">AR Aging</h1>
      <p class="text-sm text-slate-500">Outstanding client invoices bucketed by days past due.</p>
    </div>
    <div class="text-right">
      <p class="text-xs uppercase tracking-wider text-slate-500">Total outstanding</p>
      <p class="text-2xl font-semibold">{currency(data.totals.total)}</p>
    </div>
  </header>

  <div class="grid grid-cols-2 gap-3 md:grid-cols-5">
    {#each summary as s (s.key)}
      <div class="rounded-lg border p-3 {s.tone}">
        <p
          class="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-slate-600"
        >
          {s.label}
          <HelpTooltip
            text={s.key === 'current'
              ? 'Invoices not yet due (due date ≥ today)'
              : `Invoices ${s.key === 'd1_30' ? '1–30' : s.key === 'd31_60' ? '31–60' : s.key === 'd61_90' ? '61–90' : '90+'} days past due`}
          />
        </p>
        <p class="mt-1 text-xl font-semibold">{currency(s.amount)}</p>
      </div>
    {/each}
  </div>

  {#if data.totals.no_due_date > 0}
    <p class="text-xs text-slate-500">
      Also {currency(data.totals.no_due_date)} on invoices without a due date — set due dates to age them.
    </p>
  {/if}

  <div class="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
    {#if data.byCustomer.length === 0}
      <p class="p-6 text-sm text-slate-500">No outstanding invoices. Everything is paid up.</p>
    {:else}
      <table class="w-full text-sm">
        <thead class="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
          <tr>
            <th class="px-3 py-2 text-left font-medium">Client</th>
            <th class="px-2 py-2 text-right font-medium">Current</th>
            <th class="px-2 py-2 text-right font-medium">1–30</th>
            <th class="px-2 py-2 text-right font-medium">31–60</th>
            <th class="px-2 py-2 text-right font-medium">61–90</th>
            <th class="px-2 py-2 text-right font-medium">90+</th>
            <th class="px-2 py-2 text-right font-medium">Total</th>
            <th class="px-2 py-2 text-right font-medium">Oldest</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          {#each data.byCustomer as c (c.customer_id)}
            <tr class="cursor-pointer hover:bg-slate-50" onclick={() => toggle(c.customer_id)}>
              <td class="px-3 py-2">
                <span class="mr-2 inline-block w-3 text-xs text-slate-400">
                  {expanded[c.customer_id] ? '▾' : '▸'}
                </span>
                <a
                  class="text-sky-700 hover:underline"
                  href="/clients/{c.customer_id}"
                  onclick={(e) => e.stopPropagation()}
                >
                  {c.customer_name}
                </a>
                <span class="ml-2 text-xs text-slate-400">{c.invoice_count} inv</span>
              </td>
              <td class="px-2 py-2 text-right {bucketClass(c.current, 'current')}"
                >{currency(c.current)}</td
              >
              <td class="px-2 py-2 text-right {bucketClass(c.d1_30, 'd1_30')}"
                >{currency(c.d1_30)}</td
              >
              <td class="px-2 py-2 text-right {bucketClass(c.d31_60, 'd31_60')}"
                >{currency(c.d31_60)}</td
              >
              <td class="px-2 py-2 text-right {bucketClass(c.d61_90, 'd61_90')}"
                >{currency(c.d61_90)}</td
              >
              <td class="px-2 py-2 text-right {bucketClass(c.d90_plus, 'd90_plus')}"
                >{currency(c.d90_plus)}</td
              >
              <td class="px-2 py-2 text-right font-semibold">{currency(c.total)}</td>
              <td
                class="px-2 py-2 text-right text-xs {c.oldest_days > 60
                  ? 'text-red-700'
                  : 'text-slate-500'}"
              >
                {c.oldest_days > 0 ? `${c.oldest_days}d` : '—'}
              </td>
            </tr>

            {#if expanded[c.customer_id]}
              <tr class="bg-slate-50">
                <td colspan="8" class="px-3 py-3">
                  <table class="w-full text-xs">
                    <thead class="text-slate-500">
                      <tr>
                        <th class="px-2 py-1 text-left font-medium">Invoice</th>
                        <th class="px-2 py-1 text-left font-medium">Issued</th>
                        <th class="px-2 py-1 text-left font-medium">Due</th>
                        <th class="px-2 py-1 text-right font-medium">Total</th>
                        <th class="px-2 py-1 text-right font-medium">Paid</th>
                        <th class="px-2 py-1 text-right font-medium">Balance</th>
                        <th class="px-2 py-1 text-right font-medium">Past due</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-200">
                      {#each invoicesForCustomer(c.customer_id) as inv (inv.invoice_id)}
                        <tr>
                          <td class="px-2 py-1">
                            <a
                              class="text-sky-700 hover:underline"
                              href="/invoices/{inv.invoice_id}"
                            >
                              {inv.invoice_number}
                            </a>
                          </td>
                          <td class="px-2 py-1 text-slate-600">{dateShort(inv.issued_at)}</td>
                          <td class="px-2 py-1 text-slate-600">{dateShort(inv.due_at)}</td>
                          <td class="px-2 py-1 text-right text-slate-500">{currency(inv.total)}</td>
                          <td class="px-2 py-1 text-right text-slate-500"
                            >{currency(inv.amount_paid)}</td
                          >
                          <td class="px-2 py-1 text-right font-medium">{currency(inv.balance)}</td>
                          <td
                            class="px-2 py-1 text-right {(inv.days_past_due ?? 0) > 60
                              ? 'text-red-700'
                              : 'text-slate-600'}"
                          >
                            {inv.days_past_due == null
                              ? 'no due date'
                              : inv.days_past_due === 0
                                ? '—'
                                : `${inv.days_past_due}d`}
                          </td>
                        </tr>
                      {/each}
                    </tbody>
                  </table>
                </td>
              </tr>
            {/if}
          {/each}
        </tbody>
        <tfoot class="bg-slate-50 text-sm font-semibold">
          <tr>
            <td class="px-3 py-2 text-right">Totals</td>
            <td class="px-2 py-2 text-right">{currency(data.totals.current)}</td>
            <td class="px-2 py-2 text-right">{currency(data.totals.d1_30)}</td>
            <td class="px-2 py-2 text-right">{currency(data.totals.d31_60)}</td>
            <td class="px-2 py-2 text-right">{currency(data.totals.d61_90)}</td>
            <td class="px-2 py-2 text-right">{currency(data.totals.d90_plus)}</td>
            <td class="px-2 py-2 text-right">{currency(data.totals.total)}</td>
            <td></td>
          </tr>
        </tfoot>
      </table>
    {/if}
  </div>
</section>

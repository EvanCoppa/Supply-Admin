<script lang="ts">
  import { currency, dateShort } from '$lib/format';
  import HelpTooltip from '$lib/components/HelpTooltip.svelte';

  let { data } = $props();

  const m = $derived(data.metrics);

  function pct(v: number): string {
    return `${(v * 100).toFixed(1)}%`;
  }

  function marginClass(v: number): string {
    if (v >= 0.4) return 'text-emerald-700';
    if (v >= 0.25) return 'text-amber-700';
    return 'text-red-700';
  }
</script>

<svelte:head><title>Financials · Supply Admin</title></svelte:head>

<section class="space-y-6">
  <header>
    <h1 class="text-2xl font-semibold">Financials</h1>
    <p class="text-sm text-slate-500">Daily and month-to-date revenue, cost, margin, and cash.</p>
  </header>

  <div>
    <p class="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Today</p>
    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div class="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <p class="text-xs font-medium uppercase tracking-wider text-slate-500">Revenue</p>
        <p class="mt-1 text-2xl font-semibold">{currency(m.revenueToday)}</p>
      </div>
      <div class="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <p class="text-xs font-medium uppercase tracking-wider text-slate-500">COGS</p>
        <p class="mt-1 text-2xl font-semibold">{currency(m.cogsToday)}</p>
      </div>
      <div class="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <p class="flex items-center gap-1 text-xs font-medium uppercase tracking-wider text-slate-500">
          Gross Profit
          <HelpTooltip text="Revenue minus COGS. Does not include operating expenses." />
        </p>
        <p class="mt-1 text-2xl font-semibold">{currency(m.gpToday)}</p>
      </div>
      <div class="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <p class="flex items-center gap-1 text-xs font-medium uppercase tracking-wider text-slate-500">
          Gross Margin
          <HelpTooltip text="(Revenue - COGS) ÷ Revenue. Green ≥40%, Amber ≥25%, Red <25%" />
        </p>
        <p class="mt-1 text-2xl font-semibold {marginClass(m.marginToday)}">{pct(m.marginToday)}</p>
        <p class="text-xs text-slate-500">Target 40%+</p>
      </div>
    </div>
  </div>

  <div>
    <p class="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Month to date</p>
    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div class="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <p class="text-xs font-medium uppercase tracking-wider text-slate-500">Revenue</p>
        <p class="mt-1 text-2xl font-semibold">{currency(m.revenueMtd)}</p>
      </div>
      <div class="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <p class="text-xs font-medium uppercase tracking-wider text-slate-500">COGS</p>
        <p class="mt-1 text-2xl font-semibold">{currency(m.cogsMtd)}</p>
      </div>
      <div class="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <p class="flex items-center gap-1 text-xs font-medium uppercase tracking-wider text-slate-500">
          Gross Profit
          <HelpTooltip text="Revenue minus COGS. Does not include operating expenses." />
        </p>
        <p class="mt-1 text-2xl font-semibold">{currency(m.gpMtd)}</p>
      </div>
      <div class="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <p class="flex items-center gap-1 text-xs font-medium uppercase tracking-wider text-slate-500">
          Gross Margin
          <HelpTooltip text="(Revenue - COGS) ÷ Revenue. Green ≥40%, Amber ≥25%, Red <25%" />
        </p>
        <p class="mt-1 text-2xl font-semibold {marginClass(m.marginMtd)}">{pct(m.marginMtd)}</p>
        <p class="text-xs text-slate-500">Target 40%+</p>
      </div>
    </div>
  </div>

  <div class="grid gap-4 lg:grid-cols-3">
    <div class="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <p class="text-xs font-semibold uppercase tracking-wider text-slate-500">Cash today</p>
      <div class="mt-2 space-y-1.5 text-sm">
        <div class="flex justify-between">
          <span class="text-slate-600">Cash in</span>
          <span class="font-medium text-emerald-700">{currency(m.cashIn)}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-slate-600">Cash out</span>
          <span class="font-medium text-red-700">{currency(m.cashOut)}</span>
        </div>
        <div class="flex justify-between border-t border-slate-200 pt-1.5">
          <span class="inline-flex items-center gap-1 font-medium text-slate-800">
            Net cash
            <HelpTooltip text="Cash in minus cash out for today. Daily snapshot, not cumulative." />
          </span>
          <span class="font-semibold {m.netCash >= 0 ? 'text-emerald-700' : 'text-red-700'}">
            {currency(m.netCash)}
          </span>
        </div>
      </div>
    </div>

    <a
      href="/invoices?status=outstanding"
      class="rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:border-sky-400"
    >
      <p class="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
        Outstanding AR
        <HelpTooltip text="Sum of unpaid invoice balances. = Invoice total - amount paid" />
      </p>
      <p class="mt-1 text-2xl font-semibold">{currency(m.outstandingAr)}</p>
      <p class="text-xs text-slate-500">
        {m.overdueInvoices} invoice{m.overdueInvoices === 1 ? '' : 's'} overdue
      </p>
    </a>

    <div class="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <p class="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
        Outstanding AP
        <HelpTooltip text="Sum of unpaid supplier purchase balances. = Purchase total - amount paid" />
      </p>
      <p class="mt-1 text-2xl font-semibold">{currency(m.outstandingAp)}</p>
      <p class="text-xs text-slate-500">Unpaid supplier purchases</p>
    </div>
  </div>

  <div class="grid gap-4 lg:grid-cols-3">
    <div class="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <p class="text-xs font-semibold uppercase tracking-wider text-slate-500">
        Supplier spend · last 30 days
      </p>
      {#if data.supplierBreakdown.length === 0}
        <p class="mt-4 text-sm text-slate-500">
          No purchases logged yet. Add a purchase to see supplier breakdown.
        </p>
      {:else}
        <ul class="mt-3 space-y-2 text-sm">
          {#each data.supplierBreakdown as s (s.key)}
            {@const share = data.supplierGrandTotal > 0 ? s.total / data.supplierGrandTotal : 0}
            <li>
              <div class="flex items-center justify-between">
                <span class="font-medium text-slate-800">{s.name}</span>
                <span class="text-slate-600">{currency(s.total)} · {pct(share)}</span>
              </div>
              <div class="mt-1 h-1.5 w-full rounded bg-slate-100">
                <div class="h-full rounded bg-sky-500" style="width: {share * 100}%"></div>
              </div>
            </li>
          {/each}
        </ul>
      {/if}
    </div>

    <div class="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div class="mb-2 flex items-center justify-between">
        <p class="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Trending items · last 30 days
        </p>
        <a href="/insights" class="text-xs text-sky-700 hover:underline">See all →</a>
      </div>
      {#if data.trendingItems.length === 0}
        <p class="text-sm text-slate-500">Not enough order history to surface trends yet.</p>
      {:else}
        <ul class="space-y-1.5 text-sm">
          {#each data.trendingItems as t (t.product_id)}
            <li class="flex items-center justify-between gap-2">
              <a
                class="min-w-0 truncate text-slate-800 hover:underline"
                href="/catalog/{t.product_id}"
              >
                {t.name ?? t.sku ?? '—'}
              </a>
              <span class="shrink-0 text-xs text-slate-500">
                {Number(t.total_qty).toLocaleString()} units · {t.unique_customers} client{t.unique_customers ===
                1
                  ? ''
                  : 's'}
              </span>
            </li>
          {/each}
        </ul>
      {/if}
    </div>

    <div class="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <p class="text-xs font-semibold uppercase tracking-wider text-slate-500">Smart alerts</p>
      <ul class="mt-3 space-y-2 text-sm">
        {#if m.overdueInvoices > 0}
          <li class="flex items-start gap-2">
            <span class="mt-0.5 inline-block h-2 w-2 shrink-0 rounded-full bg-red-500"></span>
            <span>
              <a
                class="font-medium text-red-700 hover:underline"
                href="/invoices?status=outstanding"
              >
                {m.overdueInvoices} overdue invoice{m.overdueInvoices === 1 ? '' : 's'}
              </a>
              — follow up on AR.
            </span>
          </li>
        {/if}
        {#if m.medplusPendingCount > 0}
          <li class="flex items-start gap-2">
            <span class="mt-0.5 inline-block h-2 w-2 shrink-0 rounded-full bg-amber-500"></span>
            <span>
              {m.medplusPendingCount} MedPlus charge{m.medplusPendingCount === 1 ? '' : 's'} pending ({currency(
                m.medplusPendingTotal
              )}).
            </span>
          </li>
        {/if}
        {#if m.dueSoonCount > 0}
          <li class="space-y-1">
            <div class="flex items-start gap-2">
              <span class="mt-0.5 inline-block h-2 w-2 shrink-0 rounded-full bg-amber-500"></span>
              <span>
                <a
                  class="font-medium text-amber-800 hover:underline"
                  href="/purchases?payment_status=unpaid"
                >
                  {m.dueSoonCount} supplier payment{m.dueSoonCount === 1 ? '' : 's'} due within 7 days
                </a>
                ({currency(m.dueSoonTotal)}).
              </span>
            </div>
            <ul class="ml-4 space-y-1 text-xs text-slate-600">
              {#each data.dueSoonPurchases as p (p.id)}
                <li class="flex justify-between gap-3">
                  <a class="truncate hover:underline" href="/purchases/{p.id}">
                    {p.supplier?.name ?? 'Supplier'} · due {dateShort(p.due_date)}
                  </a>
                  <span>{currency(p.total)}</span>
                </li>
              {/each}
            </ul>
          </li>
        {/if}
        {#if data.lowMarginOrders.length > 0}
          <li class="space-y-1">
            <div class="flex items-start gap-2">
              <span class="mt-0.5 inline-block h-2 w-2 shrink-0 rounded-full bg-amber-500"></span>
              <span class="font-medium text-amber-800">
                {data.lowMarginOrders.length} order{data.lowMarginOrders.length === 1 ? '' : 's'} below
                40% margin
              </span>
            </div>
            <ul class="ml-4 space-y-1 text-xs text-slate-600">
              {#each data.lowMarginOrders as o (o.id)}
                <li class="flex justify-between gap-3">
                  <a class="truncate hover:underline" href="/orders/{o.id}">
                    {o.customer?.business_name ?? 'Order'} · {dateShort(o.placed_at)}
                  </a>
                  <span class={marginClass(o.margin)}>{pct(o.margin)}</span>
                </li>
              {/each}
            </ul>
          </li>
        {/if}
        {#if m.overdueInvoices === 0 && m.medplusPendingCount === 0 && m.dueSoonCount === 0 && data.lowMarginOrders.length === 0}
          <li class="text-sm text-slate-500">All clear — no alerts.</li>
        {/if}
      </ul>
    </div>
  </div>
</section>

<script lang="ts">
  import { currency, dateShort, dateTime } from '$lib/format';

  let { data } = $props();

  const priorityClass: Record<string, string> = {
    low: 'bg-slate-100 text-slate-600',
    normal: 'bg-sky-50 text-sky-700',
    high: 'bg-amber-50 text-amber-700',
    urgent: 'bg-red-50 text-red-700'
  };
</script>

<svelte:head><title>Dashboard · Supply Admin</title></svelte:head>

<section class="space-y-6">
  <header>
    <h1 class="text-2xl font-semibold">Dashboard</h1>
    <p class="text-sm text-slate-500">At-a-glance operations.</p>
  </header>

  <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
    <div class="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <p class="text-xs font-medium uppercase tracking-wider text-slate-500">Orders today</p>
      <p class="mt-1 text-2xl font-semibold">{data.metrics.ordersToday}</p>
    </div>
    <div class="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <p class="text-xs font-medium uppercase tracking-wider text-slate-500">Revenue (7d)</p>
      <p class="mt-1 text-2xl font-semibold">{currency(data.metrics.revenue7d)}</p>
    </div>
    <div class="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <p class="text-xs font-medium uppercase tracking-wider text-slate-500">Revenue (30d)</p>
      <p class="mt-1 text-2xl font-semibold">{currency(data.metrics.revenue30d)}</p>
    </div>
    <a
      href="/inventory?filter=low"
      class="rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:border-amber-400"
    >
      <p class="text-xs font-medium uppercase tracking-wider text-slate-500">Low stock</p>
      <p class="mt-1 text-2xl font-semibold text-amber-700">{data.metrics.lowStockCount}</p>
      <p class="text-xs text-slate-500">See inventory →</p>
    </a>
  </div>

  <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
    <a
      href="/tasks?view=overdue"
      class="rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:border-red-400"
    >
      <p class="text-xs font-medium uppercase tracking-wider text-slate-500">Overdue tasks</p>
      <p class="mt-1 text-2xl font-semibold text-red-700">{data.metrics.overdueTasks}</p>
      <p class="text-xs text-slate-500">Triage follow-ups →</p>
    </a>
    <a
      href="/invoices?status=outstanding"
      class="rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:border-red-400"
    >
      <p class="text-xs font-medium uppercase tracking-wider text-slate-500">Overdue invoices</p>
      <p class="mt-1 text-2xl font-semibold text-red-700">{data.metrics.overdueInvoices}</p>
      <p class="text-xs text-slate-500">
        {currency(data.metrics.outstandingBalance)} outstanding →
      </p>
    </a>
    <a
      href="/clients?lifecycle=at_risk"
      class="rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:border-amber-400"
    >
      <p class="text-xs font-medium uppercase tracking-wider text-slate-500">At-risk accounts</p>
      <p class="mt-1 text-2xl font-semibold text-amber-700">{data.atRiskCustomers.length}</p>
      <p class="text-xs text-slate-500">Review lifecycle →</p>
    </a>
  </div>

  <div class="grid gap-6 lg:grid-cols-2">
    <div class="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div class="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <h2 class="font-semibold">My open tasks</h2>
        <a class="text-xs text-sky-700 hover:underline" href="/tasks?view=mine_open">View all</a>
      </div>
      {#if data.myOpenTasks.length === 0}
        <p class="px-4 py-6 text-sm text-slate-500">Nothing on your plate.</p>
      {:else}
        <ul class="divide-y divide-slate-100">
          {#each data.myOpenTasks as t}
            <li class="flex items-start justify-between gap-3 px-4 py-3">
              <div class="min-w-0 flex-1">
                <p class="truncate font-medium">
                  <a class="hover:underline" href="/clients/{t.customer_id}/tasks">{t.title}</a>
                </p>
                <p class="text-xs text-slate-500">
                  {t.customer?.business_name ?? '—'}
                  {#if t.due_at} · due {dateTime(t.due_at)}{/if}
                </p>
              </div>
              <span class="rounded px-1.5 py-0.5 text-xs {priorityClass[t.priority] ?? ''}">{t.priority}</span>
            </li>
          {/each}
        </ul>
      {/if}
    </div>

    <div class="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div class="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <h2 class="font-semibold">At-risk & churned accounts</h2>
        <a class="text-xs text-sky-700 hover:underline" href="/clients?lifecycle=at_risk">View all</a>
      </div>
      {#if data.atRiskCustomers.length === 0}
        <p class="px-4 py-6 text-sm text-slate-500">No accounts flagged.</p>
      {:else}
        <table class="w-full text-sm">
          <thead class="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th class="px-4 py-2 text-left font-medium">Customer</th>
              <th class="px-4 py-2 text-left font-medium">Stage</th>
              <th class="px-4 py-2 text-right font-medium">Outstanding</th>
              <th class="px-4 py-2 text-right font-medium">Last order</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            {#each data.atRiskCustomers as c}
              <tr class="hover:bg-slate-50">
                <td class="px-4 py-2">
                  <a class="text-sky-700 hover:underline" href="/clients/{c.customer_id}">
                    {c.business_name}
                  </a>
                </td>
                <td class="px-4 py-2">{c.lifecycle_stage.replace('_', ' ')}</td>
                <td class="px-4 py-2 text-right">{currency(c.outstanding_balance)}</td>
                <td class="px-4 py-2 text-right text-slate-500">{dateShort(c.last_order_at)}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      {/if}
    </div>
  </div>

  <div class="grid gap-6 lg:grid-cols-2">
    <div class="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div class="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <h2 class="font-semibold">Recent orders</h2>
        <a class="text-xs text-sky-700 hover:underline" href="/orders">View all</a>
      </div>
      {#if data.recentOrders.length === 0}
        <p class="px-4 py-6 text-sm text-slate-500">No orders yet.</p>
      {:else}
        <table class="w-full text-sm">
          <thead class="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th class="px-4 py-2 text-left font-medium">Customer</th>
              <th class="px-4 py-2 text-left font-medium">Status</th>
              <th class="px-4 py-2 text-right font-medium">Total</th>
              <th class="px-4 py-2 text-right font-medium">Placed</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            {#each data.recentOrders as o}
              <tr class="hover:bg-slate-50">
                <td class="px-4 py-2">
                  <a class="text-sky-700 hover:underline" href="/orders/{o.id}">
                    {o.customer?.business_name ?? '—'}
                  </a>
                </td>
                <td class="px-4 py-2">{o.status}</td>
                <td class="px-4 py-2 text-right">{currency(o.total)}</td>
                <td class="px-4 py-2 text-right text-slate-500">{dateTime(o.placed_at)}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      {/if}
    </div>

    <div class="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div class="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <h2 class="font-semibold">Low stock</h2>
        <a class="text-xs text-sky-700 hover:underline" href="/inventory?filter=low">View all</a>
      </div>
      {#if data.lowStock.length === 0}
        <p class="px-4 py-6 text-sm text-slate-500">Everything is above threshold.</p>
      {:else}
        <table class="w-full text-sm">
          <thead class="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th class="px-4 py-2 text-left font-medium">SKU</th>
              <th class="px-4 py-2 text-left font-medium">Product</th>
              <th class="px-4 py-2 text-right font-medium">On hand</th>
              <th class="px-4 py-2 text-right font-medium">Threshold</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            {#each data.lowStock as row}
              <tr class="hover:bg-slate-50">
                <td class="px-4 py-2 font-mono text-xs">{row.product?.sku ?? '—'}</td>
                <td class="px-4 py-2">{row.product?.name ?? '—'}</td>
                <td class="px-4 py-2 text-right font-semibold text-amber-700">{row.quantity_on_hand}</td>
                <td class="px-4 py-2 text-right text-slate-500">{row.low_stock_threshold}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      {/if}
    </div>
  </div>
</section>

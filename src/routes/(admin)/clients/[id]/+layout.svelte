<script lang="ts">
  import { page } from '$app/state';
  import { currency, dateShort } from '$lib/format';
  import Breadcrumbs from '$lib/components/Breadcrumbs.svelte';

  let { data, children } = $props();

  const clientId = $derived(data.client.id);

  const tabs = $derived([
    { href: `/clients/${clientId}`, label: 'Profile', exact: true },
    { href: `/clients/${clientId}/contacts`, label: 'Contacts' },
    { href: `/clients/${clientId}/notes`, label: 'Notes' },
    { href: `/clients/${clientId}/activities`, label: 'Activity' },
    { href: `/clients/${clientId}/tasks`, label: 'Tasks' },
    { href: `/clients/${clientId}/addresses`, label: 'Addresses' },
    { href: `/clients/${clientId}/pricing`, label: 'Pricing' },
    { href: `/clients/${clientId}/featured`, label: 'Featured' },
    { href: `/clients/${clientId}/orders`, label: 'Orders' },
    { href: `/clients/${clientId}/invoices`, label: 'Invoices' },
    { href: `/clients/${clientId}/rmas`, label: 'RMAs' },
    { href: `/clients/${clientId}/credit`, label: 'Credit' },
    { href: `/clients/${clientId}/tokens`, label: 'API Tokens' }
  ]);

  const lifecycleColor: Record<string, string> = {
    lead: 'bg-sky-50 text-sky-700',
    prospect: 'bg-indigo-50 text-indigo-700',
    active: 'bg-emerald-50 text-emerald-700',
    at_risk: 'bg-amber-50 text-amber-700',
    churned: 'bg-slate-200 text-slate-700'
  };

  function isActive(tab: { href: string; exact?: boolean }) {
    return tab.exact ? page.url.pathname === tab.href : page.url.pathname.startsWith(tab.href);
  }
</script>

<section class="space-y-5">
  <header class="space-y-2">
    <Breadcrumbs
      items={[
        { label: 'Clients', href: '/clients' },
        { label: data.client.business_name }
      ]}
    />
    <div class="flex flex-wrap items-center gap-3">
      <h1 class="text-2xl font-semibold">{data.client.business_name}</h1>
      <span
        class="rounded px-2 py-0.5 text-xs"
        class:bg-emerald-50={data.client.status === 'active'}
        class:text-emerald-700={data.client.status === 'active'}
        class:bg-amber-50={data.client.status === 'suspended'}
        class:text-amber-700={data.client.status === 'suspended'}
        class:bg-slate-100={data.client.status === 'archived'}
        class:text-slate-600={data.client.status === 'archived'}
      >
        {data.client.status}
      </span>
      <span class="rounded px-2 py-0.5 text-xs {lifecycleColor[data.client.lifecycle_stage] ?? 'bg-slate-100 text-slate-700'}">
        {data.client.lifecycle_stage.replace('_', ' ')}
      </span>
      {#each data.tags as tag}
        <span
          class="rounded px-2 py-0.5 text-xs"
          style={tag.color ? `background-color:${tag.color}20; color:${tag.color}` : ''}
          class:bg-slate-100={!tag.color}
          class:text-slate-700={!tag.color}
        >
          {tag.name}
        </span>
      {/each}
    </div>
    {#if data.client.email}
      <p class="text-sm text-slate-500">{data.client.email}</p>
    {/if}
    {#if data.health}
      <dl class="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-slate-600 sm:grid-cols-5">
        <div>
          <dt class="text-slate-400">Lifetime revenue</dt>
          <dd class="font-medium text-slate-800">{currency(data.health.lifetime_revenue)}</dd>
        </div>
        <div>
          <dt class="text-slate-400">Lifetime orders</dt>
          <dd class="font-medium text-slate-800">{data.health.lifetime_orders}</dd>
        </div>
        <div>
          <dt class="text-slate-400">Last order</dt>
          <dd class="font-medium text-slate-800">{dateShort(data.health.last_order_at)}</dd>
        </div>
        <div>
          <dt class="text-slate-400">Open tasks</dt>
          <dd class="font-medium" class:text-amber-700={data.health.overdue_tasks > 0}>
            {data.health.open_tasks}{data.health.overdue_tasks > 0
              ? ` (${data.health.overdue_tasks} overdue)`
              : ''}
          </dd>
        </div>
        <div>
          <dt class="text-slate-400">Outstanding balance</dt>
          <dd class="font-medium" class:text-red-700={data.health.overdue_invoices > 0}>
            {currency(data.health.outstanding_balance)}
          </dd>
        </div>
      </dl>
    {/if}
  </header>

  <nav class="border-b border-slate-200">
    <ul class="flex gap-6 text-sm">
      {#each tabs as tab}
        <li>
          <a
            href={tab.href}
            class="block border-b-2 py-2 transition-colors"
            class:border-slate-900={isActive(tab)}
            class:text-slate-900={isActive(tab)}
            class:font-medium={isActive(tab)}
            class:border-transparent={!isActive(tab)}
            class:text-slate-500={!isActive(tab)}
            class:hover:text-slate-900={!isActive(tab)}
          >
            {tab.label}
          </a>
        </li>
      {/each}
    </ul>
  </nav>

  <div>{@render children()}</div>
</section>

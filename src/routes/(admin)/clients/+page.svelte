<script lang="ts">
  import { enhance } from '$app/forms';
  import { dateShort } from '$lib/format';

  let { data, form } = $props();

  let showCreate = $state(false);
  const totalPages = $derived(Math.max(1, Math.ceil(data.total / data.pageSize)));

  const lifecycleClass: Record<string, string> = {
    lead: 'bg-sky-50 text-sky-700',
    prospect: 'bg-indigo-50 text-indigo-700',
    active: 'bg-emerald-50 text-emerald-700',
    at_risk: 'bg-amber-50 text-amber-700',
    churned: 'bg-slate-200 text-slate-700'
  };
</script>

<svelte:head><title>Clients · Supply Admin</title></svelte:head>

<section class="space-y-4">
  <header class="flex items-center justify-between">
    <div>
      <h1 class="text-2xl font-semibold">Clients</h1>
      <p class="text-sm text-slate-500">{data.total} client{data.total === 1 ? '' : 's'}</p>
    </div>
    <button
      type="button"
      onclick={() => (showCreate = !showCreate)}
      class="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
    >
      {showCreate ? 'Cancel' : 'New client'}
    </button>
  </header>

  {#if showCreate}
    <form
      method="POST"
      action="?/create"
      use:enhance
      class="grid gap-3 rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-2"
    >
      {#if form?.message}
        <div class="sm:col-span-2 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">
          {form.message}
        </div>
      {/if}
      <label class="block">
        <span class="mb-1 block text-sm font-medium">Business name</span>
        <input
          type="text"
          name="business_name"
          required
          class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
        />
      </label>
      <label class="block">
        <span class="mb-1 block text-sm font-medium">Primary contact</span>
        <input
          type="text"
          name="primary_contact_name"
          class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
        />
      </label>
      <label class="block">
        <span class="mb-1 block text-sm font-medium">Email</span>
        <input
          type="email"
          name="email"
          class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
        />
      </label>
      <label class="block">
        <span class="mb-1 block text-sm font-medium">Phone</span>
        <input
          type="tel"
          name="phone"
          class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
        />
      </label>
      <div class="sm:col-span-2 flex justify-end">
        <button
          type="submit"
          class="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
        >
          Create
        </button>
      </div>
    </form>
  {/if}

  <form method="GET" class="flex flex-wrap gap-2 rounded border border-slate-200 bg-white p-3">
    <input
      type="search"
      name="q"
      placeholder="Search name or email"
      value={data.filters.search}
      class="min-w-[240px] flex-1 rounded border border-slate-300 px-2 py-1.5 text-sm"
    />
    <select name="status" class="rounded border border-slate-300 px-2 py-1.5 text-sm">
      <option value="">All statuses</option>
      <option value="active" selected={data.filters.status === 'active'}>Active</option>
      <option value="suspended" selected={data.filters.status === 'suspended'}>Suspended</option>
      <option value="archived" selected={data.filters.status === 'archived'}>Archived</option>
    </select>
    <select name="lifecycle" class="rounded border border-slate-300 px-2 py-1.5 text-sm">
      <option value="">Any lifecycle</option>
      <option value="lead" selected={data.filters.lifecycle === 'lead'}>Lead</option>
      <option value="prospect" selected={data.filters.lifecycle === 'prospect'}>Prospect</option>
      <option value="active" selected={data.filters.lifecycle === 'active'}>Active</option>
      <option value="at_risk" selected={data.filters.lifecycle === 'at_risk'}>At risk</option>
      <option value="churned" selected={data.filters.lifecycle === 'churned'}>Churned</option>
    </select>
    <select name="territory" class="rounded border border-slate-300 px-2 py-1.5 text-sm">
      <option value="">Any territory</option>
      {#each data.territories as t}
        <option value={t.id} selected={data.filters.territory === t.id}>{t.name}</option>
      {/each}
    </select>
    <select name="tag" class="rounded border border-slate-300 px-2 py-1.5 text-sm">
      <option value="">Any tag</option>
      {#each data.tagOptions as tg}
        <option value={tg.id} selected={data.filters.tag === tg.id}>{tg.name}</option>
      {/each}
    </select>
    <button
      type="submit"
      class="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
    >
      Filter
    </button>
  </form>

  <div class="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
    {#if data.clients.length === 0}
      <p class="px-4 py-10 text-center text-sm text-slate-500">No clients match these filters.</p>
    {:else}
      <table class="w-full text-sm">
        <thead class="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
          <tr>
            <th class="px-4 py-2 text-left font-medium">Business</th>
            <th class="px-4 py-2 text-left font-medium">Lifecycle</th>
            <th class="px-4 py-2 text-left font-medium">Territory</th>
            <th class="px-4 py-2 text-left font-medium">Tags</th>
            <th class="px-4 py-2 text-left font-medium">Sales rep</th>
            <th class="px-4 py-2 text-left font-medium">Status</th>
            <th class="px-4 py-2 text-right font-medium">Created</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          {#each data.clients as c}
            <tr class="hover:bg-slate-50">
              <td class="px-4 py-2">
                <a class="font-medium text-sky-700 hover:underline" href="/clients/{c.id}">
                  {c.business_name}
                </a>
                {#if c.email}
                  <p class="text-xs text-slate-500">{c.email}</p>
                {/if}
              </td>
              <td class="px-4 py-2">
                <span class="rounded px-2 py-0.5 text-xs {lifecycleClass[c.lifecycle_stage] ?? ''}">
                  {c.lifecycle_stage.replace('_', ' ')}
                </span>
              </td>
              <td class="px-4 py-2 text-slate-600">{c.territory?.name ?? '—'}</td>
              <td class="px-4 py-2">
                <div class="flex flex-wrap gap-1">
                  {#each c.tag_assignments as a}
                    {#if a.tag}
                      <span
                        class="rounded px-1.5 py-0.5 text-xs"
                        style={a.tag.color ? `background-color:${a.tag.color}20; color:${a.tag.color}` : ''}
                        class:bg-slate-100={!a.tag.color}
                        class:text-slate-700={!a.tag.color}
                      >
                        {a.tag.name}
                      </span>
                    {/if}
                  {/each}
                </div>
              </td>
              <td class="px-4 py-2 text-slate-600">{c.sales_rep?.display_name ?? '—'}</td>
              <td class="px-4 py-2">
                <span
                  class="rounded px-2 py-0.5 text-xs"
                  class:bg-emerald-50={c.status === 'active'}
                  class:text-emerald-700={c.status === 'active'}
                  class:bg-amber-50={c.status === 'suspended'}
                  class:text-amber-700={c.status === 'suspended'}
                  class:bg-slate-100={c.status === 'archived'}
                  class:text-slate-600={c.status === 'archived'}
                >
                  {c.status}
                </span>
              </td>
              <td class="px-4 py-2 text-right text-slate-500">{dateShort(c.created_at)}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
  </div>

  {#if totalPages > 1}
    <nav class="flex justify-end gap-2 text-sm">
      {#if data.page > 1}
        <a
          class="rounded border border-slate-300 px-3 py-1 hover:bg-slate-100"
          href="?{new URLSearchParams({ ...data.filters, page: String(data.page - 1) })}">
          Previous
        </a>
      {/if}
      <span class="px-2 py-1 text-slate-500">Page {data.page} of {totalPages}</span>
      {#if data.page < totalPages}
        <a
          class="rounded border border-slate-300 px-3 py-1 hover:bg-slate-100"
          href="?{new URLSearchParams({ ...data.filters, page: String(data.page + 1) })}">
          Next
        </a>
      {/if}
    </nav>
  {/if}
</section>

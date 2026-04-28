<script lang="ts">
  import { currency } from '$lib/format';

  let { data } = $props();

  const totalPages = $derived(Math.max(1, Math.ceil(data.total / data.pageSize)));

  const exportQuery = $derived(() => {
    const params = new URLSearchParams();
    if (data.filters.search) params.set('q', data.filters.search);
    if (data.filters.status) params.set('status', data.filters.status);
    if (data.filters.categoryId) params.set('category', data.filters.categoryId);
    const s = params.toString();
    return s ? `?${s}` : '';
  });
</script>

<svelte:head><title>Catalog · Supply Admin</title></svelte:head>

<section class="space-y-4">
  <header class="flex items-center justify-between">
    <div>
      <h1 class="text-2xl font-semibold">Catalog</h1>
      <p class="text-sm text-slate-500">{data.total} product{data.total === 1 ? '' : 's'}</p>
    </div>
    <div class="flex flex-wrap items-center gap-2">
      <a
        href="/catalog/import"
        class="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
      >
        Import CSV
      </a>
      <a
        href={`/catalog/export${exportQuery()}`}
        class="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
      >
        Export CSV
      </a>
      <a
        href="/catalog/new"
        class="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
      >
        New product
      </a>
    </div>
  </header>

  <form method="GET" class="flex flex-wrap gap-2 rounded border border-slate-200 bg-white p-3">
    <input
      type="search"
      name="q"
      placeholder="Search SKU or name"
      value={data.filters.search}
      class="min-w-[200px] flex-1 rounded border border-slate-300 px-2 py-1.5 text-sm"
    />
    <select
      name="status"
      class="rounded border border-slate-300 px-2 py-1.5 text-sm"
    >
      <option value="">All statuses</option>
      <option value="active" selected={data.filters.status === 'active'}>Active</option>
      <option value="archived" selected={data.filters.status === 'archived'}>Archived</option>
    </select>
    <select
      name="category"
      class="rounded border border-slate-300 px-2 py-1.5 text-sm"
    >
      <option value="">All categories</option>
      {#each data.categories as c}
        <option value={c.id} selected={c.id === data.filters.categoryId}>{c.name}</option>
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
    {#if data.products.length === 0}
      <p class="px-4 py-10 text-center text-sm text-slate-500">No products match these filters.</p>
    {:else}
      <table class="w-full text-sm">
        <thead class="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
          <tr>
            <th class="px-4 py-2 text-left font-medium">SKU</th>
            <th class="px-4 py-2 text-left font-medium">Name</th>
            <th class="px-4 py-2 text-left font-medium">Category</th>
            <th class="px-4 py-2 text-left font-medium">Manufacturer</th>
            <th class="px-4 py-2 text-right font-medium">Price</th>
            <th class="px-4 py-2 text-right font-medium">Stock</th>
            <th class="px-4 py-2 text-left font-medium">Status</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          {#each data.products as p}
            {@const stock = p.inventory?.quantity_on_hand ?? null}
            {@const low =
              stock !== null && stock <= (p.inventory?.low_stock_threshold ?? 0)}
            <tr class="hover:bg-slate-50">
              <td class="px-4 py-2 font-mono text-xs">{p.sku}</td>
              <td class="px-4 py-2">
                <a class="text-sky-700 hover:underline" href="/catalog/{p.id}">{p.name}</a>
              </td>
              <td class="px-4 py-2 text-slate-600">{p.category?.name ?? '—'}</td>
              <td class="px-4 py-2 text-slate-600">{p.manufacturer ?? '—'}</td>
              <td class="px-4 py-2 text-right">{currency(p.base_price)}</td>
              <td
                class="px-4 py-2 text-right"
                class:text-amber-700={low}
                class:font-semibold={low}
              >
                {stock ?? '—'}
              </td>
              <td class="px-4 py-2">
                <span
                  class="rounded px-2 py-0.5 text-xs"
                  class:bg-emerald-50={p.status === 'active'}
                  class:text-emerald-700={p.status === 'active'}
                  class:bg-slate-100={p.status !== 'active'}
                  class:text-slate-600={p.status !== 'active'}>{p.status}</span
                >
              </td>
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
          href="?{new URLSearchParams({ ...data.filters, page: String(data.page - 1) })}"
        >
          Previous
        </a>
      {/if}
      <span class="px-2 py-1 text-slate-500">Page {data.page} of {totalPages}</span>
      {#if data.page < totalPages}
        <a
          class="rounded border border-slate-300 px-3 py-1 hover:bg-slate-100"
          href="?{new URLSearchParams({ ...data.filters, page: String(data.page + 1) })}"
        >
          Next
        </a>
      {/if}
    </nav>
  {/if}
</section>

<script lang="ts">
  import { enhance } from '$app/forms';
  import Check from '@lucide/svelte/icons/check';
  import EyeOff from '@lucide/svelte/icons/eye-off';
  import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
  import Search from '@lucide/svelte/icons/search';
  import ShoppingCart from '@lucide/svelte/icons/shopping-cart';
  import Select from '$lib/components/Select.svelte';

  let { data, form } = $props();

  let selectedIds = $state<string[]>([]);
  let bulkScope = $state<'filtered' | 'category' | 'group' | 'all' | 'selected'>('filtered');
  let bulkOperation = $state<'allow' | 'hide' | 'buyable' | 'view_only' | 'clear'>('allow');
  let bulkCategoryId = $state('');
  let bulkGroupId = $state('');

  const selectedSet = $derived(new Set(selectedIds));
  const visibleIds = $derived(data.products.map((product) => product.id));
  const selectedVisibleCount = $derived(visibleIds.filter((id) => selectedSet.has(id)).length);
  const allVisibleSelected = $derived(
    data.products.length > 0 && selectedVisibleCount === data.products.length
  );
  const totalPages = $derived(Math.max(1, Math.ceil(data.total / data.pageSize)));
  const selectedProductsValue = $derived(selectedIds.join(','));
  const filterQuery = $derived(
    new URLSearchParams({
      ...(data.search ? { q: data.search } : {}),
      ...(data.filters.categoryId ? { category: data.filters.categoryId } : {}),
      ...(data.filters.groupId ? { group: data.filters.groupId } : {})
    }).toString()
  );

  const operationLabels = {
    allow: 'Allow viewing and buying',
    buyable: 'Make buyable',
    view_only: 'View only',
    hide: 'Hide products',
    clear: 'Clear overrides'
  };

  $effect(() => {
    if (!bulkCategoryId) bulkCategoryId = data.filters.categoryId || data.categories[0]?.id || '';
    if (!bulkGroupId) bulkGroupId = data.filters.groupId || data.groups[0]?.id || '';
  });

  function statPercent(value: number, total: number) {
    if (!total) return '0%';
    return `${Math.round((value / total) * 100)}%`;
  }

  function toggleSelected(productId: string, checked: boolean) {
    selectedIds = checked
      ? Array.from(new Set([...selectedIds, productId]))
      : selectedIds.filter((id) => id !== productId);
  }

  function toggleVisibleProducts(checked: boolean) {
    selectedIds = checked
      ? Array.from(new Set([...selectedIds, ...visibleIds]))
      : selectedIds.filter((id) => !visibleIds.includes(id));
  }

  function clearSelection() {
    selectedIds = [];
  }
</script>

<div class="space-y-5">
  {#if form?.message}
    <div class="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">
      {form.message}
    </div>
  {/if}
  {#if form?.saved}
    <div class="rounded border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
      Catalog access saved{form.affected ? ` for ${form.affected} products` : ''}.
    </div>
  {/if}

  <section class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
    <div class="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div class="text-xs font-medium uppercase text-slate-500">Active products</div>
      <div class="mt-2 text-2xl font-semibold text-slate-900">{data.summary.total}</div>
    </div>
    <div class="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div class="text-xs font-medium uppercase text-slate-500">Visible</div>
      <div class="mt-2 flex items-end gap-2">
        <span class="text-2xl font-semibold text-slate-900">{data.summary.visible}</span>
        <span class="pb-1 text-xs text-slate-500"
          >{statPercent(data.summary.visible, data.summary.total)}</span
        >
      </div>
    </div>
    <div class="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div class="text-xs font-medium uppercase text-slate-500">Buyable</div>
      <div class="mt-2 flex items-end gap-2">
        <span class="text-2xl font-semibold text-slate-900">{data.summary.buyable}</span>
        <span class="pb-1 text-xs text-slate-500"
          >{statPercent(data.summary.buyable, data.summary.total)}</span
        >
      </div>
    </div>
    <div class="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div class="text-xs font-medium uppercase text-slate-500">Overrides</div>
      <div class="mt-2 text-2xl font-semibold text-slate-900">{data.summary.overrides}</div>
    </div>
  </section>

  <section
    class="grid gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm lg:grid-cols-[minmax(260px,0.8fr)_1fr]"
  >
    <form method="POST" action="?/saveMode" use:enhance class="space-y-3">
      <div>
        <h2 class="text-base font-semibold text-slate-900">Default Access</h2>
        <p class="mt-1 text-sm text-slate-500">
          Choose what happens when a product has no explicit row for this client.
        </p>
      </div>
      <label class="block">
        <span class="mb-1 block text-sm font-medium text-slate-700">Mode</span>
        <Select name="catalog_access_mode" class="w-full">
          <option value="allowlist" selected={data.mode === 'allowlist'}>
            Assigned products only
          </option>
          <option value="all_active" selected={data.mode === 'all_active'}>
            All active except hidden
          </option>
        </Select>
      </label>
      <button
        type="submit"
        class="inline-flex items-center gap-2 rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
      >
        <Check size={16} />
        Save mode
      </button>
    </form>

    <form method="POST" action="?/bulkAccess" use:enhance class="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="q" value={data.search} />
      <input type="hidden" name="category_id" value={data.filters.categoryId} />
      <input type="hidden" name="group_id" value={data.filters.groupId} />
      <input type="hidden" name="product_ids" value={selectedProductsValue} />

      <div class="sm:col-span-2">
        <h2 class="text-base font-semibold text-slate-900">Bulk Assignment</h2>
        <p class="mt-1 text-sm text-slate-500">
          Apply one access state across a focused set of active products.
        </p>
      </div>

      <label class="block">
        <span class="mb-1 block text-sm font-medium text-slate-700">Apply to</span>
        <Select name="scope" bind:value={bulkScope} class="w-full">
          <option value="filtered">Current filtered results ({data.total})</option>
          <option value="selected">Selected rows ({selectedIds.length})</option>
          <option value="category">A category</option>
          <option value="group">A featured group</option>
          <option value="all">All active products ({data.summary.total})</option>
        </Select>
      </label>

      <label class="block">
        <span class="mb-1 block text-sm font-medium text-slate-700">Action</span>
        <Select name="operation" bind:value={bulkOperation} class="w-full">
          <option value="allow">{operationLabels.allow}</option>
          <option value="buyable">{operationLabels.buyable}</option>
          <option value="view_only">{operationLabels.view_only}</option>
          <option value="hide">{operationLabels.hide}</option>
          <option value="clear">{operationLabels.clear}</option>
        </Select>
      </label>

      {#if bulkScope === 'category'}
        <label class="block">
          <span class="mb-1 block text-sm font-medium text-slate-700">Category</span>
          <Select name="bulk_category_id" bind:value={bulkCategoryId} class="w-full">
            {#each data.categories as category}
              <option value={category.id}>
                {category.name} ({category.total})
              </option>
            {/each}
          </Select>
        </label>
      {/if}

      {#if bulkScope === 'group'}
        <label class="block">
          <span class="mb-1 block text-sm font-medium text-slate-700">Featured group</span>
          <Select name="bulk_group_id" bind:value={bulkGroupId} class="w-full">
            {#each data.groups as group}
              <option value={group.id}>
                {group.name} ({group.total})
              </option>
            {/each}
          </Select>
        </label>
      {/if}

      <div class="flex items-end gap-2 sm:col-span-2">
        <button
          type="submit"
          disabled={bulkScope === 'selected' && selectedIds.length === 0}
          class="inline-flex items-center gap-2 rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {#if bulkOperation === 'hide'}
            <EyeOff size={16} />
          {:else if bulkOperation === 'clear'}
            <RotateCcw size={16} />
          {:else if bulkOperation === 'view_only'}
            <Check size={16} />
          {:else}
            <ShoppingCart size={16} />
          {/if}
          Apply bulk action
        </button>
        {#if selectedIds.length > 0}
          <button
            type="button"
            onclick={clearSelection}
            class="rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
          >
            Clear selection
          </button>
        {/if}
      </div>
    </form>
  </section>

  <section class="grid gap-4 lg:grid-cols-2">
    <div class="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div class="border-b border-slate-100 px-4 py-3">
        <h2 class="text-base font-semibold text-slate-900">Categories</h2>
      </div>
      <div class="max-h-72 overflow-auto">
        <table class="w-full text-sm">
          <thead class="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th class="px-4 py-2 text-left font-medium">Category</th>
              <th class="px-4 py-2 text-right font-medium">Visible</th>
              <th class="px-4 py-2 text-right font-medium">Buyable</th>
              <th class="px-4 py-2 text-right font-medium">Overrides</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            {#each data.categories as category}
              <tr>
                <td class="px-4 py-2">
                  <a
                    class="font-medium text-sky-700 hover:underline"
                    href="?category={category.id}"
                  >
                    {category.name}
                  </a>
                  <div class="text-xs text-slate-500">{category.total} active</div>
                </td>
                <td class="px-4 py-2 text-right">{category.visible}</td>
                <td class="px-4 py-2 text-right">{category.buyable}</td>
                <td class="px-4 py-2 text-right">{category.overrides}</td>
              </tr>
            {:else}
              <tr
                ><td colspan="4" class="px-4 py-6 text-center text-sm text-slate-500"
                  >No categories.</td
                ></tr
              >
            {/each}
          </tbody>
        </table>
      </div>
    </div>

    <div class="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div class="border-b border-slate-100 px-4 py-3">
        <h2 class="text-base font-semibold text-slate-900">Featured Groups</h2>
      </div>
      <div class="max-h-72 overflow-auto">
        <table class="w-full text-sm">
          <thead class="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th class="px-4 py-2 text-left font-medium">Group</th>
              <th class="px-4 py-2 text-right font-medium">Visible</th>
              <th class="px-4 py-2 text-right font-medium">Buyable</th>
              <th class="px-4 py-2 text-right font-medium">Overrides</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            {#each data.groups as group}
              <tr>
                <td class="px-4 py-2">
                  <a class="font-medium text-sky-700 hover:underline" href="?group={group.id}">
                    {group.name}
                  </a>
                  <div class="text-xs text-slate-500">{group.total} active</div>
                </td>
                <td class="px-4 py-2 text-right">{group.visible}</td>
                <td class="px-4 py-2 text-right">{group.buyable}</td>
                <td class="px-4 py-2 text-right">{group.overrides}</td>
              </tr>
            {:else}
              <tr
                ><td colspan="4" class="px-4 py-6 text-center text-sm text-slate-500"
                  >No featured groups.</td
                ></tr
              >
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  </section>

  <form
    method="GET"
    class="grid gap-2 rounded-lg border border-slate-200 bg-white p-3 shadow-sm md:grid-cols-[1fr_220px_220px_auto]"
  >
    <label class="block">
      <span class="sr-only">Search</span>
      <input
        name="q"
        value={data.search}
        placeholder="Search products by SKU or name"
        class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
      />
    </label>
    <Select name="category">
      <option value="">All categories</option>
      {#each data.categories as category}
        <option value={category.id} selected={data.filters.categoryId === category.id}>
          {category.name}
        </option>
      {/each}
    </Select>
    <Select name="group">
      <option value="">All groups</option>
      {#each data.groups as group}
        <option value={group.id} selected={data.filters.groupId === group.id}>
          {group.name}
        </option>
      {/each}
    </Select>
    <button
      class="inline-flex items-center justify-center gap-2 rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
    >
      <Search size={16} />
      Filter
    </button>
  </form>

  <div class="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
    <div
      class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3"
    >
      <div>
        <h2 class="text-base font-semibold text-slate-900">Products</h2>
        <p class="text-sm text-slate-500">
          Showing {data.products.length} of {data.total}; {selectedIds.length} selected.
        </p>
      </div>
      {#if filterQuery}
        <a class="rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50" href="?">
          Reset filters
        </a>
      {/if}
    </div>

    <table class="w-full text-sm">
      <thead class="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
        <tr>
          <th class="w-10 px-4 py-2 text-left font-medium">
            <input
              type="checkbox"
              checked={allVisibleSelected}
              onchange={(e) => toggleVisibleProducts(e.currentTarget.checked)}
              class="h-4 w-4 rounded border-slate-300"
              aria-label="Select visible products"
            />
          </th>
          <th class="px-4 py-2 text-left font-medium">Product</th>
          <th class="px-4 py-2 text-left font-medium">Category</th>
          <th class="px-4 py-2 text-left font-medium">Visible</th>
          <th class="px-4 py-2 text-left font-medium">Buyable</th>
          <th class="px-4 py-2 text-right font-medium">Override</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-slate-100">
        {#each data.products as product}
          <tr class:bg-sky-50={selectedSet.has(product.id)}>
            <td class="px-4 py-2">
              <input
                type="checkbox"
                checked={selectedSet.has(product.id)}
                onchange={(e) => toggleSelected(product.id, e.currentTarget.checked)}
                class="h-4 w-4 rounded border-slate-300"
                aria-label="Select {product.name}"
              />
            </td>
            <td class="px-4 py-2">
              <div class="font-medium text-slate-900">{product.name}</div>
              <div class="font-mono text-xs text-slate-500">{product.sku}</div>
            </td>
            <td class="px-4 py-2 text-slate-600">
              {product.category?.name ?? 'Uncategorized'}
            </td>
            <td class="px-4 py-2">
              <form method="POST" action="?/setAccess" use:enhance class="flex items-center gap-2">
                <input type="hidden" name="product_id" value={product.id} />
                <input
                  type="checkbox"
                  name="can_view"
                  checked={product.can_view}
                  onchange={(e) => e.currentTarget.form?.requestSubmit()}
                  class="h-4 w-4 rounded border-slate-300"
                />
                {#if product.can_buy}
                  <input type="hidden" name="can_buy" value="on" />
                {/if}
              </form>
            </td>
            <td class="px-4 py-2">
              <form method="POST" action="?/setAccess" use:enhance class="flex items-center gap-2">
                <input type="hidden" name="product_id" value={product.id} />
                {#if product.can_view}
                  <input type="hidden" name="can_view" value="on" />
                {/if}
                <input
                  type="checkbox"
                  name="can_buy"
                  checked={product.can_buy}
                  disabled={!product.can_view}
                  onchange={(e) => e.currentTarget.form?.requestSubmit()}
                  class="h-4 w-4 rounded border-slate-300 disabled:opacity-40"
                />
              </form>
            </td>
            <td class="px-4 py-2 text-right">
              {#if product.has_override}
                <form method="POST" action="?/clearAccess" use:enhance>
                  <input type="hidden" name="product_id" value={product.id} />
                  <button
                    class="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50"
                  >
                    Clear
                  </button>
                </form>
              {:else}
                <span class="text-xs text-slate-400">Default</span>
              {/if}
            </td>
          </tr>
        {:else}
          <tr>
            <td colspan="6" class="px-4 py-10 text-center text-sm text-slate-500">
              No products found.
            </td>
          </tr>
        {/each}
      </tbody>
    </table>

    {#if totalPages > 1}
      <div class="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm">
        <span class="text-slate-500">Page {data.page} of {totalPages}</span>
        <div class="flex gap-2">
          {#if data.page > 1}
            <a
              class="rounded border border-slate-300 px-3 py-1.5 hover:bg-slate-50"
              href="?{filterQuery ? `${filterQuery}&` : ''}page={data.page - 1}"
            >
              Previous
            </a>
          {/if}
          {#if data.page < totalPages}
            <a
              class="rounded border border-slate-300 px-3 py-1.5 hover:bg-slate-50"
              href="?{filterQuery ? `${filterQuery}&` : ''}page={data.page + 1}"
            >
              Next
            </a>
          {/if}
        </div>
      </div>
    {/if}
  </div>
</div>

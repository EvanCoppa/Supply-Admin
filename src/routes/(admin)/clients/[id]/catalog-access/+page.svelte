<script lang="ts">
  import { enhance } from '$app/forms';

  let { data, form } = $props();
</script>

<div class="space-y-5">
  {#if form?.message}
    <div class="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">
      {form.message}
    </div>
  {/if}
  {#if form?.saved}
    <div class="rounded border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
      Catalog access saved.
    </div>
  {/if}

  <form
    method="POST"
    action="?/saveMode"
    use:enhance
    class="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-[1fr_auto]"
  >
    <label class="block">
      <span class="mb-1 block text-sm font-medium text-slate-700">Default catalog access</span>
      <select
        name="catalog_access_mode"
        class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
      >
        <option value="all_active" selected={data.mode === 'all_active'}>
          All active products except explicit hidden products
        </option>
        <option value="allowlist" selected={data.mode === 'allowlist'}>
          Only products explicitly allowed below
        </option>
      </select>
    </label>
    <button
      type="submit"
      class="self-end rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
    >
      Save mode
    </button>
  </form>

  <form method="GET" class="flex gap-2">
    <input
      name="q"
      value={data.search}
      placeholder="Search products by SKU or name"
      class="w-full max-w-md rounded border border-slate-300 px-2 py-1.5 text-sm"
    />
    <button class="rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50">
      Search
    </button>
  </form>

  <div class="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
    <table class="w-full text-sm">
      <thead class="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
        <tr>
          <th class="px-4 py-2 text-left font-medium">Product</th>
          <th class="px-4 py-2 text-left font-medium">Visible</th>
          <th class="px-4 py-2 text-left font-medium">Buyable</th>
          <th class="px-4 py-2 text-right font-medium">Override</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-slate-100">
        {#each data.products as product}
          <tr>
            <td class="px-4 py-2">
              <div class="font-medium text-slate-900">{product.name}</div>
              <div class="font-mono text-xs text-slate-500">{product.sku}</div>
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
                  <button class="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50">
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
            <td colspan="4" class="px-4 py-10 text-center text-sm text-slate-500">
              No products found.
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</div>

<script lang="ts">
  let { data } = $props();
</script>

<section class="space-y-4">
  <div class="flex items-center justify-between">
    <h1 class="text-2xl font-semibold">Products</h1>
    <button
      type="button"
      class="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white opacity-50"
      disabled
      title="Create product UI lands in a later commit"
    >
      New product
    </button>
  </div>

  {#if data.loadError}
    <div class="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
      Failed to load products: {data.loadError}
    </div>
  {/if}

  <div class="overflow-hidden rounded border border-slate-200 bg-white">
    <table class="w-full text-sm">
      <thead class="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
        <tr>
          <th class="px-3 py-2">SKU</th>
          <th class="px-3 py-2">Name</th>
          <th class="px-3 py-2">Manufacturer</th>
          <th class="px-3 py-2 text-right">Base price</th>
          <th class="px-3 py-2">Status</th>
        </tr>
      </thead>
      <tbody>
        {#each data.products as p (p.id)}
          <tr class="border-t border-slate-100">
            <td class="px-3 py-2 font-mono text-xs">{p.sku}</td>
            <td class="px-3 py-2">{p.name}</td>
            <td class="px-3 py-2 text-slate-600">{p.manufacturer ?? '—'}</td>
            <td class="px-3 py-2 text-right">${Number(p.base_price).toFixed(2)}</td>
            <td class="px-3 py-2">
              <span
                class="rounded-full px-2 py-0.5 text-xs {p.status === 'active'
                  ? 'bg-green-100 text-green-800'
                  : 'bg-slate-100 text-slate-600'}"
              >
                {p.status}
              </span>
            </td>
          </tr>
        {:else}
          <tr>
            <td colspan="5" class="px-3 py-6 text-center text-slate-500">
              No products yet.
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</section>

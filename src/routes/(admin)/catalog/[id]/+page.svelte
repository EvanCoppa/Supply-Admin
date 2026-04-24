<script lang="ts">
  import { enhance } from '$app/forms';
  import ProductForm from '$lib/components/ProductForm.svelte';

  let { data, form } = $props();
</script>

<svelte:head><title>{data.product.name} · Supply Admin</title></svelte:head>

<section class="space-y-5">
  <header class="flex items-center justify-between">
    <div>
      <a class="text-sm text-sky-700 hover:underline" href="/catalog">← Catalog</a>
      <h1 class="text-2xl font-semibold">{data.product.name}</h1>
      <p class="text-xs text-slate-500 font-mono">{data.product.sku}</p>
    </div>
    <div class="flex gap-2">
      <a
        href="/inventory/{data.product.id}/ledger"
        class="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
      >
        View ledger
      </a>
      {#if data.product.status === 'active'}
        <form method="POST" action="?/archive" use:enhance>
          <button
            type="submit"
            onclick={(e) => {
              if (!confirm('Archive this product?')) e.preventDefault();
            }}
            class="rounded border border-red-300 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50"
          >
            Archive
          </button>
        </form>
      {:else}
        <form method="POST" action="?/restore" use:enhance>
          <button
            type="submit"
            class="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
          >
            Restore
          </button>
        </form>
      {/if}
    </div>
  </header>

  {#if form?.message}
    <div class="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">
      {form.message}
    </div>
  {/if}
  {#if form?.saved}
    <div class="rounded border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
      Saved.
    </div>
  {/if}

  <form
    method="POST"
    action="?/save"
    use:enhance
    class="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
  >
    <ProductForm product={data.product} categories={data.categories} submitLabel="Save" />
  </form>

  <div class="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
    <h2 class="mb-3 font-semibold">Inventory</h2>
    <div class="mb-4 grid gap-3 sm:grid-cols-3 text-sm">
      <div>
        <p class="text-xs uppercase tracking-wider text-slate-500">On hand</p>
        <p class="text-lg font-semibold">{data.inventory?.quantity_on_hand ?? 0}</p>
      </div>
      <div>
        <p class="text-xs uppercase tracking-wider text-slate-500">Reserved</p>
        <p class="text-lg font-semibold">{data.inventory?.quantity_reserved ?? 0}</p>
      </div>
      <div>
        <p class="text-xs uppercase tracking-wider text-slate-500">Low-stock threshold</p>
        <p class="text-lg font-semibold">{data.inventory?.low_stock_threshold ?? 0}</p>
      </div>
    </div>

    <form method="POST" action="?/update-threshold" use:enhance class="flex items-end gap-2">
      <label class="block">
        <span class="mb-1 block text-xs font-medium text-slate-600">New threshold</span>
        <input
          type="number"
          name="low_stock_threshold"
          min="0"
          value={data.inventory?.low_stock_threshold ?? 0}
          class="w-32 rounded border border-slate-300 px-2 py-1.5 text-sm"
        />
      </label>
      <button
        type="submit"
        class="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
      >
        Update
      </button>
    </form>
    <p class="mt-2 text-xs text-slate-500">
      Stock adjustments go through the API. Open the ledger for manual adjustments.
    </p>
  </div>
</section>

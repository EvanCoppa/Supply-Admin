<script lang="ts">
  import { enhance } from '$app/forms';

  type ImportError = {
    row: number;
    sku: string;
    message: string;
  };

  type ImportResult = {
    totalRows: number;
    imported: number;
    categoriesCreated: number;
    pricesNeedingReview: number;
    inventoryRowsUpserted: number;
    errors: ImportError[];
  };

  let { form } = $props();

  const result = $derived(form?.result as ImportResult | undefined);
  const hasErrors = $derived((result?.errors.length ?? 0) > 0);
  const succeeded = $derived(Boolean(result && !hasErrors));
</script>

<svelte:head><title>Import Inventory · Supply Admin</title></svelte:head>

<section class="space-y-4">
  <header>
    <h1 class="text-2xl font-semibold">Import Inventory</h1>
    <p class="text-sm text-slate-500">
      Upload a CSV with product, SKU, category, purchase history, price, and optional stock columns.
    </p>
  </header>

  {#if form?.message}
    <div
      class="rounded border px-3 py-2 text-sm"
      class:border-emerald-300={succeeded}
      class:bg-emerald-50={succeeded}
      class:text-emerald-900={succeeded}
      class:border-red-300={hasErrors || !result}
      class:bg-red-50={hasErrors || !result}
      class:text-red-900={hasErrors || !result}
    >
      {form.message}
    </div>
  {/if}

  <form
    method="POST"
    enctype="multipart/form-data"
    use:enhance
    class="space-y-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
  >
    <label class="block">
      <span class="mb-1 block text-sm font-medium">CSV file</span>
      <input
        type="file"
        name="file"
        accept=".csv,text/csv"
        required
        class="block w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
      />
    </label>

    <div class="rounded border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
      Expected columns: Product Name, SKU, Category, Last Purchased, Total Orders, Last Purchased
      Qty, Price. Optional stock columns: Quantity On Hand, Low Stock Threshold.
    </div>

    <div class="flex justify-end">
      <button
        type="submit"
        class="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
      >
        Import CSV
      </button>
    </div>
  </form>

  {#if result}
    <div class="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h2 class="mb-3 font-semibold">Import result</h2>
      <dl class="grid gap-3 text-sm sm:grid-cols-5">
        <div>
          <dt class="text-slate-500">Rows</dt>
          <dd class="text-lg font-semibold">{result.totalRows}</dd>
        </div>
        <div>
          <dt class="text-slate-500">Imported</dt>
          <dd class="text-lg font-semibold">{result.imported}</dd>
        </div>
        <div>
          <dt class="text-slate-500">Categories</dt>
          <dd class="text-lg font-semibold">{result.categoriesCreated}</dd>
        </div>
        <div>
          <dt class="text-slate-500">Price review</dt>
          <dd class="text-lg font-semibold">{result.pricesNeedingReview}</dd>
        </div>
        <div>
          <dt class="text-slate-500">Inventory</dt>
          <dd class="text-lg font-semibold">{result.inventoryRowsUpserted}</dd>
        </div>
      </dl>

      {#if result.errors.length > 0}
        <div class="mt-4 overflow-hidden rounded border border-red-200">
          <table class="w-full text-sm">
            <thead class="bg-red-50 text-xs uppercase tracking-wider text-red-800">
              <tr>
                <th class="px-3 py-2 text-left font-medium">Row</th>
                <th class="px-3 py-2 text-left font-medium">SKU</th>
                <th class="px-3 py-2 text-left font-medium">Issue</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-red-100">
              {#each result.errors.slice(0, 50) as error}
                <tr>
                  <td class="px-3 py-2">{error.row}</td>
                  <td class="px-3 py-2 font-mono text-xs">{error.sku || '—'}</td>
                  <td class="px-3 py-2">{error.message}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </div>
  {/if}
</section>

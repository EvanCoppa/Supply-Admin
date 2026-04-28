<script lang="ts">
  import { enhance } from '$app/forms';

  let { data, form } = $props();

  const stage = $derived(form?.stage ?? 'upload');
</script>

<svelte:head><title>Import catalog · Supply Admin</title></svelte:head>

<section class="space-y-5">
  <header>
    <a class="text-sm text-sky-700 hover:underline" href="/catalog">← Catalog</a>
    <h1 class="text-2xl font-semibold">Bulk CSV import</h1>
    <p class="text-sm text-slate-500">
      Upload a CSV to create or update products. Existing SKUs are updated; new SKUs are created.
    </p>
  </header>

  {#if stage === 'committed'}
    <div class="rounded border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
      <p class="font-medium">{form?.message}</p>
      <p class="mt-1">
        <a class="text-emerald-800 underline" href="/catalog">Back to catalog</a>
      </p>
    </div>
  {/if}

  {#if stage === 'upload' || stage === 'committed'}
    <form
      method="POST"
      action="?/preview"
      enctype="multipart/form-data"
      use:enhance
      class="space-y-3 rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
    >
      {#if stage === 'upload' && form?.message}
        <div class="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">
          {form.message}
        </div>
      {/if}

      <div>
        <label class="block text-sm font-medium text-slate-700" for="csv-input">CSV file</label>
        <input
          id="csv-input"
          type="file"
          name="csv"
          accept=".csv,text/csv"
          required
          class="mt-1 block text-sm"
        />
      </div>

      <div class="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
        <p class="mb-1 font-semibold">Expected columns</p>
        <p class="font-mono break-all">
          {data.columns.join(',')}
        </p>
        <p class="mt-1">
          Required: <span class="font-mono">{data.requiredColumns.join(', ')}</span>.
          <span class="font-mono">category</span> matches by name or slug.
          <span class="font-mono">status</span> defaults to
          <span class="font-mono">active</span>.
        </p>
      </div>

      <button
        type="submit"
        class="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
      >
        Parse &amp; preview
      </button>
    </form>
  {/if}

  {#if stage === 'preview' && form && 'message' in form && form.message}
    <div class="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">
      {form.message}
    </div>
  {/if}

  {#if stage === 'preview' && form && form.summary && form.previews}
    {@const summary = form.summary}
    {@const previews = form.previews}
    <div class="grid gap-3 sm:grid-cols-4">
      <div class="rounded border border-slate-200 bg-white p-3 text-sm">
        <p class="text-xs uppercase tracking-wider text-slate-500">Rows</p>
        <p class="text-lg font-semibold">{summary.total}</p>
      </div>
      <div class="rounded border border-emerald-200 bg-emerald-50 p-3 text-sm">
        <p class="text-xs uppercase tracking-wider text-emerald-700">Valid</p>
        <p class="text-lg font-semibold text-emerald-800">{summary.valid}</p>
        <p class="text-xs text-emerald-700">
          {summary.toCreate} new · {summary.toUpdate} update
        </p>
      </div>
      <div class="rounded border border-red-200 bg-red-50 p-3 text-sm">
        <p class="text-xs uppercase tracking-wider text-red-700">Errors</p>
        <p class="text-lg font-semibold text-red-800">{summary.errors}</p>
      </div>
      <div class="flex items-center justify-end gap-2">
        <a
          href="/catalog/import"
          class="rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100"
        >
          Cancel
        </a>
        <form method="POST" action="?/commit" use:enhance>
          <input type="hidden" name="payload" value={JSON.stringify(form.payload)} />
          <button
            type="submit"
            disabled={summary.valid === 0}
            class="rounded bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
            onclick={(e) => {
              if (
                !confirm(
                  `Import ${summary.valid} row${summary.valid === 1 ? '' : 's'}? ` +
                    `This creates ${summary.toCreate} and updates ${summary.toUpdate}.`
                )
              )
                e.preventDefault();
            }}
          >
            Commit {summary.valid} row{summary.valid === 1 ? '' : 's'}
          </button>
        </form>
      </div>
    </div>

    <div class="overflow-auto rounded-lg border border-slate-200 bg-white shadow-sm">
      <table class="w-full text-sm">
        <thead class="sticky top-0 bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
          <tr>
            <th class="px-3 py-2 text-left font-medium">Row</th>
            <th class="px-3 py-2 text-left font-medium">Status</th>
            <th class="px-3 py-2 text-left font-medium">SKU</th>
            <th class="px-3 py-2 text-left font-medium">Name</th>
            <th class="px-3 py-2 text-left font-medium">Category</th>
            <th class="px-3 py-2 text-right font-medium">Price</th>
            <th class="px-3 py-2 text-left font-medium">Errors</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          {#each previews as row (row.rowNumber)}
            <tr
              class:bg-red-50={row.errors.length > 0}
              class:bg-amber-50={row.errors.length === 0 && row.exists}
            >
              <td class="px-3 py-2 font-mono text-xs text-slate-500">{row.rowNumber}</td>
              <td class="px-3 py-2">
                {#if row.errors.length > 0}
                  <span
                    class="rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800"
                  >
                    error
                  </span>
                {:else if row.exists}
                  <span
                    class="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800"
                  >
                    update
                  </span>
                {:else}
                  <span
                    class="rounded bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800"
                  >
                    create
                  </span>
                {/if}
              </td>
              <td class="px-3 py-2 font-mono text-xs">{row.raw.sku ?? ''}</td>
              <td class="px-3 py-2">{row.raw.name ?? ''}</td>
              <td class="px-3 py-2 text-slate-600">{row.raw.category ?? ''}</td>
              <td class="px-3 py-2 text-right">{row.raw.base_price ?? ''}</td>
              <td class="px-3 py-2 text-xs text-red-800">
                {#if row.errors.length > 0}
                  <ul class="list-disc space-y-0.5 pl-4">
                    {#each row.errors as e}
                      <li>{e}</li>
                    {/each}
                  </ul>
                {:else}
                  —
                {/if}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</section>

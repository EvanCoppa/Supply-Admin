<script lang="ts">
  import { enhance } from '$app/forms';
  import ProductForm from '$lib/components/ProductForm.svelte';
  import Breadcrumbs from '$lib/components/Breadcrumbs.svelte';
  import Select from '$lib/components/Select.svelte';
  import { dateTime } from '$lib/format';

  let { data, form } = $props();
</script>

<svelte:head><title>{data.product.name} · Supply Admin</title></svelte:head>

<section class="space-y-5">
  <header class="flex items-center justify-between">
    <div class="space-y-2">
      <Breadcrumbs items={[{ label: 'Catalog', href: '/catalog' }, { label: data.product.name }]} />
      <h1 class="text-2xl font-semibold">{data.product.name}</h1>
      <p class="text-xs text-slate-500 font-mono">{data.product.sku}</p>
    </div>
    <div class="flex gap-2">
      {#if data.watchlistItem}
        <form method="POST" action="?/unwatch" use:enhance>
          <button
            type="submit"
            class="rounded border border-amber-300 px-3 py-1.5 text-sm text-amber-800 bg-amber-50 hover:bg-amber-100"
          >
            ★ Watching
          </button>
        </form>
      {:else}
        <form method="POST" action="?/watch" use:enhance>
          <button
            type="submit"
            class="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
          >
            + Watch
          </button>
        </form>
      {/if}
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

  <div class="grid gap-5 lg:grid-cols-[240px_1fr]">
    <div class="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h2 class="mb-3 font-semibold">Preview image</h2>
      {#if data.productImageUrl}
        <img
          src={data.productImageUrl}
          alt="{data.product.name} preview"
          class="aspect-square w-full rounded border border-slate-200 object-cover"
        />
        <form method="POST" action="?/delete-image" use:enhance class="mt-3">
          <button
            type="submit"
            onclick={(e) => {
              if (!confirm('Remove this product image?')) e.preventDefault();
            }}
            class="w-full rounded border border-red-300 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50"
          >
            Remove image
          </button>
        </form>
      {:else}
        <div
          class="flex aspect-square w-full items-center justify-center rounded border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-500"
        >
          No image
        </div>
      {/if}
    </div>

    <form
      method="POST"
      action="?/save"
      enctype="multipart/form-data"
      use:enhance
      class="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
    >
      <ProductForm
        product={data.product}
        categories={data.categories}
        fieldErrors={form?.fieldErrors ?? {}}
        submitLabel="Save"
      />
    </form>
  </div>

  <div class="grid gap-5 lg:grid-cols-2">
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
    </div>

    <div class="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h2 class="mb-3 font-semibold">Manual adjustment</h2>
      <p class="mb-3 text-xs text-slate-500">
        Writes through the API with the current admin as actor.
      </p>

      {#if form?.message}
        <div class="mb-3 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">
          {form.message}
        </div>
      {/if}
      {#if form?.saved}
        <div
          class="mb-3 rounded border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-900"
        >
          Adjustment recorded.
        </div>
      {/if}

      <form method="POST" action="?/adjust" use:enhance class="grid gap-3 sm:grid-cols-4">
        <label class="block">
          <span class="mb-1 block text-xs font-medium">Delta (±)</span>
          <input
            type="number"
            name="delta"
            required
            class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
          />
        </label>
        <label class="block">
          <span class="mb-1 block text-xs font-medium">Reason</span>
          <Select name="reason" required class="w-full">
            {#each data.reasons as r}
              <option value={r}>{r}</option>
            {/each}
          </Select>
        </label>
        <label class="block sm:col-span-2">
          <span class="mb-1 block text-xs font-medium">Notes</span>
          <input
            type="text"
            name="notes"
            class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
          />
        </label>
        <div class="sm:col-span-4 flex justify-end">
          <button
            type="submit"
            class="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
          >
            Record adjustment
          </button>
        </div>
      </form>
    </div>
  </div>

  <div class="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
    <div class="border-b border-slate-200 px-4 py-3">
      <h2 class="font-semibold">Ledger</h2>
    </div>
    {#if data.ledger.length === 0}
      <p class="px-4 py-10 text-center text-sm text-slate-500">No ledger entries yet.</p>
    {:else}
      <table class="w-full text-sm">
        <thead class="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
          <tr>
            <th class="px-4 py-2 text-left font-medium">When</th>
            <th class="px-4 py-2 text-right font-medium">Delta</th>
            <th class="px-4 py-2 text-left font-medium">Reason</th>
            <th class="px-4 py-2 text-left font-medium">Order</th>
            <th class="px-4 py-2 text-left font-medium">Actor</th>
            <th class="px-4 py-2 text-left font-medium">Notes</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          {#each data.ledger as entry}
            <tr class="hover:bg-slate-50">
              <td class="px-4 py-2 text-slate-500">{dateTime(entry.created_at)}</td>
              <td
                class="px-4 py-2 text-right font-semibold"
                class:text-emerald-700={entry.delta > 0}
                class:text-red-700={entry.delta < 0}
              >
                {entry.delta > 0 ? '+' : ''}{entry.delta}
              </td>
              <td class="px-4 py-2">{entry.reason}</td>
              <td class="px-4 py-2">
                {#if entry.order_id}
                  <a class="text-sky-700 hover:underline" href="/orders/{entry.order_id}">Order</a>
                {:else}
                  —
                {/if}
              </td>
              <td class="px-4 py-2 font-mono text-xs text-slate-500">
                {entry.actor_id ? entry.actor_id.slice(0, 8) : '—'}
              </td>
              <td class="px-4 py-2 text-slate-600">{entry.notes ?? ''}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
  </div>
</section>

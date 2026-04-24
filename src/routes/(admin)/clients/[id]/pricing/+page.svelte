<script lang="ts">
  import { enhance } from '$app/forms';
  import { currency, dateShort } from '$lib/format';

  let { data, form } = $props();

  let scope = $state<'product' | 'category'>('product');
  let overrideType = $state<'absolute_price' | 'percent_discount'>('percent_discount');
</script>

<div class="space-y-5">
  {#if form?.message}
    <div class="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">
      {form.message}
    </div>
  {/if}

  <form
    method="POST"
    action="?/create"
    use:enhance
    class="grid gap-3 rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-3"
  >
    <p class="sm:col-span-3 font-semibold">New pricing rule</p>

    <label class="block">
      <span class="mb-1 block text-xs font-medium">Scope</span>
      <select
        name="scope"
        bind:value={scope}
        class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
      >
        <option value="product">Product</option>
        <option value="category">Category</option>
      </select>
    </label>

    {#if scope === 'product'}
      <label class="block sm:col-span-2">
        <span class="mb-1 block text-xs font-medium">Product</span>
        <select
          name="product_id"
          class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
        >
          <option value="">— Select —</option>
          {#each data.products as p}
            <option value={p.id}>{p.sku} · {p.name}</option>
          {/each}
        </select>
      </label>
    {:else}
      <label class="block sm:col-span-2">
        <span class="mb-1 block text-xs font-medium">Category</span>
        <select
          name="category_id"
          class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
        >
          <option value="">— Select —</option>
          {#each data.categories as c}
            <option value={c.id}>{c.name}</option>
          {/each}
        </select>
      </label>
    {/if}

    <label class="block">
      <span class="mb-1 block text-xs font-medium">Override type</span>
      <select
        name="override_type"
        bind:value={overrideType}
        class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
      >
        <option value="percent_discount">Percent discount</option>
        <option value="absolute_price">Absolute price</option>
      </select>
    </label>

    {#if overrideType === 'absolute_price'}
      <label class="block">
        <span class="mb-1 block text-xs font-medium">Absolute price (USD)</span>
        <input
          type="number"
          step="0.01"
          min="0"
          name="absolute_price"
          class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
        />
      </label>
    {:else}
      <label class="block">
        <span class="mb-1 block text-xs font-medium">Percent discount</span>
        <input
          type="number"
          step="0.01"
          min="0"
          max="100"
          name="percent_discount"
          class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
        />
      </label>
    {/if}

    <label class="block">
      <span class="mb-1 block text-xs font-medium">Effective start</span>
      <input
        type="datetime-local"
        name="effective_start"
        class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
      />
    </label>
    <label class="block">
      <span class="mb-1 block text-xs font-medium">Effective end</span>
      <input
        type="datetime-local"
        name="effective_end"
        class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
      />
    </label>
    <div class="sm:col-span-3 flex justify-end">
      <button
        type="submit"
        class="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
      >
        Create rule
      </button>
    </div>
  </form>

  <div class="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
    <h2 class="mb-2 font-semibold">Price preview</h2>
    <form method="POST" action="?/preview" use:enhance class="flex flex-wrap items-end gap-2">
      <label class="block">
        <span class="mb-1 block text-xs font-medium">Product</span>
        <select
          name="product_id"
          class="min-w-[260px] rounded border border-slate-300 px-2 py-1.5 text-sm"
        >
          {#each data.products as p}
            <option value={p.id} selected={p.id === form?.previewProductId}>
              {p.sku} · {p.name}
            </option>
          {/each}
        </select>
      </label>
      <button
        type="submit"
        class="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
      >
        Resolve
      </button>
      {#if form?.resolvedPrice !== undefined}
        <span class="ml-3 text-sm text-slate-700">
          Resolved price: <span class="font-semibold">{currency(form.resolvedPrice)}</span>
        </span>
      {/if}
    </form>
  </div>

  <div class="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
    <div class="border-b border-slate-200 px-4 py-3">
      <h2 class="font-semibold">Rules</h2>
    </div>
    {#if data.rules.length === 0}
      <p class="px-4 py-10 text-center text-sm text-slate-500">No rules yet.</p>
    {:else}
      <table class="w-full text-sm">
        <thead class="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
          <tr>
            <th class="px-4 py-2 text-left font-medium">Scope</th>
            <th class="px-4 py-2 text-left font-medium">Target</th>
            <th class="px-4 py-2 text-left font-medium">Override</th>
            <th class="px-4 py-2 text-left font-medium">Window</th>
            <th class="px-4 py-2"></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          {#each data.rules as r}
            <tr>
              <td class="px-4 py-2">{r.scope}</td>
              <td class="px-4 py-2">
                {#if r.scope === 'product'}
                  <span class="font-mono text-xs text-slate-500">{r.product?.sku ?? ''}</span>
                  {r.product?.name ?? '—'}
                {:else}
                  {r.category?.name ?? '—'}
                {/if}
              </td>
              <td class="px-4 py-2">
                {#if r.override_type === 'absolute_price'}
                  {currency(r.absolute_price)}
                {:else}
                  {r.percent_discount}% off
                {/if}
              </td>
              <td class="px-4 py-2 text-slate-500">
                {dateShort(r.effective_start)} → {dateShort(r.effective_end)}
              </td>
              <td class="px-4 py-2 text-right">
                <form method="POST" action="?/delete" use:enhance>
                  <input type="hidden" name="id" value={r.id} />
                  <button
                    type="submit"
                    onclick={(e) => {
                      if (!confirm('Delete this rule?')) e.preventDefault();
                    }}
                    class="rounded border border-red-300 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                  >
                    Delete
                  </button>
                </form>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
  </div>
</div>

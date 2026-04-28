<script lang="ts">
  import type { Product } from '$lib/types/db';

  type ProductLike = Partial<{
    [K in keyof Product]: Product[K] | null;
  }>;

  interface Props {
    product?: ProductLike;
    categories: Array<{ id: string; name: string }>;
    submitLabel?: string;
  }

  let { product = {}, categories, submitLabel = 'Save' }: Props = $props();
</script>

<div class="grid gap-4 sm:grid-cols-2">
  <label class="block">
    <span class="mb-1 block text-sm font-medium">SKU</span>
    <input
      type="text"
      name="sku"
      required
      value={product.sku ?? ''}
      class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
    />
  </label>
  <label class="block">
    <span class="mb-1 block text-sm font-medium">Name</span>
    <input
      type="text"
      name="name"
      required
      value={product.name ?? ''}
      class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
    />
  </label>
  <label class="block sm:col-span-2">
    <span class="mb-1 block text-sm font-medium">Description</span>
    <textarea
      name="description"
      rows="3"
      class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
      >{product.description ?? ''}</textarea
    >
  </label>
  <label class="block">
    <span class="mb-1 block text-sm font-medium">Category</span>
    <select
      name="category_id"
      class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
    >
      <option value="">— None —</option>
      {#each categories as c}
        <option value={c.id} selected={c.id === product.category_id}>{c.name}</option>
      {/each}
    </select>
  </label>
  <label class="block">
    <span class="mb-1 block text-sm font-medium">Manufacturer</span>
    <input
      type="text"
      name="manufacturer"
      value={product.manufacturer ?? ''}
      class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
    />
  </label>
  <label class="block">
    <span class="mb-1 block text-sm font-medium">Unit of measure</span>
    <input
      type="text"
      name="unit_of_measure"
      value={product.unit_of_measure ?? ''}
      class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
    />
  </label>
  <label class="block">
    <span class="mb-1 block text-sm font-medium">Pack size</span>
    <input
      type="number"
      name="pack_size"
      min="1"
      value={product.pack_size ?? ''}
      class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
    />
  </label>
  <label class="block">
    <span class="mb-1 block text-sm font-medium">Base price (USD)</span>
    <input
      type="number"
      name="base_price"
      step="0.01"
      min="0"
      required
      value={product.base_price ?? ''}
      class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
    />
  </label>
  <label class="block">
    <span class="mb-1 block text-sm font-medium">Tax class</span>
    <input
      type="text"
      name="tax_class"
      value={product.tax_class ?? ''}
      class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
    />
  </label>
  <label class="block">
    <span class="mb-1 block text-sm font-medium">Weight (grams)</span>
    <input
      type="number"
      name="weight_grams"
      min="0"
      value={product.weight_grams ?? ''}
      class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
    />
  </label>
  <label class="block">
    <span class="mb-1 block text-sm font-medium">Status</span>
    <select
      name="status"
      class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
    >
      <option value="active" selected={product.status !== 'archived'}>Active</option>
      <option value="archived" selected={product.status === 'archived'}>Archived</option>
    </select>
  </label>
</div>

<div class="mt-4 flex justify-end">
  <button
    type="submit"
    class="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
  >
    {submitLabel}
  </button>
</div>

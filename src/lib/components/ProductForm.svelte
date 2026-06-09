<script lang="ts">
  import { calculateSalePrice } from '$lib/utils';
  import type { Product } from '$lib/types/db';
  import Select from '$lib/components/Select.svelte';

  type ProductLike = Partial<{
    [K in keyof Product]: Product[K] | null;
  }>;

  interface Props {
    product?: ProductLike;
    categories: { id: string; name: string }[];
    submitLabel?: string;
    cancelHref?: string;
    fieldErrors?: Record<string, string[]>;
  }

  let {
    product = {},
    categories,
    submitLabel = 'Save',
    cancelHref = '/catalog',
    fieldErrors = {}
  }: Props = $props();

  let unitCost = $state(product.unit_cost ?? 0);
  let markupPercent = $state(40);

  const derivedSalePrice = $derived(calculateSalePrice(unitCost, markupPercent));
  const imageError = $derived(fieldErrors['image']?.[0]);
</script>

<div class="space-y-4">
  <div class="space-y-3 rounded-lg border border-slate-200 bg-white p-4 text-sm shadow-sm">
    <h2 class="font-semibold">Details</h2>
    <div class="grid gap-3 sm:grid-cols-2">
      <label class="block">
        <span class="mb-1 block text-xs font-medium text-slate-600">SKU</span>
        <input
          type="text"
          name="sku"
          required
          value={product.sku ?? ''}
          class="w-full rounded border border-slate-300 px-2 py-1.5"
        />
      </label>
      <label class="block">
        <span class="mb-1 block text-xs font-medium text-slate-600">Barcode</span>
        <input
          type="text"
          name="barcode"
          value={product.barcode ?? ''}
          class="w-full rounded border border-slate-300 px-2 py-1.5"
        />
      </label>
    </div>
    <label class="block">
      <span class="mb-1 block text-xs font-medium text-slate-600">Name</span>
      <input
        type="text"
        name="name"
        required
        value={product.name ?? ''}
        class="w-full rounded border border-slate-300 px-2 py-1.5"
      />
    </label>
    <label class="block">
      <span class="mb-1 block text-xs font-medium text-slate-600">Description</span>
      <textarea
        name="description"
        rows="3"
        class="w-full rounded border border-slate-300 px-2 py-1.5"
        >{product.description ?? ''}</textarea
      >
    </label>
    <div class="grid gap-3 sm:grid-cols-2">
      <label class="block">
        <span class="mb-1 block text-xs font-medium text-slate-600">Category</span>
        <Select name="category_id" class="w-full">
          <option value="">— None —</option>
          {#each categories as c}
            <option value={c.id} selected={c.id === product.category_id}>{c.name}</option>
          {/each}
        </Select>
      </label>
      <label class="block">
        <span class="mb-1 block text-xs font-medium text-slate-600">Manufacturer</span>
        <input
          type="text"
          name="manufacturer"
          value={product.manufacturer ?? ''}
          class="w-full rounded border border-slate-300 px-2 py-1.5"
        />
      </label>
    </div>
  </div>

  <div class="space-y-3 rounded-lg border border-slate-200 bg-white p-4 text-sm shadow-sm">
    <h2 class="font-semibold">Pricing &amp; sizing</h2>
    <div class="grid gap-3 sm:grid-cols-3">
      <label class="block">
        <span class="mb-1 block text-xs font-medium text-slate-600">Unit cost (USD)</span>
        <input
          type="number"
          name="unit_cost"
          step="0.01"
          min="0"
          required
          bind:value={unitCost}
          class="w-full rounded border border-slate-300 px-2 py-1.5"
        />
      </label>
      <label class="block">
        <span class="mb-1 block text-xs font-medium text-slate-600">Markup (%)</span>
        <input
          type="number"
          bind:value={markupPercent}
          min="0"
          step="1"
          class="w-full rounded border border-slate-300 px-2 py-1.5"
        />
        <p class="mt-0.5 text-xs text-slate-500">Default: 40%</p>
      </label>
      <label class="block">
        <span class="mb-1 block text-xs font-medium text-slate-600">Sale price (USD)</span>
        <input
          type="number"
          name="base_price"
          value={derivedSalePrice}
          step="1"
          min="0"
          readonly
          class="w-full rounded border border-slate-300 bg-slate-50 px-2 py-1.5 text-slate-600"
        />
        <p class="mt-0.5 text-xs text-slate-500">Auto-calculated from cost + markup, rounded to nearest dollar</p>
      </label>
      <label class="block">
        <span class="mb-1 block text-xs font-medium text-slate-600">Tax class</span>
        <input
          type="text"
          name="tax_class"
          value={product.tax_class ?? ''}
          class="w-full rounded border border-slate-300 px-2 py-1.5"
        />
      </label>
      <label class="block">
        <span class="mb-1 block text-xs font-medium text-slate-600">Unit of measure</span>
        <input
          type="text"
          name="unit_of_measure"
          value={product.unit_of_measure ?? ''}
          class="w-full rounded border border-slate-300 px-2 py-1.5"
        />
      </label>
      <label class="block">
        <span class="mb-1 block text-xs font-medium text-slate-600">Pack size</span>
        <input
          type="number"
          name="pack_size"
          min="1"
          value={product.pack_size ?? ''}
          class="w-full rounded border border-slate-300 px-2 py-1.5"
        />
      </label>
      <label class="block">
        <span class="mb-1 block text-xs font-medium text-slate-600">Weight (grams)</span>
        <input
          type="number"
          name="weight_grams"
          min="0"
          value={product.weight_grams ?? ''}
          class="w-full rounded border border-slate-300 px-2 py-1.5"
        />
      </label>
    </div>
  </div>

  <div class="space-y-3 rounded-lg border border-slate-200 bg-white p-4 text-sm shadow-sm">
    <h2 class="font-semibold">Status &amp; image</h2>
    <div class="grid gap-3 sm:grid-cols-2">
      <label class="block">
        <span class="mb-1 block text-xs font-medium text-slate-600">Status</span>
        <Select name="status" class="w-full">
          <option value="active" selected={product.status !== 'archived'}>Active</option>
          <option value="archived" selected={product.status === 'archived'}>Archived</option>
        </Select>
      </label>
    </div>
    <label class="block">
      <span class="mb-1 block text-xs font-medium text-slate-600">Preview image</span>
      <input
        type="file"
        name="image"
        accept="image/jpeg,image/png,image/webp,image/avif"
        class="w-full rounded border border-slate-300 px-2 py-1.5 file:mr-3 file:rounded file:border-0 file:bg-slate-100 file:px-3 file:py-1 file:text-sm file:font-medium file:text-slate-700"
        aria-invalid={imageError ? 'true' : undefined}
        aria-describedby={imageError ? 'product-image-error' : 'product-image-help'}
      />
      {#if imageError}
        <p id="product-image-error" class="mt-1 text-xs text-red-700">{imageError}</p>
      {:else}
        <p id="product-image-help" class="mt-1 text-xs text-slate-500">
          JPEG, PNG, WebP, or AVIF up to 10 MB.
        </p>
      {/if}
    </label>
  </div>

  <div class="flex gap-2">
    <a
      href={cancelHref}
      class="flex-1 rounded border border-slate-300 px-3 py-2 text-center text-sm text-slate-700 hover:bg-slate-100"
    >
      Cancel
    </a>
    <button
      type="submit"
      class="flex-1 rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
    >
      {submitLabel}
    </button>
  </div>
</div>

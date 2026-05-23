<script lang="ts">
  import type { Product } from '$lib/types/db';
  import { Button, Field, Input, Select, Textarea } from '$lib/components/ui';

  type ProductLike = Partial<{
    [K in keyof Product]: Product[K] | null;
  }>;

  interface Props {
    product?: ProductLike;
    categories: Array<{ id: string; name: string }>;
    submitLabel?: string;
    fieldErrors?: Record<string, string[]>;
  }

  let { product = {}, categories, submitLabel = 'Save', fieldErrors = {} }: Props = $props();

  const imageError = $derived(fieldErrors.image?.[0]);
</script>

<div class="grid gap-4 sm:grid-cols-2">
  <Field label="SKU">
    <Input type="text" name="sku" required value={product.sku ?? ''} />
  </Field>
  <Field label="Name">
    <Input type="text" name="name" required value={product.name ?? ''} />
  </Field>
  <Field label="Description" class="sm:col-span-2">
    <Textarea name="description" rows={3} value={product.description ?? ''} />
  </Field>
  <Field label="Category">
    <Select name="category_id">
      <option value="">— None —</option>
      {#each categories as c}
        <option value={c.id} selected={c.id === product.category_id}>{c.name}</option>
      {/each}
    </Select>
  </Field>
  <Field label="Manufacturer">
    <Input type="text" name="manufacturer" value={product.manufacturer ?? ''} />
  </Field>
  <Field label="Unit of measure">
    <Input type="text" name="unit_of_measure" value={product.unit_of_measure ?? ''} />
  </Field>
  <Field label="Pack size">
    <Input type="number" name="pack_size" min={1} value={product.pack_size ?? ''} />
  </Field>
  <Field label="Base price (USD)">
    <Input
      type="number"
      name="base_price"
      step={0.01}
      min={0}
      required
      value={product.base_price ?? ''}
    />
  </Field>
  <Field label="Tax class">
    <Input type="text" name="tax_class" value={product.tax_class ?? ''} />
  </Field>
  <Field label="Weight (grams)">
    <Input type="number" name="weight_grams" min={0} value={product.weight_grams ?? ''} />
  </Field>
  <Field label="Status">
    <Select name="status">
      <option value="active" selected={product.status !== 'archived'}>Active</option>
      <option value="archived" selected={product.status === 'archived'}>Archived</option>
    </Select>
  </Field>
  <Field
    label="Preview image"
    class="sm:col-span-2"
    error={imageError}
    help="JPEG, PNG, or WebP up to 10 MB."
  >
    <input
      type="file"
      name="image"
      accept="image/jpeg,image/png,image/webp"
      class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm file:mr-3 file:rounded file:border-0 file:bg-slate-100 file:px-3 file:py-1 file:text-sm file:font-medium file:text-slate-700"
      aria-invalid={imageError ? 'true' : undefined}
    />
  </Field>
</div>

<div class="mt-4 flex justify-end">
  <Button type="submit">{submitLabel}</Button>
</div>

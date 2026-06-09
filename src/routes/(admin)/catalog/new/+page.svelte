<script lang="ts">
  import { enhance } from '$app/forms';
  import ProductForm from '$lib/components/ProductForm.svelte';
  import ScanModal from '$lib/components/ScanModal.svelte';
  import Breadcrumbs from '$lib/components/Breadcrumbs.svelte';
  import { Camera } from '@lucide/svelte';
  import type { Product } from '$lib/types/db';

  let { data, form } = $props();

  let scanOpen = $state(false);
  let formData = $state<Partial<Product>>(form?.payload ?? {});

  function handleScan(product: Partial<Product>) {
    formData = {
      ...formData,
      barcode: product.barcode,
      name: product.name || formData.name,
      description: product.description || formData.description
    };
    scanOpen = false;
  }
</script>

<svelte:head><title>New product · Supply Admin</title></svelte:head>

<section class="space-y-5">
  <Breadcrumbs items={[{ label: 'Catalog', href: '/catalog' }, { label: 'New product' }]} />

  {#if form?.message}
    <div class="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">
      {form.message}
    </div>
  {/if}

  <div class="mx-auto max-w-5xl">
    <div class="mb-3 flex gap-2">
      <button
        type="button"
        onclick={() => (scanOpen = true)}
        class="flex items-center gap-2 rounded border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
      >
        <Camera class="size-4" />
        Scan product
      </button>
    </div>

    <form method="POST" enctype="multipart/form-data" use:enhance>
      <ProductForm
        product={formData}
        categories={data.categories}
        fieldErrors={form?.fieldErrors ?? {}}
        submitLabel="Create product"
        cancelHref="/catalog"
      />
    </form>
  </div>

  <ScanModal {scanOpen} onSelect={handleScan} />
</section>

<script lang="ts">
  import { enhance } from '$app/forms';
  import ProductForm from '$lib/components/ProductForm.svelte';
  import Breadcrumbs from '$lib/components/Breadcrumbs.svelte';

  let { data, form } = $props();
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
    <form method="POST" enctype="multipart/form-data" use:enhance>
      <ProductForm
        product={form?.payload ?? {}}
        categories={data.categories}
        fieldErrors={form?.fieldErrors ?? {}}
        submitLabel="Create product"
        cancelHref="/catalog"
      />
    </form>
  </div>
</section>

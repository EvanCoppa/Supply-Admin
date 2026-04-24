<script lang="ts">
  import { enhance } from '$app/forms';
  import ProductForm from '$lib/components/ProductForm.svelte';

  let { data, form } = $props();
</script>

<svelte:head><title>New product · Supply Admin</title></svelte:head>

<section class="space-y-4">
  <header>
    <a class="text-sm text-sky-700 hover:underline" href="/catalog">← Catalog</a>
    <h1 class="text-2xl font-semibold">New product</h1>
  </header>

  {#if form?.message}
    <div class="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">
      {form.message}
    </div>
  {/if}

  <form
    method="POST"
    use:enhance
    class="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
  >
    <ProductForm product={form?.payload ?? {}} categories={data.categories} submitLabel="Create" />
  </form>
</section>

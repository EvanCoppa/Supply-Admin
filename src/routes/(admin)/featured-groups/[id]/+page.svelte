<script lang="ts">
  import { enhance } from '$app/forms';
  import Breadcrumbs from '$lib/components/Breadcrumbs.svelte';
  import ProductPicker from '$lib/components/ProductPicker.svelte';

  let { data, form } = $props();
  let g = $derived(data.group);
</script>

<svelte:head><title>{g.name} · Featured Group</title></svelte:head>

<section class="space-y-5">
  <header class="space-y-2">
    <Breadcrumbs
      items={[
        { label: 'Featured Groups', href: '/featured-groups' },
        { label: g.name }
      ]}
    />
    <h1 class="text-2xl font-semibold">{g.name}</h1>
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

  <form
    method="POST"
    action="?/save"
    use:enhance
    class="grid gap-3 rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-3"
  >
    <label class="block">
      <span class="mb-1 block text-sm font-medium">Name</span>
      <input
        name="name"
        required
        value={g.name}
        class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
      />
    </label>
    <label class="block sm:col-span-2">
      <span class="mb-1 block text-sm font-medium">Description</span>
      <input
        name="description"
        value={g.description ?? ''}
        class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
      />
    </label>
    <div class="sm:col-span-3 flex justify-end">
      <button
        type="submit"
        class="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
      >
        Save
      </button>
    </div>
  </form>

  <div class="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
    <div class="mb-3 flex items-center justify-between">
      <h2 class="font-semibold">Products in group</h2>
      <span class="text-xs text-slate-500">{data.productIds.length} selected</span>
    </div>
    <form method="POST" action="?/saveProducts" use:enhance class="space-y-3">
      <ProductPicker
        products={data.allProducts}
        name="product_ids"
        initial={data.productIds}
      />
      <div class="flex justify-end">
        <button
          type="submit"
          class="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
        >
          Save products
        </button>
      </div>
    </form>
  </div>
</section>

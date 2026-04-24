<script lang="ts">
  import { enhance } from '$app/forms';

  let { data, form } = $props();
  let g = $derived(data.group);
</script>

<svelte:head><title>{g.name} · Featured Group</title></svelte:head>

<section class="space-y-5">
  <header>
    <a class="text-sm text-sky-700 hover:underline" href="/featured-groups">← Featured Groups</a>
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

  <div class="grid gap-4 lg:grid-cols-2">
    <div class="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div class="border-b border-slate-200 px-4 py-3">
        <h2 class="font-semibold">Products in group</h2>
      </div>
      {#if data.currentProducts.length === 0}
        <p class="px-4 py-10 text-center text-sm text-slate-500">Empty group.</p>
      {:else}
        <ul class="divide-y divide-slate-100 text-sm">
          {#each data.currentProducts as p}
            <li class="flex items-center justify-between px-4 py-2">
              <div>
                <span class="font-mono text-xs text-slate-500">{p.sku}</span>
                {p.name}
              </div>
              <div class="flex gap-1">
                <form method="POST" action="?/reorder" use:enhance>
                  <input type="hidden" name="product_id" value={p.id} />
                  <input type="hidden" name="direction" value="up" />
                  <button
                    type="submit"
                    class="rounded border border-slate-300 px-2 py-0.5 text-xs hover:bg-slate-100"
                    >↑</button
                  >
                </form>
                <form method="POST" action="?/reorder" use:enhance>
                  <input type="hidden" name="product_id" value={p.id} />
                  <input type="hidden" name="direction" value="down" />
                  <button
                    type="submit"
                    class="rounded border border-slate-300 px-2 py-0.5 text-xs hover:bg-slate-100"
                    >↓</button
                  >
                </form>
                <form method="POST" action="?/removeProduct" use:enhance>
                  <input type="hidden" name="product_id" value={p.id} />
                  <button
                    type="submit"
                    class="rounded border border-red-300 px-2 py-0.5 text-xs text-red-700 hover:bg-red-50"
                  >
                    Remove
                  </button>
                </form>
              </div>
            </li>
          {/each}
        </ul>
      {/if}
    </div>

    <div class="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h2 class="mb-3 font-semibold">Add product</h2>
      <form method="POST" action="?/addProduct" use:enhance class="flex gap-2">
        <select
          name="product_id"
          class="flex-1 rounded border border-slate-300 px-2 py-1.5 text-sm"
        >
          <option value="">— Select —</option>
          {#each data.availableProducts as p}
            <option value={p.id}>{p.sku} · {p.name}</option>
          {/each}
        </select>
        <button
          type="submit"
          class="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
        >
          Add
        </button>
      </form>
    </div>
  </div>
</section>

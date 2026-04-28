<script lang="ts">
  import { enhance } from '$app/forms';

  let { data, form } = $props();

  const parentMap = $derived(new Map(data.categories.map((c) => [c.id, c.name])));
</script>

<svelte:head><title>Categories · Supply Admin</title></svelte:head>

<section class="space-y-4">
  <header>
    <h1 class="text-2xl font-semibold">Categories</h1>
    <p class="text-sm text-slate-500">{data.categories.length} categories</p>
  </header>

  {#if form?.message}
    <div class="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">
      {form.message}
    </div>
  {/if}

  <form
    method="POST"
    action="?/create"
    use:enhance
    class="grid gap-3 rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-4"
  >
    <label class="block">
      <span class="mb-1 block text-sm font-medium">Name</span>
      <input name="name" required class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm" />
    </label>
    <label class="block">
      <span class="mb-1 block text-sm font-medium">Parent</span>
      <select name="parent_id" class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm">
        <option value="">— Top level —</option>
        {#each data.categories as c}
          <option value={c.id}>{c.name}</option>
        {/each}
      </select>
    </label>
    <label class="block">
      <span class="mb-1 block text-sm font-medium">Display order</span>
      <input
        type="number"
        name="display_order"
        value="0"
        class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
      />
    </label>
    <div class="flex items-end">
      <button
        type="submit"
        class="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
      >
        Add category
      </button>
    </div>
  </form>

  <div class="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
    {#if data.categories.length === 0}
      <p class="px-4 py-10 text-center text-sm text-slate-500">No categories yet.</p>
    {:else}
      <table class="w-full text-sm">
        <thead class="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
          <tr>
            <th class="px-4 py-2 text-left font-medium">Name</th>
            <th class="px-4 py-2 text-left font-medium">Slug</th>
            <th class="px-4 py-2 text-left font-medium">Parent</th>
            <th class="px-4 py-2 text-right font-medium">Order</th>
            <th class="px-4 py-2"></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          {#each data.categories as c}
            <tr>
              <td class="px-4 py-2">{c.name}</td>
              <td class="px-4 py-2 font-mono text-xs text-slate-500">{c.slug}</td>
              <td class="px-4 py-2 text-slate-600">
                {c.parent_id ? parentMap.get(c.parent_id) ?? '—' : '—'}
              </td>
              <td class="px-4 py-2 text-right">{c.display_order}</td>
              <td class="px-4 py-2 text-right">
                <form method="POST" action="?/delete" use:enhance>
                  <input type="hidden" name="id" value={c.id} />
                  <button
                    type="submit"
                    onclick={(e) => {
                      if (!confirm('Delete this category?')) e.preventDefault();
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
</section>

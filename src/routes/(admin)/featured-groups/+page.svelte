<script lang="ts">
  import { enhance } from '$app/forms';

  let { data, form } = $props();
</script>

<svelte:head><title>Featured Groups · Supply Admin</title></svelte:head>

<section class="space-y-4">
  <header>
    <h1 class="text-2xl font-semibold">Featured Groups</h1>
    <p class="text-sm text-slate-500">Reusable groups of products that can be featured per client.</p>
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
    class="grid gap-3 rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-3"
  >
    <label class="block">
      <span class="mb-1 block text-sm font-medium">Name</span>
      <input
        name="name"
        required
        class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
      />
    </label>
    <label class="block sm:col-span-2">
      <span class="mb-1 block text-sm font-medium">Description</span>
      <input name="description" class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm" />
    </label>
    <div class="sm:col-span-3 flex justify-end">
      <button
        type="submit"
        class="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
      >
        Create group
      </button>
    </div>
  </form>

  <div class="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
    {#if data.groups.length === 0}
      <p class="px-4 py-10 text-center text-sm text-slate-500">No groups yet.</p>
    {:else}
      <table class="w-full text-sm">
        <thead class="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
          <tr>
            <th class="px-4 py-2 text-left font-medium">Name</th>
            <th class="px-4 py-2 text-left font-medium">Description</th>
            <th class="px-4 py-2 text-right font-medium">Products</th>
            <th class="px-4 py-2"></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          {#each data.groups as g}
            <tr>
              <td class="px-4 py-2">
                <a class="text-sky-700 hover:underline" href="/featured-groups/{g.id}">{g.name}</a>
              </td>
              <td class="px-4 py-2 text-slate-600">{g.description ?? '—'}</td>
              <td class="px-4 py-2 text-right">{g.product_ids?.length ?? 0}</td>
              <td class="px-4 py-2 text-right">
                <form method="POST" action="?/delete" use:enhance>
                  <input type="hidden" name="id" value={g.id} />
                  <button
                    type="submit"
                    onclick={(e) => {
                      if (!confirm('Delete this group?')) e.preventDefault();
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

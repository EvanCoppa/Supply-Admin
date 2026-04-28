<script lang="ts">
  import { enhance } from '$app/forms';

  let { data, form } = $props();
  let editingId = $state<string | null>(null);
</script>

<svelte:head><title>Tags · Supply Admin</title></svelte:head>

<section class="space-y-4">
  <header>
    <h1 class="text-2xl font-semibold">Customer tags</h1>
    <p class="text-sm text-slate-500">Arbitrary segmentation — VIP, PPO-only, key account, etc.</p>
  </header>

  {#if form?.message}
    <div class="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">{form.message}</div>
  {/if}

  <form
    method="POST"
    action="?/create"
    use:enhance
    class="grid gap-3 rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-3"
  >
    <label class="block">
      <span class="mb-1 block text-xs font-medium">Name</span>
      <input name="name" required class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm" />
    </label>
    <label class="block">
      <span class="mb-1 block text-xs font-medium">Color (hex)</span>
      <input
        name="color"
        placeholder="#0ea5e9"
        class="w-full rounded border border-slate-300 px-2 py-1.5 font-mono text-sm"
      />
    </label>
    <div class="flex items-end justify-end">
      <button
        type="submit"
        class="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
      >
        Add tag
      </button>
    </div>
  </form>

  <div class="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
    {#if data.tags.length === 0}
      <p class="px-4 py-10 text-center text-sm text-slate-500">No tags yet.</p>
    {:else}
      <table class="w-full text-sm">
        <thead class="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
          <tr>
            <th class="px-3 py-2 text-left font-medium">Tag</th>
            <th class="px-3 py-2 text-left font-medium">Color</th>
            <th class="px-3 py-2 text-right font-medium">Clients</th>
            <th class="px-3 py-2 text-right font-medium"></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          {#each data.tags as tag}
            <tr class="hover:bg-slate-50">
              {#if editingId === tag.id}
                <td colspan="4" class="px-3 py-3">
                  <form
                    method="POST"
                    action="?/update"
                    use:enhance={() => () => {
                      editingId = null;
                    }}
                    class="flex flex-wrap items-end gap-3"
                  >
                    <input type="hidden" name="id" value={tag.id} />
                    <label class="block">
                      <span class="mb-1 block text-xs font-medium">Name</span>
                      <input
                        name="name"
                        value={tag.name}
                        required
                        class="rounded border border-slate-300 px-2 py-1.5 text-sm"
                      />
                    </label>
                    <label class="block">
                      <span class="mb-1 block text-xs font-medium">Color</span>
                      <input
                        name="color"
                        value={tag.color ?? ''}
                        class="rounded border border-slate-300 px-2 py-1.5 font-mono text-sm"
                      />
                    </label>
                    <button
                      type="button"
                      onclick={() => (editingId = null)}
                      class="rounded border border-slate-300 px-3 py-1.5 text-xs hover:bg-slate-100"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      class="rounded bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
                    >
                      Save
                    </button>
                  </form>
                </td>
              {:else}
                <td class="px-3 py-2">
                  <span
                    class="inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-xs"
                    style={tag.color ? `background-color:${tag.color}20; color:${tag.color}` : ''}
                    class:bg-slate-100={!tag.color}
                    class:text-slate-700={!tag.color}
                  >
                    {#if tag.color}
                      <span class="inline-block h-2 w-2 rounded-full" style="background-color:{tag.color}"></span>
                    {/if}
                    {tag.name}
                  </span>
                </td>
                <td class="px-3 py-2 font-mono text-xs text-slate-600">{tag.color ?? '—'}</td>
                <td class="px-3 py-2 text-right">{tag.customer_count}</td>
                <td class="px-3 py-2 text-right">
                  <button
                    type="button"
                    onclick={() => (editingId = tag.id)}
                    class="rounded border border-slate-300 px-2 py-0.5 text-xs hover:bg-slate-100"
                  >
                    Edit
                  </button>
                  <form method="POST" action="?/delete" use:enhance class="inline">
                    <input type="hidden" name="id" value={tag.id} />
                    <button
                      type="submit"
                      class="rounded border border-red-300 px-2 py-0.5 text-xs text-red-700 hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </form>
                </td>
              {/if}
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
  </div>
</section>

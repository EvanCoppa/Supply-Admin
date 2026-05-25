<script lang="ts">
  import { enhance } from '$app/forms';

  let { data, form } = $props();
  let editingId = $state<string | null>(null);
  let expandedRepsId = $state<string | null>(null);
</script>

<svelte:head><title>Territories · Supply Admin</title></svelte:head>

<section class="space-y-4">
  <header>
    <h1 class="text-2xl font-semibold">Territories</h1>
    <p class="text-sm text-slate-500">
      Geographic or vertical groupings used to split up rep coverage.
    </p>
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
      <span class="mb-1 block text-xs font-medium">Name</span>
      <input
        name="name"
        required
        class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
      />
    </label>
    <label class="block sm:col-span-2">
      <span class="mb-1 block text-xs font-medium">Description</span>
      <input
        name="description"
        class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
      />
    </label>
    <div class="flex items-end justify-end">
      <button
        type="submit"
        class="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
      >
        Add territory
      </button>
    </div>
  </form>

  <div class="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
    {#if data.territories.length === 0}
      <p class="px-4 py-10 text-center text-sm text-slate-500">No territories defined.</p>
    {:else}
      <table class="w-full text-sm">
        <thead class="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
          <tr>
            <th class="px-3 py-2 text-left font-medium">Name</th>
            <th class="px-3 py-2 text-left font-medium">Description</th>
            <th class="px-3 py-2 text-right font-medium">Clients</th>
            <th class="px-3 py-2 text-left font-medium">Reps</th>
            <th class="px-3 py-2 text-right font-medium"></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          {#each data.territories as t}
            <tr class="hover:bg-slate-50">
              {#if editingId === t.id}
                <td colspan="5" class="px-3 py-3">
                  <form
                    method="POST"
                    action="?/update"
                    use:enhance={() =>
                      async ({ update }) => {
                        await update();
                        editingId = null;
                      }}
                    class="grid gap-3 sm:grid-cols-3"
                  >
                    <input type="hidden" name="id" value={t.id} />
                    <input
                      name="name"
                      value={t.name}
                      required
                      class="rounded border border-slate-300 px-2 py-1.5 text-sm"
                    />
                    <input
                      name="description"
                      value={t.description ?? ''}
                      class="sm:col-span-2 rounded border border-slate-300 px-2 py-1.5 text-sm"
                    />
                    <div class="sm:col-span-3 flex justify-end gap-2">
                      <button
                        type="button"
                        onclick={() => (editingId = null)}
                        class="rounded border border-slate-300 px-3 py-1 text-xs hover:bg-slate-100"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        class="rounded bg-slate-900 px-3 py-1 text-xs font-medium text-white hover:bg-slate-800"
                      >
                        Save
                      </button>
                    </div>
                  </form>
                </td>
              {:else}
                <td class="px-3 py-2 font-medium">
                  <a class="text-sky-700 hover:underline" href="/clients?territory={t.id}"
                    >{t.name}</a
                  >
                </td>
                <td class="px-3 py-2 text-slate-600">{t.description ?? '—'}</td>
                <td class="px-3 py-2 text-right">{t.customer_count}</td>
                <td class="px-3 py-2">
                  <button
                    type="button"
                    onclick={() => (expandedRepsId = expandedRepsId === t.id ? null : t.id)}
                    class="text-xs text-slate-600 hover:text-slate-900"
                  >
                    {#if t.reps && t.reps.length > 0}
                      {t.reps.length} rep{t.reps.length !== 1 ? 's' : ''}
                    {:else}
                      No reps
                    {/if}
                  </button>
                </td>
                <td class="px-3 py-2 text-right">
                  <button
                    type="button"
                    onclick={() => (editingId = t.id)}
                    class="rounded border border-slate-300 px-2 py-0.5 text-xs hover:bg-slate-100"
                  >
                    Edit
                  </button>
                  <form method="POST" action="?/delete" use:enhance class="inline">
                    <input type="hidden" name="id" value={t.id} />
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
            {#if expandedRepsId === t.id}
              <tr class="bg-slate-50">
                <td colspan="5" class="px-3 py-3">
                  <div class="space-y-3">
                    {#if t.reps && t.reps.length > 0}
                      <div>
                        <h4 class="mb-2 text-xs font-semibold">Current Reps</h4>
                        <div class="space-y-1">
                          {#each t.reps as rep}
                            <div
                              class="flex items-center justify-between rounded bg-white p-2 text-sm"
                            >
                              <span>{rep.display_name || 'Unknown'}</span>
                              <form method="POST" action="?/removeRep" use:enhance class="inline">
                                <input type="hidden" name="id" value={rep.id} />
                                <button
                                  type="submit"
                                  class="text-xs text-red-600 hover:text-red-900"
                                >
                                  Remove
                                </button>
                              </form>
                            </div>
                          {/each}
                        </div>
                      </div>
                    {/if}
                    <form method="POST" action="?/addRep" use:enhance class="flex gap-2">
                      <input type="hidden" name="territory_id" value={t.id} />
                      <select
                        name="user_id"
                        class="flex-1 rounded border border-slate-300 px-2 py-1 text-sm"
                      >
                        <option value="">Select a rep to add...</option>
                        {#each data.adminUsers as user}
                          {#if !t.reps?.some((r) => r.id === user.id)}
                            <option value={user.id}>
                              {user.display_name || user.id}
                            </option>
                          {/if}
                        {/each}
                      </select>
                      <button
                        type="submit"
                        class="rounded bg-slate-900 px-3 py-1 text-xs font-medium text-white hover:bg-slate-800"
                      >
                        Add
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            {/if}
          {/each}
        </tbody>
      </table>
    {/if}
  </div>
</section>

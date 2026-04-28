<script lang="ts">
  import { enhance } from '$app/forms';
  import { dateTime } from '$lib/format';

  let { data, form } = $props();

  let editingId = $state<string | null>(null);
</script>

<div class="space-y-5">
  {#if form?.message}
    <div class="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">
      {form.message}
    </div>
  {/if}

  <form
    method="POST"
    action="?/create"
    use:enhance
    class="space-y-2 rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
  >
    <label class="block">
      <span class="mb-1 block text-sm font-medium">New note</span>
      <textarea
        name="body"
        rows="3"
        required
        class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
        placeholder="Add an internal note about this account…"
      ></textarea>
    </label>
    <div class="flex items-center justify-between">
      <label class="inline-flex items-center gap-2 text-sm text-slate-600">
        <input type="checkbox" name="pinned" /> Pin to top
      </label>
      <button
        type="submit"
        class="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
      >
        Post note
      </button>
    </div>
  </form>

  {#if data.notes.length === 0}
    <p class="rounded border border-dashed border-slate-300 bg-white px-4 py-10 text-center text-sm text-slate-500">
      No notes yet.
    </p>
  {:else}
    <ul class="space-y-3">
      {#each data.notes as n}
        <li
          class="rounded-lg border bg-white p-4 shadow-sm"
          class:border-amber-300={n.pinned}
          class:border-slate-200={!n.pinned}
        >
          {#if editingId === n.id}
            <form
              method="POST"
              action="?/update"
              use:enhance={() => () => {
                editingId = null;
              }}
              class="space-y-2"
            >
              <input type="hidden" name="id" value={n.id} />
              <textarea
                name="body"
                rows="3"
                required
                class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
              >{n.body}</textarea>
              <div class="flex items-center justify-between">
                <label class="inline-flex items-center gap-2 text-sm text-slate-600">
                  <input type="checkbox" name="pinned" checked={n.pinned} /> Pinned
                </label>
                <div class="flex gap-2">
                  <button
                    type="button"
                    onclick={() => (editingId = null)}
                    class="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-100"
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
              </div>
            </form>
          {:else}
            <div class="flex items-start justify-between gap-4">
              <div class="min-w-0 flex-1">
                <p class="whitespace-pre-wrap text-sm text-slate-800">{n.body}</p>
                <p class="mt-2 text-xs text-slate-500">
                  {#if n.pinned}
                    <span class="mr-1 rounded bg-amber-100 px-1.5 py-0.5 text-amber-800">Pinned</span>
                  {/if}
                  {n.author?.display_name ?? 'Unknown'} · {dateTime(n.created_at)}
                </p>
              </div>
              <div class="flex flex-shrink-0 gap-2">
                <form method="POST" action="?/togglePinned" use:enhance>
                  <input type="hidden" name="id" value={n.id} />
                  <input type="hidden" name="pinned" value={String(n.pinned)} />
                  <button
                    type="submit"
                    class="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-100"
                  >
                    {n.pinned ? 'Unpin' : 'Pin'}
                  </button>
                </form>
                <button
                  type="button"
                  onclick={() => (editingId = n.id)}
                  class="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-100"
                >
                  Edit
                </button>
                <form method="POST" action="?/delete" use:enhance>
                  <input type="hidden" name="id" value={n.id} />
                  <button
                    type="submit"
                    class="rounded border border-red-300 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                  >
                    Delete
                  </button>
                </form>
              </div>
            </div>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
</div>

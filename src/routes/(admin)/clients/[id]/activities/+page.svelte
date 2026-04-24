<script lang="ts">
  import { enhance } from '$app/forms';
  import { dateTime } from '$lib/format';

  let { data, form } = $props();

  let showCreate = $state(false);

  const typeIcon: Record<string, string> = {
    call: '📞',
    email: '✉️',
    meeting: '🗓',
    visit: '📍',
    sms: '💬',
    other: '•'
  };
</script>

<div class="space-y-5">
  {#if form?.message}
    <div class="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">
      {form.message}
    </div>
  {/if}

  <div class="flex items-center justify-between">
    <div>
      <h2 class="font-semibold">Activity timeline</h2>
      <p class="text-sm text-slate-500">Calls, emails, visits, and other touchpoints.</p>
    </div>
    <button
      type="button"
      onclick={() => (showCreate = !showCreate)}
      class="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
    >
      {showCreate ? 'Cancel' : 'Log activity'}
    </button>
  </div>

  {#if showCreate}
    <form
      method="POST"
      action="?/create"
      use:enhance={() => () => {
        showCreate = false;
      }}
      class="grid gap-3 rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-3"
    >
      <label class="block">
        <span class="mb-1 block text-xs font-medium">Type</span>
        <select name="type" required class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm">
          <option value="call">Call</option>
          <option value="email">Email</option>
          <option value="meeting">Meeting</option>
          <option value="visit">Visit</option>
          <option value="sms">SMS</option>
          <option value="other">Other</option>
        </select>
      </label>
      <label class="block">
        <span class="mb-1 block text-xs font-medium">Direction</span>
        <select name="direction" class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm">
          <option value="">—</option>
          <option value="inbound">Inbound</option>
          <option value="outbound">Outbound</option>
        </select>
      </label>
      <label class="block">
        <span class="mb-1 block text-xs font-medium">When</span>
        <input
          type="datetime-local"
          name="occurred_at"
          class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
        />
      </label>
      <label class="block sm:col-span-2">
        <span class="mb-1 block text-xs font-medium">Subject</span>
        <input name="subject" class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm" />
      </label>
      <label class="block">
        <span class="mb-1 block text-xs font-medium">Contact</span>
        <select name="contact_id" class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm">
          <option value="">—</option>
          {#each data.contacts as ct}
            <option value={ct.id}>
              {[ct.first_name, ct.last_name].filter(Boolean).join(' ') || ct.id.slice(0, 6)}
            </option>
          {/each}
        </select>
      </label>
      <label class="block sm:col-span-3">
        <span class="mb-1 block text-xs font-medium">Notes</span>
        <textarea name="body" rows="3" class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"></textarea>
      </label>
      <div class="sm:col-span-3 flex justify-end">
        <button
          type="submit"
          class="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
        >
          Log activity
        </button>
      </div>
    </form>
  {/if}

  {#if data.activities.length === 0}
    <p class="rounded border border-dashed border-slate-300 bg-white px-4 py-10 text-center text-sm text-slate-500">
      No activities logged yet.
    </p>
  {:else}
    <ol class="relative space-y-3 border-l border-slate-200 pl-6">
      {#each data.activities as a}
        <li class="relative">
          <span class="absolute -left-[30px] top-1 text-lg">{typeIcon[a.type] ?? '•'}</span>
          <div class="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0 flex-1">
                <p class="text-sm font-medium">
                  {a.subject ?? a.type}
                  <span class="ml-1 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">{a.type}</span>
                  {#if a.direction}
                    <span class="ml-1 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">{a.direction}</span>
                  {/if}
                </p>
                {#if a.body}
                  <p class="mt-1 whitespace-pre-wrap text-sm text-slate-700">{a.body}</p>
                {/if}
                <p class="mt-2 text-xs text-slate-500">
                  {dateTime(a.occurred_at)}
                  · {a.actor?.display_name ?? 'Unknown'}
                  {#if a.contact}
                    · with {[a.contact.first_name, a.contact.last_name].filter(Boolean).join(' ')}
                  {/if}
                </p>
              </div>
              <form method="POST" action="?/delete" use:enhance>
                <input type="hidden" name="id" value={a.id} />
                <button
                  type="submit"
                  class="rounded border border-red-300 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                >
                  Delete
                </button>
              </form>
            </div>
          </div>
        </li>
      {/each}
    </ol>
  {/if}
</div>

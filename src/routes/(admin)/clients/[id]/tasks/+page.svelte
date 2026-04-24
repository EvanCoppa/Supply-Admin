<script lang="ts">
  import { enhance } from '$app/forms';
  import { dateTime } from '$lib/format';

  let { data, form } = $props();

  let showCreate = $state(false);

  const priorityClass: Record<string, string> = {
    low: 'bg-slate-100 text-slate-600',
    normal: 'bg-sky-50 text-sky-700',
    high: 'bg-amber-50 text-amber-700',
    urgent: 'bg-red-50 text-red-700'
  };

  function isOverdue(t: { due_at: string | null; status: string }) {
    return (
      !!t.due_at &&
      (t.status === 'open' || t.status === 'in_progress') &&
      new Date(t.due_at).getTime() < Date.now()
    );
  }
</script>

<div class="space-y-5">
  {#if form?.message}
    <div class="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">
      {form.message}
    </div>
  {/if}

  <div class="flex items-center justify-between">
    <div>
      <h2 class="font-semibold">Tasks</h2>
      <p class="text-sm text-slate-500">Rep follow-ups and to-dos for this account.</p>
    </div>
    <button
      type="button"
      onclick={() => (showCreate = !showCreate)}
      class="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
    >
      {showCreate ? 'Cancel' : 'New task'}
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
      <label class="block sm:col-span-3">
        <span class="mb-1 block text-xs font-medium">Title</span>
        <input
          name="title"
          required
          class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
        />
      </label>
      <label class="block sm:col-span-3">
        <span class="mb-1 block text-xs font-medium">Description</span>
        <textarea
          name="description"
          rows="2"
          class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
        ></textarea>
      </label>
      <label class="block">
        <span class="mb-1 block text-xs font-medium">Assignee</span>
        <select name="assigned_to" class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm">
          <option value="">— Unassigned —</option>
          {#each data.admins as a}
            <option value={a.id}>{a.display_name ?? a.id.slice(0, 8)}</option>
          {/each}
        </select>
      </label>
      <label class="block">
        <span class="mb-1 block text-xs font-medium">Priority</span>
        <select name="priority" class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm">
          <option value="low">Low</option>
          <option value="normal" selected>Normal</option>
          <option value="high">High</option>
          <option value="urgent">Urgent</option>
        </select>
      </label>
      <label class="block">
        <span class="mb-1 block text-xs font-medium">Due</span>
        <input
          type="datetime-local"
          name="due_at"
          class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
        />
      </label>
      <div class="sm:col-span-3 flex justify-end">
        <button
          type="submit"
          class="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
        >
          Create task
        </button>
      </div>
    </form>
  {/if}

  {#if data.tasks.length === 0}
    <p class="rounded border border-dashed border-slate-300 bg-white px-4 py-10 text-center text-sm text-slate-500">
      No tasks yet.
    </p>
  {:else}
    <div class="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <table class="w-full text-sm">
        <thead class="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
          <tr>
            <th class="px-3 py-2 text-left font-medium">Status</th>
            <th class="px-3 py-2 text-left font-medium">Title</th>
            <th class="px-3 py-2 text-left font-medium">Priority</th>
            <th class="px-3 py-2 text-left font-medium">Assignee</th>
            <th class="px-3 py-2 text-left font-medium">Due</th>
            <th class="px-3 py-2 text-right font-medium"></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          {#each data.tasks as t}
            <tr class="hover:bg-slate-50" class:bg-red-50={isOverdue(t)}>
              <td class="px-3 py-2">
                <form method="POST" action="?/setStatus" use:enhance class="inline">
                  <input type="hidden" name="id" value={t.id} />
                  <select
                    name="status"
                    class="rounded border border-slate-300 px-1 py-0.5 text-xs"
                    onchange={(e) => (e.currentTarget.form as HTMLFormElement).requestSubmit()}
                  >
                    <option value="open" selected={t.status === 'open'}>Open</option>
                    <option value="in_progress" selected={t.status === 'in_progress'}>In progress</option>
                    <option value="done" selected={t.status === 'done'}>Done</option>
                    <option value="cancelled" selected={t.status === 'cancelled'}>Cancelled</option>
                  </select>
                </form>
              </td>
              <td class="px-3 py-2">
                <p class="font-medium" class:line-through={t.status === 'done' || t.status === 'cancelled'}>
                  {t.title}
                </p>
                {#if t.description}
                  <p class="text-xs text-slate-500">{t.description}</p>
                {/if}
              </td>
              <td class="px-3 py-2">
                <span class="rounded px-1.5 py-0.5 text-xs {priorityClass[t.priority] ?? ''}">{t.priority}</span>
              </td>
              <td class="px-3 py-2 text-slate-600">{t.assignee?.display_name ?? '—'}</td>
              <td class="px-3 py-2 text-slate-600" class:text-red-700={isOverdue(t)}>
                {t.due_at ? dateTime(t.due_at) : '—'}
              </td>
              <td class="px-3 py-2 text-right">
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
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>

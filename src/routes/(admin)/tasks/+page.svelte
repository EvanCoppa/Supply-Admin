<script lang="ts">
  import { enhance } from '$app/forms';
  import { dateTime } from '$lib/format';

  let { data } = $props();

  const totalPages = $derived(Math.max(1, Math.ceil(data.total / data.pageSize)));

  const priorityClass: Record<string, string> = {
    low: 'bg-slate-100 text-slate-600',
    normal: 'bg-sky-50 text-sky-700',
    high: 'bg-amber-50 text-amber-700',
    urgent: 'bg-red-50 text-red-700'
  };

  const views = [
    { key: 'mine_open', label: 'My open' },
    { key: 'overdue', label: 'Overdue' },
    { key: 'unassigned', label: 'Unassigned' },
    { key: 'all', label: 'All' }
  ];

  function isOverdue(t: { due_at: string | null; status: string }) {
    return (
      !!t.due_at &&
      (t.status === 'open' || t.status === 'in_progress') &&
      new Date(t.due_at).getTime() < Date.now()
    );
  }
</script>

<svelte:head><title>Tasks · Supply Admin</title></svelte:head>

<section class="space-y-4">
  <header>
    <h1 class="text-2xl font-semibold">Tasks</h1>
    <p class="text-sm text-slate-500">Follow-ups across every account.</p>
  </header>

  <div class="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
    {#each views as v}
      <a
        href="?view={v.key}"
        class="rounded-t px-3 py-1.5 text-sm"
        class:bg-slate-900={data.filters.view === v.key}
        class:text-white={data.filters.view === v.key}
        class:text-slate-600={data.filters.view !== v.key}
        class:hover:bg-slate-100={data.filters.view !== v.key}
      >
        {v.label}
      </a>
    {/each}
  </div>

  <form method="GET" class="flex flex-wrap gap-2 rounded border border-slate-200 bg-white p-3 text-sm">
    <input type="hidden" name="view" value={data.filters.view} />
    <select name="status" class="rounded border border-slate-300 px-2 py-1.5">
      <option value="">Any status</option>
      <option value="open" selected={data.filters.status === 'open'}>Open</option>
      <option value="in_progress" selected={data.filters.status === 'in_progress'}>In progress</option>
      <option value="done" selected={data.filters.status === 'done'}>Done</option>
      <option value="cancelled" selected={data.filters.status === 'cancelled'}>Cancelled</option>
    </select>
    <select name="assignee" class="rounded border border-slate-300 px-2 py-1.5">
      <option value="">Any assignee</option>
      {#each data.admins as a}
        <option value={a.id} selected={data.filters.assignee === a.id}>
          {a.display_name ?? a.id.slice(0, 8)}
        </option>
      {/each}
    </select>
    <button type="submit" class="rounded bg-slate-900 px-3 py-1.5 font-medium text-white hover:bg-slate-800">
      Apply
    </button>
  </form>

  <div class="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
    {#if data.tasks.length === 0}
      <p class="px-4 py-10 text-center text-sm text-slate-500">No tasks match these filters.</p>
    {:else}
      <table class="w-full text-sm">
        <thead class="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
          <tr>
            <th class="px-3 py-2 text-left font-medium">Status</th>
            <th class="px-3 py-2 text-left font-medium">Title</th>
            <th class="px-3 py-2 text-left font-medium">Customer</th>
            <th class="px-3 py-2 text-left font-medium">Assignee</th>
            <th class="px-3 py-2 text-left font-medium">Priority</th>
            <th class="px-3 py-2 text-right font-medium">Due</th>
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
                <a class="text-sky-700 hover:underline" href="/clients/{t.customer_id}/tasks">{t.title}</a>
              </td>
              <td class="px-3 py-2">
                <a class="text-sky-700 hover:underline" href="/clients/{t.customer_id}">
                  {t.customer?.business_name ?? '—'}
                </a>
              </td>
              <td class="px-3 py-2 text-slate-600">{t.assignee?.display_name ?? '—'}</td>
              <td class="px-3 py-2">
                <span class="rounded px-1.5 py-0.5 text-xs {priorityClass[t.priority] ?? ''}">{t.priority}</span>
              </td>
              <td class="px-3 py-2 text-right" class:text-red-700={isOverdue(t)}>
                {t.due_at ? dateTime(t.due_at) : '—'}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
  </div>

  {#if totalPages > 1}
    <nav class="flex justify-end gap-2 text-sm">
      {#if data.page > 1}
        <a
          class="rounded border border-slate-300 px-3 py-1 hover:bg-slate-100"
          href="?{new URLSearchParams({ ...data.filters, page: String(data.page - 1) })}"
        >
          Previous
        </a>
      {/if}
      <span class="px-2 py-1 text-slate-500">Page {data.page} of {totalPages}</span>
      {#if data.page < totalPages}
        <a
          class="rounded border border-slate-300 px-3 py-1 hover:bg-slate-100"
          href="?{new URLSearchParams({ ...data.filters, page: String(data.page + 1) })}"
        >
          Next
        </a>
      {/if}
    </nav>
  {/if}
</section>

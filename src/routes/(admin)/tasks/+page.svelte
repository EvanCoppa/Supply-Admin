<script lang="ts">
  import { enhance } from '$app/forms';
  import { invalidateAll } from '$app/navigation';
  import { dateTime } from '$lib/format';
  import type { TaskStatus } from '$lib/types/db';

  let { data } = $props();

  type Task = (typeof data.tasks)[number];

  const priorityClass: Record<string, string> = {
    low: 'bg-slate-100 text-slate-600',
    normal: 'bg-sky-50 text-sky-700',
    high: 'bg-amber-50 text-amber-700',
    urgent: 'bg-red-50 text-red-700'
  };

  const views = [
    { key: 'mine', label: 'Mine' },
    { key: 'overdue', label: 'Overdue' },
    { key: 'unassigned', label: 'Unassigned' },
    { key: 'all', label: 'All' }
  ];

  const columns: Array<{ status: TaskStatus; label: string; accent: string }> = [
    { status: 'open', label: 'Open', accent: 'border-slate-300' },
    { status: 'in_progress', label: 'In progress', accent: 'border-sky-300' },
    { status: 'done', label: 'Done', accent: 'border-emerald-300' },
    { status: 'cancelled', label: 'Cancelled', accent: 'border-slate-200' }
  ];

  const tasksByStatus = $derived.by(() => {
    const buckets: Record<TaskStatus, Task[]> = {
      open: [],
      in_progress: [],
      done: [],
      cancelled: []
    };
    for (const t of data.tasks) buckets[t.status as TaskStatus].push(t);
    return buckets;
  });

  function isOverdue(t: Task) {
    return (
      !!t.due_at &&
      (t.status === 'open' || t.status === 'in_progress') &&
      new Date(t.due_at).getTime() < Date.now()
    );
  }

  let draggingId = $state<string | null>(null);
  let dragOverStatus = $state<TaskStatus | null>(null);

  function onDragStart(event: DragEvent, task: Task) {
    if (!event.dataTransfer) return;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', task.id);
    draggingId = task.id;
  }

  function onDragEnd() {
    draggingId = null;
    dragOverStatus = null;
  }

  function onDragOver(event: DragEvent, status: TaskStatus) {
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    dragOverStatus = status;
  }

  function onDragLeave(status: TaskStatus) {
    if (dragOverStatus === status) dragOverStatus = null;
  }

  async function onDrop(event: DragEvent, status: TaskStatus) {
    event.preventDefault();
    const id = event.dataTransfer?.getData('text/plain');
    dragOverStatus = null;
    draggingId = null;
    if (!id) return;

    const current = data.tasks.find((t) => t.id === id);
    if (!current || current.status === status) return;

    const body = new FormData();
    body.set('id', id);
    body.set('status', status);
    const res = await fetch('?/setStatus', { method: 'POST', body });
    if (res.ok) await invalidateAll();
  }
</script>

<svelte:head><title>Tasks · Supply Admin</title></svelte:head>

<section class="space-y-4">
  <header class="flex items-end justify-between">
    <div>
      <h1 class="text-2xl font-semibold">Tasks</h1>
      <p class="text-sm text-slate-500">Follow-ups across every account.</p>
    </div>
    <p class="text-xs text-slate-500">
      Showing {data.tasks.length} of {data.total}
      {#if data.total > data.limit}
        <span class="text-amber-700">(cap {data.limit}; narrow filters to see more)</span>
      {/if}
    </p>
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
    <select name="priority" class="rounded border border-slate-300 px-2 py-1.5">
      <option value="">Any priority</option>
      <option value="urgent" selected={data.filters.priority === 'urgent'}>Urgent</option>
      <option value="high" selected={data.filters.priority === 'high'}>High</option>
      <option value="normal" selected={data.filters.priority === 'normal'}>Normal</option>
      <option value="low" selected={data.filters.priority === 'low'}>Low</option>
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

  <div class="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
    {#each columns as col}
      {@const items = tasksByStatus[col.status]}
      <div
        class="flex min-h-64 flex-col rounded-lg border-t-4 {col.accent} bg-slate-50/70 p-3"
        class:ring-2={dragOverStatus === col.status}
        class:ring-sky-400={dragOverStatus === col.status}
        ondragover={(e) => onDragOver(e, col.status)}
        ondragleave={() => onDragLeave(col.status)}
        ondrop={(e) => onDrop(e, col.status)}
        role="list"
        aria-label={col.label}
      >
        <header class="mb-2 flex items-center justify-between">
          <h2 class="text-sm font-semibold text-slate-700">{col.label}</h2>
          <span class="rounded-full bg-white px-2 py-0.5 text-xs text-slate-500">{items.length}</span>
        </header>

        <div class="flex-1 space-y-2">
          {#each items as t (t.id)}
            <article
              class="rounded border border-slate-200 bg-white p-2 text-sm shadow-sm"
              class:opacity-50={draggingId === t.id}
              class:ring-1={isOverdue(t)}
              class:ring-red-300={isOverdue(t)}
              draggable="true"
              ondragstart={(e) => onDragStart(e, t)}
              ondragend={onDragEnd}
              role="listitem"
            >
              <div class="flex items-start justify-between gap-2">
                <a
                  class="font-medium text-slate-900 hover:text-sky-700"
                  href="/clients/{t.customer_id}/tasks"
                >
                  {t.title}
                </a>
                <span class="shrink-0 rounded px-1.5 py-0.5 text-[10px] {priorityClass[t.priority] ?? ''}">
                  {t.priority}
                </span>
              </div>

              <a
                class="mt-1 block truncate text-xs text-sky-700 hover:underline"
                href="/clients/{t.customer_id}"
              >
                {t.customer?.business_name ?? '—'}
              </a>

              <dl class="mt-2 grid grid-cols-2 gap-x-2 text-xs text-slate-500">
                <dt class="sr-only">Assignee</dt>
                <dd class="truncate">{t.assignee?.display_name ?? 'Unassigned'}</dd>
                <dt class="sr-only">Due</dt>
                <dd class="text-right" class:text-red-700={isOverdue(t)}>
                  {t.due_at ? dateTime(t.due_at) : '—'}
                </dd>
              </dl>

              <form method="POST" action="?/setStatus" use:enhance class="mt-2">
                <input type="hidden" name="id" value={t.id} />
                <select
                  name="status"
                  aria-label="Move task"
                  class="w-full rounded border border-slate-200 bg-slate-50 px-1 py-0.5 text-xs"
                  onchange={(e) => (e.currentTarget.form as HTMLFormElement).requestSubmit()}
                >
                  <option value="open" selected={t.status === 'open'}>Open</option>
                  <option value="in_progress" selected={t.status === 'in_progress'}>In progress</option>
                  <option value="done" selected={t.status === 'done'}>Done</option>
                  <option value="cancelled" selected={t.status === 'cancelled'}>Cancelled</option>
                </select>
              </form>
            </article>
          {:else}
            <p class="py-6 text-center text-xs text-slate-400">Drop tasks here</p>
          {/each}
        </div>
      </div>
    {/each}
  </div>
</section>

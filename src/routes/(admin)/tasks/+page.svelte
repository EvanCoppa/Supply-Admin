<script lang="ts">
  import { invalidateAll, goto } from '$app/navigation';
  import { enhance } from '$app/forms';
  import { ACTIONABLE_TASK_STATUSES, type TaskStatus, type TaskPriority } from '$lib/types/db';
  import Select from '$lib/components/Select.svelte';
  import KanbanBoard, {
    type KanbanCard,
    type KanbanColumn,
    type KanbanPriorityOption,
    type KanbanAssigneeOption
  } from '$lib/components/KanbanBoard.svelte';

  let { data, form } = $props();

  let createDialog: HTMLDialogElement | undefined = $state();

  function openCreate() {
    createDialog?.showModal();
  }

  function closeCreate() {
    createDialog?.close();
  }

  type Task = (typeof data.tasks)[number];

  // 5 board columns. Each groups two DB statuses that render as split drop-zones during drag.
  const COLUMNS: KanbanColumn[] = [
    {
      key: 'new',
      label: 'New',
      colorVar: '#9ca3af',
      statuses: ['unassigned', 'assigned'],
      statusOptions: [
        { value: 'unassigned', label: 'Unassigned' },
        { value: 'assigned', label: 'Assigned' }
      ]
    },
    {
      key: 'qualifying',
      label: 'Qualifying',
      colorVar: '#8b5cf6',
      statuses: ['contacted', 'interested'],
      statusOptions: [
        { value: 'contacted', label: 'Contacted' },
        { value: 'interested', label: 'Interested' }
      ]
    },
    {
      key: 'active',
      label: 'Active',
      colorVar: '#3b82f6',
      statuses: ['in_progress', 'waiting_on_customer'],
      statusOptions: [
        { value: 'in_progress', label: 'In progress' },
        { value: 'waiting_on_customer', label: 'Waiting on customer' }
      ]
    },
    {
      key: 'closed_won',
      label: 'Closed-Won',
      colorVar: '#16a34a',
      statuses: ['shipped', 'verified'],
      statusOptions: [
        { value: 'shipped', label: 'Shipped' },
        { value: 'verified', label: 'Verified' }
      ]
    },
    {
      key: 'closed_lost',
      label: 'Closed-Lost',
      colorVar: '#ef4444',
      statuses: ['cancelled', 'lost'],
      statusOptions: [
        { value: 'cancelled', label: 'Cancelled' },
        { value: 'lost', label: 'Lost' }
      ]
    }
  ];

  const STATUS_COLORS: Record<string, string> = {
    // sub-statuses
    unassigned: '#9ca3af',
    assigned: '#6366f1',
    contacted: '#8b5cf6',
    interested: '#10b981',
    in_progress: '#3b82f6',
    waiting_on_customer: '#f59e0b',
    shipped: '#16a34a',
    verified: '#15803d',
    cancelled: '#ef4444',
    lost: '#b91c1c',
    // column keys (for the header ring + accent bar)
    new: '#9ca3af',
    qualifying: '#8b5cf6',
    active: '#3b82f6',
    closed_won: '#16a34a',
    closed_lost: '#ef4444'
  };

  const STATUS_RING_CONFIG: Record<string, { fill: number | 'dot' | 'check' | 'x' }> = {
    // sub-statuses — fill grows along the workflow
    unassigned: { fill: 'dot' },
    assigned: { fill: 0.2 },
    contacted: { fill: 0.35 },
    interested: { fill: 0.5 },
    in_progress: { fill: 0.65 },
    waiting_on_customer: { fill: 0.8 },
    shipped: { fill: 1 },
    verified: { fill: 'check' },
    cancelled: { fill: 'x' },
    lost: { fill: 'x' },
    // column keys
    new: { fill: 'dot' },
    qualifying: { fill: 0.4 },
    active: { fill: 0.7 },
    closed_won: { fill: 'check' },
    closed_lost: { fill: 'x' }
  };

  const ACTIONABLE: ReadonlySet<string> = new Set(ACTIONABLE_TASK_STATUSES);

  const VIEWS = [
    { key: 'mine', label: 'Mine' },
    { key: 'overdue', label: 'Overdue' },
    { key: 'unassigned', label: 'Unassigned' },
    { key: 'all', label: 'All' }
  ];

  let localTasks = $state<Task[]>([]);
  $effect(() => {
    localTasks = [...data.tasks];
  });

  function isOverdue(t: Task): boolean {
    return !!t.due_at && ACTIONABLE.has(t.status) && new Date(t.due_at).getTime() < Date.now();
  }

  const stats = $derived.by(() => {
    let overdueCount = 0;
    let unassigned = 0;
    for (const t of localTasks) {
      if (isOverdue(t)) overdueCount++;
      if (!t.assigned_to) unassigned++;
    }
    return { overdue: overdueCount, unassigned };
  });

  function shortId(id: string): string {
    return id.slice(0, 6).toUpperCase();
  }

  function dueLabel(d: string | null): string {
    if (!d) return '';
    return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  function priorityToKanban(p: TaskPriority): 'high' | 'med' | 'low' | undefined {
    if (p === 'urgent' || p === 'high') return 'high';
    if (p === 'normal') return 'med';
    if (p === 'low') return 'low';
    return undefined;
  }

  function getInitials(name: string | null | undefined): string {
    if (!name) return '?';
    return name
      .split(' ')
      .map((p) => p[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  }

  const cards = $derived<KanbanCard[]>(
    localTasks.map((t) => ({
      id: t.id,
      title: t.title,
      titleHref: `/clients/${t.customer_id}/tasks`,
      subtitle: shortId(t.id),
      status: t.status,
      priority: priorityToKanban(t.priority as TaskPriority),
      priorityValue: t.priority,
      dueDate: t.due_at ? dueLabel(t.due_at) : undefined,
      dueDateISO: t.due_at,
      assignees: t.assignee?.display_name
        ? [{ name: t.assignee.display_name, initials: getInitials(t.assignee.display_name) }]
        : []
    }))
  );

  // 4-tier priority. The kanban renders the visual using 3 bars (high/med/low);
  // here we keep all 4 user-visible options so urgent isn't silently downgraded.
  const PRIORITY_OPTIONS: KanbanPriorityOption[] = [
    { value: 'urgent', label: 'Urgent', visual: 'high' },
    { value: 'high', label: 'High', visual: 'high' },
    { value: 'normal', label: 'Normal', visual: 'med' },
    { value: 'low', label: 'Low', visual: 'low' }
  ];

  const assigneeOptions = $derived<KanbanAssigneeOption[]>(
    data.admins.map((a) => ({
      id: a.id,
      name: a.display_name ?? a.id.slice(0, 8),
      initials: getInitials(a.display_name)
    }))
  );

  async function postUpdate(action: string, fields: Record<string, string>) {
    const body = new FormData();
    for (const [k, v] of Object.entries(fields)) body.set(k, v);
    const res = await fetch(`?/${action}`, { method: 'POST', body });
    if (res.ok) void invalidateAll();
  }

  function patchTask(cardId: string, patch: Partial<Task>) {
    const idx = localTasks.findIndex((t) => t.id === cardId);
    const current = idx >= 0 ? localTasks[idx] : undefined;
    if (!current) return;
    const next = [...localTasks];
    next[idx] = { ...current, ...patch };
    localTasks = next;
  }

  async function handleStatusChange(cardId: string, newStatus: string) {
    patchTask(cardId, { status: newStatus as TaskStatus });
    await postUpdate('setStatus', { id: cardId, status: newStatus });
  }

  async function handleDueChange(cardId: string, iso: string | null) {
    patchTask(cardId, { due_at: iso });
    await postUpdate('setDue', { id: cardId, due_at: iso ?? '' });
  }

  async function handlePriorityChange(cardId: string, value: string) {
    patchTask(cardId, { priority: value as TaskPriority });
    await postUpdate('setPriority', { id: cardId, priority: value });
  }

  async function handleAssigneeAdd(cardId: string, assigneeId: string) {
    const admin = data.admins.find((a) => a.id === assigneeId);
    patchTask(cardId, {
      assigned_to: assigneeId,
      assignee: admin ? { display_name: admin.display_name ?? null } : null
    } as Partial<Task>);
    await postUpdate('setAssignee', { id: cardId, assigned_to: assigneeId });
  }

  function handleCardClick(card: KanbanCard) {
    const t = localTasks.find((x) => x.id === card.id);
    if (!t) return;
    void goto(`/clients/${t.customer_id}/tasks`);
  }
</script>

<svelte:head><title>Tasks · Supply Admin</title></svelte:head>

<section class="kb">
  <header class="kb-head">
    <div>
      <h1>Sprint board</h1>
      <p class="meta">
        {localTasks.length} tasks
        {#if stats.overdue > 0}
          <span class="dot">·</span>
          <span class="warn">{stats.overdue} overdue</span>
        {/if}
        {#if stats.unassigned > 0}
          <span class="dot">·</span> {stats.unassigned} unassigned
        {/if}
        {#if data.total > data.limit}
          <span class="dot">·</span>
          <span class="warn">cap {data.limit}; narrow filters to see more</span>
        {/if}
      </p>
    </div>
    <div class="head-right">
      <div class="tabs">
        {#each VIEWS as v}
          <a href="?view={v.key}" class="tab" class:active={data.filters.view === v.key}>
            {v.label}
          </a>
        {/each}
      </div>
      <button type="button" class="new-task" onclick={openCreate}>+ New task</button>
    </div>
  </header>

  <dialog bind:this={createDialog} class="create-dialog">
    <form
      method="POST"
      action="?/create"
      use:enhance={() =>
        async ({ result, update }) => {
          await update();
          if (result.type === 'success') closeCreate();
        }}
    >
      <header>
        <h2>New task</h2>
        <button type="button" class="close" onclick={closeCreate} aria-label="Close">×</button>
      </header>

      {#if form?.message}
        <p class="err">{form.message}</p>
      {/if}

      <label>
        <span>Title</span>
        <input name="title" required autocomplete="off" />
      </label>
      <label>
        <span>Customer</span>
        <Select name="customer_id" required>
          <option value="">Select a customer…</option>
          {#each data.customers as c (c.id)}
            <option value={c.id}>{c.business_name}</option>
          {/each}
        </Select>
      </label>
      <label>
        <span>Description</span>
        <textarea name="description" rows="2"></textarea>
      </label>
      <div class="row">
        <label>
          <span>Assignee</span>
          <Select name="assigned_to">
            <option value="">Unassigned</option>
            {#each data.admins as a (a.id)}
              <option value={a.id}>{a.display_name ?? a.id.slice(0, 8)}</option>
            {/each}
          </Select>
        </label>
        <label>
          <span>Priority</span>
          <Select name="priority">
            <option value="low">Low</option>
            <option value="normal" selected>Normal</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </Select>
        </label>
        <label>
          <span>Due</span>
          <input type="datetime-local" name="due_at" />
        </label>
      </div>

      <footer>
        <button type="button" class="ghost" onclick={closeCreate}>Cancel</button>
        <button type="submit" class="primary">Create task</button>
      </footer>
    </form>
  </dialog>

  <form method="GET" class="kb-filters">
    <input type="hidden" name="view" value={data.filters.view} />
    <Select name="priority" aria-label="Priority filter">
      <option value="">Any priority</option>
      <option value="urgent" selected={data.filters.priority === 'urgent'}>Urgent</option>
      <option value="high" selected={data.filters.priority === 'high'}>High</option>
      <option value="normal" selected={data.filters.priority === 'normal'}>Normal</option>
      <option value="low" selected={data.filters.priority === 'low'}>Low</option>
    </Select>
    <Select name="assignee" aria-label="Assignee filter">
      <option value="">Any assignee</option>
      {#each data.admins as a}
        <option value={a.id} selected={data.filters.assignee === a.id}>
          {a.display_name ?? a.id.slice(0, 8)}
        </option>
      {/each}
    </Select>
    <button type="submit">Apply</button>
  </form>

  <KanbanBoard
    columns={COLUMNS}
    {cards}
    statusColors={STATUS_COLORS}
    statusRingConfig={STATUS_RING_CONFIG}
    priorityOptions={PRIORITY_OPTIONS}
    {assigneeOptions}
    onStatusChange={handleStatusChange}
    onCardClick={handleCardClick}
    onDueDateChange={handleDueChange}
    onPriorityChange={handlePriorityChange}
    onAssigneeAdd={handleAssigneeAdd}
  />
</section>

<style>
  .kb {
    color: oklch(0.18 0.01 270);
  }
  .kb-head {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
    margin-bottom: 1rem;
  }
  .kb-head h1 {
    font-size: 1.5rem;
    font-weight: 600;
    letter-spacing: -0.01em;
    margin: 0;
  }
  .kb-head .meta {
    color: oklch(0.55 0.01 270);
    font-size: 0.8125rem;
    margin: 0.25rem 0 0;
  }
  .kb-head .meta .dot {
    color: oklch(0.72 0.008 270);
    margin: 0 0.35rem;
  }
  .kb-head .meta .warn {
    color: oklch(0.6 0.21 25);
  }
  .head-right {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
  }
  .new-task {
    height: 32px;
    padding: 0 0.9rem;
    border-radius: 8px;
    background: oklch(0.18 0.01 270);
    color: oklch(0.99 0 0);
    font-size: 0.8125rem;
    font-weight: 500;
    border: 1px solid transparent;
    cursor: pointer;
    transition: background 0.15s ease;
  }
  .new-task:hover {
    background: oklch(0.28 0.01 270);
  }
  .tabs {
    display: inline-flex;
    background: oklch(1 0 0);
    border: 1px solid oklch(0.92 0.005 270);
    border-radius: 8px;
    padding: 3px;
    gap: 2px;
  }

  /* ── Create dialog ────────────────────────────────────────────────────── */
  .create-dialog {
    /* Center in viewport regardless of ambient layout */
    position: fixed;
    inset: 0;
    margin: auto;
    width: min(520px, calc(100vw - 2rem));
    max-height: calc(100vh - 2rem);
    overflow: auto;

    border: 0;
    border-radius: 12px;
    padding: 0;
    box-shadow:
      0 18px 48px rgba(0, 0, 0, 0.18),
      0 4px 10px rgba(0, 0, 0, 0.08);
    color: oklch(0.18 0.01 270);
    background: oklch(1 0 0);
  }
  .create-dialog[open] {
    animation: dialog-in 0.16s cubic-bezier(0.2, 0.7, 0.3, 1);
  }
  @keyframes dialog-in {
    from {
      opacity: 0;
      transform: translateY(-4px) scale(0.98);
    }
    to {
      opacity: 1;
      transform: none;
    }
  }
  .create-dialog::backdrop {
    background: rgba(15, 23, 42, 0.45);
    backdrop-filter: blur(2px);
  }
  .create-dialog form {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 1rem 1.25rem 1.1rem;
  }
  .create-dialog header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin: -0.25rem -0.25rem 0.25rem;
  }
  .create-dialog h2 {
    margin: 0;
    font-size: 1.05rem;
    font-weight: 600;
    letter-spacing: -0.01em;
  }
  .create-dialog .close {
    width: 28px;
    height: 28px;
    border: 0;
    background: transparent;
    color: oklch(0.55 0.01 270);
    font-size: 1.4rem;
    line-height: 1;
    cursor: pointer;
    border-radius: 6px;
  }
  .create-dialog .close:hover {
    background: oklch(0.96 0.005 270);
    color: oklch(0.18 0.01 270);
  }
  .create-dialog label {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    font-size: 0.75rem;
    font-weight: 500;
    color: oklch(0.36 0.01 270);
  }
  .create-dialog label > span {
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .create-dialog input,
  .create-dialog textarea {
    width: 100%;
    padding: 0.5rem 0.65rem;
    border: 1px solid oklch(0.92 0.005 270);
    border-radius: 8px;
    font-size: 0.875rem;
    font-family: inherit;
    color: oklch(0.18 0.01 270);
    background: oklch(1 0 0);
  }
  .create-dialog input:focus,
  .create-dialog textarea:focus {
    outline: 2px solid oklch(0.6 0.16 240);
    outline-offset: 0;
    border-color: transparent;
  }
  .create-dialog .row {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.6rem;
  }
  .create-dialog .err {
    margin: 0;
    padding: 0.5rem 0.65rem;
    border-radius: 8px;
    background: oklch(0.95 0.06 25 / 0.5);
    border: 1px solid oklch(0.8 0.12 25 / 0.4);
    color: oklch(0.45 0.18 25);
    font-size: 0.8125rem;
  }
  .create-dialog footer {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
    margin-top: 0.5rem;
  }
  .create-dialog .ghost,
  .create-dialog .primary {
    height: 34px;
    padding: 0 0.95rem;
    border-radius: 8px;
    font-size: 0.8125rem;
    font-weight: 500;
    cursor: pointer;
    border: 1px solid transparent;
  }
  .create-dialog .ghost {
    background: transparent;
    color: oklch(0.36 0.01 270);
    border-color: oklch(0.92 0.005 270);
  }
  .create-dialog .ghost:hover {
    background: oklch(0.96 0.005 270);
  }
  .create-dialog .primary {
    background: oklch(0.18 0.01 270);
    color: oklch(0.99 0 0);
  }
  .create-dialog .primary:hover {
    background: oklch(0.28 0.01 270);
  }
  .tab {
    padding: 0.4rem 0.85rem;
    font-size: 0.8125rem;
    border-radius: 5px;
    color: oklch(0.36 0.01 270);
    text-decoration: none;
    transition:
      background 0.15s ease,
      color 0.15s ease;
    user-select: none;
  }
  .tab:hover {
    color: oklch(0.18 0.01 270);
    background: oklch(0.96 0.005 270);
  }
  .tab.active {
    background: oklch(0.18 0.01 270);
    color: oklch(0.99 0 0);
  }
  .kb-filters {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }
  .kb-filters button {
    height: 32px;
    border-radius: 8px;
    background: oklch(0.18 0.01 270);
    color: oklch(0.99 0 0);
    font-size: 0.8125rem;
    font-weight: 500;
    border: 1px solid transparent;
    padding: 0 0.85rem;
    cursor: pointer;
  }
  .kb-filters button:hover {
    background: oklch(0.28 0.01 270);
  }
</style>

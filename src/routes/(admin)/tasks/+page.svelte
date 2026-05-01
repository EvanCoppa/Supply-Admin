<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import type { TaskStatus, TaskPriority } from '$lib/types/db';

  let { data } = $props();

  type Task = (typeof data.tasks)[number];
  type StatusKey = TaskStatus;
  type StatusVis = 'new' | 'prog' | 'done' | 'cancel';

  const COLS: Array<{ key: StatusKey; title: string; vis: StatusVis; pct: number }> = [
    { key: 'open', title: 'Backlog', vis: 'new', pct: 0 },
    { key: 'in_progress', title: 'In Progress', vis: 'prog', pct: 0.5 },
    { key: 'done', title: 'Shipped', vis: 'done', pct: 1 },
    { key: 'cancelled', title: 'Cancelled', vis: 'cancel', pct: 0 }
  ];

  const VIEWS = [
    { key: 'mine', label: 'Mine' },
    { key: 'overdue', label: 'Overdue' },
    { key: 'unassigned', label: 'Unassigned' },
    { key: 'all', label: 'All' }
  ];

  // Local mirror of tasks so we can do optimistic moves and reorders during drag.
  let localTasks = $state<Task[]>([]);
  $effect(() => {
    localTasks = [...data.tasks];
  });

  const tasksByStatus = $derived.by(() => {
    const buckets: Record<StatusKey, Task[]> = {
      open: [],
      in_progress: [],
      done: [],
      cancelled: []
    };
    for (const t of localTasks) buckets[t.status as StatusKey].push(t);
    return buckets;
  });

  const stats = $derived.by(() => {
    let overdueCount = 0;
    let unassigned = 0;
    for (const t of localTasks) {
      if (isOverdue(t)) overdueCount++;
      if (!t.assigned_to) unassigned++;
    }
    return { overdue: overdueCount, unassigned };
  });

  function isOverdue(t: Task): boolean {
    return (
      !!t.due_at &&
      (t.status === 'open' || t.status === 'in_progress') &&
      new Date(t.due_at).getTime() < Date.now()
    );
  }

  function visFromStatus(s: StatusKey): StatusVis {
    if (s === 'open') return 'new';
    if (s === 'in_progress') return 'prog';
    if (s === 'done') return 'done';
    return 'cancel';
  }

  function pctFromStatus(s: StatusKey): number {
    if (s === 'done') return 1;
    if (s === 'in_progress') return 0.5;
    return 0;
  }

  function shortId(id: string): string {
    return id.slice(0, 6).toUpperCase();
  }

  function dueLabel(d: string | null): string {
    if (!d) return '';
    const date = new Date(d);
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  function avatarLetter(name: string | null | undefined): string {
    if (!name) return '·';
    const trimmed = name.trim();
    return trimmed ? trimmed.slice(0, 1).toUpperCase() : '·';
  }

  function avatarTone(name: string | null | undefined): string {
    if (!name) return 'a0';
    let h = 0;
    for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
    return ['a1', 'a2', 'a3', 'a4'][h % 4];
  }

  // ── Drag machinery ──────────────────────────────────────────────────────
  type DragState = {
    cardId: string;
    pointerId: number;
    fromStatus: StatusKey;
    fromIndex: number;
    w: number;
    h: number;
    x: number;
    y: number;
    ox: number;
    oy: number;
    over: { status: StatusKey; index: number } | null;
  };

  let dragState = $state<DragState | null>(null);
  let boardEl: HTMLDivElement | undefined = $state();

  function findTask(id: string): Task | undefined {
    return localTasks.find((t) => t.id === id);
  }

  function computeDropTarget(
    clientX: number,
    clientY: number
  ): { status: StatusKey; index: number } | null {
    if (!boardEl) return null;
    const colEls = Array.from(boardEl.querySelectorAll<HTMLElement>('.col'));
    let targetEl: HTMLElement | null = null;
    for (const el of colEls) {
      const r = el.getBoundingClientRect();
      if (clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom) {
        targetEl = el;
        break;
      }
    }
    if (!targetEl) {
      let best: HTMLElement | null = null;
      let bestDx = Infinity;
      for (const el of colEls) {
        const r = el.getBoundingClientRect();
        const cx = (r.left + r.right) / 2;
        const dx = Math.abs(clientX - cx);
        if (dx < bestDx) {
          bestDx = dx;
          best = el;
        }
      }
      targetEl = best;
    }
    if (!targetEl) return null;
    const status = targetEl.dataset.status as StatusKey;
    const cardEls = targetEl.querySelectorAll<HTMLElement>('.card:not(.is-dragging)');
    let index = 0;
    let placed = false;
    for (let i = 0; i < cardEls.length; i++) {
      const r = cardEls[i].getBoundingClientRect();
      const mid = r.top + r.height / 2;
      if (clientY < mid) {
        index = i;
        placed = true;
        break;
      }
    }
    if (!placed) index = cardEls.length;
    return { status, index };
  }

  function onCardPointerDown(e: PointerEvent, taskId: string) {
    if (e.button !== 0) return;
    const target = e.currentTarget as HTMLElement;
    if ((e.target as HTMLElement).closest('a, button, select, input, textarea')) return;

    const r = target.getBoundingClientRect();
    const t = findTask(taskId);
    if (!t) return;
    const fromStatus = t.status as StatusKey;
    const fromIndex = tasksByStatus[fromStatus].findIndex((x) => x.id === taskId);
    if (fromIndex < 0) return;

    e.preventDefault();
    target.setPointerCapture?.(e.pointerId);
    document.body.classList.add('kb-dragging');

    dragState = {
      cardId: taskId,
      pointerId: e.pointerId,
      fromStatus,
      fromIndex,
      w: r.width,
      h: r.height,
      x: r.left,
      y: r.top,
      ox: e.clientX - r.left,
      oy: e.clientY - r.top,
      over: { status: fromStatus, index: fromIndex }
    };

    const onMove = (ev: PointerEvent) => {
      if (!dragState) return;
      const nx = ev.clientX - dragState.ox;
      const ny = ev.clientY - dragState.oy;
      const over = computeDropTarget(ev.clientX, ev.clientY) ?? dragState.over;
      dragState = { ...dragState, x: nx, y: ny, over };
    };

    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      document.body.classList.remove('kb-dragging');

      const d = dragState;
      dragState = null;
      if (!d) return;

      const targetStatus: StatusKey = d.over?.status ?? d.fromStatus;
      let targetIdx = d.over?.index ?? d.fromIndex;
      if (d.fromStatus === targetStatus && targetIdx > d.fromIndex) targetIdx -= 1;

      const flatIdx = localTasks.findIndex((t) => t.id === d.cardId);
      if (flatIdx < 0) return;
      const next = [...localTasks];
      const [task] = next.splice(flatIdx, 1);
      const moved: Task = { ...task, status: targetStatus };

      const idsForStatus = next.filter((t) => t.status === targetStatus).map((t) => t.id);
      let insertFlat: number;
      if (targetIdx >= idsForStatus.length) {
        let lastFlat = -1;
        for (let i = next.length - 1; i >= 0; i--) {
          if (next[i].status === targetStatus) {
            lastFlat = i;
            break;
          }
        }
        insertFlat = lastFlat + 1;
        if (insertFlat <= 0) {
          // No tasks in target column — append at end of array.
          insertFlat = next.length;
        }
      } else {
        const targetCardId = idsForStatus[targetIdx];
        insertFlat = next.findIndex((t) => t.id === targetCardId);
      }
      next.splice(insertFlat, 0, moved);
      localTasks = next;

      if (d.fromStatus !== targetStatus) {
        const body = new FormData();
        body.set('id', d.cardId);
        body.set('status', targetStatus);
        fetch('?/setStatus', { method: 'POST', body }).then((res) => {
          if (res.ok) invalidateAll();
        });
      }
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  }

  const draggingTask = $derived(dragState ? findTask(dragState.cardId) ?? null : null);
</script>

<svelte:head><title>Tasks · Supply Admin</title></svelte:head>

<section class="kb">
  <header class="kb-head">
    <div>
      <h1>Sprint board</h1>
      <p class="meta">
        {localTasks.length} tasks
        {#if stats.overdue > 0}<span class="dot">·</span> <span class="warn">{stats.overdue} overdue</span>{/if}
        {#if stats.unassigned > 0}<span class="dot">·</span> {stats.unassigned} unassigned{/if}
        {#if data.total > data.limit}
          <span class="dot">·</span>
          <span class="warn">cap {data.limit}; narrow filters to see more</span>
        {/if}
      </p>
    </div>
    <div class="tabs">
      {#each VIEWS as v}
        <a href="?view={v.key}" class="tab" class:active={data.filters.view === v.key}>
          {v.label}
        </a>
      {/each}
    </div>
  </header>

  <form method="GET" class="kb-filters">
    <input type="hidden" name="view" value={data.filters.view} />
    <select name="priority" aria-label="Priority filter">
      <option value="">Any priority</option>
      <option value="urgent" selected={data.filters.priority === 'urgent'}>Urgent</option>
      <option value="high" selected={data.filters.priority === 'high'}>High</option>
      <option value="normal" selected={data.filters.priority === 'normal'}>Normal</option>
      <option value="low" selected={data.filters.priority === 'low'}>Low</option>
    </select>
    <select name="assignee" aria-label="Assignee filter">
      <option value="">Any assignee</option>
      {#each data.admins as a}
        <option value={a.id} selected={data.filters.assignee === a.id}>
          {a.display_name ?? a.id.slice(0, 8)}
        </option>
      {/each}
    </select>
    <button type="submit">Apply</button>
  </form>

  <div class="board" bind:this={boardEl}>
    {#each COLS as col}
      {@const items = tasksByStatus[col.key]}
      {@const isOver = !!dragState && dragState.over?.status === col.key}
      <div
        class="col col-{col.vis}"
        class:drop-active={isOver}
        data-status={col.key}
      >
        <div class="col-head">
          <div class="col-title">
            {@render Ring(col.pct, col.vis, 16)}
            <span class="title">{col.title}</span>
            <span class="count">{items.length}</span>
          </div>
          <div class="col-actions">
            <button class="icon-btn" type="button" title="Reorder" aria-label="Reorder">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="8" r="1.4"/><circle cx="12" cy="8" r="1.4"/><circle cx="19" cy="8" r="1.4"/><circle cx="5" cy="16" r="1.4"/><circle cx="12" cy="16" r="1.4"/><circle cx="19" cy="16" r="1.4"/></svg>
            </button>
            <button class="icon-btn" type="button" title="Add" aria-label="Add">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
            </button>
          </div>
        </div>
        <div class="col-accent" style="--pct: {Math.round(col.pct * 100)}%"></div>

        <div class="cards">
          {#each items as t, i (t.id)}
            {@const hidden = !!dragState && dragState.cardId === t.id}
            {#if isOver && dragState && dragState.over?.index === i && !hidden}
              <div class="card-placeholder" style="height: {dragState.h}px"></div>
            {/if}
            {#if !hidden}
              {@render TaskCard(t)}
            {/if}
          {/each}
          {#if isOver && dragState && dragState.over && dragState.over.index >= items.filter((t) => !(dragState && dragState.cardId === t.id)).length}
            <div class="card-placeholder" style="height: {dragState.h}px"></div>
          {/if}
          {#if items.length === 0 && !isOver}
            <p class="empty">No tasks</p>
          {/if}
        </div>

        <button class="add-task" type="button">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v8M8 12h8"/></svg>
          Add task
        </button>
      </div>
    {/each}
  </div>

  {#if dragState && draggingTask}
    <div
      class="card is-dragging"
      style="position: fixed; left: 0; top: 0; width: {dragState.w}px; transform: translate3d({dragState.x}px, {dragState.y}px, 0) rotate(1.5deg) scale(1.02);"
    >
      {@render CardBody(draggingTask)}
    </div>
  {/if}
</section>

{#snippet Ring(pct: number, vis: StatusVis, size: number)}
  {@const cx = size / 2}
  {@const cy = size / 2}
  {@const r = size / 2 - 1.3}
  {@const stroke = 1.6}
  {@const rInner = r - stroke / 2 - 1.4}
  {@const p = Math.max(0.05, Math.min(0.95, pct || (vis === 'prog' ? 0.5 : 0.3)))}
  <span class="ring vis-{vis}" style="width: {size}px; height: {size}px;">
    <svg viewBox="0 0 {size} {size}" style="width:100%; height:100%; display:block">
      {#if vis === 'new'}
        <circle {cx} {cy} {r} fill="none" stroke="currentColor" stroke-width={stroke} stroke-dasharray="2 2" stroke-linecap="round"/>
      {:else if vis === 'done'}
        <circle {cx} {cy} {r} fill="currentColor" stroke="currentColor" stroke-width={stroke}/>
        <path d="M {size * 0.28} {size * 0.52} L {size * 0.44} {size * 0.67} L {size * 0.74} {size * 0.36}" fill="none" stroke="#fff" stroke-width={stroke + 0.2} stroke-linecap="round" stroke-linejoin="round"/>
      {:else if vis === 'cancel'}
        <circle {cx} {cy} {r} fill="none" stroke="currentColor" stroke-width={stroke} opacity="0.6"/>
        <path d="M {size * 0.32} {size * 0.32} L {size * 0.68} {size * 0.68} M {size * 0.68} {size * 0.32} L {size * 0.32} {size * 0.68}" fill="none" stroke="currentColor" stroke-width={stroke} stroke-linecap="round" opacity="0.8"/>
      {:else}
        {@const ang = p * 2 * Math.PI}
        {@const x = cx + rInner * Math.sin(ang)}
        {@const y = cy - rInner * Math.cos(ang)}
        {@const large = p > 0.5 ? 1 : 0}
        {@const slice = pct >= 0.999 ? `M ${cx} ${cy} m 0 -${rInner} a ${rInner} ${rInner} 0 1 1 -0.01 0 Z` : `M ${cx} ${cy} L ${cx} ${cy - rInner} A ${rInner} ${rInner} 0 ${large} 1 ${x} ${y} Z`}
        <circle {cx} {cy} {r} fill="none" stroke="currentColor" stroke-width={stroke}/>
        <path d={slice} fill="currentColor"/>
      {/if}
    </svg>
  </span>
{/snippet}

{#snippet TaskCard(t: Task)}
  <article
    class="card"
    class:overdue={isOverdue(t)}
    data-card-id={t.id}
    onpointerdown={(e) => onCardPointerDown(e, t.id)}
  >
    {@render CardBody(t)}
  </article>
{/snippet}

{#snippet CardBody(t: Task)}
  {@const vis = visFromStatus(t.status as StatusKey)}
  {@const prio = t.priority as TaskPriority}
  <div class="card-top">
    <span class="ticket vis-{vis}">
      <svg class="link-ic" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
      <span class="ticket-id">{shortId(t.id)}</span>
      {@render Ring(pctFromStatus(t.status as StatusKey), vis, 12)}
    </span>
    <a class="customer" href="/clients/{t.customer_id}" onpointerdown={(e) => e.stopPropagation()}>
      {t.customer?.business_name ?? '—'}
    </a>
  </div>

  <h3 class="card-title">
    <a href="/clients/{t.customer_id}/tasks" onpointerdown={(e) => e.stopPropagation()}>{t.title}</a>
  </h3>

  {#if t.description}
    <p class="desc">{t.description}</p>
  {/if}

  <div class="bars-row">
    {#if t.due_at}
      <span class="due" class:warn={isOverdue(t)}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
        {dueLabel(t.due_at)}
      </span>
    {:else}
      <span class="due muted">No due date</span>
    {/if}
    <span class="prio prio-{prio}">
      <span class="bars"><span></span><span></span><span></span></span>
      <span class="prio-label">{prio}</span>
    </span>
  </div>

  <div class="card-foot">
    <div class="assignee">
      <span class="av {avatarTone(t.assignee?.display_name)}">{avatarLetter(t.assignee?.display_name)}</span>
      <span class="assignee-name">{t.assignee?.display_name ?? 'Unassigned'}</span>
    </div>
  </div>
{/snippet}

<style>
  /* ── Tokens ───────────────────────────────────────────────────────────── */
  .kb {
    --kb-bg: oklch(0.985 0.005 270);
    --kb-surface: oklch(1 0 0);
    --kb-border: oklch(0.92 0.005 270);
    --kb-border-strong: oklch(0.86 0.005 270);
    --kb-ink-1: oklch(0.18 0.01 270);
    --kb-ink-2: oklch(0.36 0.01 270);
    --kb-ink-3: oklch(0.55 0.01 270);
    --kb-ink-4: oklch(0.72 0.008 270);
    --kb-radius: 12px;
    --kb-radius-sm: 8px;

    --kb-status-new: oklch(0.62 0.015 270);
    --kb-status-prog: oklch(0.6 0.16 240);
    --kb-status-done: oklch(0.62 0.14 150);
    --kb-status-cancel: oklch(0.62 0.01 270);

    --kb-prio-low: oklch(0.78 0.01 270);
    --kb-prio-med: oklch(0.62 0.14 220);
    --kb-prio-high: oklch(0.7 0.16 65);
    --kb-prio-urgent: oklch(0.6 0.21 25);

    --kb-av-1: oklch(0.65 0.13 28);
    --kb-av-2: oklch(0.65 0.12 200);
    --kb-av-3: oklch(0.65 0.13 280);
    --kb-av-4: oklch(0.62 0.14 150);
    --kb-av-0: oklch(0.78 0.005 270);

    color: var(--kb-ink-1);
    font-feature-settings: 'cv11', 'ss01';
  }

  /* ── Page header ──────────────────────────────────────────────────────── */
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
    color: var(--kb-ink-1);
    margin: 0;
  }
  .kb-head .meta {
    color: var(--kb-ink-3);
    font-size: 0.8125rem;
    margin: 0.25rem 0 0;
  }
  .kb-head .meta .dot {
    color: var(--kb-ink-4);
    margin: 0 0.35rem;
  }
  .kb-head .meta .warn {
    color: var(--kb-prio-urgent);
  }
  .tabs {
    display: inline-flex;
    background: var(--kb-surface);
    border: 1px solid var(--kb-border);
    border-radius: 999px;
    padding: 3px;
    gap: 2px;
  }
  .tab {
    padding: 0.4rem 0.85rem;
    font-size: 0.8125rem;
    border-radius: 999px;
    color: var(--kb-ink-2);
    text-decoration: none;
    transition: background 0.15s ease, color 0.15s ease;
    user-select: none;
  }
  .tab:hover {
    color: var(--kb-ink-1);
    background: oklch(0.96 0.005 270);
  }
  .tab.active {
    background: var(--kb-ink-1);
    color: oklch(0.99 0 0);
  }

  /* ── Filters ──────────────────────────────────────────────────────────── */
  .kb-filters {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }
  .kb-filters select,
  .kb-filters button {
    height: 32px;
    border-radius: var(--kb-radius-sm);
    border: 1px solid var(--kb-border-strong);
    background: var(--kb-surface);
    padding: 0 0.65rem;
    font-size: 0.8125rem;
    color: var(--kb-ink-1);
    cursor: pointer;
  }
  .kb-filters button {
    background: var(--kb-ink-1);
    color: oklch(0.99 0 0);
    font-weight: 500;
    border-color: transparent;
    padding: 0 0.85rem;
  }
  .kb-filters button:hover {
    background: oklch(0.28 0.01 270);
  }

  /* ── Board ────────────────────────────────────────────────────────────── */
  .board {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 1rem;
    align-items: start;
  }
  @media (max-width: 1100px) {
    .board { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  }
  @media (max-width: 640px) {
    .board { grid-template-columns: 1fr; }
  }

  /* ── Column ───────────────────────────────────────────────────────────── */
  .col {
    background: var(--kb-bg);
    border: 1px solid var(--kb-border);
    border-radius: var(--kb-radius);
    padding: 0.5rem 0.5rem 0.625rem;
    position: relative;
    transition: background 0.18s ease, border-color 0.18s ease;
    min-height: 8rem;
  }
  .col.drop-active {
    background: oklch(0.97 0.01 270);
    border-color: var(--kb-border-strong);
  }
  .col-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.5rem 0.5rem 0.4rem;
    gap: 0.5rem;
  }
  .col-title {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.8125rem;
    color: var(--kb-ink-1);
    font-weight: 600;
    letter-spacing: -0.005em;
    min-width: 0;
  }
  .col-title .title {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .col-title .count {
    color: var(--kb-ink-3);
    font-weight: 500;
    font-variant-numeric: tabular-nums;
  }
  .col-actions {
    display: flex;
    gap: 2px;
  }
  .icon-btn {
    width: 22px;
    height: 22px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 6px;
    border: 0;
    background: transparent;
    color: var(--kb-ink-3);
    cursor: pointer;
    padding: 0;
  }
  .icon-btn:hover {
    background: oklch(0.94 0.005 270);
    color: var(--kb-ink-1);
  }

  .col-accent {
    height: 2px;
    margin: 0 0.25rem 0.5rem;
    border-radius: 2px;
    background: linear-gradient(
      to right,
      currentColor calc(var(--pct, 0%)),
      var(--kb-border) calc(var(--pct, 0%))
    );
    color: var(--kb-status-new);
    opacity: 0.85;
  }
  .col-new .col-accent { color: var(--kb-status-new); }
  .col-prog .col-accent { color: var(--kb-status-prog); }
  .col-done .col-accent { color: var(--kb-status-done); }
  .col-cancel .col-accent { color: var(--kb-status-cancel); }

  /* ── Ring (status indicator) ──────────────────────────────────────────── */
  .ring {
    display: inline-block;
    flex-shrink: 0;
    line-height: 0;
  }
  .ring.vis-new { color: var(--kb-status-new); }
  .ring.vis-prog { color: var(--kb-status-prog); }
  .ring.vis-done { color: var(--kb-status-done); }
  .ring.vis-cancel { color: var(--kb-status-cancel); }

  /* ── Cards list ───────────────────────────────────────────────────────── */
  .cards {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0 0.25rem;
    min-height: 1.5rem;
  }
  .empty {
    color: var(--kb-ink-4);
    font-size: 0.75rem;
    text-align: center;
    padding: 1.25rem 0;
    margin: 0;
  }

  /* ── Card ─────────────────────────────────────────────────────────────── */
  .card {
    background: var(--kb-surface);
    border: 1px solid var(--kb-border);
    border-radius: var(--kb-radius);
    padding: 0.75rem;
    box-shadow: 0 1px 0 oklch(0.94 0.005 270 / 0.5);
    cursor: grab;
    user-select: none;
    touch-action: none;
    transition: box-shadow 0.18s ease, border-color 0.18s ease, transform 0.18s ease;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .card:hover {
    border-color: var(--kb-border-strong);
    box-shadow: 0 1px 2px oklch(0.5 0.02 270 / 0.06), 0 4px 14px oklch(0.5 0.02 270 / 0.05);
  }
  .card.overdue {
    box-shadow: inset 0 0 0 1px oklch(0.7 0.16 25 / 0.4), 0 1px 0 oklch(0.94 0.005 270 / 0.5);
  }
  .card.is-dragging {
    cursor: grabbing;
    box-shadow:
      0 12px 28px oklch(0.3 0.05 270 / 0.18),
      0 4px 8px oklch(0.3 0.05 270 / 0.12);
    border-color: var(--kb-border-strong);
    pointer-events: none;
    z-index: 999;
  }
  :global(body.kb-dragging) {
    cursor: grabbing;
  }
  :global(body.kb-dragging) * {
    cursor: grabbing !important;
  }

  .card-placeholder {
    border: 1.5px dashed var(--kb-border-strong);
    border-radius: var(--kb-radius);
    background: oklch(0.97 0.01 270 / 0.4);
    transition: height 0.18s ease;
  }

  .card-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    min-width: 0;
  }
  .ticket {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    font-family: ui-monospace, 'SF Mono', Menlo, monospace;
    font-size: 0.6875rem;
    font-weight: 500;
    letter-spacing: 0.02em;
    color: var(--kb-ink-2);
    background: oklch(0.96 0.005 270);
    padding: 0.2rem 0.4rem;
    border-radius: 6px;
    line-height: 1;
  }
  .ticket .link-ic {
    color: var(--kb-ink-3);
  }
  .ticket-id {
    color: var(--kb-ink-2);
  }
  .customer {
    color: var(--kb-ink-3);
    font-size: 0.75rem;
    text-decoration: none;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
    flex: 1 1 auto;
    text-align: right;
  }
  .customer:hover {
    color: var(--kb-status-prog);
    text-decoration: underline;
  }

  .card-title {
    margin: 0;
    font-size: 0.875rem;
    font-weight: 500;
    line-height: 1.35;
    letter-spacing: -0.005em;
    color: var(--kb-ink-1);
  }
  .card-title a {
    color: inherit;
    text-decoration: none;
  }
  .card-title a:hover {
    color: var(--kb-status-prog);
  }
  .desc {
    margin: 0;
    font-size: 0.75rem;
    line-height: 1.45;
    color: var(--kb-ink-3);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .bars-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    color: var(--kb-ink-3);
    font-size: 0.75rem;
  }
  .due {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
  }
  .due.muted {
    color: var(--kb-ink-4);
  }
  .due.warn {
    color: var(--kb-prio-urgent);
  }
  .prio {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    text-transform: capitalize;
  }
  .bars {
    display: inline-flex;
    align-items: end;
    gap: 1.5px;
    height: 10px;
  }
  .bars span {
    width: 2.5px;
    border-radius: 1px;
    background: oklch(0.92 0.005 270);
  }
  .bars span:nth-child(1) { height: 4px; }
  .bars span:nth-child(2) { height: 7px; }
  .bars span:nth-child(3) { height: 10px; }
  .prio-label {
    font-size: 0.6875rem;
    color: var(--kb-ink-3);
  }
  .prio-low .bars span:nth-child(1) { background: var(--kb-prio-low); }
  .prio-low .prio-label { color: var(--kb-prio-low); }
  .prio-normal .bars span:nth-child(-n+2) { background: var(--kb-prio-med); }
  .prio-normal .prio-label { color: var(--kb-prio-med); }
  .prio-high .bars span { background: var(--kb-prio-high); }
  .prio-high .prio-label { color: var(--kb-prio-high); }
  .prio-urgent .bars span { background: var(--kb-prio-urgent); }
  .prio-urgent .prio-label { color: var(--kb-prio-urgent); font-weight: 600; }

  .card-foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    border-top: 1px solid var(--kb-border);
    padding-top: 0.5rem;
    margin-top: 0.125rem;
  }
  .assignee {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    color: var(--kb-ink-3);
    font-size: 0.75rem;
    min-width: 0;
  }
  .assignee-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .av {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 0.625rem;
    font-weight: 600;
    color: oklch(0.99 0 0);
    flex-shrink: 0;
  }
  .av.a0 { background: var(--kb-av-0); color: var(--kb-ink-2); }
  .av.a1 { background: var(--kb-av-1); }
  .av.a2 { background: var(--kb-av-2); }
  .av.a3 { background: var(--kb-av-3); }
  .av.a4 { background: var(--kb-av-4); }

  /* ── Add task ─────────────────────────────────────────────────────────── */
  .add-task {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
    width: calc(100% - 0.5rem);
    margin: 0.5rem 0.25rem 0;
    padding: 0.55rem;
    border: 1px dashed var(--kb-border-strong);
    border-radius: var(--kb-radius-sm);
    background: transparent;
    color: var(--kb-ink-3);
    font-size: 0.75rem;
    cursor: pointer;
    transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
  }
  .add-task:hover {
    background: var(--kb-surface);
    border-color: var(--kb-ink-3);
    color: var(--kb-ink-1);
  }
</style>

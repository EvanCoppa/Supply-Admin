<script lang="ts" module>
  export interface KanbanCardAssignee {
    name: string;
    initials: string;
    avatarBg?: string;
  }

  export interface KanbanCard {
    id: string;
    title: string;
    titleHref?: string | undefined;
    subtitle?: string | undefined;
    description?: string | null | undefined;
    status: string;
    assigneeName?: string | null | undefined;
    assignees?: KanbanCardAssignee[] | undefined;
    priority?: 'high' | 'med' | 'low' | undefined;
    /** Raw priority value (consumer-defined). When omitted, `priority` is used. */
    priorityValue?: string | undefined;
    dueDate?: string | undefined;
    /** Raw ISO timestamp — populates the inline date picker when editable. */
    dueDateISO?: string | null | undefined;
    commentCount?: number | undefined;
    attachmentCount?: number | undefined;
  }

  export interface KanbanColumnStatusOption {
    value: string;
    label?: string;
  }

  export interface KanbanColumn {
    key: string;
    label: string;
    colorVar: string;
    statuses?: string[];
    statusOptions?: KanbanColumnStatusOption[];
  }

  export interface KanbanPriorityOption {
    value: string;
    label: string;
    visual: 'high' | 'med' | 'low';
  }

  export interface KanbanAssigneeOption {
    id: string;
    name: string;
    initials?: string;
    avatarBg?: string;
  }
</script>

<script lang="ts">
  interface Props {
    columns: KanbanColumn[];
    cards: KanbanCard[];
    statusColors?: Record<string, string>;
    statusRingConfig?: Record<string, { fill: number | 'dot' | 'check' | 'x' }>;
    onCardClick?: (card: KanbanCard) => void;
    onCardMenuClick?: (card: KanbanCard, anchor: HTMLElement) => void;
    onStatusChange?: (cardId: string, newStatus: string) => void;
    // Inline-edit. When the callback is provided, the matching card element
    // becomes interactive. Without it, it renders as static text.
    onDueDateChange?: (cardId: string, iso: string | null) => void;
    onPriorityChange?: (cardId: string, value: string) => void;
    onAssigneeAdd?: (cardId: string, assigneeId: string) => void;
    priorityOptions?: KanbanPriorityOption[];
    assigneeOptions?: KanbanAssigneeOption[];
    loading?: boolean;
  }

  const {
    columns,
    cards,
    statusColors: statusColorsProp,
    statusRingConfig: statusRingConfigProp,
    onCardClick,
    onCardMenuClick,
    onStatusChange,
    onDueDateChange,
    onPriorityChange,
    onAssigneeAdd,
    priorityOptions,
    assigneeOptions,
    loading = false
  }: Props = $props();

  const MOBILE_LAYOUT_QUERY = '(max-width: 768px)';

  const DEFAULT_STATUS_COLORS: Record<string, string> = {
    New: '#9ca3af',
    Assigned: '#3b82f6',
    Contacted: '#8b5cf6',
    Open: '#06b6d4',
    Interested: '#10b981',
    Pending: '#f59e0b',
    Proposed: '#f97316',
    Qualified: '#22c55e',
    Disqualified: '#ef4444',
    Converted: '#6366f1',
    Closed: '#6366f1',
    'Closed-Won': '#16a34a',
    'Closed-Lost': '#dc2626'
  };

  const DEFAULT_STATUS_RING_CONFIG: Record<string, { fill: number | 'dot' | 'check' | 'x' }> = {
    New: { fill: 'dot' },
    Assigned: { fill: 0.2 },
    Contacted: { fill: 0.33 },
    Open: { fill: 0.45 },
    Interested: { fill: 0.55 },
    Pending: { fill: 0.65 },
    Proposed: { fill: 0.75 },
    Qualified: { fill: 0.88 },
    Converted: { fill: 1 },
    Closed: { fill: 1 },
    'Closed-Won': { fill: 1 },
    Disqualified: { fill: 'x' },
    'Closed-Lost': { fill: 1 }
  };

  const STATUS_COLORS = $derived({ ...DEFAULT_STATUS_COLORS, ...(statusColorsProp ?? {}) });
  const STATUS_RING_CONFIG = $derived({
    ...DEFAULT_STATUS_RING_CONFIG,
    ...(statusRingConfigProp ?? {})
  });

  const AVATAR_GRADIENTS = [
    'linear-gradient(135deg, #3b82f6, #8b5cf6)',
    'linear-gradient(135deg, #06b6d4, #3b82f6)',
    'linear-gradient(135deg, #10b981, #06b6d4)',
    'linear-gradient(135deg, #f59e0b, #f97316)',
    'linear-gradient(135deg, #ec4899, #8b5cf6)'
  ];

  // Ring geometry
  const CX = 8;
  const CY = 8;
  const OUTER_R = 6.0;
  const PIE_R = 3.8;

  function getColumnStatuses(column: KanbanColumn): string[] {
    return column.statuses?.length ? column.statuses : [column.key];
  }

  function formatStatusLabel(status: string): string {
    return status.replace(/-/g, ' ');
  }

  function getColumnStatusOptions(column: KanbanColumn): KanbanColumnStatusOption[] {
    if (column.statusOptions?.length) return column.statusOptions;
    return getColumnStatuses(column).map((status) => ({
      value: status,
      label: formatStatusLabel(status)
    }));
  }

  function pieSlicePath(fraction: number): string {
    if (fraction >= 1) {
      return `M ${CX} ${CY - PIE_R} A ${PIE_R} ${PIE_R} 0 1 1 ${CX - 0.001} ${CY - PIE_R} Z`;
    }
    const angle = fraction * 2 * Math.PI;
    const endX = CX + PIE_R * Math.sin(angle);
    const endY = CY - PIE_R * Math.cos(angle);
    const largeArc = fraction > 0.5 ? 1 : 0;
    return `M ${CX} ${CY} L ${CX} ${CY - PIE_R} A ${PIE_R} ${PIE_R} 0 ${largeArc} 1 ${endX} ${endY} Z`;
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

  function getAssigneeList(card: KanbanCard): KanbanCardAssignee[] {
    if (card.assignees?.length) return card.assignees;
    if (card.assigneeName)
      return [{ name: card.assigneeName, initials: getInitials(card.assigneeName) }];
    return [];
  }

  function getCompactCardMeta(card: KanbanCard): string | null {
    return card.subtitle ?? card.description ?? card.assigneeName ?? null;
  }

  // ── Inline-edit popover state ─────────────────────────────────────────
  type PopoverKind = 'priority' | 'assignee';
  let openPopover = $state<{ cardId: string; kind: PopoverKind } | null>(null);
  // Hidden date inputs per card — clicking the date chip programmatically
  // opens the native picker via showPicker().
  const dateInputRefs = new Map<string, HTMLInputElement>();

  function togglePopover(cardId: string, kind: PopoverKind) {
    if (openPopover?.cardId === cardId && openPopover.kind === kind) {
      openPopover = null;
    } else {
      openPopover = { cardId, kind };
    }
  }

  function openDatePicker(cardId: string) {
    const el = dateInputRefs.get(cardId);
    if (!el) return;
    // showPicker is supported in modern browsers; fall back to focus+click.
    if (typeof el.showPicker === 'function') el.showPicker();
    else el.click();
  }

  function emitDueChange(cardId: string, raw: string) {
    if (!onDueDateChange) return;
    const iso = raw ? new Date(raw).toISOString() : null;
    onDueDateChange(cardId, iso);
  }

  // Convert an ISO string back to the `datetime-local` value format (YYYY-MM-DDTHH:mm).
  // Uses the browser's local zone so what the user sees matches what they pick.
  function toLocalInputValue(iso: string | null | undefined): string {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  // Close popover on outside click.
  $effect(() => {
    if (!openPopover) return;
    const handler = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.closest('.ix_css_kanban_popover') || t.closest('.ix_css_kanban_popover_trigger'))
      ) {
        return;
      }
      openPopover = null;
    };
    // Defer so the click that opened the popover doesn't immediately close it.
    const id = window.setTimeout(() => document.addEventListener('click', handler), 0);
    return () => {
      window.clearTimeout(id);
      document.removeEventListener('click', handler);
    };
  });

  // ── Drag state ─────────────────────────────────────────────────────────
  let draggingCard = $state<KanbanCard | null>(null);
  let dragX = $state(0);
  let dragY = $state(0);
  let overCol = $state<string | null>(null);
  let overSubOption = $state<string | null>(null);

  const colElems = new Map<string, HTMLElement>();
  const subZoneElems = new Map<string, HTMLElement>();

  let isMobileLayout = $state(false);

  $effect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia(MOBILE_LAYOUT_QUERY);
    const update = (matches: boolean) => {
      isMobileLayout = matches;
      if (matches) {
        draggingCard = null;
        overCol = null;
        document.body.classList.remove('ix_css_kanban_dragging_active');
      }
    };
    const handler = (e: MediaQueryListEvent) => update(e.matches);
    update(mq.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  });

  function startDrag(e: PointerEvent, card: KanbanCard) {
    if (isMobileLayout) return;
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    const target = e.currentTarget as HTMLElement;
    // Don't start drag if pointer is on an interactive child (link, button)
    if ((e.target as HTMLElement).closest('a, button, select, input, textarea')) return;

    e.preventDefault();
    target.setPointerCapture?.(e.pointerId);
    draggingCard = card;
    dragX = e.clientX;
    dragY = e.clientY;
    document.body.classList.add('ix_css_kanban_dragging_active');

    const onMove = (ev: PointerEvent) => {
      if (!draggingCard) return;
      dragX = ev.clientX;
      dragY = ev.clientY;

      let hit: string | null = null;
      for (const [key, el] of colElems) {
        const r = el.getBoundingClientRect();
        if (
          ev.clientX >= r.left &&
          ev.clientX <= r.right &&
          ev.clientY >= r.top &&
          ev.clientY <= r.bottom
        ) {
          hit = key;
          break;
        }
      }
      overCol = hit;

      let hitSub: string | null = null;
      if (hit) {
        const prefix = `${hit}::`;
        for (const [zoneKey, el] of subZoneElems) {
          if (!zoneKey.startsWith(prefix)) continue;
          const r = el.getBoundingClientRect();
          if (
            ev.clientX >= r.left &&
            ev.clientX <= r.right &&
            ev.clientY >= r.top &&
            ev.clientY <= r.bottom
          ) {
            hitSub = zoneKey.slice(prefix.length);
            break;
          }
        }
      }
      overSubOption = hitSub;
    };

    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      document.body.classList.remove('ix_css_kanban_dragging_active');

      const dragged = draggingCard;
      const finalCol = overCol;
      const finalSub = overSubOption;
      draggingCard = null;
      overCol = null;
      overSubOption = null;
      if (!dragged) return;

      const targetColumn = finalCol ? columns.find((c) => c.key === finalCol) : undefined;
      if (!targetColumn) return;
      const targetOptions = getColumnStatusOptions(targetColumn);
      const targetStatus =
        targetOptions.length === 1 ? (targetOptions[0]?.value ?? null) : finalSub;
      if (targetStatus && targetStatus !== dragged.status) {
        onStatusChange?.(dragged.id, targetStatus);
      }
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  }

  function handleCardClick(card: KanbanCard) {
    onCardClick?.(card);
  }

  function handleMenuClick(e: MouseEvent, card: KanbanCard) {
    e.stopPropagation();
    onCardMenuClick?.(card, e.currentTarget as HTMLElement);
  }
</script>

{#snippet StatusRing(status: string, size: number = 16)}
  {@const color = STATUS_COLORS[status] ?? '#9ca3af'}
  {@const cfg = STATUS_RING_CONFIG[status] ?? { fill: 'dot' as const }}
  {@const fill = cfg.fill}
  <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true" style="flex-shrink: 0">
    {#if fill === 'dot'}
      <circle
        cx={CX}
        cy={CY}
        r={OUTER_R}
        fill="none"
        stroke={color}
        stroke-width={1.6}
        stroke-dasharray="2.2 2.4"
        stroke-linecap="round"
      />
    {:else if fill === 'check'}
      <circle cx={CX} cy={CY} r={OUTER_R} fill="none" stroke={color} stroke-width={1.6} />
      <circle cx={CX} cy={CY} r={PIE_R} fill={color} />
      <path
        d="M5.2 8.1 L7.1 10.1 L10.8 6.2"
        fill="none"
        stroke="white"
        stroke-width={1.4}
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    {:else if fill === 'x'}
      <circle cx={CX} cy={CY} r={OUTER_R} fill="none" stroke={color} stroke-width={1.6} />
      <circle cx={CX} cy={CY} r={PIE_R} fill={color} />
      <path
        d="M5.8 5.8 L10.2 10.2 M10.2 5.8 L5.8 10.2"
        fill="none"
        stroke="white"
        stroke-width={1.4}
        stroke-linecap="round"
      />
    {:else}
      <circle cx={CX} cy={CY} r={OUTER_R} fill="none" stroke={color} stroke-width={1.6} />
      <path d={pieSlicePath(fill as number)} fill={color} />
    {/if}
  </svg>
{/snippet}

{#snippet CalendarIcon()}
  <svg
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
{/snippet}

{#snippet ChatIcon()}
  <svg
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
{/snippet}

{#snippet PaperclipIcon()}
  <svg
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path
      d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66L9.41 17.41a2 2 0 0 1-2.83-2.83l8.49-8.48"
    />
  </svg>
{/snippet}

{#snippet PriorityBars(priority: 'high' | 'med' | 'low')}
  {@const label = priority === 'high' ? 'High' : priority === 'med' ? 'Medium' : 'Low'}
  <span class="ix_css_kanban_prio ix_css_kanban_prio_{priority}" title="{label} priority">
    <span class="ix_css_kanban_prio_bars">
      <span></span><span></span><span></span>
    </span>
    {label}
  </span>
{/snippet}

{#snippet AvatarGroup(card: KanbanCard)}
  {@const list = getAssigneeList(card)}
  {@const editable = !!onAssigneeAdd && !!assigneeOptions?.length}
  <div class="ix_css_kanban_assignee_wrap">
    {#if list.length === 0 && !editable}
      <span style="font-size: 11px; color: #9ca3af">Unassigned</span>
    {:else}
      {@const visible = list.slice(0, 3)}
      {@const overflow = list.length - visible.length}
      <div class="ix_css_kanban_avatars">
        {#if list.length === 0}
          <span class="ix_css_kanban_av ix_css_kanban_av_empty" title="Unassigned"> ? </span>
        {/if}
        {#each visible as av, i (av.name)}
          <span
            class="ix_css_kanban_av"
            style="background: {av.avatarBg ?? AVATAR_GRADIENTS[i % AVATAR_GRADIENTS.length]}"
            title={av.name}
          >
            {av.initials}
          </span>
        {/each}
        {#if overflow > 0}
          <span
            class="ix_css_kanban_av"
            style="background: #f3f4f6; color: #4b5563; border: 2px solid #fff; box-shadow: inset 0 0 0 1px #d1d5db"
            title="{overflow} more"
          >
            +{overflow}
          </span>
        {/if}
      </div>
    {/if}
    {#if editable}
      <button
        type="button"
        class="ix_css_kanban_av_add ix_css_kanban_popover_trigger"
        aria-label="Add assignee"
        aria-haspopup="menu"
        aria-expanded={openPopover?.cardId === card.id && openPopover.kind === 'assignee'}
        onpointerdown={(e) => e.stopPropagation()}
        onclick={(e) => {
          e.stopPropagation();
          togglePopover(card.id, 'assignee');
        }}
      >
        +
      </button>
      {#if openPopover?.cardId === card.id && openPopover.kind === 'assignee'}
        <div class="ix_css_kanban_popover ix_css_kanban_popover_assignee" role="menu">
          {#each assigneeOptions ?? [] as opt (opt.id)}
            <button
              type="button"
              class="ix_css_kanban_popover_item"
              role="menuitem"
              onpointerdown={(e) => e.stopPropagation()}
              onclick={(e) => {
                e.stopPropagation();
                onAssigneeAdd?.(card.id, opt.id);
                openPopover = null;
              }}
            >
              <span
                class="ix_css_kanban_av"
                style="background: {opt.avatarBg ?? AVATAR_GRADIENTS[0]}; margin: 0"
              >
                {opt.initials ?? getInitials(opt.name)}
              </span>
              <span class="ix_css_kanban_popover_item_label">{opt.name}</span>
            </button>
          {/each}
        </div>
      {/if}
    {/if}
  </div>
{/snippet}

{#snippet CardBody(card: KanbanCard)}
  <div class="ix_css_kanban_card_top">
    <span class="ix_css_kanban_ticket">
      {@render StatusRing(card.status, 16)}
      {card.subtitle ?? card.id}
    </span>
    <button
      type="button"
      class="ix_css_kanban_dots_btn"
      aria-label="Card actions"
      onpointerdown={(e) => e.stopPropagation()}
      onclick={(e) => handleMenuClick(e, card)}
    >
      ⋯
    </button>
  </div>

  {#if card.titleHref}
    <a
      href={card.titleHref}
      class="ix_css_kanban_card_title ix_css_kanban_card_title_link"
      onpointerdown={(e) => e.stopPropagation()}
      onclick={(e) => e.stopPropagation()}
    >
      {card.title}
    </a>
  {:else}
    <button
      type="button"
      class="ix_css_kanban_card_title ix_css_kanban_card_title_link"
      onpointerdown={(e) => e.stopPropagation()}
      onclick={(e) => {
        e.stopPropagation();
        handleCardClick(card);
      }}
    >
      {card.title}
    </button>
  {/if}

  {#if card.description}
    <p class="ix_css_kanban_card_desc">{card.description}</p>
  {/if}

  {#if card.dueDate || card.priority || onDueDateChange || (onPriorityChange && priorityOptions?.length)}
    <div class="ix_css_kanban_bars_row">
      {#if onDueDateChange}
        <!-- Editable: chip is a button that opens a hidden native picker. -->
        <button
          type="button"
          class="ix_css_kanban_due ix_css_kanban_due_btn ix_css_kanban_popover_trigger"
          class:ix_css_kanban_due_empty={!card.dueDate}
          onpointerdown={(e) => e.stopPropagation()}
          onclick={(e) => {
            e.stopPropagation();
            openDatePicker(card.id);
          }}
        >
          {@render CalendarIcon()}
          {card.dueDate ?? 'Set due'}
        </button>
        <input
          type="datetime-local"
          class="ix_css_kanban_due_input"
          tabindex="-1"
          aria-hidden="true"
          value={toLocalInputValue(card.dueDateISO)}
          bind:this={
            () => dateInputRefs.get(card.id),
            (el) => {
              if (el) dateInputRefs.set(card.id, el);
              else dateInputRefs.delete(card.id);
            }
          }
          onchange={(e) => emitDueChange(card.id, (e.currentTarget as HTMLInputElement).value)}
          onpointerdown={(e) => e.stopPropagation()}
          onclick={(e) => e.stopPropagation()}
        />
      {:else if card.dueDate}
        <span class="ix_css_kanban_due">
          {@render CalendarIcon()}
          {card.dueDate}
        </span>
      {/if}

      {#if onPriorityChange && priorityOptions?.length}
        <div class="ix_css_kanban_prio_edit">
          <button
            type="button"
            class="ix_css_kanban_prio_btn ix_css_kanban_popover_trigger"
            onpointerdown={(e) => e.stopPropagation()}
            onclick={(e) => {
              e.stopPropagation();
              togglePopover(card.id, 'priority');
            }}
            aria-haspopup="menu"
            aria-expanded={openPopover?.cardId === card.id && openPopover.kind === 'priority'}
          >
            {#if card.priority}
              {@render PriorityBars(card.priority)}
            {:else}
              <span class="ix_css_kanban_prio_empty">Set priority</span>
            {/if}
          </button>
          {#if openPopover?.cardId === card.id && openPopover.kind === 'priority'}
            <div class="ix_css_kanban_popover" role="menu">
              {#each priorityOptions as opt (opt.value)}
                <button
                  type="button"
                  class="ix_css_kanban_popover_item"
                  role="menuitem"
                  onpointerdown={(e) => e.stopPropagation()}
                  onclick={(e) => {
                    e.stopPropagation();
                    onPriorityChange?.(card.id, opt.value);
                    openPopover = null;
                  }}
                >
                  {@render PriorityBars(opt.visual)}
                  <span class="ix_css_kanban_popover_item_label">{opt.label}</span>
                </button>
              {/each}
            </div>
          {/if}
        </div>
      {:else if card.priority}
        {@render PriorityBars(card.priority)}
      {/if}
    </div>
  {/if}

  <div class="ix_css_kanban_card_foot">
    {@render AvatarGroup(card)}
    {#if card.commentCount != null || card.attachmentCount != null}
      <div class="ix_css_kanban_stats">
        {#if card.commentCount != null}
          <span>{@render ChatIcon()}{card.commentCount}</span>
        {/if}
        {#if card.attachmentCount != null}
          <span>{@render PaperclipIcon()}{card.attachmentCount}</span>
        {/if}
      </div>
    {/if}
  </div>
{/snippet}

{#if loading}
  <div style="text-align: center; padding: 1.25rem 0">
    <p style="color: #6b7280">Loading…</p>
  </div>
{:else}
  <div class="ix_css_kanban_shell">
    <div class="ix_css_kanban_scroll_frame">
      <div class="ix_css_kanban_board">
        {#each columns as col (col.key)}
          {@const columnStatuses = getColumnStatuses(col)}
          {@const colCards = cards.filter((c) => columnStatuses.includes(c.status))}
          {@const isOver = overCol === col.key}
          {@const color = STATUS_COLORS[col.key] ?? col.colorVar}
          {@const colOptions = getColumnStatusOptions(col)}
          {@const showSplit = isOver && !!draggingCard && colOptions.length > 1}
          <div
            bind:this={
              () => colElems.get(col.key),
              (el) => {
                if (el) colElems.set(col.key, el);
                else colElems.delete(col.key);
              }
            }
            class="ix_css_kanban_col"
            class:ix_css_kanban_col_drop={isOver}
            class:ix_css_kanban_col_split_active={showSplit}
            style="--ix-kanban-col-color: {color}"
          >
            <div class="ix_css_kanban_col_head">
              <div class="ix_css_kanban_col_title">
                {@render StatusRing(col.key, 16)}
                {col.label}
                <span class="ix_css_kanban_col_count">{colCards.length}</span>
              </div>
            </div>

            <div class="ix_css_kanban_accent_bar"></div>

            {#if showSplit}
              <div class="ix_css_kanban_col_split">
                {#each colOptions as option (option.value)}
                  {@const zoneKey = `${col.key}::${option.value}`}
                  {@const isActive = overSubOption === option.value}
                  {@const zoneColor = STATUS_COLORS[option.value] ?? color}
                  <div
                    bind:this={
                      () => subZoneElems.get(zoneKey),
                      (el) => {
                        if (el) subZoneElems.set(zoneKey, el);
                        else subZoneElems.delete(zoneKey);
                      }
                    }
                    class="ix_css_kanban_drop_zone"
                    class:ix_css_kanban_drop_zone_active={isActive}
                    style="--ix-kanban-zone-color: {zoneColor}"
                  >
                    {@render StatusRing(option.value, 16)}
                    <span class="ix_css_kanban_drop_zone_label">
                      {option.label ?? formatStatusLabel(option.value)}
                    </span>
                  </div>
                {/each}
              </div>
            {:else}
              {#each colCards as card (card.id)}
                {@const isDragging = draggingCard?.id === card.id}
                {#if isMobileLayout}
                  {@const compactMeta = getCompactCardMeta(card)}
                  <button
                    type="button"
                    class="ix_css_kanban_card ix_css_kanban_card_compact"
                    onclick={() => handleCardClick(card)}
                    aria-label="Open {card.title}"
                  >
                    <span class="ix_css_kanban_card_compact_icon">
                      {@render StatusRing(card.status, 16)}
                    </span>
                    <span class="ix_css_kanban_card_compact_body">
                      <span class="ix_css_kanban_card_compact_title">{card.title}</span>
                      {#if compactMeta}
                        <span class="ix_css_kanban_card_compact_meta">{compactMeta}</span>
                      {/if}
                    </span>
                  </button>
                {:else}
                  <div
                    class="ix_css_kanban_card"
                    class:ix_css_kanban_card_dragging={isDragging}
                    onpointerdown={(e) => startDrag(e, card)}
                    onclick={() => handleCardClick(card)}
                    onkeydown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleCardClick(card);
                      }
                    }}
                    role="button"
                    tabindex="0"
                  >
                    {@render CardBody(card)}
                  </div>
                {/if}
              {/each}

              {#if isOver && draggingCard && !columnStatuses.includes(draggingCard.status)}
                <div class="ix_css_kanban_placeholder"></div>
              {/if}

              {#if colCards.length === 0 && !isOver}
                <div class="ix_css_kanban_empty">No items</div>
              {/if}
            {/if}
          </div>
        {/each}
      </div>
    </div>
  </div>

  {#if draggingCard}
    <div class="ix_css_kanban_card_clone" style="left: {dragX}px; top: {dragY}px">
      <div class="ix_css_kanban_card_top">
        <span class="ix_css_kanban_ticket">
          {@render StatusRing(draggingCard.status, 16)}
          {draggingCard.subtitle ?? draggingCard.id}
        </span>
      </div>
      <h3 class="ix_css_kanban_card_title">{draggingCard.title}</h3>
      {#if draggingCard.description}
        <p class="ix_css_kanban_card_desc">{draggingCard.description}</p>
      {/if}
    </div>
  {/if}
{/if}

<style>
  /* ── Tokens ────────────────────────────────────────────────────────────── */
  .ix_css_kanban_shell {
    --ix-kanban-bg: #f9fafb;
    --ix-kanban-card: #ffffff;
    --ix-kanban-border: #e5e7eb;
    --ix-kanban-border-strong: #d1d5db;
    --ix-kanban-ink: #111827;
    --ix-kanban-ink-2: #4b5563;
    --ix-kanban-ink-3: #9ca3af;
    --ix-kanban-ink-4: #d1d5db;
    --ix-kanban-accent: #3b82f6;
    --ix-kanban-accent-soft: rgba(59, 130, 246, 0.08);
    --ix-kanban-radius: 11px;
    --ix-kanban-shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.04), 0 1px 1px rgba(0, 0, 0, 0.03);
    --ix-kanban-shadow-md: 0 4px 12px rgba(0, 0, 0, 0.06), 0 2px 4px rgba(0, 0, 0, 0.04);
    --ix-kanban-shadow-lift: 0 18px 48px rgba(0, 0, 0, 0.18), 0 4px 10px rgba(0, 0, 0, 0.08);

    display: flex;
    flex: 1 1 auto;
    flex-direction: column;
    width: 100%;
  }

  .ix_css_kanban_scroll_frame {
    display: flex;
    flex: 1 1 auto;
    width: 100%;
  }

  .ix_css_kanban_board {
    display: flex;
    gap: clamp(12px, 1.4vw, 16px);
    align-items: flex-start;
    min-height: 400px;
    width: 100%;
    font-family:
      'Roboto',
      -apple-system,
      BlinkMacSystemFont,
      'Segoe UI',
      sans-serif;
  }

  :global(body.ix_css_kanban_dragging_active),
  :global(body.ix_css_kanban_dragging_active *) {
    cursor: grabbing !important;
    user-select: none !important;
  }

  /* ── Column ───────────────────────────────────────────────────────────── */
  .ix_css_kanban_col {
    flex: 1 1 0;
    min-width: 0;
    background: var(--ix-kanban-bg);
    border: 1px solid var(--ix-kanban-border);
    border-radius: 14px;
    padding: 10px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    transition:
      background 0.15s,
      border-color 0.15s,
      box-shadow 0.15s;
  }
  .ix_css_kanban_col_drop {
    background: rgba(59, 130, 246, 0.04);
    border-color: var(--ix-kanban-accent);
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.12);
  }

  /* ── Column header ────────────────────────────────────────────────────── */
  .ix_css_kanban_col_head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 4px 4px 2px;
  }
  .ix_css_kanban_col_title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 600;
    font-size: 13.5px;
    color: var(--ix-kanban-ink);
    letter-spacing: -0.01em;
  }
  .ix_css_kanban_col_count {
    font-family: ui-monospace, 'Roboto Mono', Consolas, monospace;
    font-size: 11px;
    color: var(--ix-kanban-ink-3);
    background: var(--ix-kanban-card);
    border: 1px solid var(--ix-kanban-border);
    padding: 2px 7px;
    border-radius: 999px;
    font-weight: 500;
  }

  .ix_css_kanban_accent_bar {
    height: 2px;
    border-radius: 2px;
    margin: 0 2px 4px;
    background: var(--ix-kanban-col-color, var(--ix-kanban-accent));
    opacity: 0.85;
  }

  /* ── Card ─────────────────────────────────────────────────────────────── */
  .ix_css_kanban_card {
    background: var(--ix-kanban-card);
    border: 1px solid var(--ix-kanban-border);
    border-radius: var(--ix-kanban-radius);
    padding: 12px 13px;
    box-shadow: var(--ix-kanban-shadow-sm);
    display: flex;
    flex-direction: column;
    gap: 8px;
    cursor: grab;
    user-select: none;
    touch-action: none;
    position: relative;
    transition:
      box-shadow 0.15s ease,
      border-color 0.12s ease,
      transform 0.18s cubic-bezier(0.2, 0.7, 0.3, 1),
      opacity 0.15s ease;
    will-change: transform;
  }
  .ix_css_kanban_card:hover {
    border-color: var(--ix-kanban-border-strong);
    box-shadow: var(--ix-kanban-shadow-md);
  }
  .ix_css_kanban_card_dragging {
    opacity: 0.4;
    cursor: grabbing;
  }

  button.ix_css_kanban_card {
    width: 100%;
    text-align: left;
    font: inherit;
    color: inherit;
  }

  .ix_css_kanban_card_compact {
    width: 100%;
    align-items: flex-start;
    flex-direction: row;
    gap: 12px;
    padding: 11px 0;
    border: 0;
    border-bottom: 1px solid var(--ix-kanban-border);
    border-radius: 0;
    box-shadow: none;
    background: transparent;
    cursor: pointer;
    touch-action: manipulation;
  }
  .ix_css_kanban_card_compact:hover {
    border-color: transparent;
    box-shadow: none;
    transform: none;
  }
  .ix_css_kanban_card_compact:last-child {
    border-bottom: 0;
  }
  .ix_css_kanban_card_compact_icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    margin-top: 2px;
  }
  .ix_css_kanban_card_compact_body {
    min-width: 0;
    display: flex;
    flex: 1 1 auto;
    flex-direction: column;
    gap: 3px;
  }
  .ix_css_kanban_card_compact_title {
    display: block;
    overflow: hidden;
    font-size: 14px;
    font-weight: 600;
    line-height: 1.35;
    color: var(--ix-kanban-ink);
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .ix_css_kanban_card_compact_meta {
    display: block;
    overflow: hidden;
    font-size: 11.5px;
    color: var(--ix-kanban-ink-3);
    letter-spacing: 0.02em;
    text-overflow: ellipsis;
    text-transform: uppercase;
    white-space: nowrap;
  }

  /* Floating clone */
  .ix_css_kanban_card_clone {
    position: fixed;
    pointer-events: none;
    z-index: 9999;
    width: 280px;
    background: var(--ix-kanban-card, #fff);
    border: 1px solid var(--ix-kanban-accent, #3b82f6);
    border-radius: var(--ix-kanban-radius, 11px);
    padding: 12px 13px;
    box-shadow: var(--ix-kanban-shadow-lift, 0 18px 48px rgba(0, 0, 0, 0.18));
    display: flex;
    flex-direction: column;
    gap: 8px;
    user-select: none;
    transform: translate(-50%, -50%) rotate(1.5deg) scale(1.03);
    opacity: 0.7;
  }

  .ix_css_kanban_placeholder {
    background: var(--ix-kanban-accent-soft);
    border: 1.5px dashed rgba(59, 130, 246, 0.5);
    border-radius: var(--ix-kanban-radius);
    transition:
      height 0.18s cubic-bezier(0.2, 0.7, 0.3, 1),
      margin 0.18s cubic-bezier(0.2, 0.7, 0.3, 1),
      opacity 0.15s;
    height: 80px;
    min-height: 60px;
  }

  /* Card anatomy */
  .ix_css_kanban_card_top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    color: var(--ix-kanban-ink-3);
  }
  .ix_css_kanban_ticket {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-family: ui-monospace, 'Roboto Mono', Consolas, monospace;
    font-size: 11.5px;
    color: var(--ix-kanban-ink-3);
  }
  .ix_css_kanban_dots_btn {
    width: 22px;
    height: 22px;
    display: grid;
    place-items: center;
    border-radius: 5px;
    cursor: pointer;
    color: var(--ix-kanban-ink-3);
    background: transparent;
    border: none;
    padding: 0;
    transition: background 0.12s;
    letter-spacing: 1px;
    font-size: 13px;
    line-height: 1;
  }
  .ix_css_kanban_dots_btn:hover {
    background: var(--ix-kanban-border);
    color: var(--ix-kanban-ink);
  }

  .ix_css_kanban_card_title {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    letter-spacing: -0.015em;
    color: var(--ix-kanban-ink);
    line-height: 1.3;
  }
  a.ix_css_kanban_card_title_link,
  button.ix_css_kanban_card_title_link {
    align-self: flex-start;
    max-width: 100%;
    padding: 0;
    background: transparent;
    border: 0;
    text-align: left;
    cursor: pointer;
    font: inherit;
    color: var(--ix-kanban-ink);
    text-decoration: none;
  }
  a.ix_css_kanban_card_title_link:hover,
  a.ix_css_kanban_card_title_link:focus-visible,
  button.ix_css_kanban_card_title_link:hover,
  button.ix_css_kanban_card_title_link:focus-visible {
    color: var(--ix-kanban-accent);
    text-decoration: underline;
    text-underline-offset: 2px;
  }
  a.ix_css_kanban_card_title_link:focus-visible,
  button.ix_css_kanban_card_title_link:focus-visible {
    outline: 2px solid var(--ix-kanban-accent);
    outline-offset: 2px;
    border-radius: 3px;
  }

  .ix_css_kanban_card_desc {
    margin: 0;
    font-size: 12.5px;
    color: var(--ix-kanban-ink-2);
    line-height: 1.45;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  /* Bars row */
  .ix_css_kanban_bars_row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 2px;
  }
  .ix_css_kanban_due {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: var(--ix-kanban-ink-2);
    background: var(--ix-kanban-bg);
    border: 1px solid var(--ix-kanban-border);
    border-radius: 7px;
    padding: 3px 8px;
  }
  .ix_css_kanban_due :global(svg) {
    color: var(--ix-kanban-ink-3);
  }
  button.ix_css_kanban_due_btn {
    font: inherit;
    font-size: 11px;
    padding: 1px 6px;
    gap: 4px;
    line-height: 1.4;
    cursor: pointer;
    transition:
      background 0.12s ease,
      border-color 0.12s ease,
      color 0.12s ease;
  }
  button.ix_css_kanban_due_btn :global(svg) {
    width: 10px;
    height: 10px;
  }
  button.ix_css_kanban_due_btn:hover {
    background: var(--ix-kanban-card);
    border-color: var(--ix-kanban-border-strong);
    color: var(--ix-kanban-ink);
  }
  .ix_css_kanban_due_empty {
    color: var(--ix-kanban-ink-3);
    border-style: dashed;
  }
  /* Hidden native date picker — opened programmatically via showPicker(). */
  .ix_css_kanban_due_input {
    position: absolute;
    width: 0;
    height: 0;
    padding: 0;
    border: 0;
    opacity: 0;
    pointer-events: none;
  }

  .ix_css_kanban_prio {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 12px;
    font-weight: 500;
  }
  .ix_css_kanban_prio_high {
    color: #c2410c;
  }
  .ix_css_kanban_prio_med {
    color: #b45309;
  }
  .ix_css_kanban_prio_low {
    color: #15803d;
  }

  .ix_css_kanban_prio_bars {
    display: inline-flex;
    align-items: flex-end;
    gap: 2px;
    height: 12px;
  }
  .ix_css_kanban_prio_bars span {
    width: 3px;
    border-radius: 1px;
    background: var(--ix-kanban-ink-4);
    transition: background 0.15s;
  }
  .ix_css_kanban_prio_bars span:nth-child(1) {
    height: 40%;
  }
  .ix_css_kanban_prio_bars span:nth-child(2) {
    height: 65%;
  }
  .ix_css_kanban_prio_bars span:nth-child(3) {
    height: 100%;
  }
  .ix_css_kanban_prio_high .ix_css_kanban_prio_bars span {
    background: #c2410c;
  }
  .ix_css_kanban_prio_med .ix_css_kanban_prio_bars span:nth-child(-n + 2) {
    background: #b45309;
  }
  .ix_css_kanban_prio_low .ix_css_kanban_prio_bars span:nth-child(1) {
    background: #15803d;
  }

  /* Editable priority — button wraps the bars + label. */
  .ix_css_kanban_prio_edit {
    position: relative;
    display: inline-flex;
  }
  button.ix_css_kanban_prio_btn {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    background: transparent;
    border: 0;
    padding: 2px 4px;
    margin: -2px -4px;
    border-radius: 5px;
    font: inherit;
    color: inherit;
    cursor: pointer;
    transition: background 0.12s ease;
  }
  button.ix_css_kanban_prio_btn:hover {
    background: var(--ix-kanban-bg);
  }
  .ix_css_kanban_prio_empty {
    font-size: 12px;
    color: var(--ix-kanban-ink-3);
    font-style: italic;
  }

  /* ── Inline popover (priority + assignee menus) ───────────────────────── */
  .ix_css_kanban_popover {
    position: absolute;
    top: calc(100% + 4px);
    right: 0;
    z-index: 20;
    min-width: 140px;
    max-height: 240px;
    overflow: auto;
    background: var(--ix-kanban-card);
    border: 1px solid var(--ix-kanban-border-strong);
    border-radius: 9px;
    box-shadow: var(--ix-kanban-shadow-lift);
    padding: 4px;
    display: flex;
    flex-direction: column;
    gap: 1px;
  }
  .ix_css_kanban_popover_assignee {
    right: auto;
    left: 0;
    min-width: 180px;
  }
  button.ix_css_kanban_popover_item {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 6px 8px;
    background: transparent;
    border: 0;
    border-radius: 6px;
    font: inherit;
    color: var(--ix-kanban-ink);
    cursor: pointer;
    text-align: left;
    font-size: 12.5px;
    transition: background 0.1s ease;
  }
  button.ix_css_kanban_popover_item:hover {
    background: var(--ix-kanban-bg);
  }
  .ix_css_kanban_popover_item_label {
    flex: 1 1 auto;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* ── Assignee + button ────────────────────────────────────────────────── */
  .ix_css_kanban_assignee_wrap {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .ix_css_kanban_av_empty {
    background: var(--ix-kanban-bg) !important;
    color: var(--ix-kanban-ink-3) !important;
    border: 2px dashed var(--ix-kanban-border-strong) !important;
  }
  button.ix_css_kanban_av_add {
    width: 22px;
    height: 22px;
    border-radius: 999px;
    background: var(--ix-kanban-bg);
    border: 1.5px dashed var(--ix-kanban-border-strong);
    color: var(--ix-kanban-ink-3);
    display: grid;
    place-items: center;
    font-size: 14px;
    line-height: 1;
    cursor: pointer;
    padding: 0;
    transition:
      background 0.12s ease,
      border-color 0.12s ease,
      color 0.12s ease;
  }
  button.ix_css_kanban_av_add:hover {
    background: var(--ix-kanban-card);
    border-color: var(--ix-kanban-accent);
    color: var(--ix-kanban-accent);
  }

  /* Card footer */
  .ix_css_kanban_card_foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 2px;
    padding-top: 9px;
    border-top: 1px dashed var(--ix-kanban-border);
  }

  .ix_css_kanban_avatars {
    display: flex;
  }
  .ix_css_kanban_av {
    width: 22px;
    height: 22px;
    border-radius: 999px;
    background: var(--ix-kanban-bg);
    border: 2px solid var(--ix-kanban-card);
    display: grid;
    place-items: center;
    font-size: 9px;
    font-weight: 600;
    color: #fff;
    margin-left: -6px;
    letter-spacing: 0;
  }
  .ix_css_kanban_av:first-child {
    margin-left: 0;
  }

  .ix_css_kanban_stats {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    font-size: 12px;
    color: var(--ix-kanban-ink-3);
  }
  .ix_css_kanban_stats span {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }

  /* Empty */
  .ix_css_kanban_empty {
    text-align: center;
    color: var(--ix-kanban-ink-3);
    font-size: 13px;
    padding: 28px 8px;
    border-radius: 10px;
    border: 1px dashed var(--ix-kanban-border-strong);
    background: transparent;
  }

  /* Split drop zones */
  .ix_css_kanban_col_split {
    display: flex;
    flex: 1 1 auto;
    flex-direction: column;
    gap: 8px;
    min-height: 240px;
  }
  .ix_css_kanban_drop_zone {
    flex: 1 1 0;
    min-height: 96px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    background: var(--ix-kanban-card);
    border: 1.5px dashed var(--ix-kanban-border-strong);
    border-radius: var(--ix-kanban-radius);
    padding: 16px 12px;
    color: var(--ix-kanban-ink-2);
    font-size: 13px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    transition:
      background 0.12s ease,
      border-color 0.12s ease,
      color 0.12s ease,
      box-shadow 0.12s ease,
      transform 0.12s ease;
  }
  .ix_css_kanban_drop_zone_active {
    background: var(--ix-kanban-card);
    border-style: solid;
    border-color: var(--ix-kanban-zone-color, var(--ix-kanban-accent));
    color: var(--ix-kanban-zone-color, var(--ix-kanban-accent));
    box-shadow:
      0 0 0 3px rgba(59, 130, 246, 0.18),
      var(--ix-kanban-shadow-md);
    transform: scale(1.005);
  }
  .ix_css_kanban_drop_zone_label {
    text-align: center;
    line-height: 1.25;
  }

  @media (max-width: 768px) {
    .ix_css_kanban_board {
      flex-direction: column;
      gap: 16px;
    }
    .ix_css_kanban_col {
      flex: none;
      width: 100%;
      padding: 12px 12px 8px;
      gap: 4px;
    }
    .ix_css_kanban_empty {
      padding: 20px 8px;
    }
  }
</style>

<script lang="ts">
  import { enhance } from '$app/forms';
  import { dateShort } from '$lib/format';
  import Select from '$lib/components/Select.svelte';

  import Phone from '@lucide/svelte/icons/phone';
  import Mail from '@lucide/svelte/icons/mail';
  import CalendarDays from '@lucide/svelte/icons/calendar-days';
  import MapPin from '@lucide/svelte/icons/map-pin';
  import MessageSquare from '@lucide/svelte/icons/message-square';
  import CircleDot from '@lucide/svelte/icons/circle-dot';
  import ArrowDownLeft from '@lucide/svelte/icons/arrow-down-left';
  import ArrowUpRight from '@lucide/svelte/icons/arrow-up-right';
  import Clock from '@lucide/svelte/icons/clock';
  import User from '@lucide/svelte/icons/user';
  import Users from '@lucide/svelte/icons/users';
  import Trash2 from '@lucide/svelte/icons/trash-2';
  import Plus from '@lucide/svelte/icons/plus';
  import X from '@lucide/svelte/icons/x';

  let { data, form } = $props();

  let showCreate = $state(false);

  type TypeKey = 'call' | 'email' | 'meeting' | 'visit' | 'sms' | 'other';

  const typeConfig: Record<TypeKey, { icon: typeof Phone; label: string; badge: string }> = {
    call: { icon: Phone, label: 'Call', badge: 'bg-blue-50 text-blue-600 ring-blue-100' },
    email: { icon: Mail, label: 'Email', badge: 'bg-violet-50 text-violet-600 ring-violet-100' },
    meeting: {
      icon: CalendarDays,
      label: 'Meeting',
      badge: 'bg-amber-50 text-amber-600 ring-amber-100'
    },
    visit: {
      icon: MapPin,
      label: 'Visit',
      badge: 'bg-emerald-50 text-emerald-600 ring-emerald-100'
    },
    sms: { icon: MessageSquare, label: 'SMS', badge: 'bg-sky-50 text-sky-600 ring-sky-100' },
    other: { icon: CircleDot, label: 'Other', badge: 'bg-slate-100 text-slate-500 ring-slate-200' }
  };

  const cfg = (type: string) => typeConfig[type as TypeKey] ?? typeConfig.other;

  function timeOnly(value: string | null | undefined): string {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }

  function dayLabel(value: string | null | undefined): string {
    if (!value) return 'Unknown date';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return 'Unknown date';
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return 'Today';
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return dateShort(value);
  }

  const fullName = (c: { first_name: string | null; last_name: string | null } | null) =>
    c ? [c.first_name, c.last_name].filter(Boolean).join(' ') : '';

  // Activities arrive newest-first; group consecutive entries by calendar day.
  const dayGroups = $derived.by(() => {
    const groups: { key: string; label: string; items: typeof data.activities }[] = [];
    for (const a of data.activities) {
      const key = a.occurred_at ? new Date(a.occurred_at).toDateString() : 'unknown';
      const last = groups[groups.length - 1];
      if (last?.key === key) last.items.push(a);
      else groups.push({ key, label: dayLabel(a.occurred_at), items: [a] });
    }
    return groups;
  });

  type Activity = (typeof data.activities)[number];
  type Row =
    | { kind: 'header'; key: string; label: string }
    | { kind: 'item'; key: string; a: Activity };

  // Flatten day groups into one sequence so a single rail can run through the
  // date headers and connect every icon from first to last.
  const rows = $derived.by(() => {
    const out: Row[] = [];
    for (const g of dayGroups) {
      out.push({ kind: 'header', key: `h-${g.key}`, label: g.label });
      for (const a of g.items) out.push({ kind: 'item', key: a.id, a });
    }
    return out;
  });
  const firstItemIndex = $derived(rows.findIndex((r) => r.kind === 'item'));
  const lastItemIndex = $derived(rows.reduce((acc, r, i) => (r.kind === 'item' ? i : acc), -1));
</script>

<div class="mr-auto max-w-2xl space-y-6">
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
      class="inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800"
    >
      {#if showCreate}
        <X size={15} />
        Cancel
      {:else}
        <Plus size={15} />
        Log activity
      {/if}
    </button>
  </div>

  {#if showCreate}
    <form
      method="POST"
      action="?/create"
      use:enhance={() =>
        async ({ update }) => {
          await update();
          showCreate = false;
        }}
      class="grid gap-3 rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-3"
    >
      <label class="block">
        <span class="mb-1 block text-xs font-medium">Type</span>
        <Select name="type" required class="w-full">
          <option value="call">Call</option>
          <option value="email">Email</option>
          <option value="meeting">Meeting</option>
          <option value="visit">Visit</option>
          <option value="sms">SMS</option>
          <option value="other">Other</option>
        </Select>
      </label>
      <label class="block">
        <span class="mb-1 block text-xs font-medium">Direction</span>
        <Select name="direction" class="w-full">
          <option value="">—</option>
          <option value="inbound">Inbound</option>
          <option value="outbound">Outbound</option>
        </Select>
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
        <Select name="contact_id" class="w-full">
          <option value="">—</option>
          {#each data.contacts as ct}
            <option value={ct.id}>
              {[ct.first_name, ct.last_name].filter(Boolean).join(' ') || ct.id.slice(0, 6)}
            </option>
          {/each}
        </Select>
      </label>
      <label class="block sm:col-span-3">
        <span class="mb-1 block text-xs font-medium">Notes</span>
        <textarea
          name="body"
          rows="3"
          class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
        ></textarea>
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
    <div
      class="flex flex-col items-center gap-2 rounded-lg border border-dashed border-slate-300 bg-white px-4 py-12 text-center"
    >
      <span
        class="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400"
      >
        <Clock size={20} />
      </span>
      <p class="text-sm font-medium text-slate-600">No activities logged yet</p>
      <p class="text-xs text-slate-400">Log a call, email, or visit to start the timeline.</p>
    </div>
  {:else}
    <ol>
      {#each rows as row, idx (row.key)}
        {#if row.kind === 'header'}
          <li class="flex gap-4">
            <!-- rail passes straight through the date header -->
            <div class="flex w-9 shrink-0 flex-col items-center">
              {#if idx > firstItemIndex}
                <span class="w-px flex-1 bg-slate-200"></span>
              {/if}
            </div>
            <h3 class="flex-1 py-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
              {row.label}
            </h3>
          </li>
        {:else}
          {@const a = row.a}
          {@const c = cfg(a.type)}
          <li class="flex gap-4">
            <!-- rail: type badge + connector down to the next icon -->
            <div class="flex w-9 shrink-0 flex-col items-center">
              <span
                class="z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ring-4 {c.badge}"
              >
                <c.icon size={16} />
              </span>
              {#if idx < lastItemIndex}
                <span class="mt-1 w-px flex-1 bg-slate-200"></span>
              {/if}
            </div>

            <!-- card -->
            <div class="group min-w-0 flex-1 pb-5">
              <div
                class="rounded-lg border border-slate-200 bg-white p-3.5 shadow-sm transition hover:border-slate-300 hover:shadow"
              >
                <div class="flex items-start justify-between gap-3">
                  <div class="min-w-0 flex-1">
                    <div class="flex flex-wrap items-center gap-1.5">
                      <span class="text-sm font-medium text-slate-900">
                        {a.subject ?? c.label}
                      </span>
                      <span
                        class="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600"
                      >
                        {c.label}
                      </span>
                      {#if a.direction}
                        <span
                          class="inline-flex items-center gap-0.5 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium capitalize text-slate-600"
                        >
                          {#if a.direction === 'inbound'}
                            <ArrowDownLeft size={11} />
                          {:else}
                            <ArrowUpRight size={11} />
                          {/if}
                          {a.direction}
                        </span>
                      {/if}
                    </div>

                    {#if a.body}
                      <p class="mt-1.5 whitespace-pre-wrap text-sm text-slate-700">{a.body}</p>
                    {/if}

                    <div
                      class="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500"
                    >
                      <span class="inline-flex items-center gap-1">
                        <Clock size={13} />
                        {timeOnly(a.occurred_at)}
                      </span>
                      <span class="inline-flex items-center gap-1">
                        <User size={13} />
                        {a.actor?.display_name ?? 'Unknown'}
                      </span>
                      {#if a.contact}
                        <span class="inline-flex items-center gap-1">
                          <Users size={13} />
                          {fullName(a.contact)}
                        </span>
                      {/if}
                    </div>
                  </div>

                  <form method="POST" action="?/delete" use:enhance>
                    <input type="hidden" name="id" value={a.id} />
                    <button
                      type="submit"
                      aria-label="Delete activity"
                      class="rounded-md p-1.5 text-slate-300 transition hover:bg-red-50 hover:text-red-600 group-hover:text-slate-400"
                    >
                      <Trash2 size={15} />
                    </button>
                  </form>
                </div>
              </div>
            </div>
          </li>
        {/if}
      {/each}
    </ol>
  {/if}
</div>

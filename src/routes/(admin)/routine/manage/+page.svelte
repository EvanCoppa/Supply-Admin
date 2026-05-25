<script lang="ts">
  import { enhance } from '$app/forms';
  import type { DailyRoutineBadgeKind, DailyRoutineStep } from '$lib/types/db';
  import Select from '$lib/components/Select.svelte';

  let { data, form } = $props();

  const BADGE_OPTIONS: { value: DailyRoutineBadgeKind | ''; label: string }[] = [
    { value: '', label: '— No badge —' },
    { value: 'new_orders', label: 'New orders (pending payment)' },
    { value: 'fulfillable_orders', label: 'Paid orders ready to ship' },
    { value: 'open_purchases', label: 'Open POs' },
    { value: 'unpaid_purchases', label: 'Unpaid POs' },
    { value: 'overdue_invoices', label: 'Overdue invoices' },
    { value: 'overdue_tasks', label: 'Overdue tasks' },
    { value: 'ar_ap', label: 'AR overdue + AP unpaid (combined)' }
  ];

  function badgeLabel(kind: DailyRoutineBadgeKind | null): string {
    if (!kind) return '—';
    return BADGE_OPTIONS.find((o) => o.value === kind)?.label ?? kind;
  }

  let editingId = $state<string | null>(null);

  function startEdit(id: string) {
    editingId = id;
  }
  function cancelEdit() {
    editingId = null;
  }

  const active = $derived(data.steps.filter((s: DailyRoutineStep) => s.archived_at === null));
  const archived = $derived(data.steps.filter((s: DailyRoutineStep) => s.archived_at !== null));
</script>

<svelte:head><title>Manage routine · Supply Admin</title></svelte:head>

<section class="space-y-6">
  <header class="flex items-end justify-between">
    <div>
      <h1 class="text-2xl font-semibold">Manage daily routine</h1>
      <p class="text-sm text-slate-500">
        Edit shared steps that show on the <a href="/routine" class="text-sky-700 hover:underline"
          >daily routine</a
        > page.
      </p>
    </div>
  </header>

  {#if form?.message}
    <div class="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">
      {form.message}
    </div>
  {/if}

  <form
    method="POST"
    action="?/create"
    use:enhance={() => {
      return ({ update }) => update({ reset: true });
    }}
    class="grid gap-3 rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-6"
  >
    <label class="block sm:col-span-2">
      <span class="mb-1 block text-sm font-medium">Title</span>
      <input
        name="title"
        required
        placeholder="Check Slack #ops"
        class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
      />
    </label>
    <label class="block sm:col-span-4">
      <span class="mb-1 block text-sm font-medium">Description</span>
      <input
        name="blurb"
        placeholder="One-line description shown under the title."
        class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
      />
    </label>
    <label class="block sm:col-span-3">
      <span class="mb-1 block text-sm font-medium"
        >Link URL <span class="font-normal text-slate-400">(optional)</span></span
      >
      <input
        name="href"
        placeholder="/orders?status=pending_payment"
        class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
      />
    </label>
    <label class="block sm:col-span-1">
      <span class="mb-1 block text-sm font-medium">Button label</span>
      <input
        name="cta"
        placeholder="Open"
        class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
      />
    </label>
    <label class="block sm:col-span-2">
      <span class="mb-1 block text-sm font-medium">Badge</span>
      <Select name="badge_kind" class="w-full">
        {#each BADGE_OPTIONS as opt}
          <option value={opt.value}>{opt.label}</option>
        {/each}
      </Select>
    </label>
    <div class="flex items-end sm:col-span-6">
      <button
        type="submit"
        class="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
      >
        Add step
      </button>
    </div>
  </form>

  <div class="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
    <header
      class="flex items-center justify-between border-b border-slate-200 px-4 py-2 text-xs uppercase tracking-wider text-slate-500"
    >
      <span>Active steps</span>
      <span>{active.length}</span>
    </header>
    {#if active.length === 0}
      <p class="px-4 py-8 text-center text-sm text-slate-500">No active steps.</p>
    {:else}
      <ul class="divide-y divide-slate-100">
        {#each active as step, i (step.id)}
          <li class="px-4 py-3">
            {#if editingId === step.id}
              <form
                method="POST"
                action="?/update"
                use:enhance={() => {
                  return ({ update }) => {
                    editingId = null;
                    return update();
                  };
                }}
                class="grid gap-3 sm:grid-cols-6"
              >
                <input type="hidden" name="id" value={step.id} />
                <label class="block sm:col-span-2">
                  <span class="mb-1 block text-xs font-medium text-slate-500">Title</span>
                  <input
                    name="title"
                    required
                    value={step.title}
                    class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                  />
                </label>
                <label class="block sm:col-span-4">
                  <span class="mb-1 block text-xs font-medium text-slate-500">Description</span>
                  <input
                    name="blurb"
                    value={step.blurb ?? ''}
                    class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                  />
                </label>
                <label class="block sm:col-span-3">
                  <span class="mb-1 block text-xs font-medium text-slate-500">Link URL</span>
                  <input
                    name="href"
                    value={step.href ?? ''}
                    class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                  />
                </label>
                <label class="block sm:col-span-1">
                  <span class="mb-1 block text-xs font-medium text-slate-500">Button label</span>
                  <input
                    name="cta"
                    value={step.cta ?? ''}
                    class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                  />
                </label>
                <label class="block sm:col-span-2">
                  <span class="mb-1 block text-xs font-medium text-slate-500">Badge</span>
                  <Select name="badge_kind" class="w-full">
                    {#each BADGE_OPTIONS as opt}
                      <option value={opt.value} selected={(step.badge_kind ?? '') === opt.value}>
                        {opt.label}
                      </option>
                    {/each}
                  </Select>
                </label>
                <div class="flex items-end gap-2 sm:col-span-6">
                  <button
                    type="submit"
                    class="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onclick={cancelEdit}
                    class="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            {:else}
              <div class="flex items-start gap-3">
                <div class="flex flex-col gap-1 pt-1">
                  <form method="POST" action="?/reorder" use:enhance>
                    <input type="hidden" name="id" value={step.id} />
                    <input type="hidden" name="direction" value="up" />
                    <button
                      type="submit"
                      disabled={i === 0}
                      aria-label="Move up"
                      class="rounded border border-slate-300 px-1.5 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-30"
                    >
                      ▲
                    </button>
                  </form>
                  <form method="POST" action="?/reorder" use:enhance>
                    <input type="hidden" name="id" value={step.id} />
                    <input type="hidden" name="direction" value="down" />
                    <button
                      type="submit"
                      disabled={i === active.length - 1}
                      aria-label="Move down"
                      class="rounded border border-slate-300 px-1.5 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-30"
                    >
                      ▼
                    </button>
                  </form>
                </div>

                <div class="flex-1">
                  <div class="flex items-start justify-between gap-3">
                    <div>
                      <h3 class="text-sm font-semibold text-slate-900">{step.title}</h3>
                      {#if step.blurb}
                        <p class="text-sm text-slate-500">{step.blurb}</p>
                      {/if}
                      <p
                        class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500"
                      >
                        {#if step.href}
                          <span
                            ><span class="text-slate-400">link:</span>
                            <span class="font-mono">{step.href}</span>{#if step.cta}
                              ({step.cta}){/if}</span
                          >
                        {/if}
                        <span
                          ><span class="text-slate-400">badge:</span>
                          {badgeLabel(step.badge_kind)}</span
                        >
                        <span class="font-mono text-slate-400">{step.slug}</span>
                      </p>
                    </div>
                    <div class="flex shrink-0 gap-2">
                      <button
                        type="button"
                        onclick={() => startEdit(step.id)}
                        class="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
                      >
                        Edit
                      </button>
                      <form method="POST" action="?/archive" use:enhance>
                        <input type="hidden" name="id" value={step.id} />
                        <button
                          type="submit"
                          class="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
                        >
                          Hide
                        </button>
                      </form>
                      <form method="POST" action="?/delete" use:enhance>
                        <input type="hidden" name="id" value={step.id} />
                        <button
                          type="submit"
                          onclick={(e) => {
                            if (
                              !confirm(
                                'Delete this step? Historical completion checkmarks for it will remain in the database but will no longer be visible.'
                              )
                            )
                              e.preventDefault();
                          }}
                          class="rounded border border-red-300 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                        >
                          Delete
                        </button>
                      </form>
                    </div>
                  </div>
                </div>
              </div>
            {/if}
          </li>
        {/each}
      </ul>
    {/if}
  </div>

  {#if archived.length > 0}
    <div class="overflow-hidden rounded-lg border border-slate-200 bg-slate-50 shadow-sm">
      <header
        class="flex items-center justify-between border-b border-slate-200 px-4 py-2 text-xs uppercase tracking-wider text-slate-500"
      >
        <span>Hidden steps</span>
        <span>{archived.length}</span>
      </header>
      <ul class="divide-y divide-slate-200">
        {#each archived as step (step.id)}
          <li class="flex items-center justify-between gap-3 px-4 py-3">
            <div>
              <h3 class="text-sm font-medium text-slate-700">{step.title}</h3>
              {#if step.blurb}
                <p class="text-xs text-slate-500">{step.blurb}</p>
              {/if}
            </div>
            <div class="flex gap-2">
              <form method="POST" action="?/unarchive" use:enhance>
                <input type="hidden" name="id" value={step.id} />
                <button
                  type="submit"
                  class="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-100"
                >
                  Show
                </button>
              </form>
              <form method="POST" action="?/delete" use:enhance>
                <input type="hidden" name="id" value={step.id} />
                <button
                  type="submit"
                  onclick={(e) => {
                    if (!confirm('Permanently delete this step?')) e.preventDefault();
                  }}
                  class="rounded border border-red-300 bg-white px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                >
                  Delete
                </button>
              </form>
            </div>
          </li>
        {/each}
      </ul>
    </div>
  {/if}
</section>

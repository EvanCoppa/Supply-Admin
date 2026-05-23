<script lang="ts">
  import { enhance } from '$app/forms';
  import type { StepSlug } from './+page.server';

  let { data, form } = $props();

  type Step = {
    slug: StepSlug;
    title: string;
    blurb: string;
    href: string;
    cta: string;
    badge: { label: string; count: number; tone: 'red' | 'amber' | 'slate' } | null;
  };

  const steps = $derived<Step[]>([
    {
      slug: 'review_orders',
      title: 'Review new orders',
      blurb: 'Confirm new orders look right and are ready to be paid or processed.',
      href: '/orders?status=pending_payment',
      cta: 'Open orders',
      badge: data.counts.new_orders
        ? { label: 'awaiting payment', count: data.counts.new_orders, tone: 'amber' }
        : null
    },
    {
      slug: 'process_purchases',
      title: 'Process purchases',
      blurb: 'Place POs for items that need restocking and mark received goods.',
      href: '/purchases?status=ordered',
      cta: 'Open purchases',
      badge: data.counts.open_purchases
        ? { label: 'open POs', count: data.counts.open_purchases, tone: 'slate' }
        : null
    },
    {
      slug: 'fulfill_invoice',
      title: 'Mark fulfilled & invoice clients',
      blurb: 'Ship paid orders, generate invoices, send to clients.',
      href: '/orders?status=paid',
      cta: 'Open fulfillable',
      badge: data.counts.fulfillable_orders
        ? { label: 'ready to fulfill', count: data.counts.fulfillable_orders, tone: 'amber' }
        : null
    },
    {
      slug: 'ar_ap_followup',
      title: 'AR / AP follow-up',
      blurb: 'Chase overdue client invoices and reconcile supplier bills.',
      href: '/invoices?view=overdue',
      cta: 'Open AR',
      badge:
        data.counts.overdue_invoices || data.counts.unpaid_purchases
          ? {
              label: `${data.counts.overdue_invoices} overdue invoices · ${data.counts.unpaid_purchases} unpaid POs`,
              count: data.counts.overdue_invoices + data.counts.unpaid_purchases,
              tone: 'red'
            }
          : null
    },
    {
      slug: 'review_tasks',
      title: 'Clear overdue tasks',
      blurb: 'Check the task board and resolve anything past its due date.',
      href: '/tasks?view=overdue',
      cta: 'Open tasks',
      badge: data.counts.overdue_tasks
        ? { label: 'overdue', count: data.counts.overdue_tasks, tone: 'red' }
        : null
    }
  ]);

  function isDone(slug: StepSlug): boolean {
    return data.todayDone.includes(slug);
  }

  const completedCount = $derived(steps.filter((s) => isDone(s.slug)).length);
  const totalCount = $derived(steps.length);
  const allDone = $derived(completedCount === totalCount);

  function toneClass(tone: 'red' | 'amber' | 'slate'): string {
    if (tone === 'red') return 'bg-red-100 text-red-800';
    if (tone === 'amber') return 'bg-amber-100 text-amber-800';
    return 'bg-slate-100 text-slate-700';
  }

  const today = $derived(
    new Date(`${data.today}T00:00:00`).toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'long',
      day: 'numeric'
    })
  );

  const stepTitles: Record<StepSlug, string> = {
    review_orders: 'Review new orders',
    process_purchases: 'Process purchases',
    fulfill_invoice: 'Mark fulfilled & invoice clients',
    ar_ap_followup: 'AR / AP follow-up',
    review_tasks: 'Clear overdue tasks'
  };
</script>

<svelte:head><title>Today · Supply Admin</title></svelte:head>

<section class="space-y-6">
  <header class="flex items-end justify-between">
    <div>
      <p class="text-xs uppercase tracking-wider text-slate-500">{today}</p>
      <h1 class="text-2xl font-semibold">Daily routine</h1>
    </div>
    <div class="text-right">
      <p class="text-3xl font-semibold {allDone ? 'text-emerald-600' : 'text-slate-700'}">
        {completedCount}/{totalCount}
      </p>
      <p class="text-xs text-slate-500">steps complete</p>
    </div>
  </header>

  {#if allDone}
    <div
      class="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
    >
      All steps complete for today. Nice work.
    </div>
  {/if}

  {#if form?.error}
    <div class="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
      {form.error}
    </div>
  {/if}

  <ol class="space-y-3">
    {#each steps as step, i (step.slug)}
      {@const done = isDone(step.slug)}
      <li
        class="flex items-start gap-4 rounded-lg border p-4 shadow-sm transition {done
          ? 'border-emerald-200 bg-emerald-50/40'
          : 'border-slate-200 bg-white'}"
      >
        <form method="POST" action="?/toggle" use:enhance class="pt-1">
          <input type="hidden" name="slug" value={step.slug} />
          <input type="hidden" name="done" value={done ? 'true' : 'false'} />
          <button
            type="submit"
            class="flex h-6 w-6 items-center justify-center rounded border-2 transition {done
              ? 'border-emerald-500 bg-emerald-500 text-white'
              : 'border-slate-300 hover:border-slate-500'}"
            aria-label={done ? 'Mark incomplete' : 'Mark complete'}
          >
            {#if done}<span class="text-sm leading-none">✓</span>{/if}
          </button>
        </form>

        <div class="flex-1">
          <div class="flex items-start justify-between gap-3">
            <div>
              <h2
                class="text-base font-semibold {done
                  ? 'text-slate-500 line-through'
                  : 'text-slate-900'}"
              >
                {i + 1}. {step.title}
              </h2>
              <p class="text-sm text-slate-500">{step.blurb}</p>
            </div>
            {#if step.badge}
              <span
                class="whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium {toneClass(
                  step.badge.tone
                )}"
              >
                {step.badge.count}
                {step.badge.label}
              </span>
            {/if}
          </div>

          <div class="mt-2">
            <a
              href={step.href}
              class="inline-flex items-center text-sm font-medium text-sky-700 hover:underline"
            >
              {step.cta} →
            </a>
          </div>
        </div>
      </li>
    {/each}
  </ol>

  {#if data.yesterdayMissing.length > 0}
    <aside class="rounded-lg border border-amber-200 bg-amber-50 p-4">
      <h3 class="text-sm font-semibold text-amber-900">Skipped yesterday</h3>
      <p class="mt-1 text-xs text-amber-800">
        These steps weren't checked off on {new Date(
          `${data.yesterday}T00:00:00`
        ).toLocaleDateString(undefined, {
          weekday: 'long',
          month: 'short',
          day: 'numeric'
        })}.
      </p>
      <ul class="mt-2 list-disc pl-5 text-sm text-amber-900">
        {#each data.yesterdayMissing as slug (slug)}
          <li>{stepTitles[slug]}</li>
        {/each}
      </ul>
    </aside>
  {/if}
</section>

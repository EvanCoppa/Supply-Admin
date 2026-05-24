import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import type { DailyRoutineBadgeKind, DailyRoutineStep } from '$lib/types/db';

export type Tone = 'red' | 'amber' | 'slate';

export type ResolvedBadge = {
  count: number;
  label: string;
  tone: Tone;
};

export type RoutineStep = {
  id: string;
  slug: string;
  title: string;
  blurb: string;
  href: string | null;
  cta: string | null;
  badge: ResolvedBadge | null;
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
function yesterdayIso(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

export const load: PageServerLoad = async ({ locals: { supabase, user } }) => {
  if (!user) throw error(401, 'Not signed in.');
  const today = todayIso();
  const yesterday = yesterdayIso();
  const nowIso = new Date().toISOString();

  const { data: stepRows, error: stepErr } = await supabase
    .from('daily_routine_steps')
    .select('id, slug, title, blurb, href, cta, badge_kind, sort_order')
    .is('archived_at', null)
    .order('sort_order', { ascending: true });
  if (stepErr) throw error(500, stepErr.message);

  const steps = (stepRows ?? []) as Pick<
    DailyRoutineStep,
    'id' | 'slug' | 'title' | 'blurb' | 'href' | 'cta' | 'badge_kind' | 'sort_order'
  >[];

  const neededKinds = new Set(
    steps.map((s) => s.badge_kind).filter((k): k is DailyRoutineBadgeKind => k !== null)
  );

  const wantOverdueInvoices = neededKinds.has('overdue_invoices') || neededKinds.has('ar_ap');
  const wantUnpaidPurchases = neededKinds.has('unpaid_purchases') || neededKinds.has('ar_ap');

  const [
    completionsRes,
    newOrdersRes,
    fulfillableOrdersRes,
    openPurchasesRes,
    unpaidPurchasesRes,
    overdueInvoicesRes,
    overdueTasksRes
  ] = await Promise.all([
    supabase
      .from('daily_routine_completions')
      .select('step_slug, occurred_on, completed_at, notes')
      .eq('user_id', user.id)
      .in('occurred_on', [today, yesterday]),
    neededKinds.has('new_orders')
      ? supabase
          .from('orders')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'pending_payment')
      : Promise.resolve({ count: 0 } as { count: number | null }),
    neededKinds.has('fulfillable_orders')
      ? supabase.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'paid')
      : Promise.resolve({ count: 0 } as { count: number | null }),
    neededKinds.has('open_purchases')
      ? supabase
          .from('purchases')
          .select('id', { count: 'exact', head: true })
          .in('status', ['draft', 'ordered'])
      : Promise.resolve({ count: 0 } as { count: number | null }),
    wantUnpaidPurchases
      ? supabase
          .from('purchases')
          .select('id', { count: 'exact', head: true })
          .in('payment_status', ['unpaid', 'partial'])
      : Promise.resolve({ count: 0 } as { count: number | null }),
    wantOverdueInvoices
      ? supabase
          .from('invoices')
          .select('id', { count: 'exact', head: true })
          .in('status', ['issued', 'partially_paid', 'overdue'])
          .lt('due_at', nowIso)
      : Promise.resolve({ count: 0 } as { count: number | null }),
    neededKinds.has('overdue_tasks')
      ? supabase
          .from('customer_tasks')
          .select('id', { count: 'exact', head: true })
          .in('status', ['open', 'in_progress'])
          .lt('due_at', nowIso)
      : Promise.resolve({ count: 0 } as { count: number | null })
  ]);

  const counts = {
    new_orders: newOrdersRes.count ?? 0,
    fulfillable_orders: fulfillableOrdersRes.count ?? 0,
    open_purchases: openPurchasesRes.count ?? 0,
    unpaid_purchases: unpaidPurchasesRes.count ?? 0,
    overdue_invoices: overdueInvoicesRes.count ?? 0,
    overdue_tasks: overdueTasksRes.count ?? 0
  };

  function resolveBadge(kind: DailyRoutineBadgeKind | null): ResolvedBadge | null {
    if (!kind) return null;
    switch (kind) {
      case 'new_orders':
        return counts.new_orders
          ? { count: counts.new_orders, label: 'awaiting payment', tone: 'amber' }
          : null;
      case 'fulfillable_orders':
        return counts.fulfillable_orders
          ? { count: counts.fulfillable_orders, label: 'ready to fulfill', tone: 'amber' }
          : null;
      case 'open_purchases':
        return counts.open_purchases
          ? { count: counts.open_purchases, label: 'open POs', tone: 'slate' }
          : null;
      case 'unpaid_purchases':
        return counts.unpaid_purchases
          ? { count: counts.unpaid_purchases, label: 'unpaid POs', tone: 'red' }
          : null;
      case 'overdue_invoices':
        return counts.overdue_invoices
          ? { count: counts.overdue_invoices, label: 'overdue invoices', tone: 'red' }
          : null;
      case 'overdue_tasks':
        return counts.overdue_tasks
          ? { count: counts.overdue_tasks, label: 'overdue', tone: 'red' }
          : null;
      case 'ar_ap': {
        const total = counts.overdue_invoices + counts.unpaid_purchases;
        if (!total) return null;
        return {
          count: total,
          label: `${counts.overdue_invoices} overdue invoices · ${counts.unpaid_purchases} unpaid POs`,
          tone: 'red'
        };
      }
    }
  }

  const completions = (completionsRes.data ?? []) as {
    step_slug: string;
    occurred_on: string;
    completed_at: string;
    notes: string | null;
  }[];

  const todayDone = new Set(
    completions.filter((c) => c.occurred_on === today).map((c) => c.step_slug)
  );
  const yesterdayDone = new Set(
    completions.filter((c) => c.occurred_on === yesterday).map((c) => c.step_slug)
  );

  const resolvedSteps: RoutineStep[] = steps.map((s) => ({
    id: s.id,
    slug: s.slug,
    title: s.title,
    blurb: s.blurb ?? '',
    href: s.href && s.href.trim() ? s.href : null,
    cta: s.cta && s.cta.trim() ? s.cta : null,
    badge: resolveBadge(s.badge_kind)
  }));

  return {
    today,
    yesterday,
    steps: resolvedSteps,
    todayDone: Array.from(todayDone),
    yesterdayMissing: steps
      .filter((s) => !yesterdayDone.has(s.slug))
      .map((s) => ({ slug: s.slug, title: s.title }))
  };
};

export const actions: Actions = {
  toggle: async ({ request, locals: { supabase, user } }) => {
    if (!user) return fail(401, { error: 'Not signed in.' });
    const fd = await request.formData();
    const slug = String(fd.get('slug') ?? '');
    const done = String(fd.get('done') ?? '') === 'true';
    if (!slug) return fail(400, { error: 'Missing step.' });

    const { data: stepRow } = await supabase
      .from('daily_routine_steps')
      .select('slug')
      .eq('slug', slug)
      .is('archived_at', null)
      .maybeSingle();
    if (!stepRow) return fail(400, { error: 'Unknown step.' });

    const today = todayIso();
    if (done) {
      const { error: delErr } = await supabase
        .from('daily_routine_completions')
        .delete()
        .eq('user_id', user.id)
        .eq('occurred_on', today)
        .eq('step_slug', slug);
      if (delErr) return fail(500, { error: delErr.message });
    } else {
      const { error: upErr } = await supabase
        .from('daily_routine_completions')
        .upsert(
          { user_id: user.id, occurred_on: today, step_slug: slug },
          { onConflict: 'user_id,occurred_on,step_slug' }
        );
      if (upErr) return fail(500, { error: upErr.message });
    }
    return { ok: true };
  }
};

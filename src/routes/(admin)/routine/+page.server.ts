import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export type StepSlug =
  | 'review_orders'
  | 'process_purchases'
  | 'fulfill_invoice'
  | 'ar_ap_followup'
  | 'review_tasks';

const STEP_SLUGS: StepSlug[] = [
  'review_orders',
  'process_purchases',
  'fulfill_invoice',
  'ar_ap_followup',
  'review_tasks'
];

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
function yesterdayIso(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

export const load: PageServerLoad = async ({ locals: { supabase, user } }) => {
  const today = todayIso();
  const yesterday = yesterdayIso();
  const nowIso = new Date().toISOString();

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
      .eq('user_id', user!.id)
      .in('occurred_on', [today, yesterday]),
    supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending_payment'),
    supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'paid'),
    supabase
      .from('purchases')
      .select('id', { count: 'exact', head: true })
      .in('status', ['draft', 'ordered']),
    supabase
      .from('purchases')
      .select('id', { count: 'exact', head: true })
      .in('payment_status', ['unpaid', 'partial']),
    supabase
      .from('invoices')
      .select('id', { count: 'exact', head: true })
      .in('status', ['issued', 'partially_paid', 'overdue'])
      .lt('due_at', nowIso),
    supabase
      .from('customer_tasks')
      .select('id', { count: 'exact', head: true })
      .in('status', ['open', 'in_progress'])
      .lt('due_at', nowIso)
  ]);

  const completions = (completionsRes.data ?? []) as Array<{
    step_slug: StepSlug;
    occurred_on: string;
    completed_at: string;
    notes: string | null;
  }>;

  const todayDone = new Set(completions.filter((c) => c.occurred_on === today).map((c) => c.step_slug));
  const yesterdayDone = new Set(
    completions.filter((c) => c.occurred_on === yesterday).map((c) => c.step_slug)
  );

  return {
    today,
    yesterday,
    todayDone: Array.from(todayDone),
    yesterdayMissing: STEP_SLUGS.filter((s) => !yesterdayDone.has(s)),
    counts: {
      new_orders: newOrdersRes.count ?? 0,
      fulfillable_orders: fulfillableOrdersRes.count ?? 0,
      open_purchases: openPurchasesRes.count ?? 0,
      unpaid_purchases: unpaidPurchasesRes.count ?? 0,
      overdue_invoices: overdueInvoicesRes.count ?? 0,
      overdue_tasks: overdueTasksRes.count ?? 0
    }
  };
};

export const actions: Actions = {
  toggle: async ({ request, locals: { supabase, user } }) => {
    const fd = await request.formData();
    const slug = String(fd.get('slug') ?? '') as StepSlug;
    const done = String(fd.get('done') ?? '') === 'true';
    if (!STEP_SLUGS.includes(slug)) return fail(400, { error: 'Unknown step' });

    const today = todayIso();
    if (done) {
      const { error } = await supabase
        .from('daily_routine_completions')
        .delete()
        .eq('user_id', user!.id)
        .eq('occurred_on', today)
        .eq('step_slug', slug);
      if (error) return fail(500, { error: error.message });
    } else {
      const { error } = await supabase
        .from('daily_routine_completions')
        .upsert(
          { user_id: user!.id, occurred_on: today, step_slug: slug },
          { onConflict: 'user_id,occurred_on,step_slug' }
        );
      if (error) return fail(500, { error: error.message });
    }
    return { ok: true };
  }
};

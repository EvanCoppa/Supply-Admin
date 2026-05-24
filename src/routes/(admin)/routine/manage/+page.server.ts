import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import type { DailyRoutineBadgeKind, DailyRoutineStep } from '$lib/types/db';

const VALID_BADGE_KINDS: DailyRoutineBadgeKind[] = [
  'new_orders',
  'fulfillable_orders',
  'open_purchases',
  'unpaid_purchases',
  'overdue_invoices',
  'overdue_tasks',
  'ar_ap'
];

function isBadgeKind(value: string): value is DailyRoutineBadgeKind {
  return (VALID_BADGE_KINDS as string[]).includes(value);
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 8);
}

function readForm(fd: FormData): {
  title: string;
  blurb: string | null;
  href: string | null;
  cta: string | null;
  badge_kind: DailyRoutineBadgeKind | null;
} {
  const title = String(fd.get('title') ?? '').trim();
  const blurbRaw = String(fd.get('blurb') ?? '').trim();
  const hrefRaw = String(fd.get('href') ?? '').trim();
  const ctaRaw = String(fd.get('cta') ?? '').trim();
  const badgeRaw = String(fd.get('badge_kind') ?? '').trim();
  const badge_kind = badgeRaw && isBadgeKind(badgeRaw) ? badgeRaw : null;
  return {
    title,
    blurb: blurbRaw || null,
    href: hrefRaw || null,
    cta: ctaRaw || null,
    badge_kind
  };
}

export const load: PageServerLoad = async ({ locals: { supabase, user } }) => {
  if (!user) throw error(401, 'Not signed in.');
  const { data, error: stepErr } = await supabase
    .from('daily_routine_steps')
    .select('id, slug, title, blurb, href, cta, badge_kind, sort_order, archived_at, created_at, updated_at')
    .order('archived_at', { ascending: true, nullsFirst: true })
    .order('sort_order', { ascending: true });
  if (stepErr) throw error(500, stepErr.message);
  return { steps: (data ?? []) as DailyRoutineStep[] };
};

export const actions: Actions = {
  create: async ({ request, locals: { supabase, user } }) => {
    if (!user) return fail(401, { message: 'Not signed in.' });
    const fd = await request.formData();
    const fields = readForm(fd);
    if (!fields.title) return fail(400, { message: 'Title is required.' });

    const base = slugify(fields.title) || 'step';
    const slug = `${base}-${randomSuffix()}`;

    const { data: maxRow } = await supabase
      .from('daily_routine_steps')
      .select('sort_order')
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextOrder = (maxRow?.sort_order ?? 0) + 10;

    const { error: insErr } = await supabase.from('daily_routine_steps').insert({
      slug,
      title: fields.title,
      blurb: fields.blurb,
      href: fields.href,
      cta: fields.cta,
      badge_kind: fields.badge_kind,
      sort_order: nextOrder
    });
    if (insErr) return fail(400, { message: insErr.message });
    return { saved: true };
  },

  update: async ({ request, locals: { supabase, user } }) => {
    if (!user) return fail(401, { message: 'Not signed in.' });
    const fd = await request.formData();
    const id = String(fd.get('id') ?? '');
    if (!id) return fail(400, { message: 'Missing step.' });
    const fields = readForm(fd);
    if (!fields.title) return fail(400, { message: 'Title is required.' });

    const { error: upErr } = await supabase
      .from('daily_routine_steps')
      .update({
        title: fields.title,
        blurb: fields.blurb,
        href: fields.href,
        cta: fields.cta,
        badge_kind: fields.badge_kind,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);
    if (upErr) return fail(400, { message: upErr.message });
    return { saved: true };
  },

  archive: async ({ request, locals: { supabase, user } }) => {
    if (!user) return fail(401, { message: 'Not signed in.' });
    const fd = await request.formData();
    const id = String(fd.get('id') ?? '');
    if (!id) return fail(400, { message: 'Missing step.' });
    const { error: upErr } = await supabase
      .from('daily_routine_steps')
      .update({ archived_at: new Date().toISOString() })
      .eq('id', id);
    if (upErr) return fail(400, { message: upErr.message });
    return { saved: true };
  },

  unarchive: async ({ request, locals: { supabase, user } }) => {
    if (!user) return fail(401, { message: 'Not signed in.' });
    const fd = await request.formData();
    const id = String(fd.get('id') ?? '');
    if (!id) return fail(400, { message: 'Missing step.' });
    const { error: upErr } = await supabase
      .from('daily_routine_steps')
      .update({ archived_at: null })
      .eq('id', id);
    if (upErr) return fail(400, { message: upErr.message });
    return { saved: true };
  },

  delete: async ({ request, locals: { supabase, user } }) => {
    if (!user) return fail(401, { message: 'Not signed in.' });
    const fd = await request.formData();
    const id = String(fd.get('id') ?? '');
    if (!id) return fail(400, { message: 'Missing step.' });
    const { error: delErr } = await supabase.from('daily_routine_steps').delete().eq('id', id);
    if (delErr) return fail(400, { message: delErr.message });
    return { saved: true };
  },

  reorder: async ({ request, locals: { supabase, user } }) => {
    if (!user) return fail(401, { message: 'Not signed in.' });
    const fd = await request.formData();
    const id = String(fd.get('id') ?? '');
    const direction = String(fd.get('direction') ?? '');
    if (!id) return fail(400, { message: 'Missing step.' });
    if (direction !== 'up' && direction !== 'down') {
      return fail(400, { message: 'Bad direction.' });
    }

    const { data: items } = await supabase
      .from('daily_routine_steps')
      .select('id, sort_order')
      .is('archived_at', null)
      .order('sort_order', { ascending: true });
    if (!items) return { saved: true };

    const idx = items.findIndex((i) => i.id === id);
    const neighborIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (idx < 0 || neighborIdx < 0 || neighborIdx >= items.length) return { saved: true };
    const a = items[idx];
    const b = items[neighborIdx];
    if (!a || !b) return { saved: true };

    const { error: e1 } = await supabase
      .from('daily_routine_steps')
      .update({ sort_order: b.sort_order })
      .eq('id', a.id);
    if (e1) return fail(400, { message: e1.message });
    const { error: e2 } = await supabase
      .from('daily_routine_steps')
      .update({ sort_order: a.sort_order })
      .eq('id', b.id);
    if (e2) return fail(400, { message: e2.message });
    return { saved: true };
  }
};

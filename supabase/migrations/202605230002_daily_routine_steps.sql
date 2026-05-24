-- Editable daily routine steps. Shared org-wide list; completions remain per-user (keyed by step_slug).

create table if not exists public.daily_routine_steps (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  blurb text,
  href text,
  cta text,
  badge_kind text check (badge_kind in (
    'new_orders',
    'fulfillable_orders',
    'open_purchases',
    'unpaid_purchases',
    'overdue_invoices',
    'overdue_tasks',
    'ar_ap'
  )),
  sort_order int not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists daily_routine_steps_sort_idx
  on public.daily_routine_steps(sort_order)
  where archived_at is null;

alter table public.daily_routine_steps enable row level security;

do $$
begin
  create policy daily_routine_steps_admin_all on public.daily_routine_steps
    for all to authenticated
    using (exists (select 1 from public.user_profiles up where up.id = auth.uid() and up.role = 'admin'))
    with check (exists (select 1 from public.user_profiles up where up.id = auth.uid() and up.role = 'admin'));
exception when duplicate_object then null; end $$;

comment on table public.daily_routine_steps is
  'Editable, shared definitions of the daily operational checklist. Completion history lives in daily_routine_completions and is keyed by slug, not FK, so deleted steps still surface historically.';

-- Seed the five built-in steps with the same slugs the hardcoded version used,
-- so any pre-existing daily_routine_completions rows keep matching.
insert into public.daily_routine_steps (slug, title, blurb, href, cta, badge_kind, sort_order) values
  ('review_orders',     'Review new orders',                'Confirm new orders look right and are ready to be paid or processed.', '/orders?status=pending_payment', 'Open orders',      'new_orders',         10),
  ('process_purchases', 'Process purchases',                'Place POs for items that need restocking and mark received goods.',    '/purchases?status=ordered',      'Open purchases',   'open_purchases',     20),
  ('fulfill_invoice',   'Mark fulfilled & invoice clients', 'Ship paid orders, generate invoices, send to clients.',                '/orders?status=paid',            'Open fulfillable', 'fulfillable_orders', 30),
  ('ar_ap_followup',    'AR / AP follow-up',                'Chase overdue client invoices and reconcile supplier bills.',          '/invoices?view=overdue',         'Open AR',          'ar_ap',              40),
  ('review_tasks',      'Clear overdue tasks',              'Check the task board and resolve anything past its due date.',         '/tasks?view=overdue',            'Open tasks',       'overdue_tasks',      50)
on conflict (slug) do nothing;

-- Daily routine: per-user, per-day completion log for the operational checklist.

create table if not exists public.daily_routine_completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  occurred_on date not null default current_date,
  step_slug text not null,
  notes text,
  completed_at timestamptz not null default now(),
  unique (user_id, occurred_on, step_slug)
);

create index if not exists daily_routine_completions_user_idx
  on public.daily_routine_completions(user_id, occurred_on desc);

alter table public.daily_routine_completions enable row level security;

do $$
begin
  create policy daily_routine_completions_admin_all on public.daily_routine_completions
    for all to authenticated
    using (exists (select 1 from public.user_profiles up where up.id = auth.uid() and up.role = 'admin'))
    with check (exists (select 1 from public.user_profiles up where up.id = auth.uid() and up.role = 'admin'));
exception when duplicate_object then null; end $$;

comment on table public.daily_routine_completions is
  'Tracks completion of the daily operational checklist steps per user per day.';

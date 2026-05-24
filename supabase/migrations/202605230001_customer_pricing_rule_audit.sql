-- Audit trail for customer pricing rules (writes from /clients/[id]/pricing actions).

create table if not exists public.customer_pricing_rule_audit (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  rule_id uuid references public.customer_pricing_rules(id) on delete set null,
  action text not null check (action in ('create', 'update', 'delete')),
  actor_id uuid references auth.users(id) on delete set null,
  actor_email text,
  changes jsonb,
  created_at timestamptz not null default now()
);

create index if not exists customer_pricing_rule_audit_customer_idx
  on public.customer_pricing_rule_audit(customer_id, created_at desc);

create index if not exists customer_pricing_rule_audit_rule_idx
  on public.customer_pricing_rule_audit(rule_id);

alter table public.customer_pricing_rule_audit enable row level security;

do $$
begin
  create policy customer_pricing_rule_audit_admin_read on public.customer_pricing_rule_audit
    for select to authenticated
    using (exists (select 1 from public.user_profiles up where up.id = auth.uid() and up.role = 'admin'));
exception when duplicate_object then null; end $$;

do $$
begin
  create policy customer_pricing_rule_audit_admin_write on public.customer_pricing_rule_audit
    for insert to authenticated
    with check (exists (select 1 from public.user_profiles up where up.id = auth.uid() and up.role = 'admin'));
exception when duplicate_object then null; end $$;

comment on table public.customer_pricing_rule_audit is
  'Audit log of customer pricing rule mutations (create/update/delete) with actor attribution.';

-- Dashboard support: suppliers, purchases (AP + COGS), cash entries.

create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  kind text not null,
  distribution_fee_pct numeric(6, 4) not null default 0,
  default_payment_terms_days integer not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint suppliers_kind_check check (
    kind in ('mckesson', 'airtite', 'medplus', 'amazon', 'other')
  ),
  constraint suppliers_distribution_fee_pct_check check (
    distribution_fee_pct >= 0 and distribution_fee_pct <= 1
  )
);

insert into public.suppliers (key, name, kind, distribution_fee_pct, default_payment_terms_days)
values
  ('mckesson', 'McKesson', 'mckesson', 0, 30),
  ('airtite', 'Airtite', 'airtite', 0, 30),
  ('medplus', 'MedPlus', 'medplus', 0.045, 0),
  ('amazon', 'Amazon', 'amazon', 0, 0),
  ('other', 'Other', 'other', 0, 0)
on conflict (key) do nothing;

create table if not exists public.purchases (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.suppliers(id) on delete restrict,
  order_id uuid references public.orders(id) on delete set null,
  ordered_at timestamptz not null default now(),
  received_at timestamptz,
  subtotal numeric(12, 2) not null default 0,
  freight numeric(12, 2) not null default 0,
  distribution_fee_pct numeric(6, 4) not null default 0,
  distribution_fee numeric(12, 2) not null default 0,
  tax numeric(12, 2) not null default 0,
  total numeric(12, 2) not null default 0,
  status text not null default 'draft',
  payment_status text not null default 'unpaid',
  due_date date,
  paid_at timestamptz,
  invoice_ref text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint purchases_status_check check (
    status in ('draft', 'ordered', 'received', 'cancelled')
  ),
  constraint purchases_payment_status_check check (
    payment_status in ('unpaid', 'partial', 'paid')
  ),
  constraint purchases_money_check check (
    subtotal >= 0 and freight >= 0 and distribution_fee >= 0 and tax >= 0 and total >= 0
  ),
  constraint purchases_distribution_fee_pct_check check (
    distribution_fee_pct >= 0 and distribution_fee_pct <= 1
  )
);

create index if not exists purchases_supplier_idx on public.purchases(supplier_id, ordered_at desc);
create index if not exists purchases_order_idx on public.purchases(order_id);
create index if not exists purchases_payment_status_idx on public.purchases(payment_status, due_date);
create index if not exists purchases_ordered_at_idx on public.purchases(ordered_at desc);

create table if not exists public.purchase_line_items (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references public.purchases(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  order_line_item_id uuid references public.order_line_items(id) on delete set null,
  product_sku_snapshot text,
  product_name_snapshot text,
  description text,
  quantity numeric(12, 2) not null default 1,
  unit_cost numeric(12, 4) not null default 0,
  line_total numeric(12, 2) not null default 0,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint purchase_line_items_quantity_check check (quantity > 0),
  constraint purchase_line_items_money_check check (unit_cost >= 0 and line_total >= 0)
);

create index if not exists purchase_line_items_purchase_idx
  on public.purchase_line_items(purchase_id, display_order);
create index if not exists purchase_line_items_product_idx
  on public.purchase_line_items(product_id);

create or replace function public.purchases_apply_defaults()
returns trigger
language plpgsql
as $$
declare
  supplier_pct numeric(6, 4);
begin
  if NEW.distribution_fee_pct = 0
     and (TG_OP = 'INSERT' or NEW.supplier_id is distinct from OLD.supplier_id) then
    select distribution_fee_pct into supplier_pct
    from public.suppliers where id = NEW.supplier_id;
    NEW.distribution_fee_pct := coalesce(supplier_pct, 0);
  end if;

  NEW.distribution_fee := round(NEW.subtotal * NEW.distribution_fee_pct, 2);
  NEW.total := NEW.subtotal + NEW.freight + NEW.distribution_fee + NEW.tax;
  NEW.updated_at := now();
  return NEW;
end;
$$;

drop trigger if exists purchases_apply_defaults_trg on public.purchases;
create trigger purchases_apply_defaults_trg
before insert or update on public.purchases
for each row execute function public.purchases_apply_defaults();

create table if not exists public.cash_entries (
  id uuid primary key default gen_random_uuid(),
  occurred_on date not null default current_date,
  direction text not null,
  amount numeric(12, 2) not null,
  source text not null,
  ref_table text,
  ref_id uuid,
  notes text,
  created_at timestamptz not null default now(),
  constraint cash_entries_direction_check check (direction in ('in', 'out')),
  constraint cash_entries_amount_check check (amount > 0),
  constraint cash_entries_source_check check (source in (
    'invoice_payment', 'purchase_payment', 'manual', 'medplus_autocharge', 'credit_card', 'other'
  ))
);

create index if not exists cash_entries_occurred_idx on public.cash_entries(occurred_on desc);
create index if not exists cash_entries_direction_idx on public.cash_entries(direction, occurred_on desc);

create or replace view public.v_order_cogs as
select
  p.order_id,
  sum(p.total) as cogs_total,
  sum(p.subtotal) as cogs_subtotal,
  sum(p.freight) as cogs_freight,
  sum(p.distribution_fee) as cogs_distribution_fee
from public.purchases p
where p.order_id is not null
  and p.status <> 'cancelled'
group by p.order_id;

alter table public.suppliers enable row level security;
alter table public.purchases enable row level security;
alter table public.purchase_line_items enable row level security;
alter table public.cash_entries enable row level security;

do $$
begin
  create policy suppliers_admin_all on public.suppliers
    for all to authenticated
    using (exists (select 1 from public.user_profiles up where up.id = auth.uid() and up.role = 'admin'))
    with check (exists (select 1 from public.user_profiles up where up.id = auth.uid() and up.role = 'admin'));
exception when duplicate_object then null; end $$;

do $$
begin
  create policy purchases_admin_all on public.purchases
    for all to authenticated
    using (exists (select 1 from public.user_profiles up where up.id = auth.uid() and up.role = 'admin'))
    with check (exists (select 1 from public.user_profiles up where up.id = auth.uid() and up.role = 'admin'));
exception when duplicate_object then null; end $$;

do $$
begin
  create policy purchase_line_items_admin_all on public.purchase_line_items
    for all to authenticated
    using (exists (select 1 from public.user_profiles up where up.id = auth.uid() and up.role = 'admin'))
    with check (exists (select 1 from public.user_profiles up where up.id = auth.uid() and up.role = 'admin'));
exception when duplicate_object then null; end $$;

do $$
begin
  create policy cash_entries_admin_all on public.cash_entries
    for all to authenticated
    using (exists (select 1 from public.user_profiles up where up.id = auth.uid() and up.role = 'admin'))
    with check (exists (select 1 from public.user_profiles up where up.id = auth.uid() and up.role = 'admin'));
exception when duplicate_object then null; end $$;

comment on table public.suppliers is 'Vendor dimension: McKesson, Airtite, MedPlus, Amazon, Other.';
comment on table public.purchases is 'Supplier purchases (POs) feeding COGS and AP.';
comment on table public.purchase_line_items is 'Line-level cost detail for purchases.';
comment on table public.cash_entries is 'Cash in/out ledger for dashboard cash-flow metric.';
comment on view public.v_order_cogs is 'Aggregated landed cost per client order from purchases.';

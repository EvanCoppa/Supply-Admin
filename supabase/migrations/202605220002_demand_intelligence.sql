-- Demand intelligence: trending-item and per-client repeat-order views,
-- and a manual watch list.

create or replace view public.v_product_velocity_30d as
select
  oli.product_id,
  max(oli.product_sku_snapshot) as sku,
  max(oli.product_name_snapshot) as name,
  sum(oli.quantity) as total_qty,
  count(distinct o.customer_id) as unique_customers,
  count(distinct oli.order_id) as order_count,
  sum(oli.line_total) as revenue
from public.order_line_items oli
join public.orders o on o.id = oli.order_id
where o.placed_at >= now() - interval '30 days'
  and o.status not in ('cancelled', 'refunded')
group by oli.product_id;

create or replace view public.v_client_product_repeats_30d as
select
  o.customer_id,
  oli.product_id,
  max(oli.product_name_snapshot) as product_name,
  max(oli.product_sku_snapshot) as product_sku,
  count(distinct oli.order_id) as order_count,
  sum(oli.quantity) as total_qty,
  max(o.placed_at) as last_ordered_at
from public.order_line_items oli
join public.orders o on o.id = oli.order_id
where o.placed_at >= now() - interval '30 days'
  and o.status not in ('cancelled', 'refunded')
group by o.customer_id, oli.product_id
having count(distinct oli.order_id) >= 2;

create table if not exists public.watchlist_items (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  notes text,
  added_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (product_id)
);

create index if not exists watchlist_items_created_idx on public.watchlist_items(created_at desc);

alter table public.watchlist_items enable row level security;

do $$
begin
  create policy watchlist_items_admin_all on public.watchlist_items
    for all to authenticated
    using (exists (select 1 from public.user_profiles up where up.id = auth.uid() and up.role = 'admin'))
    with check (exists (select 1 from public.user_profiles up where up.id = auth.uid() and up.role = 'admin'));
exception when duplicate_object then null; end $$;

comment on view public.v_product_velocity_30d is 'Top-selling products by quantity across all clients in the last 30 days.';
comment on view public.v_client_product_repeats_30d is 'Per-customer products ordered 2+ times in the last 30 days.';
comment on table public.watchlist_items is 'Products flagged for stock-up consideration or supplier negotiation.';

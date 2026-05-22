-- Profitability views for product- and supplier-level reports.

create or replace view public.v_product_profitability as
with sells as (
  select
    oli.product_id,
    sum(oli.quantity) as qty_sold,
    sum(oli.line_total) as revenue
  from public.order_line_items oli
  join public.orders o on o.id = oli.order_id
  where o.status not in ('cancelled', 'refunded')
  group by oli.product_id
),
costs as (
  select
    pli.product_id,
    sum(pli.quantity) as qty_purchased,
    sum(pli.line_total) as cost
  from public.purchase_line_items pli
  join public.purchases p on p.id = pli.purchase_id
  where p.status <> 'cancelled'
    and pli.product_id is not null
  group by pli.product_id
)
select
  p.id as product_id,
  p.sku,
  p.name,
  coalesce(s.qty_sold, 0) as qty_sold,
  coalesce(s.revenue, 0) as revenue,
  coalesce(c.qty_purchased, 0) as qty_purchased,
  coalesce(c.cost, 0) as cost,
  coalesce(s.revenue, 0) - coalesce(c.cost, 0) as gross_profit,
  case
    when coalesce(s.revenue, 0) > 0
      then (coalesce(s.revenue, 0) - coalesce(c.cost, 0)) / s.revenue
    else null
  end as margin
from public.products p
left join sells s on s.product_id = p.id
left join costs c on c.product_id = p.id
where coalesce(s.qty_sold, 0) > 0 or coalesce(c.qty_purchased, 0) > 0;

create or replace view public.v_supplier_spend as
select
  s.id as supplier_id,
  s.name,
  s.key,
  count(p.id) filter (where p.status <> 'cancelled') as purchase_count,
  coalesce(sum(p.total) filter (where p.status <> 'cancelled'), 0) as total_spend,
  coalesce(sum(p.subtotal) filter (where p.status <> 'cancelled'), 0) as total_subtotal,
  coalesce(sum(p.freight) filter (where p.status <> 'cancelled'), 0) as total_freight,
  coalesce(sum(p.distribution_fee) filter (where p.status <> 'cancelled'), 0) as total_distribution_fee,
  coalesce(sum(p.total) filter (where p.status <> 'cancelled' and p.payment_status <> 'paid'), 0) as outstanding_ap,
  count(distinct p.order_id) filter (where p.status <> 'cancelled' and p.order_id is not null) as orders_fulfilled
from public.suppliers s
left join public.purchases p on p.supplier_id = s.id
group by s.id, s.name, s.key;

comment on view public.v_product_profitability is 'Per-product lifetime revenue vs purchase cost, with gross profit and margin.';
comment on view public.v_supplier_spend is 'Per-supplier purchase totals, freight, fees, outstanding AP, and orders fulfilled.';

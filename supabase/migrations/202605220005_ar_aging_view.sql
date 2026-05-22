-- AR aging: per-invoice bucket assignment for outstanding receivables.
-- Buckets are computed from `due_at` vs current_date; balance = total - amount_paid.

create or replace view public.v_ar_aging as
select
  i.id            as invoice_id,
  i.invoice_number,
  i.customer_id,
  c.business_name as customer_name,
  i.issued_at,
  i.due_at,
  i.total,
  i.amount_paid,
  (i.total - i.amount_paid)::numeric as balance,
  case
    when i.due_at is null then null
    else greatest(0, (current_date - i.due_at::date))::int
  end as days_past_due,
  case
    when i.due_at is null                               then 'no_due_date'
    when i.due_at::date >= current_date                 then 'current'
    when (current_date - i.due_at::date) <= 30          then 'd1_30'
    when (current_date - i.due_at::date) <= 60          then 'd31_60'
    when (current_date - i.due_at::date) <= 90          then 'd61_90'
    else                                                     'd90_plus'
  end as bucket
from public.invoices i
left join public.customers c on c.id = i.customer_id
where i.status in ('issued', 'partially_paid', 'overdue')
  and (i.total - i.amount_paid) > 0;

comment on view public.v_ar_aging is
  'Outstanding invoices bucketed by days-past-due (current, 1-30, 31-60, 61-90, 90+).';

grant select on public.v_ar_aging to authenticated;

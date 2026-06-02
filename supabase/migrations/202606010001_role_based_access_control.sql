-- Implement role-based access control
-- Update RLS policies to support new roles (admin, sales_rep, accounting, warehouse_staff, new_hire)
-- Admins and other authorized roles can access management tables
-- Customers continue to have limited access

-- Update suppliers RLS policy to allow all non-customer roles
drop policy if exists suppliers_admin_access on public.suppliers;
create policy suppliers_admin_access on public.suppliers
  for all
  using (exists (
    select 1 from public.user_profiles up
    where up.id = auth.uid()
    and up.role != 'customer'
    and up.deactivated_at is null
  ))
  with check (exists (
    select 1 from public.user_profiles up
    where up.id = auth.uid()
    and up.role != 'customer'
    and up.deactivated_at is null
  ));

-- Update purchases RLS policy to allow all non-customer roles
drop policy if exists purchases_admin_access on public.purchases;
create policy purchases_admin_access on public.purchases
  for all
  using (exists (
    select 1 from public.user_profiles up
    where up.id = auth.uid()
    and up.role != 'customer'
    and up.deactivated_at is null
  ))
  with check (exists (
    select 1 from public.user_profiles up
    where up.id = auth.uid()
    and up.role != 'customer'
    and up.deactivated_at is null
  ));

-- Update purchase_line_items RLS policy to allow all non-customer roles
drop policy if exists purchase_line_items_admin_access on public.purchase_line_items;
create policy purchase_line_items_admin_access on public.purchase_line_items
  for all
  using (exists (
    select 1 from public.user_profiles up
    where up.id = auth.uid()
    and up.role != 'customer'
    and up.deactivated_at is null
  ))
  with check (exists (
    select 1 from public.user_profiles up
    where up.id = auth.uid()
    and up.role != 'customer'
    and up.deactivated_at is null
  ));

-- Add updated_at column to user_profiles if it doesn't exist
alter table public.user_profiles
  add column if not exists updated_at timestamptz default now();

-- Comment on the new columns
comment on column public.user_profiles.deactivated_at is 'Timestamp when user was deactivated. NULL means active.';
comment on column public.user_profiles.updated_at is 'Timestamp of last update.';

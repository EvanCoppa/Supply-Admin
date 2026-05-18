-- API organization access should fail closed by default.
-- Linked Guaranteed Slides orgs only see products explicitly assigned in customer_product_access.

alter table public.customers
  alter column catalog_access_mode set default 'allowlist';

update public.customers
set catalog_access_mode = 'allowlist',
    updated_at = now()
where catalog_access_mode = 'all_active'
  and exists (
    select 1
    from public.guaranteeth_organization_links links
    where links.customer_id = customers.id
  );

comment on column public.customers.catalog_access_mode is
  'allowlist shows only customer_product_access rows where can_view = true; all_active shows all active products except explicit denies.';

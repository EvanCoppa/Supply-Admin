-- Guaranteed Slides integration support for customer-scoped supply catalog access.

alter table public.customers
  add column if not exists catalog_access_mode text not null default 'all_active';

alter table public.customers
  add constraint customers_catalog_access_mode_check
  check (catalog_access_mode in ('all_active', 'allowlist')) not valid;

alter table public.customers
  validate constraint customers_catalog_access_mode_check;

create table if not exists public.guaranteeth_organization_links (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  guaranteeth_org_id text not null unique,
  org_name text,
  org_email text,
  org_phone text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (customer_id)
);

create table if not exists public.customer_product_access (
  customer_id uuid not null references public.customers(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  can_view boolean not null default true,
  can_buy boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (customer_id, product_id)
);

create index if not exists customer_product_access_product_id_idx
  on public.customer_product_access(product_id);

comment on column public.customers.catalog_access_mode is
  'all_active shows all active products except explicit denies; allowlist shows only customer_product_access rows where can_view = true.';

comment on table public.guaranteeth_organization_links is
  'Maps Guaranteed Slides organizations to Supply Admin customer records.';

comment on table public.customer_product_access is
  'Per-customer product visibility and purchasability overrides for API catalog consumers.';

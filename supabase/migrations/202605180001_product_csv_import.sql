-- Adds catalog metadata needed by the Smile inventory CSV import.
-- Prices that are blank or unknown in the source CSV are imported as 0 and
-- flagged with price_needs_review so the catalog can be cleaned up later.

alter table public.products
  alter column base_price set default 0,
  add column if not exists source_system text,
  add column if not exists source_last_purchased_at timestamptz,
  add column if not exists source_total_orders integer,
  add column if not exists source_last_purchased_quantity integer,
  add column if not exists price_needs_review boolean not null default false,
  add column if not exists imported_at timestamptz;

alter table public.products
  add constraint products_source_total_orders_nonnegative
  check (source_total_orders is null or source_total_orders >= 0) not valid;

alter table public.products
  validate constraint products_source_total_orders_nonnegative;

alter table public.products
  add constraint products_source_last_purchased_quantity_nonnegative
  check (source_last_purchased_quantity is null or source_last_purchased_quantity >= 0) not valid;

alter table public.products
  validate constraint products_source_last_purchased_quantity_nonnegative;

create unique index if not exists products_sku_unique_idx
  on public.products (sku);

comment on column public.products.source_system is
  'External inventory or catalog source used by bulk imports.';
comment on column public.products.source_last_purchased_at is
  'Last purchase timestamp from the imported source file, not current inventory.';
comment on column public.products.source_total_orders is
  'Historical order count from the imported source file.';
comment on column public.products.source_last_purchased_quantity is
  'Quantity on the last purchase from the imported source file, not current stock.';
comment on column public.products.price_needs_review is
  'True when imported price data was blank, non-numeric, or otherwise unknown.';
comment on column public.products.imported_at is
  'Timestamp of the last bulk import that touched this product.';

-- Add unit_cost field to products table for markup-based pricing
alter table public.products
  add column if not exists unit_cost numeric(12, 2) not null default 0;

-- Create index for cost-based queries
create index if not exists products_unit_cost_idx
  on public.products(unit_cost);

comment on column public.products.unit_cost is
  'Our cost to acquire the product. Used to auto-derive base_price via 40% markup.';

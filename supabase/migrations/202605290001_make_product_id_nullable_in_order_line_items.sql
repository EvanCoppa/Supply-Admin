-- Allow free-form line items without product_id references
alter table public.order_line_items
  alter column product_id drop not null;

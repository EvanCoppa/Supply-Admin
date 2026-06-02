-- Allow free-form line items without a product SKU snapshot
alter table public.order_line_items
  alter column product_sku_snapshot drop not null;

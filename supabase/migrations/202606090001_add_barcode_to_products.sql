-- Add barcode column to products table for barcode scanning support
alter table public.products
  add column if not exists barcode text;

comment on column public.products.barcode is
  'Barcode identifier for product scanning and lookup.';

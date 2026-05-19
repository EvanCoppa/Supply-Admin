-- Product preview images live in a public Supabase Storage bucket.
-- The catalog keeps the canonical preview as the first products.image_paths entry.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = true,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

do $$
declare
  image_paths_type text;
begin
  select data_type
  into image_paths_type
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'products'
    and column_name = 'image_paths';

  if image_paths_type is null then
    alter table public.products
      add column image_paths text[] not null default '{}';
  elsif image_paths_type = 'ARRAY' then
    update public.products set image_paths = '{}' where image_paths is null;
    alter table public.products
      alter column image_paths set default '{}',
      alter column image_paths set not null;
  elsif image_paths_type = 'jsonb' then
    update public.products set image_paths = '[]'::jsonb where image_paths is null;
    alter table public.products
      alter column image_paths set default '[]'::jsonb,
      alter column image_paths set not null;
  end if;
end $$;

comment on column public.products.image_paths is
  'Ordered product image storage paths. The first entry is the canonical catalog preview image.';

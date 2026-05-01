-- Provisions the Supabase Storage bucket used by the admin Catalog UI for
-- product images. The application stores the resulting paths in
-- `products.image_paths` (already created by an earlier migration).
--
-- The bucket is public so `storage.getPublicUrl(...)` returns URLs the admin
-- UI can render directly. Writes are gated to admins via `user_profiles.role`,
-- mirroring the RLS pattern used by the rest of the schema.

insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

-- Public read: anyone can fetch a product image once its path is known.
drop policy if exists "product-images public read" on storage.objects;
create policy "product-images public read"
on storage.objects
for select
using (bucket_id = 'product-images');

-- Admin-only write.
drop policy if exists "product-images admin insert" on storage.objects;
create policy "product-images admin insert"
on storage.objects
for insert
with check (
  bucket_id = 'product-images'
  and exists (
    select 1
    from public.user_profiles
    where id = auth.uid()
      and role = 'admin'
  )
);

drop policy if exists "product-images admin update" on storage.objects;
create policy "product-images admin update"
on storage.objects
for update
using (
  bucket_id = 'product-images'
  and exists (
    select 1
    from public.user_profiles
    where id = auth.uid()
      and role = 'admin'
  )
)
with check (
  bucket_id = 'product-images'
  and exists (
    select 1
    from public.user_profiles
    where id = auth.uid()
      and role = 'admin'
  )
);

drop policy if exists "product-images admin delete" on storage.objects;
create policy "product-images admin delete"
on storage.objects
for delete
using (
  bucket_id = 'product-images'
  and exists (
    select 1
    from public.user_profiles
    where id = auth.uid()
      and role = 'admin'
  )
);

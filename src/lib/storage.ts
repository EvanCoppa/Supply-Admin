import type { SupabaseClient } from '@supabase/supabase-js';

export const PRODUCT_IMAGE_BUCKET = 'product-images';

const ALLOWED_MIME = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
  'image/avif'
]);

const MAX_BYTES = 10 * 1024 * 1024;

export interface UploadedImage {
  path: string;
  size: number;
  contentType: string;
}

export function publicImageUrl(supabase: SupabaseClient, path: string): string {
  const { data } = supabase.storage.from(PRODUCT_IMAGE_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

function extFromName(name: string): string {
  const m = name.toLowerCase().match(/\.([a-z0-9]+)$/);
  return m ? m[1] : 'bin';
}

function randomSuffix(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID().replace(/-/g, '').slice(0, 16);
  }
  return Math.random().toString(36).slice(2, 18);
}

export async function uploadProductImage(
  supabase: SupabaseClient,
  productId: string,
  file: File
): Promise<{ ok: true; image: UploadedImage } | { ok: false; message: string }> {
  if (!file || file.size === 0) return { ok: false, message: 'Empty file.' };
  if (file.size > MAX_BYTES) return { ok: false, message: 'File exceeds 10 MB limit.' };
  const type = (file.type || '').toLowerCase();
  if (!ALLOWED_MIME.has(type)) {
    return { ok: false, message: `Unsupported image type: ${type || 'unknown'}` };
  }

  const ext = extFromName(file.name);
  const path = `${productId}/${Date.now()}-${randomSuffix()}.${ext}`;

  const { error } = await supabase.storage
    .from(PRODUCT_IMAGE_BUCKET)
    .upload(path, file, { contentType: type, upsert: false });

  if (error) return { ok: false, message: error.message };
  return { ok: true, image: { path, size: file.size, contentType: type } };
}

export async function deleteProductImage(
  supabase: SupabaseClient,
  path: string
): Promise<{ ok: boolean; message?: string }> {
  const { error } = await supabase.storage.from(PRODUCT_IMAGE_BUCKET).remove([path]);
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

import type { SupabaseClient } from '@supabase/supabase-js';

export const PRODUCT_IMAGES_BUCKET = 'product-images';
export const PRODUCT_IMAGE_MAX_BYTES = 10 * 1024 * 1024;

const ALLOWED_IMAGE_TYPES = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp']
]);

export function getProductImageFile(value: FormDataEntryValue | null): File | null {
  if (typeof File === 'undefined') return null;
  if (!(value instanceof File) || value.size === 0) return null;
  return value;
}

export function validateProductImage(file: File): string | null {
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    return 'Image must be JPEG, PNG, or WebP.';
  }
  if (file.size > PRODUCT_IMAGE_MAX_BYTES) {
    return 'Image must be 10 MB or smaller.';
  }
  return null;
}

export function getFirstProductImagePath(imagePaths: unknown): string | null {
  if (!Array.isArray(imagePaths)) return null;
  const first = imagePaths.find((path) => typeof path === 'string' && path.trim().length > 0);
  return typeof first === 'string' ? first.trim() : null;
}

export function getProductImagePublicUrl(
  supabase: SupabaseClient,
  imagePath: string | null | undefined
): string | null {
  if (!imagePath) return null;
  const { data } = supabase.storage.from(PRODUCT_IMAGES_BUCKET).getPublicUrl(imagePath);
  return data.publicUrl;
}

export async function uploadProductImage(
  supabase: SupabaseClient,
  productId: string,
  file: File
): Promise<{ path: string | null; error: string | null }> {
  const validationError = validateProductImage(file);
  if (validationError) return { path: null, error: validationError };

  const extension = ALLOWED_IMAGE_TYPES.get(file.type);
  if (!extension) return { path: null, error: 'Unsupported image type.' };

  const path = `products/${productId}/preview-${Date.now()}.${extension}`;
  const { error } = await supabase.storage.from(PRODUCT_IMAGES_BUCKET).upload(path, file, {
    cacheControl: '3600',
    contentType: file.type,
    upsert: false
  });

  if (error) return { path: null, error: error.message };
  return { path, error: null };
}

export async function deleteProductImage(
  supabase: SupabaseClient,
  imagePath: string | null | undefined
): Promise<void> {
  if (!imagePath) return;
  const { error } = await supabase.storage.from(PRODUCT_IMAGES_BUCKET).remove([imagePath]);
  if (error) {
    console.warn('[product-images] failed to delete storage object', { imagePath, error });
  }
}

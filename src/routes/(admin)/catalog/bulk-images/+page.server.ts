import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { createSupabaseAdminClient } from '$lib/supabase.server';
import {
  deleteProductImage,
  getFirstProductImagePath,
  uploadProductImage,
  validateProductImage
} from '$lib/server/product-images';

export const load: PageServerLoad = async ({ locals: { supabase } }) => {
  const { data, error } = await supabase
    .from('products')
    .select('id, sku, name, image_paths')
    .order('name', { ascending: true })
    .limit(5000);

  if (error) {
    console.error('[catalog/bulk-images] failed to load products', error);
    return { products: [] };
  }

  const products = (data ?? []).map((p) => ({
    id: p.id as string,
    sku: p.sku as string,
    name: p.name as string,
    hasImage: getFirstProductImagePath(p.image_paths) !== null
  }));

  return { products };
};

type UploadOutcome = {
  filename: string;
  productId: string | null;
  productSku: string | null;
  status: 'uploaded' | 'failed';
  message?: string;
};

export const actions: Actions = {
  upload: async ({ request, locals: { supabase } }) => {
    const form = await request.formData();
    const productIds = form.getAll('productIds').filter((v): v is string => typeof v === 'string');
    const filesRaw = form.getAll('files');
    const files: File[] = [];
    for (const f of filesRaw) {
      if (typeof File !== 'undefined' && f instanceof File && f.size > 0) {
        files.push(f);
      }
    }

    if (productIds.length === 0 || productIds.length !== files.length) {
      return fail(400, {
        upload: {
          ok: false,
          message: 'Pair each file with a product before uploading.',
          results: [] as UploadOutcome[]
        }
      });
    }

    const uniqueProductIds = Array.from(new Set(productIds));
    const { data: productRows, error: productErr } = await supabase
      .from('products')
      .select('id, sku, image_paths')
      .in('id', uniqueProductIds);

    if (productErr) {
      return fail(500, {
        upload: { ok: false, message: productErr.message, results: [] as UploadOutcome[] }
      });
    }

    const productsById = new Map<string, { id: string; sku: string; image_paths: unknown }>();
    for (const row of productRows ?? []) {
      productsById.set(row.id as string, {
        id: row.id as string,
        sku: row.sku as string,
        image_paths: row.image_paths
      });
    }

    const storage = createSupabaseAdminClient();
    const results: UploadOutcome[] = [];

    for (const [i, file] of files.entries()) {
      const productId = productIds[i];
      if (productId === undefined) continue;
      const product = productsById.get(productId);

      if (!product) {
        results.push({
          filename: file.name,
          productId,
          productSku: null,
          status: 'failed',
          message: 'Product not found.'
        });
        continue;
      }

      const validationError = validateProductImage(file);
      if (validationError) {
        results.push({
          filename: file.name,
          productId,
          productSku: product.sku,
          status: 'failed',
          message: validationError
        });
        continue;
      }

      const upload = await uploadProductImage(storage, productId, file);
      if (upload.error || !upload.path) {
        results.push({
          filename: file.name,
          productId,
          productSku: product.sku,
          status: 'failed',
          message: upload.error ?? 'Upload failed.'
        });
        continue;
      }

      const previousImagePath = getFirstProductImagePath(product.image_paths);
      const { error: updateError } = await supabase
        .from('products')
        .update({ image_paths: [upload.path] })
        .eq('id', productId);

      if (updateError) {
        await deleteProductImage(storage, upload.path);
        results.push({
          filename: file.name,
          productId,
          productSku: product.sku,
          status: 'failed',
          message: updateError.message
        });
        continue;
      }

      if (previousImagePath && previousImagePath !== upload.path) {
        await deleteProductImage(storage, previousImagePath);
      }

      // Reflect the new path locally so a duplicate productId in the batch
      // cleans up its predecessor rather than the original.
      product.image_paths = [upload.path];

      results.push({
        filename: file.name,
        productId,
        productSku: product.sku,
        status: 'uploaded'
      });
    }

    const uploadedCount = results.filter((r) => r.status === 'uploaded').length;
    const failedCount = results.length - uploadedCount;

    return {
      upload: {
        ok: true,
        message: `Uploaded ${uploadedCount} image${uploadedCount === 1 ? '' : 's'}${
          failedCount > 0 ? ` · ${failedCount} failed` : ''
        }.`,
        results
      }
    };
  }
};

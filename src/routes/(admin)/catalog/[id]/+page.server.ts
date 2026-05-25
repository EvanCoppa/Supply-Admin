import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
  lowStockThresholdSchema,
  parseForm,
  productSchema,
  inventoryAdjustSchema,
  REASON_CODES
} from '$lib/schemas';
import { createSupabaseAdminClient } from '$lib/supabase.server';
import {
  deleteProductImage,
  getFirstProductImagePath,
  getProductImageFile,
  getProductImagePublicUrl,
  uploadProductImage,
  validateProductImage
} from '$lib/server/product-images';

export const load: PageServerLoad = async ({ params, locals: { supabase } }) => {
  const [productRes, categoriesRes, inventoryRes, watchlistRes, ledgerRes] = await Promise.all([
    supabase.from('products').select('*').eq('id', params.id).maybeSingle(),
    supabase.from('categories').select('id, name').order('name'),
    supabase.from('inventory').select('*').eq('product_id', params.id).maybeSingle(),
    supabase.from('watchlist_items').select('id, notes').eq('product_id', params.id).maybeSingle(),
    supabase
      .from('inventory_ledger')
      .select('id, delta, reason, notes, order_id, actor_id, created_at')
      .eq('product_id', params.id)
      .order('created_at', { ascending: false })
      .limit(200)
  ]);

  if (productRes.error || !productRes.data) {
    throw error(404, 'Product not found');
  }

  const productImagePath = getFirstProductImagePath(productRes.data.image_paths);

  return {
    product: productRes.data,
    productImageUrl: getProductImagePublicUrl(supabase, productImagePath),
    categories: categoriesRes.data ?? [],
    inventory: inventoryRes.data,
    watchlistItem: watchlistRes.data,
    ledger: ledgerRes.data ?? [],
    reasons: REASON_CODES
  };
};

export const actions: Actions = {
  save: async ({ params, request, locals: { supabase } }) => {
    const form = await request.formData();
    const imageFile = getProductImageFile(form.get('image'));
    const parsed = parseForm(productSchema, form);
    if (!parsed.success) {
      return fail(400, { message: parsed.message, fieldErrors: parsed.fieldErrors });
    }

    if (imageFile) {
      const imageError = validateProductImage(imageFile);
      if (imageError) {
        return fail(400, { message: imageError, fieldErrors: { image: [imageError] } });
      }
    }

    let storage: ReturnType<typeof createSupabaseAdminClient> | null = null;
    let newImagePath: string | null = null;
    let previousImagePath: string | null = null;

    if (imageFile) {
      const productRes = await supabase
        .from('products')
        .select('image_paths')
        .eq('id', params.id)
        .maybeSingle();
      if (productRes.error || !productRes.data) {
        return fail(404, { message: 'Product not found.', fieldErrors: {} });
      }

      previousImagePath = getFirstProductImagePath(productRes.data.image_paths);

      try {
        storage = createSupabaseAdminClient();
        const upload = await uploadProductImage(storage, params.id, imageFile);
        if (upload.error || !upload.path) {
          return fail(400, {
            message: upload.error ?? 'Failed to upload product image.',
            fieldErrors: { image: [upload.error ?? 'Failed to upload product image.'] }
          });
        }
        newImagePath = upload.path;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to upload product image.';
        return fail(500, { message, fieldErrors: { image: [message] } });
      }
    }

    const payload = newImagePath ? { ...parsed.data, image_paths: [newImagePath] } : parsed.data;

    const { error } = await supabase.from('products').update(payload).eq('id', params.id);
    if (error) {
      if (storage && newImagePath) await deleteProductImage(storage, newImagePath);
      return fail(400, { message: error.message, fieldErrors: {} });
    }

    if (storage && newImagePath && previousImagePath && previousImagePath !== newImagePath) {
      await deleteProductImage(storage, previousImagePath);
    }

    return { saved: true };
  },

  'delete-image': async ({ params, locals: { supabase } }) => {
    const productRes = await supabase
      .from('products')
      .select('image_paths')
      .eq('id', params.id)
      .maybeSingle();
    if (productRes.error || !productRes.data) {
      return fail(404, { message: 'Product not found.', fieldErrors: {} });
    }

    const imagePath = getFirstProductImagePath(productRes.data.image_paths);
    if (!imagePath) return { saved: true };

    const { error } = await supabase
      .from('products')
      .update({ image_paths: [] })
      .eq('id', params.id);
    if (error) return fail(400, { message: error.message, fieldErrors: {} });

    try {
      await deleteProductImage(createSupabaseAdminClient(), imagePath);
    } catch (err) {
      console.warn('[product-images] image removed from product but storage cleanup failed', err);
    }

    return { saved: true };
  },

  archive: async ({ params, locals: { supabase } }) => {
    const { error } = await supabase
      .from('products')
      .update({ status: 'archived' })
      .eq('id', params.id);
    if (error) return fail(400, { message: error.message, fieldErrors: {} });
    return { saved: true };
  },

  restore: async ({ params, locals: { supabase } }) => {
    const { error } = await supabase
      .from('products')
      .update({ status: 'active' })
      .eq('id', params.id);
    if (error) return fail(400, { message: error.message, fieldErrors: {} });
    return { saved: true };
  },

  'update-threshold': async ({ params, request, locals: { supabase } }) => {
    const form = await request.formData();
    const parsed = parseForm(lowStockThresholdSchema, form);
    if (!parsed.success) {
      return fail(400, { message: parsed.message, fieldErrors: parsed.fieldErrors });
    }
    const { error } = await supabase.from('inventory').upsert({
      product_id: params.id,
      low_stock_threshold: parsed.data.low_stock_threshold
    });
    if (error) return fail(400, { message: error.message, fieldErrors: {} });
    return { saved: true };
  },

  watch: async ({ params, request, locals: { supabase, user } }) => {
    const form = await request.formData();
    const notes = String(form.get('notes') ?? '').trim() || null;
    const { error } = await supabase
      .from('watchlist_items')
      .upsert(
        { product_id: params.id, notes, added_by: user?.id ?? null },
        { onConflict: 'product_id' }
      );
    if (error) return fail(400, { message: error.message });
    return { saved: true };
  },

  unwatch: async ({ params, locals: { supabase } }) => {
    const { error } = await supabase.from('watchlist_items').delete().eq('product_id', params.id);
    if (error) return fail(400, { message: error.message });
    return { saved: true };
  },

  adjust: async ({ params, request, locals }) => {
    const form = await request.formData();
    const parsed = parseForm(inventoryAdjustSchema, form);
    if (!parsed.success) {
      return fail(400, {
        message: parsed.message,
        fieldErrors: parsed.fieldErrors,
        code: undefined
      });
    }
    if (!locals.session) {
      return fail(401, { message: 'Not signed in.', fieldErrors: {}, code: undefined });
    }

    const { delta, reason, notes } = parsed.data;

    const { error: ledgerError } = await locals.supabase.from('inventory_ledger').insert({
      product_id: params.id,
      delta,
      reason,
      notes: notes ?? null,
      actor_id: locals.user?.id
    });

    if (ledgerError) {
      return fail(400, {
        message: ledgerError.message ?? 'Adjustment failed.',
        fieldErrors: {},
        code: undefined
      });
    }
    return { saved: true, message: undefined, code: undefined };
  }
};

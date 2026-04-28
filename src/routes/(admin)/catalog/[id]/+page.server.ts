import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
  PRODUCT_IMAGE_BUCKET,
  deleteProductImage,
  publicImageUrl,
  uploadProductImage
} from '$lib/storage';

export const load: PageServerLoad = async ({ params, locals: { supabase } }) => {
  const [productRes, categoriesRes, inventoryRes] = await Promise.all([
    supabase.from('products').select('*').eq('id', params.id).maybeSingle(),
    supabase.from('categories').select('id, name').order('name'),
    supabase.from('inventory').select('*').eq('product_id', params.id).maybeSingle()
  ]);

  if (productRes.error || !productRes.data) {
    throw error(404, 'Product not found');
  }

  const product = productRes.data as { image_paths?: string[] | null } & Record<string, unknown>;
  const imagePaths = Array.isArray(product.image_paths) ? product.image_paths : [];
  const imageUrls: Record<string, string> = {};
  for (const p of imagePaths) {
    imageUrls[p] = publicImageUrl(supabase, p);
  }

  return {
    product: productRes.data,
    categories: categoriesRes.data ?? [],
    inventory: inventoryRes.data,
    imageUrls
  };
};

function parseProduct(form: FormData) {
  const str = (k: string) => {
    const v = form.get(k);
    return typeof v === 'string' && v.length > 0 ? v : null;
  };
  const num = (k: string) => {
    const v = form.get(k);
    if (typeof v !== 'string' || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  return {
    sku: str('sku'),
    name: str('name'),
    description: str('description'),
    category_id: str('category_id'),
    manufacturer: str('manufacturer'),
    unit_of_measure: str('unit_of_measure'),
    pack_size: num('pack_size'),
    base_price: num('base_price'),
    tax_class: str('tax_class'),
    weight_grams: num('weight_grams'),
    status: (str('status') ?? 'active') as 'active' | 'archived'
  };
}

async function loadImagePaths(
  supabase: App.Locals['supabase'],
  productId: string
): Promise<string[]> {
  const { data, error: err } = await supabase
    .from('products')
    .select('image_paths')
    .eq('id', productId)
    .maybeSingle();
  if (err || !data) return [];
  const paths = (data as { image_paths?: string[] | null }).image_paths;
  return Array.isArray(paths) ? paths : [];
}

async function saveImagePaths(
  supabase: App.Locals['supabase'],
  productId: string,
  paths: string[]
) {
  return supabase.from('products').update({ image_paths: paths }).eq('id', productId);
}

export const actions: Actions = {
  save: async ({ params, request, locals: { supabase } }) => {
    const form = await request.formData();
    const payload = parseProduct(form);
    if (!payload.sku || !payload.name || payload.base_price === null) {
      return fail(400, { message: 'SKU, name, and base price are required.' });
    }
    const { error } = await supabase.from('products').update(payload).eq('id', params.id);
    if (error) return fail(400, { message: error.message });
    return { saved: true };
  },

  archive: async ({ params, locals: { supabase } }) => {
    const { error } = await supabase
      .from('products')
      .update({ status: 'archived' })
      .eq('id', params.id);
    if (error) return fail(400, { message: error.message });
    return { saved: true };
  },

  restore: async ({ params, locals: { supabase } }) => {
    const { error } = await supabase
      .from('products')
      .update({ status: 'active' })
      .eq('id', params.id);
    if (error) return fail(400, { message: error.message });
    return { saved: true };
  },

  'update-threshold': async ({ params, request, locals: { supabase } }) => {
    const form = await request.formData();
    const v = Number(form.get('low_stock_threshold'));
    if (!Number.isFinite(v) || v < 0) {
      return fail(400, { message: 'Threshold must be a non-negative number.' });
    }
    const { error } = await supabase
      .from('inventory')
      .upsert({ product_id: params.id, low_stock_threshold: v });
    if (error) return fail(400, { message: error.message });
    return { saved: true };
  },

  'upload-image': async ({ params, request, locals: { supabase } }) => {
    const form = await request.formData();
    const file = form.get('image');
    if (!(file instanceof File)) {
      return fail(400, { message: 'No file provided.' });
    }

    const result = await uploadProductImage(supabase, params.id, file);
    if (!result.ok) return fail(400, { message: result.message });

    const current = await loadImagePaths(supabase, params.id);
    const next = [...current, result.image.path];
    const { error: updErr } = await saveImagePaths(supabase, params.id, next);
    if (updErr) {
      // Roll back the upload so storage and DB stay in sync.
      await deleteProductImage(supabase, result.image.path);
      return fail(400, { message: updErr.message });
    }
    return { saved: true, bucket: PRODUCT_IMAGE_BUCKET };
  },

  'delete-image': async ({ params, request, locals: { supabase } }) => {
    const form = await request.formData();
    const path = form.get('path');
    if (typeof path !== 'string' || !path) {
      return fail(400, { message: 'Missing image path.' });
    }
    const current = await loadImagePaths(supabase, params.id);
    if (!current.includes(path)) {
      return fail(400, { message: 'Image not found on this product.' });
    }
    const next = current.filter((p) => p !== path);
    const { error: updErr } = await saveImagePaths(supabase, params.id, next);
    if (updErr) return fail(400, { message: updErr.message });

    const del = await deleteProductImage(supabase, path);
    if (!del.ok) {
      // DB is already updated; surface a soft warning so the operator knows.
      return { saved: true, warning: del.message ?? 'Image record removed but storage delete failed.' };
    }
    return { saved: true };
  },

  'move-image': async ({ params, request, locals: { supabase } }) => {
    const form = await request.formData();
    const path = form.get('path');
    const direction = form.get('direction');
    if (typeof path !== 'string' || !path) {
      return fail(400, { message: 'Missing image path.' });
    }
    if (direction !== 'up' && direction !== 'down' && direction !== 'primary') {
      return fail(400, { message: 'Invalid move direction.' });
    }

    const current = await loadImagePaths(supabase, params.id);
    const idx = current.indexOf(path);
    if (idx < 0) return fail(400, { message: 'Image not found on this product.' });

    const next = [...current];
    if (direction === 'primary') {
      next.splice(idx, 1);
      next.unshift(path);
    } else if (direction === 'up' && idx > 0) {
      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    } else if (direction === 'down' && idx < next.length - 1) {
      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
    } else {
      return { saved: true };
    }

    const { error: updErr } = await saveImagePaths(supabase, params.id, next);
    if (updErr) return fail(400, { message: updErr.message });
    return { saved: true };
  }
};

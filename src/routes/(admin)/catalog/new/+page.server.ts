import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { parseForm, productSchema } from '$lib/schemas';
import { createSupabaseAdminClient } from '$lib/supabase.server';
import {
  deleteProductImage,
  getProductImageFile,
  uploadProductImage,
  validateProductImage
} from '$lib/server/product-images';

function formPayload(form: FormData) {
  return Object.fromEntries(
    [...form.entries()].filter((entry): entry is [string, string] => typeof entry[1] === 'string')
  );
}

export const load: PageServerLoad = async ({ locals: { supabase } }) => {
  const { data } = await supabase.from('categories').select('id, name').order('name');
  return { categories: data ?? [] };
};

export const actions: Actions = {
  default: async ({ request, locals: { supabase } }) => {
    const form = await request.formData();
    const imageFile = getProductImageFile(form.get('image'));
    const parsed = parseForm(productSchema, form);
    if (!parsed.success) {
      return fail(400, {
        message: parsed.message,
        fieldErrors: parsed.fieldErrors,
        payload: formPayload(form)
      });
    }

    if (imageFile) {
      const imageError = validateProductImage(imageFile);
      if (imageError) {
        return fail(400, {
          message: imageError,
          fieldErrors: { image: [imageError] },
          payload: formPayload(form)
        });
      }
    }

    const { data, error } = await supabase
      .from('products')
      .insert(parsed.data)
      .select('id')
      .single();

    if (error) {
      return fail(400, {
        message: error.message,
        fieldErrors: {},
        payload: parsed.data
      });
    }

    if (imageFile) {
      let storage: ReturnType<typeof createSupabaseAdminClient> | null = null;
      let imagePath: string | null = null;
      try {
        storage = createSupabaseAdminClient();
        const upload = await uploadProductImage(storage, data.id, imageFile);
        if (upload.error || !upload.path) {
          await supabase.from('products').delete().eq('id', data.id);
          return fail(400, {
            message: upload.error ?? 'Failed to upload product image.',
            fieldErrors: { image: [upload.error ?? 'Failed to upload product image.'] },
            payload: parsed.data
          });
        }

        imagePath = upload.path;
        const imageUpdate = await supabase
          .from('products')
          .update({ image_paths: [imagePath] })
          .eq('id', data.id);

        if (imageUpdate.error) {
          await deleteProductImage(storage, imagePath);
          await supabase.from('products').delete().eq('id', data.id);
          return fail(400, {
            message: imageUpdate.error.message,
            fieldErrors: {},
            payload: parsed.data
          });
        }
      } catch (err) {
        await supabase.from('products').delete().eq('id', data.id);
        if (storage && imagePath) await deleteProductImage(storage, imagePath);
        const message = err instanceof Error ? err.message : 'Failed to upload product image.';
        return fail(500, {
          message,
          fieldErrors: { image: [message] },
          payload: parsed.data
        });
      }
    }

    await supabase.from('inventory').upsert({ product_id: data.id });

    throw redirect(303, `/catalog/${data.id}`);
  }
};

import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

/**
 * THROWAWAY page: /catalog/barcode-match
 *
 * Loads every active product that is still missing a barcode so they can be
 * matched up one by one against the UPC database (see /api/catalog/scan/search).
 */

export const load: PageServerLoad = async ({ locals: { supabase }, url }) => {
  const onlyMissing = url.searchParams.get('all') !== '1';

  let query = supabase
    .from('products')
    .select('id, sku, name, manufacturer, barcode, status')
    .eq('status', 'active')
    .order('name', { ascending: true })
    .limit(500);

  if (onlyMissing) {
    query = query.is('barcode', null);
  }

  const { data, error } = await query;

  return {
    products: data ?? [],
    loadError: error?.message ?? null,
    onlyMissing
  };
};

export const actions: Actions = {
  assign: async ({ request, locals: { supabase } }) => {
    const form = await request.formData();
    const productId = String(form.get('productId') ?? '').trim();
    const barcode = String(form.get('barcode') ?? '').trim();

    if (!productId || !barcode) {
      return fail(400, { message: 'productId and barcode are required.' });
    }

    // Guard against assigning a barcode that already belongs to another product.
    const { data: existing } = await supabase
      .from('products')
      .select('id, name')
      .eq('barcode', barcode)
      .neq('id', productId)
      .maybeSingle();

    if (existing) {
      return fail(409, {
        message: `Barcode ${barcode} is already assigned to "${existing.name}".`,
        productId
      });
    }

    const { error } = await supabase
      .from('products')
      .update({ barcode })
      .eq('id', productId);

    if (error) {
      return fail(500, { message: error.message, productId });
    }

    return { ok: true, productId, barcode };
  }
};

import type { PageServerLoad } from './$types';

/**
 * THROWAWAY page: /catalog/barcode-match
 *
 * Loads every active product that is still missing a barcode so they can be
 * matched against the UPC database by SKU (see /api/catalog/scan/search).
 * Saving a match goes through /api/catalog/barcode-match/assign.
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

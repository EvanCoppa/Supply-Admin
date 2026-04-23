import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  const { data, error } = await locals.supabase
    .from('products')
    .select('id, sku, name, manufacturer, base_price, status')
    .order('name', { ascending: true })
    .limit(100);

  return {
    products: data ?? [],
    loadError: error?.message ?? null
  };
};

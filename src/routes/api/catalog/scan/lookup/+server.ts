import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

async function lookupUPC(code: string): Promise<{ name?: string; description?: string }> {
  const apiUrl = process.env.UPC_LOOKUP_API_URL || 'https://api.upcitemdb.com/prod/trial/lookup';
  const apiKey = process.env.UPC_LOOKUP_API_KEY;

  try {
    const url = new URL(apiUrl);
    url.searchParams.set('upc', code);
    if (apiKey) url.searchParams.set('key', apiKey);

    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return {};

    const data = (await res.json()) as {
      items?: Array<{ title?: string; description?: string }>;
    };
    const item = data.items?.[0];
    if (!item) return {};

    return {
      name: item.title,
      description: item.description
    };
  } catch {
    return {};
  }
}

export const GET: RequestHandler = async ({ locals: { supabase }, url }) => {
  const code = url.searchParams.get('code') ?? '';
  const trimmed = code.trim();
  if (!trimmed) return json({ product: null });

  const { data: catalogProducts, error: catalogError } = await supabase
    .from('products')
    .select('*')
    .or(`barcode.ilike.${trimmed},sku.ilike.${trimmed}`)
    .limit(1);

  if (catalogError) throw error(500, 'Database query failed');

  if (catalogProducts && catalogProducts.length > 0) {
    return json({ product: catalogProducts[0] });
  }

  const upcData = await lookupUPC(trimmed);
  if (upcData.name) {
    return json({
      product: {
        barcode: trimmed,
        name: upcData.name,
        description: upcData.description || null
      }
    });
  }

  return json({ product: null });
};

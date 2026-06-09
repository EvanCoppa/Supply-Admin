import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * THROWAWAY / DEBUG endpoint backing /catalog/barcode-match.
 *
 * Saves a matched barcode onto a product. Used both by the per-row "Assign"
 * button and the "Resolve all" batch loop, so it returns plain JSON instead of
 * a SvelteKit action result.
 */

export const POST: RequestHandler = async ({ request, locals: { supabase } }) => {
  const body = (await request.json().catch(() => null)) as {
    productId?: string;
    barcode?: string;
  } | null;

  const productId = String(body?.productId ?? '').trim();
  const barcode = String(body?.barcode ?? '').trim();

  if (!productId || !barcode) {
    return json({ ok: false, message: 'productId and barcode are required.' }, { status: 400 });
  }

  // Guard against assigning a barcode that already belongs to another product.
  const { data: existing } = await supabase
    .from('products')
    .select('id, name')
    .eq('barcode', barcode)
    .neq('id', productId)
    .maybeSingle();

  if (existing) {
    return json(
      { ok: false, message: `Barcode ${barcode} is already assigned to "${existing.name}".` },
      { status: 409 }
    );
  }

  const { error } = await supabase.from('products').update({ barcode }).eq('id', productId);

  if (error) {
    return json({ ok: false, message: error.message }, { status: 500 });
  }

  return json({ ok: true, productId, barcode });
};

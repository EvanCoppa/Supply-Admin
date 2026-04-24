import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals: { supabase } }) => {
  const { data: group } = await supabase
    .from('featured_groups')
    .select('*')
    .eq('id', params.id)
    .maybeSingle();
  if (!group) throw error(404, 'Group not found');

  const ids: string[] = group.product_ids ?? [];
  const productsRes = await supabase
    .from('products')
    .select('id, sku, name')
    .eq('status', 'active')
    .order('name')
    .limit(500);

  const productMap = new Map((productsRes.data ?? []).map((p) => [p.id, p]));
  const current = ids
    .map((id) => productMap.get(id))
    .filter((p): p is NonNullable<typeof p> => !!p);

  return {
    group,
    currentProducts: current,
    availableProducts: (productsRes.data ?? []).filter((p) => !ids.includes(p.id))
  };
};

export const actions: Actions = {
  save: async ({ params, request, locals: { supabase } }) => {
    const form = await request.formData();
    const name = String(form.get('name') ?? '').trim();
    const description = String(form.get('description') ?? '').trim() || null;
    if (!name) return fail(400, { message: 'Name is required.' });
    const { error } = await supabase
      .from('featured_groups')
      .update({ name, description })
      .eq('id', params.id);
    if (error) return fail(400, { message: error.message });
    return { saved: true };
  },

  addProduct: async ({ params, request, locals: { supabase } }) => {
    const form = await request.formData();
    const product_id = String(form.get('product_id') ?? '');
    if (!product_id) return fail(400, { message: 'Pick a product.' });

    const { data: group } = await supabase
      .from('featured_groups')
      .select('product_ids')
      .eq('id', params.id)
      .maybeSingle();
    const ids: string[] = group?.product_ids ?? [];
    if (!ids.includes(product_id)) ids.push(product_id);

    const { error } = await supabase
      .from('featured_groups')
      .update({ product_ids: ids })
      .eq('id', params.id);
    if (error) return fail(400, { message: error.message });
    return { saved: true };
  },

  removeProduct: async ({ params, request, locals: { supabase } }) => {
    const form = await request.formData();
    const product_id = String(form.get('product_id') ?? '');
    const { data: group } = await supabase
      .from('featured_groups')
      .select('product_ids')
      .eq('id', params.id)
      .maybeSingle();
    const ids: string[] = (group?.product_ids ?? []).filter((id: string) => id !== product_id);
    const { error } = await supabase
      .from('featured_groups')
      .update({ product_ids: ids })
      .eq('id', params.id);
    if (error) return fail(400, { message: error.message });
    return { saved: true };
  },

  reorder: async ({ params, request, locals: { supabase } }) => {
    const form = await request.formData();
    const product_id = String(form.get('product_id') ?? '');
    const direction = String(form.get('direction') ?? '');
    const { data: group } = await supabase
      .from('featured_groups')
      .select('product_ids')
      .eq('id', params.id)
      .maybeSingle();
    const ids: string[] = group?.product_ids ?? [];
    const idx = ids.indexOf(product_id);
    const neighborIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (idx < 0 || neighborIdx < 0 || neighborIdx >= ids.length) return { saved: true };
    [ids[idx], ids[neighborIdx]] = [ids[neighborIdx], ids[idx]];

    const { error } = await supabase
      .from('featured_groups')
      .update({ product_ids: ids })
      .eq('id', params.id);
    if (error) return fail(400, { message: error.message });
    return { saved: true };
  }
};

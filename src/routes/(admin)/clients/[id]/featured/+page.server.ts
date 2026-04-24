import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals: { supabase } }) => {
  const [itemsRes, productsRes, groupsRes] = await Promise.all([
    supabase
      .from('customer_featured_items')
      .select(
        'id, product_id, group_id, display_order, product:products(id, sku, name), group:featured_groups(id, name)'
      )
      .eq('customer_id', params.id)
      .order('display_order', { ascending: true }),
    supabase
      .from('products')
      .select('id, sku, name')
      .eq('status', 'active')
      .order('name')
      .limit(500),
    supabase.from('featured_groups').select('id, name').order('name')
  ]);

  type Item = {
    id: string;
    product_id: string | null;
    group_id: string | null;
    display_order: number;
    product: { id: string; sku: string; name: string } | null;
    group: { id: string; name: string } | null;
  };

  return {
    items: (itemsRes.data ?? []) as unknown as Item[],
    products: (productsRes.data ?? []) as Array<{ id: string; sku: string; name: string }>,
    groups: (groupsRes.data ?? []) as Array<{ id: string; name: string }>
  };
};

export const actions: Actions = {
  addProduct: async ({ params, request, locals: { supabase } }) => {
    const form = await request.formData();
    const product_id = String(form.get('product_id') ?? '');
    if (!product_id) return fail(400, { message: 'Pick a product.' });

    const { data: max } = await supabase
      .from('customer_featured_items')
      .select('display_order')
      .eq('customer_id', params.id)
      .order('display_order', { ascending: false })
      .limit(1);

    const nextOrder = (max?.[0]?.display_order ?? -1) + 1;

    const { error } = await supabase.from('customer_featured_items').insert({
      customer_id: params.id,
      product_id,
      display_order: nextOrder
    });
    if (error) return fail(400, { message: error.message });
    return { saved: true };
  },

  addGroup: async ({ params, request, locals: { supabase } }) => {
    const form = await request.formData();
    const group_id = String(form.get('group_id') ?? '');
    if (!group_id) return fail(400, { message: 'Pick a group.' });

    const { data: max } = await supabase
      .from('customer_featured_items')
      .select('display_order')
      .eq('customer_id', params.id)
      .order('display_order', { ascending: false })
      .limit(1);

    const nextOrder = (max?.[0]?.display_order ?? -1) + 1;

    const { error } = await supabase.from('customer_featured_items').insert({
      customer_id: params.id,
      group_id,
      display_order: nextOrder
    });
    if (error) return fail(400, { message: error.message });
    return { saved: true };
  },

  remove: async ({ params, request, locals: { supabase } }) => {
    const form = await request.formData();
    const id = String(form.get('id') ?? '');
    const { error } = await supabase
      .from('customer_featured_items')
      .delete()
      .eq('id', id)
      .eq('customer_id', params.id);
    if (error) return fail(400, { message: error.message });
    return { saved: true };
  },

  reorder: async ({ params, request, locals: { supabase } }) => {
    const form = await request.formData();
    const id = String(form.get('id') ?? '');
    const direction = String(form.get('direction') ?? '');
    if (direction !== 'up' && direction !== 'down') return fail(400, { message: 'Bad direction.' });

    const { data: items } = await supabase
      .from('customer_featured_items')
      .select('id, display_order')
      .eq('customer_id', params.id)
      .order('display_order');

    if (!items) return { saved: true };
    const idx = items.findIndex((i) => i.id === id);
    const neighborIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (idx < 0 || neighborIdx < 0 || neighborIdx >= items.length) return { saved: true };

    const a = items[idx];
    const b = items[neighborIdx];
    await supabase
      .from('customer_featured_items')
      .update({ display_order: b.display_order })
      .eq('id', a.id);
    await supabase
      .from('customer_featured_items')
      .update({ display_order: a.display_order })
      .eq('id', b.id);
    return { saved: true };
  }
};

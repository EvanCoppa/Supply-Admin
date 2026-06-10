import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals: { supabase } }) => {
  const [orderRes, lineItemsRes] = await Promise.all([
    supabase
      .from('orders')
      .select('*, customer:customers(id, business_name, email)')
      .eq('id', params.id)
      .maybeSingle(),
    supabase
      .from('order_line_items')
      .select('*')
      .eq('order_id', params.id)
      .order('product_sku_snapshot')
  ]);

  if (orderRes.error || !orderRes.data) throw error(404, 'Order not found');

  return {
    order: orderRes.data,
    lineItems: lineItemsRes.data ?? []
  };
};

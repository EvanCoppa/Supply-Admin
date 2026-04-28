import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const UUID_PREFIX_RE = /^[0-9a-f-]{4,}$/i;

export const GET: RequestHandler = async ({ url, locals: { supabase, profile } }) => {
  if (!profile || profile.role !== 'admin') {
    return json({ products: [], customers: [], orders: [] }, { status: 403 });
  }

  const q = (url.searchParams.get('q') ?? '').trim();
  if (q.length < 2) {
    return json({ products: [], customers: [], orders: [] });
  }

  const like = `%${q.replace(/[%_]/g, (c) => `\\${c}`)}%`;

  const orderQuery = UUID_PREFIX_RE.test(q)
    ? supabase
        .from('orders')
        .select('id, status, total, placed_at, customer:customers(business_name)')
        .filter('id::text', 'ilike', `${q}%`)
        .order('placed_at', { ascending: false })
        .limit(5)
    : Promise.resolve({ data: [] as unknown[] });

  const [productsRes, customersRes, ordersRes] = await Promise.all([
    supabase
      .from('products')
      .select('id, sku, name, status')
      .or(`sku.ilike.${like},name.ilike.${like}`)
      .order('name')
      .limit(8),
    supabase
      .from('customers')
      .select('id, business_name, email')
      .or(`business_name.ilike.${like},email.ilike.${like}`)
      .order('business_name')
      .limit(8),
    orderQuery
  ]);

  return json({
    products: productsRes.data ?? [],
    customers: customersRes.data ?? [],
    orders: ordersRes.data ?? []
  });
};

import type { PageServerLoad } from './$types';

const PAGE_SIZE = 25;
const STATUSES = [
  'pending_payment',
  'paid',
  'fulfilled',
  'shipped',
  'delivered',
  'cancelled',
  'refunded'
] as const;

export const load: PageServerLoad = async ({ locals: { supabase }, url }) => {
  const status = url.searchParams.get('status') ?? '';
  const customerId = url.searchParams.get('customer') ?? '';
  const source = url.searchParams.get('source') ?? '';
  const from = url.searchParams.get('from') ?? '';
  const to = url.searchParams.get('to') ?? '';
  const page = Math.max(1, Number(url.searchParams.get('page') ?? '1'));
  const sliceFrom = (page - 1) * PAGE_SIZE;
  const sliceTo = sliceFrom + PAGE_SIZE - 1;

  let query = supabase
    .from('orders')
    .select(
      'id, status, total, placed_at, source, customer:customers(id, business_name)',
      { count: 'exact' }
    )
    .order('placed_at', { ascending: false })
    .range(sliceFrom, sliceTo);

  if (STATUSES.includes(status as (typeof STATUSES)[number])) query = query.eq('status', status);
  if (customerId) query = query.eq('customer_id', customerId);
  if (source === 'storefront' || source === 'api') query = query.eq('source', source);
  if (from) query = query.gte('placed_at', from);
  if (to) query = query.lte('placed_at', to);

  const [ordersRes, customersRes] = await Promise.all([
    query,
    supabase.from('customers').select('id, business_name').order('business_name').limit(500)
  ]);

  type OrderRow = {
    id: string;
    status: string;
    total: number;
    placed_at: string;
    source: 'storefront' | 'api';
    customer: { id: string; business_name: string } | null;
  };

  return {
    orders: (ordersRes.data ?? []) as unknown as OrderRow[],
    total: ordersRes.count ?? 0,
    page,
    pageSize: PAGE_SIZE,
    statuses: STATUSES,
    customers: (customersRes.data ?? []) as Array<{ id: string; business_name: string }>,
    filters: { status, customerId, source, from, to }
  };
};

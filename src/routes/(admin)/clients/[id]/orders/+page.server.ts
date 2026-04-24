import type { PageServerLoad } from './$types';

const PAGE_SIZE = 25;

export const load: PageServerLoad = async ({ params, locals: { supabase }, url }) => {
  const page = Math.max(1, Number(url.searchParams.get('page') ?? '1'));
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data, count } = await supabase
    .from('orders')
    .select('id, status, total, placed_at, source', { count: 'exact' })
    .eq('customer_id', params.id)
    .order('placed_at', { ascending: false })
    .range(from, to);

  return { orders: data ?? [], total: count ?? 0, page, pageSize: PAGE_SIZE };
};

import type { PageServerLoad } from './$types';
import type { Rma, RmaStatus } from '$lib/types/db';

const PAGE_SIZE = 50;

export const load: PageServerLoad = async ({ url, locals: { supabase } }) => {
  const status = url.searchParams.get('status') ?? '';
  const page = Math.max(1, Number(url.searchParams.get('page') ?? '1'));
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabase
    .from('rmas')
    .select(
      'id, customer_id, rma_number, status, reason, refund_amount, restocking_fee, created_at,' +
        ' customer:customers(business_name)',
      { count: 'exact' }
    )
    .order('created_at', { ascending: false })
    .range(from, to);

  if (
    status &&
    ['requested', 'approved', 'received', 'refunded', 'rejected', 'cancelled'].includes(status)
  ) {
    query = query.eq('status', status);
  }

  const res = await query;

  type Row = Pick<
    Rma,
    'id' | 'customer_id' | 'rma_number' | 'status' | 'reason' | 'refund_amount' | 'restocking_fee' | 'created_at'
  > & { customer: { business_name: string } | null };

  return {
    rmas: (res.data ?? []) as unknown as Row[],
    total: res.count ?? 0,
    page,
    pageSize: PAGE_SIZE,
    filters: { status: status as RmaStatus | '' }
  };
};

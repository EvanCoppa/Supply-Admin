import type { PageServerLoad } from './$types';
import type { Invoice } from '$lib/types/db';

const PAGE_SIZE = 25;

export const load: PageServerLoad = async ({ locals: { profile, supabase }, url }) => {
  const customerId = profile?.customer_id;
  const status = url.searchParams.get('status') ?? '';
  const page = Math.max(1, Number(url.searchParams.get('page') ?? '1'));
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabase
    .from('invoices')
    .select('id, invoice_number, status, total, amount_paid, due_at, issued_at, sent_at, payment_url', {
      count: 'exact'
    })
    .eq('customer_id', customerId)
    .neq('status', 'draft')
    .order('created_at', { ascending: false })
    .range(from, to);

  if (status === 'open') {
    query = query.in('status', ['issued', 'partially_paid', 'overdue']);
  } else if (status === 'paid') {
    query = query.eq('status', 'paid');
  }

  const { data, count } = await query;

  return {
    invoices: (data ?? []) as Pick<
      Invoice,
      'id' | 'invoice_number' | 'status' | 'total' | 'amount_paid' | 'due_at' | 'issued_at' | 'sent_at' | 'payment_url'
    >[],
    total: count ?? 0,
    page,
    pageSize: PAGE_SIZE,
    filters: { status }
  };
};

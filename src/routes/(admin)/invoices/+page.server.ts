import type { PageServerLoad } from './$types';
import type { Invoice, InvoiceStatus } from '$lib/types/db';

const PAGE_SIZE = 50;

export const load: PageServerLoad = async ({ url, locals: { supabase } }) => {
  const status = url.searchParams.get('status') ?? '';
  const q = url.searchParams.get('q')?.trim() ?? '';
  const page = Math.max(1, Number(url.searchParams.get('page') ?? '1'));
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabase
    .from('invoices')
    .select(
      'id, customer_id, invoice_number, status, total, amount_paid, terms, issued_at, due_at, created_at,' +
        ' customer:customers(business_name)',
      { count: 'exact' }
    )
    .order('created_at', { ascending: false })
    .range(from, to);

  if (status === 'outstanding') {
    query = query.in('status', ['issued', 'partially_paid', 'overdue']);
  } else if (status && ['draft', 'issued', 'paid', 'partially_paid', 'overdue', 'void', 'refunded'].includes(status)) {
    query = query.eq('status', status);
  }

  if (q) query = query.ilike('invoice_number', `%${q}%`);

  const res = await query;

  type Row = Pick<
    Invoice,
    'id' | 'customer_id' | 'invoice_number' | 'status' | 'total' | 'amount_paid' | 'terms' | 'issued_at' | 'due_at' | 'created_at'
  > & { customer: { business_name: string } | null };

  return {
    invoices: (res.data ?? []) as unknown as Row[],
    total: res.count ?? 0,
    page,
    pageSize: PAGE_SIZE,
    filters: { status: status as InvoiceStatus | 'outstanding' | '', q }
  };
};

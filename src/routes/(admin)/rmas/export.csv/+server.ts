import type { RequestHandler } from './$types';
import { rowsToCsv } from '$lib/csv';

const STATUSES = ['requested', 'approved', 'received', 'refunded', 'rejected', 'cancelled'] as const;
const MAX_ROWS = 10000;

export const GET: RequestHandler = async ({ url, locals: { supabase } }) => {
  const status = url.searchParams.get('status') ?? '';

  let query = supabase
    .from('rmas')
    .select(
      'id, rma_number, status, reason, refund_amount, restocking_fee, created_at, customer:customers(business_name)'
    )
    .order('created_at', { ascending: false })
    .limit(MAX_ROWS);

  if (STATUSES.includes(status as (typeof STATUSES)[number])) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;
  if (error) {
    return new Response(`error,${error.message}`, {
      status: 500,
      headers: { 'content-type': 'text/csv; charset=utf-8' }
    });
  }

  type Row = {
    id: string;
    rma_number: string;
    status: string;
    reason: string | null;
    refund_amount: number;
    restocking_fee: number;
    created_at: string;
    customer: { business_name: string } | null;
  };
  const rows = (data ?? []) as unknown as Row[];

  const csv = rowsToCsv([
    ['RMA #', 'Status', 'Customer', 'Reason', 'Refund', 'Restocking fee', 'Created at'],
    ...rows.map((r) => [
      r.rma_number,
      r.status,
      r.customer?.business_name ?? '',
      r.reason ?? '',
      Number(r.refund_amount).toFixed(2),
      Number(r.restocking_fee).toFixed(2),
      r.created_at
    ])
  ]);

  const filename = `rmas-${new Date().toISOString().slice(0, 10)}.csv`;
  return new Response(csv, {
    status: 200,
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${filename}"`,
      'cache-control': 'no-store'
    }
  });
};

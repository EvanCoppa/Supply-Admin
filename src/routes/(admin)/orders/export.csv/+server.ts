import type { RequestHandler } from './$types';
import { rowsToCsv } from '$lib/csv';

const STATUSES = [
  'pending_payment',
  'paid',
  'fulfilled',
  'shipped',
  'delivered',
  'cancelled',
  'refunded'
] as const;

const MAX_ROWS = 10000;

export const GET: RequestHandler = async ({ url, locals: { supabase } }) => {
  const status = url.searchParams.get('status') ?? '';
  const customerId = url.searchParams.get('customer') ?? '';
  const source = url.searchParams.get('source') ?? '';
  const from = url.searchParams.get('from') ?? '';
  const to = url.searchParams.get('to') ?? '';

  let query = supabase
    .from('orders')
    .select(
      'id, status, source, placed_at, subtotal, tax, shipping, total, payment_reference, customer:customers(business_name, email)'
    )
    .order('placed_at', { ascending: false })
    .limit(MAX_ROWS);

  if (STATUSES.includes(status as (typeof STATUSES)[number])) query = query.eq('status', status);
  if (customerId) query = query.eq('customer_id', customerId);
  if (source === 'storefront' || source === 'api') query = query.eq('source', source);
  if (from) query = query.gte('placed_at', from);
  if (to) query = query.lte('placed_at', to);

  const { data, error } = await query;
  if (error) {
    return new Response(`error,${error.message}`, {
      status: 500,
      headers: { 'content-type': 'text/csv; charset=utf-8' }
    });
  }

  type Row = {
    id: string;
    status: string;
    source: string;
    placed_at: string;
    subtotal: number;
    tax: number;
    shipping: number;
    total: number;
    payment_reference: string | null;
    customer: { business_name: string; email: string | null } | null;
  };
  const rows = (data ?? []) as unknown as Row[];

  const csv = rowsToCsv([
    [
      'Order ID',
      'Placed at',
      'Status',
      'Source',
      'Customer',
      'Customer email',
      'Subtotal',
      'Tax',
      'Shipping',
      'Total',
      'Payment reference'
    ],
    ...rows.map((r) => [
      r.id,
      r.placed_at,
      r.status,
      r.source,
      r.customer?.business_name ?? '',
      r.customer?.email ?? '',
      Number(r.subtotal).toFixed(2),
      Number(r.tax).toFixed(2),
      Number(r.shipping).toFixed(2),
      Number(r.total).toFixed(2),
      r.payment_reference ?? ''
    ])
  ]);

  const filename = `orders-${new Date().toISOString().slice(0, 10)}.csv`;
  return new Response(csv, {
    status: 200,
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${filename}"`,
      'cache-control': 'no-store'
    }
  });
};

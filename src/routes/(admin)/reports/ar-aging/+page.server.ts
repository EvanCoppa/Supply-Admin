import type { PageServerLoad } from './$types';

export type Bucket = 'current' | 'd1_30' | 'd31_60' | 'd61_90' | 'd90_plus' | 'no_due_date';

type Row = {
  invoice_id: string;
  invoice_number: string;
  customer_id: string;
  customer_name: string | null;
  issued_at: string | null;
  due_at: string | null;
  total: number;
  amount_paid: number;
  balance: number;
  days_past_due: number | null;
  bucket: Bucket;
};

export type CustomerAging = {
  customer_id: string;
  customer_name: string;
  current: number;
  d1_30: number;
  d31_60: number;
  d61_90: number;
  d90_plus: number;
  no_due_date: number;
  total: number;
  oldest_days: number;
  invoice_count: number;
};

export const load: PageServerLoad = async ({ locals: { supabase } }) => {
  const { data, error } = await supabase
    .from('v_ar_aging')
    .select(
      'invoice_id, invoice_number, customer_id, customer_name, issued_at, due_at, total, amount_paid, balance, days_past_due, bucket'
    )
    .order('days_past_due', { ascending: false, nullsFirst: false });

  if (error) {
    return { rows: [], byCustomer: [], totals: emptyTotals(), error: error.message };
  }

  const rows = (data ?? []) as Row[];

  const byCustomerMap = new Map<string, CustomerAging>();
  const totals = emptyTotals();

  for (const r of rows) {
    const bal = Number(r.balance);
    totals[r.bucket] += bal;
    totals.total += bal;

    const key = r.customer_id;
    let agg = byCustomerMap.get(key);
    if (!agg) {
      agg = {
        customer_id: key,
        customer_name: r.customer_name ?? '(unknown)',
        current: 0,
        d1_30: 0,
        d31_60: 0,
        d61_90: 0,
        d90_plus: 0,
        no_due_date: 0,
        total: 0,
        oldest_days: 0,
        invoice_count: 0
      };
      byCustomerMap.set(key, agg);
    }
    agg[r.bucket] += bal;
    agg.total += bal;
    agg.invoice_count += 1;
    if ((r.days_past_due ?? 0) > agg.oldest_days) agg.oldest_days = r.days_past_due ?? 0;
  }

  const byCustomer = Array.from(byCustomerMap.values()).sort((a, b) => b.total - a.total);

  return { rows, byCustomer, totals };
};

function emptyTotals() {
  return {
    current: 0,
    d1_30: 0,
    d31_60: 0,
    d61_90: 0,
    d90_plus: 0,
    no_due_date: 0,
    total: 0
  };
}

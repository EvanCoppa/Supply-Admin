import type { PageServerLoad } from './$types';

const FULFILLED_STATUSES = ['paid', 'fulfilled', 'shipped', 'delivered'];
const TARGET_MARGIN = 0.4;

type OrderRow = {
  id: string;
  total: number;
  placed_at: string;
  status: string;
  customer_id: string;
  customer: { business_name: string } | null;
};

type PurchaseRow = {
  id: string;
  supplier_id: string;
  total: number;
  ordered_at: string;
  status: string;
  payment_status: string;
  supplier: { name: string; key: string } | null;
};

type OutstandingPurchaseRow = {
  id: string;
  total: number;
  due_date: string | null;
  payment_status: string;
  supplier: { name: string; key: string } | null;
};

type CogsRow = { order_id: string; cogs_total: number };

export const load: PageServerLoad = async ({ locals: { supabase } }) => {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const days30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const nowIso = now.toISOString();
  const startMonthIso = startOfMonth.toISOString();
  const days30Iso = days30.toISOString();
  const todayDate = startOfToday.toISOString().slice(0, 10);

  const [
    ordersMtd,
    cogsByOrder,
    purchases30d,
    cashToday,
    outstandingInvoices,
    outstandingPurchases,
    overdueInvoicesCount
  ] = await Promise.all([
    supabase
      .from('orders')
      .select('id, total, placed_at, status, customer_id, customer:customers(business_name)')
      .gte('placed_at', startMonthIso)
      .in('status', FULFILLED_STATUSES)
      .order('placed_at', { ascending: false }),
    supabase.from('v_order_cogs').select('order_id, cogs_total'),
    supabase
      .from('purchases')
      .select(
        'id, supplier_id, total, ordered_at, status, payment_status, supplier:suppliers(name, key)'
      )
      .gte('ordered_at', days30Iso)
      .neq('status', 'cancelled'),
    supabase.from('cash_entries').select('direction, amount').eq('occurred_on', todayDate),
    supabase
      .from('invoices')
      .select('total, amount_paid')
      .in('status', ['issued', 'partially_paid', 'overdue']),
    supabase
      .from('purchases')
      .select('id, total, due_date, payment_status, supplier:suppliers(name, key)')
      .in('payment_status', ['unpaid', 'partial'])
      .neq('status', 'cancelled'),
    supabase
      .from('invoices')
      .select('id', { count: 'exact', head: true })
      .in('status', ['issued', 'partially_paid', 'overdue'])
      .lt('due_at', nowIso)
  ]);

  const cogsMap = new Map<string, number>();
  for (const row of (cogsByOrder.data ?? []) as CogsRow[]) {
    cogsMap.set(row.order_id, Number(row.cogs_total));
  }

  let revenueToday = 0;
  let cogsToday = 0;
  let revenueMtd = 0;
  let cogsMtd = 0;
  const lowMarginOrders: Array<OrderRow & { cogs: number; margin: number }> = [];

  const orders = (ordersMtd.data ?? []) as unknown as OrderRow[];
  for (const o of orders) {
    const rev = Number(o.total);
    const cogs = cogsMap.get(o.id) ?? 0;
    const placed = new Date(o.placed_at);
    revenueMtd += rev;
    cogsMtd += cogs;
    if (placed >= startOfToday) {
      revenueToday += rev;
      cogsToday += cogs;
    }
    if (cogs > 0 && rev > 0) {
      const margin = (rev - cogs) / rev;
      if (margin < TARGET_MARGIN) lowMarginOrders.push({ ...o, cogs, margin });
    }
  }
  lowMarginOrders.sort((a, b) => a.margin - b.margin);

  const supplierTotals = new Map<string, { name: string; key: string; total: number; orders: number }>();
  for (const p of (purchases30d.data ?? []) as unknown as PurchaseRow[]) {
    const key = p.supplier?.key ?? 'unknown';
    const entry = supplierTotals.get(key) ?? {
      name: p.supplier?.name ?? 'Unknown',
      key,
      total: 0,
      orders: 0
    };
    entry.total += Number(p.total);
    entry.orders += 1;
    supplierTotals.set(key, entry);
  }
  const supplierBreakdown = Array.from(supplierTotals.values()).sort((a, b) => b.total - a.total);
  const supplierGrandTotal = supplierBreakdown.reduce((a, s) => a + s.total, 0);

  let cashIn = 0;
  let cashOut = 0;
  for (const c of (cashToday.data ?? []) as Array<{ direction: string; amount: number }>) {
    if (c.direction === 'in') cashIn += Number(c.amount);
    else cashOut += Number(c.amount);
  }

  const outstandingAr = (
    (outstandingInvoices.data ?? []) as Array<{ total: number; amount_paid: number }>
  ).reduce((a, r) => a + Number(r.total) - Number(r.amount_paid), 0);

  const outstandingApRows = (outstandingPurchases.data ?? []) as unknown as OutstandingPurchaseRow[];
  const outstandingAp = outstandingApRows.reduce((a, r) => a + Number(r.total), 0);
  const medplusPendingRows = outstandingApRows.filter((p) => p.supplier?.key === 'medplus');
  const medplusPendingTotal = medplusPendingRows.reduce((a, r) => a + Number(r.total), 0);

  return {
    metrics: {
      revenueToday,
      revenueMtd,
      cogsToday,
      cogsMtd,
      gpToday: revenueToday - cogsToday,
      gpMtd: revenueMtd - cogsMtd,
      marginToday: revenueToday > 0 ? (revenueToday - cogsToday) / revenueToday : 0,
      marginMtd: revenueMtd > 0 ? (revenueMtd - cogsMtd) / revenueMtd : 0,
      cashIn,
      cashOut,
      netCash: cashIn - cashOut,
      outstandingAr,
      outstandingAp,
      overdueInvoices: overdueInvoicesCount.count ?? 0,
      medplusPendingCount: medplusPendingRows.length,
      medplusPendingTotal
    },
    supplierBreakdown,
    supplierGrandTotal,
    lowMarginOrders: lowMarginOrders.slice(0, 5)
  };
};

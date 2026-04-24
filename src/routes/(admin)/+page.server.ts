import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { supabase, user } }) => {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const days7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const days30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const nowIso = now.toISOString();

  const [
    ordersToday,
    revenue7d,
    revenue30d,
    recentOrders,
    lowStock,
    myOpenTasks,
    overdueTasks,
    overdueInvoices,
    outstandingInvoices,
    atRiskCustomers
  ] = await Promise.all([
    supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .gte('placed_at', startOfToday),
    supabase
      .from('orders')
      .select('total')
      .gte('placed_at', days7)
      .in('status', ['paid', 'fulfilled', 'shipped', 'delivered']),
    supabase
      .from('orders')
      .select('total')
      .gte('placed_at', days30)
      .in('status', ['paid', 'fulfilled', 'shipped', 'delivered']),
    supabase
      .from('orders')
      .select('id, status, total, placed_at, customer:customers(business_name)')
      .order('placed_at', { ascending: false })
      .limit(10),
    supabase
      .from('inventory')
      .select('product_id, quantity_on_hand, low_stock_threshold, product:products(name, sku)')
      .filter('quantity_on_hand', 'lte', 'low_stock_threshold')
      .limit(10),
    user?.id
      ? supabase
          .from('customer_tasks')
          .select(
            'id, title, due_at, priority, status, customer_id, customer:customers(business_name)'
          )
          .eq('assigned_to', user.id)
          .in('status', ['open', 'in_progress'])
          .order('due_at', { ascending: true, nullsFirst: false })
          .limit(8)
      : Promise.resolve({ data: [], count: 0 }),
    supabase
      .from('customer_tasks')
      .select('id', { count: 'exact', head: true })
      .in('status', ['open', 'in_progress'])
      .lt('due_at', nowIso),
    supabase
      .from('invoices')
      .select('id', { count: 'exact', head: true })
      .in('status', ['issued', 'partially_paid', 'overdue'])
      .lt('due_at', nowIso),
    supabase
      .from('invoices')
      .select('total, amount_paid')
      .in('status', ['issued', 'partially_paid', 'overdue']),
    supabase
      .from('customer_health')
      .select('customer_id, business_name, lifecycle_stage, outstanding_balance, last_order_at, overdue_tasks')
      .in('lifecycle_stage', ['at_risk', 'churned'])
      .order('outstanding_balance', { ascending: false })
      .limit(8)
  ]);

  const sum7 = (revenue7d.data ?? []).reduce((a, r) => a + Number(r.total), 0);
  const sum30 = (revenue30d.data ?? []).reduce((a, r) => a + Number(r.total), 0);
  const outstanding = (outstandingInvoices.data ?? []).reduce(
    (a, r) => a + Number(r.total) - Number(r.amount_paid),
    0
  );

  type RecentOrder = {
    id: string;
    status: string;
    total: number;
    placed_at: string;
    customer: { business_name: string } | null;
  };
  type LowStockRow = {
    product_id: string;
    quantity_on_hand: number;
    low_stock_threshold: number;
    product: { name: string; sku: string } | null;
  };
  type MyTask = {
    id: string;
    title: string;
    due_at: string | null;
    priority: string;
    status: string;
    customer_id: string;
    customer: { business_name: string } | null;
  };
  type AtRisk = {
    customer_id: string;
    business_name: string;
    lifecycle_stage: string;
    outstanding_balance: number;
    last_order_at: string | null;
    overdue_tasks: number;
  };

  return {
    metrics: {
      ordersToday: ordersToday.count ?? 0,
      revenue7d: sum7,
      revenue30d: sum30,
      lowStockCount: lowStock.data?.length ?? 0,
      overdueTasks: overdueTasks.count ?? 0,
      overdueInvoices: overdueInvoices.count ?? 0,
      outstandingBalance: outstanding
    },
    recentOrders: (recentOrders.data ?? []) as unknown as RecentOrder[],
    lowStock: (lowStock.data ?? []) as unknown as LowStockRow[],
    myOpenTasks: (myOpenTasks.data ?? []) as unknown as MyTask[],
    atRiskCustomers: (atRiskCustomers.data ?? []) as unknown as AtRisk[]
  };
};

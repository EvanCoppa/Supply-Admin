import type { PageServerLoad } from './$types';
import { PURCHASE_STATUSES, PURCHASE_PAYMENT_STATUSES } from '$lib/schemas';

const PAGE_SIZE = 25;

export const load: PageServerLoad = async ({ locals: { supabase }, url }) => {
  const supplierId = url.searchParams.get('supplier') ?? '';
  const status = url.searchParams.get('status') ?? '';
  const paymentStatus = url.searchParams.get('payment_status') ?? '';
  const page = Math.max(1, Number(url.searchParams.get('page') ?? '1'));
  const sliceFrom = (page - 1) * PAGE_SIZE;
  const sliceTo = sliceFrom + PAGE_SIZE - 1;

  let query = supabase
    .from('purchases')
    .select(
      'id, supplier_id, order_id, ordered_at, received_at, subtotal, freight, distribution_fee, total, status, payment_status, due_date, invoice_ref, supplier:suppliers(id, name, key), order:orders(id, customer:customers(id, business_name))',
      { count: 'exact' }
    )
    .order('ordered_at', { ascending: false })
    .range(sliceFrom, sliceTo);

  if (supplierId) query = query.eq('supplier_id', supplierId);
  if (PURCHASE_STATUSES.includes(status as (typeof PURCHASE_STATUSES)[number]))
    query = query.eq('status', status);
  if (
    PURCHASE_PAYMENT_STATUSES.includes(paymentStatus as (typeof PURCHASE_PAYMENT_STATUSES)[number])
  )
    query = query.eq('payment_status', paymentStatus);

  const [purchasesRes, suppliersRes] = await Promise.all([
    query,
    supabase.from('suppliers').select('id, name, key').order('name')
  ]);

  type PurchaseRow = {
    id: string;
    supplier_id: string;
    order_id: string | null;
    ordered_at: string;
    received_at: string | null;
    subtotal: number;
    freight: number;
    distribution_fee: number;
    total: number;
    status: string;
    payment_status: string;
    due_date: string | null;
    invoice_ref: string | null;
    supplier: { id: string; name: string; key: string } | null;
    order: { id: string; customer: { id: string; business_name: string } | null } | null;
  };

  return {
    purchases: (purchasesRes.data ?? []) as unknown as PurchaseRow[],
    total: purchasesRes.count ?? 0,
    page,
    pageSize: PAGE_SIZE,
    suppliers: suppliersRes.data ?? [],
    statuses: PURCHASE_STATUSES,
    paymentStatuses: PURCHASE_PAYMENT_STATUSES,
    filters: { supplierId, status, paymentStatus }
  };
};

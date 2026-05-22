import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { parseForm, purchaseCreateSchema } from '$lib/schemas';

type SupplierRow = { id: string; name: string; key: string; distribution_fee_pct: number };
type OrderForLink = {
  id: string;
  total: number;
  placed_at: string;
  customer: { business_name: string } | null;
};

export const load: PageServerLoad = async ({ locals: { supabase }, url }) => {
  const orderId = url.searchParams.get('order') ?? '';

  const [suppliersRes, ordersRes, linkedOrderRes, existingCogsRes] = await Promise.all([
    supabase
      .from('suppliers')
      .select('id, name, key, distribution_fee_pct')
      .order('name'),
    supabase
      .from('orders')
      .select('id, total, placed_at, customer:customers(business_name)')
      .order('placed_at', { ascending: false })
      .limit(100),
    orderId
      ? supabase
          .from('orders')
          .select('id, total, placed_at, customer:customers(business_name)')
          .eq('id', orderId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    orderId
      ? supabase.from('v_order_cogs').select('cogs_total').eq('order_id', orderId).maybeSingle()
      : Promise.resolve({ data: null })
  ]);

  return {
    suppliers: (suppliersRes.data ?? []) as SupplierRow[],
    recentOrders: (ordersRes.data ?? []) as unknown as OrderForLink[],
    linkedOrder: linkedOrderRes.data as unknown as OrderForLink | null,
    existingCogs: Number((existingCogsRes.data as { cogs_total?: number } | null)?.cogs_total ?? 0),
    defaultOrderId: orderId
  };
};

export const actions: Actions = {
  create: async ({ request, locals: { supabase } }) => {
    const form = await request.formData();
    const parsed = parseForm(purchaseCreateSchema, form);
    if (!parsed.success) {
      return fail(400, { message: parsed.message, fieldErrors: parsed.fieldErrors });
    }

    const d = parsed.data;
    const { data: purchase, error } = await supabase
      .from('purchases')
      .insert({
        supplier_id: d.supplier_id,
        order_id: d.order_id ?? null,
        ordered_at: d.ordered_at ?? new Date().toISOString(),
        received_at: d.received_at ?? null,
        subtotal: d.subtotal,
        freight: d.freight,
        distribution_fee_pct: d.distribution_fee_pct,
        tax: d.tax,
        status: d.status,
        payment_status: d.payment_status,
        due_date: d.due_date ?? null,
        invoice_ref: d.invoice_ref ?? null,
        notes: d.notes ?? null
      })
      .select('id')
      .single();

    if (error || !purchase) {
      return fail(400, {
        message: error?.message ?? 'Failed to create purchase.',
        fieldErrors: {}
      });
    }

    throw redirect(303, `/purchases/${purchase.id}`);
  }
};

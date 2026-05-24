import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { parseForm, parsePurchaseLineItems, purchaseCreateSchema } from '$lib/schemas';

type OrderForLink = {
  id: string;
  total: number;
  placed_at: string;
  customer: { business_name: string } | null;
};

export const load: PageServerLoad = async ({ locals: { supabase }, url }) => {
  const orderId = url.searchParams.get('order') ?? '';

  const [suppliersRes, ordersRes, linkedOrderRes, existingCogsRes] = await Promise.all([
    supabase.from('suppliers').select('id, name, key, distribution_fee_pct').order('name'),
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
    suppliers: suppliersRes.data ?? [],
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

    let lines;
    try {
      lines = parsePurchaseLineItems(d.line_items_json);
    } catch (err) {
      return fail(400, {
        message: err instanceof Error ? err.message : 'Invalid purchase lines.',
        fieldErrors: {}
      });
    }

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

    if (lines.length > 0) {
      const rows = lines.map((line, i) => ({
        purchase_id: purchase.id,
        product_id: line.product_id ?? null,
        order_line_item_id: line.order_line_item_id ?? null,
        product_sku_snapshot: line.product_sku_snapshot ?? null,
        product_name_snapshot: line.product_name_snapshot ?? null,
        description: line.description ?? null,
        quantity: line.quantity,
        unit_cost: line.unit_cost,
        line_total: Math.round(line.quantity * line.unit_cost * 100) / 100,
        display_order: i
      }));

      const { error: lineErr } = await supabase.from('purchase_line_items').insert(rows);
      if (lineErr) {
        await supabase.from('purchases').delete().eq('id', purchase.id);
        return fail(400, {
          message: `Failed to save line items: ${lineErr.message}`,
          fieldErrors: {}
        });
      }
    }

    throw redirect(303, `/purchases/${purchase.id}`);
  }
};

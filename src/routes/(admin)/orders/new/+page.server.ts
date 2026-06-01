import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { adminOrderCreateSchema, parseForm, parseOrderLineItems } from '$lib/schemas';
import { calculateTaxForAddress } from '$lib/server/tax-calculation';
import { roundToNearestDollar } from '$lib/utils';

type CustomerAddress = {
  id: string;
  label: string | null;
  line1: string;
  line2: string | null;
  city: string;
  region: string;
  postal_code: string;
  country: string;
  is_default_shipping: boolean;
};

export const load: PageServerLoad = async ({ locals: { supabase }, url }) => {
  const defaultCustomerId = url.searchParams.get('customer') ?? '';

  const [customersRes, addressesRes] = await Promise.all([
    supabase.from('customers').select('id, business_name, email').order('business_name'),
    supabase
      .from('customer_addresses')
      .select(
        'id, customer_id, label, line1, line2, city, region, postal_code, country, is_default_shipping'
      )
      .order('is_default_shipping', { ascending: false })
  ]);

  const addressesByCustomer = new Map<string, CustomerAddress[]>();
  for (const row of addressesRes.data ?? []) {
    const list = addressesByCustomer.get(row.customer_id) ?? [];
    list.push({
      id: row.id,
      label: row.label,
      line1: row.line1,
      line2: row.line2,
      city: row.city,
      region: row.region,
      postal_code: row.postal_code,
      country: row.country,
      is_default_shipping: row.is_default_shipping
    });
    addressesByCustomer.set(row.customer_id, list);
  }

  return {
    customers: customersRes.data ?? [],
    addressesByCustomer: Object.fromEntries(addressesByCustomer),
    defaultCustomerId
  };
};

export const actions: Actions = {
  create: async ({ request, locals: { supabase } }) => {
    const form = await request.formData();
    const parsed = parseForm(adminOrderCreateSchema, form);
    if (!parsed.success) {
      return fail(400, { message: parsed.message, fieldErrors: parsed.fieldErrors });
    }
    const d = parsed.data;

    let lines;
    try {
      lines = parseOrderLineItems(d.line_items_json);
    } catch (err) {
      return fail(400, {
        message: err instanceof Error ? err.message : 'Invalid order lines.',
        fieldErrors: {}
      });
    }

    if (lines.length === 0) {
      return fail(400, { message: 'Add at least one line item.', fieldErrors: {} });
    }

    let shippingAddressSnapshot: Record<string, unknown> | null = null;
    if (d.shipping_address_id) {
      const { data: addr } = await supabase
        .from('customer_addresses')
        .select('label, line1, line2, city, region, postal_code, country')
        .eq('id', d.shipping_address_id)
        .eq('customer_id', d.customer_id)
        .maybeSingle();
      if (addr) {
        shippingAddressSnapshot = {
          label: addr.label,
          line1: addr.line1,
          line2: addr.line2,
          city: addr.city,
          state: addr.region,
          postal_code: addr.postal_code,
          country: addr.country
        };
      }
    }

    const lineRows = lines.map((line) => {
      const roundedUnitPrice = roundToNearestDollar(line.unit_price);
      const lineTotal = Math.round(line.quantity * roundedUnitPrice * 100) / 100;
      return {
        product_id: line.product_id ?? null,
        product_sku_snapshot: line.product_sku_snapshot ?? null,
        product_name_snapshot: line.product_name_snapshot,
        quantity: line.quantity,
        unit_price_snapshot: roundedUnitPrice,
        line_total: lineTotal
      };
    });

    const subtotal = Math.round(lineRows.reduce((s, r) => s + r.line_total, 0) * 100) / 100;

    const tax = shippingAddressSnapshot
      ? await calculateTaxForAddress(supabase, shippingAddressSnapshot, subtotal)
      : { tax: 0, rate: 0, state: null };

    const shipping = Math.max(0, d.shipping);
    const total = Math.round((subtotal + tax.tax + shipping) * 100) / 100;

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        customer_id: d.customer_id,
        status: d.status,
        payment_method: d.payment_method ?? null,
        subtotal,
        tax: tax.tax,
        shipping,
        total,
        tax_rate: tax.rate || null,
        shipping_state: tax.state || null,
        tax_calculated_at: shippingAddressSnapshot ? new Date().toISOString() : null,
        shipping_address_snapshot: shippingAddressSnapshot,
        source: 'manual'
      })
      .select('id')
      .single();

    if (orderError || !order) {
      return fail(400, {
        message: orderError?.message ?? 'Failed to create order.',
        fieldErrors: {}
      });
    }

    const { error: lineError } = await supabase
      .from('order_line_items')
      .insert(lineRows.map((row) => ({ ...row, order_id: order.id })));

    if (lineError) {
      await supabase.from('orders').delete().eq('id', order.id);
      return fail(400, {
        message: `Failed to save line items: ${lineError.message}`,
        fieldErrors: {}
      });
    }

    throw redirect(303, `/orders/${order.id}`);
  }
};

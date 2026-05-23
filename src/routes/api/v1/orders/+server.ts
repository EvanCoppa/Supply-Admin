import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { z } from 'zod';
import { createSupabaseAdminClient } from '$lib/supabase.server';
import { requireSupplyCustomer } from '$lib/server/supply-auth';
import {
  canBuyProduct,
  getAccessMap,
  getCatalogCustomer,
  resolveCustomerPrice
} from '$lib/server/supply-catalog';

const orderSchema = z.object({
  idempotency_key: z.string().trim().min(1).max(128).optional(),
  shipping_address: z.record(z.unknown()).nullable().optional(),
  items: z
    .array(
      z.object({
        product_id: z.string().uuid(),
        quantity: z.number().int().positive().max(999)
      })
    )
    .min(1)
    .max(100)
});

type ProductRow = {
  id: string;
  sku: string;
  name: string;
  base_price: number | string;
};

export const POST: RequestHandler = async ({ request }) => {
  const supabase = createSupabaseAdminClient();
  const { customerId } = await requireSupplyCustomer(request, supabase);
  const parsed = orderSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    throw error(400, parsed.error.issues[0]?.message ?? 'Invalid order payload');
  }

  if (parsed.data.idempotency_key) {
    const { data: existing, error: existingError } = await supabase
      .from('orders')
      .select('id, status, subtotal, tax, shipping, total, placed_at')
      .eq('customer_id', customerId)
      .eq('idempotency_key', parsed.data.idempotency_key)
      .maybeSingle();

    if (existingError) {
      console.error('[supply-api] idempotency lookup failed', existingError);
      throw error(500, 'Idempotency lookup failed');
    }
    if (existing) {
      return json({ order: existing, idempotent: true });
    }
  }

  const customer = await getCatalogCustomer(supabase, customerId);
  const accessMap = await getAccessMap(supabase, customerId);
  const quantities = new Map<string, number>();
  for (const item of parsed.data.items) {
    quantities.set(item.product_id, (quantities.get(item.product_id) ?? 0) + item.quantity);
  }

  const productIds = [...quantities.keys()];
  const { data: products, error: productsError } = await supabase
    .from('products')
    .select('id, sku, name, base_price')
    .in('id', productIds)
    .eq('status', 'active');

  if (productsError) {
    console.error('[supply-api] order product lookup failed', productsError);
    throw error(500, 'Product lookup failed');
  }

  const productMap = new Map(((products ?? []) as ProductRow[]).map((p) => [p.id, p]));
  for (const productId of productIds) {
    const product = productMap.get(productId);
    if (!product) throw error(400, `Product ${productId} is not available`);
    if (!canBuyProduct(customer.catalog_access_mode, accessMap.get(productId))) {
      throw error(403, `Product ${productId} cannot be purchased by this customer`);
    }
  }

  const lineItems = await Promise.all(
    productIds.map(async (productId) => {
      const product = productMap.get(productId);
      if (!product) throw error(400, `Product ${productId} is not available`);
      const quantity = quantities.get(productId) ?? 0;
      const unitPrice = await resolveCustomerPrice(supabase, customerId, product);
      return {
        product_id: product.id,
        product_sku_snapshot: product.sku,
        product_name_snapshot: product.name,
        quantity,
        unit_price_snapshot: unitPrice,
        line_total: Math.round(unitPrice * quantity * 100) / 100
      };
    })
  );

  const subtotal =
    Math.round(lineItems.reduce((sum, item) => sum + item.line_total, 0) * 100) / 100;
  const tax = 0;
  const shipping = 0;
  const total = subtotal + tax + shipping;

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({
      customer_id: customerId,
      status: 'paid',
      subtotal,
      tax,
      shipping,
      total,
      shipping_address_snapshot: parsed.data.shipping_address ?? null,
      source: 'api',
      idempotency_key: parsed.data.idempotency_key ?? null
    })
    .select('id, status, subtotal, tax, shipping, total, placed_at')
    .single();

  if (orderError || !order) {
    console.error('[supply-api] order create failed', orderError);
    throw error(500, orderError?.message ?? 'Order create failed');
  }

  const { error: lineError } = await supabase
    .from('order_line_items')
    .insert(lineItems.map((item) => ({ ...item, order_id: order.id })));

  if (lineError) {
    console.error('[supply-api] line item create failed', lineError);
    await supabase.from('orders').delete().eq('id', order.id);
    throw error(500, 'Line item create failed');
  }

  return json({ order: { ...order, line_items: lineItems }, idempotent: false }, { status: 201 });
};

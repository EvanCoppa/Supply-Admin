import { fail } from '@sveltejs/kit';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Actions, PageServerLoad } from './$types';
import { parseForm, pricingPreviewSchema, pricingRuleSchema } from '$lib/schemas';

type AuditAction = 'create' | 'update' | 'delete';

type AuditEntry = {
  id: string;
  rule_id: string | null;
  action: AuditAction;
  actor_id: string | null;
  actor_email: string | null;
  changes: Record<string, unknown> | null;
  created_at: string;
};

async function logAudit(
  supabase: SupabaseClient,
  entry: {
    customer_id: string;
    rule_id: string | null;
    action: AuditAction;
    actor_id: string | null;
    actor_email: string | null;
    changes: Record<string, unknown> | null;
  }
) {
  // Best effort — if the audit table is missing, we don't want to break the rule mutation.
  try {
    await supabase.from('customer_pricing_rule_audit').insert(entry);
  } catch {
    // ignore
  }
}

export const load: PageServerLoad = async ({ params, locals: { supabase } }) => {
  const [rulesRes, productsRes, categoriesRes, auditRes] = await Promise.all([
    supabase
      .from('customer_pricing_rules')
      .select(
        'id, scope, product_id, category_id, override_type, absolute_price, percent_discount, effective_start, effective_end, created_at, product:products(name, sku), category:categories(name)'
      )
      .eq('customer_id', params.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('products')
      .select('id, sku, name')
      .eq('status', 'active')
      .order('name')
      .limit(500),
    supabase.from('categories').select('id, name').order('name'),
    supabase
      .from('customer_pricing_rule_audit')
      .select('id, rule_id, action, actor_id, actor_email, changes, created_at')
      .eq('customer_id', params.id)
      .order('created_at', { ascending: false })
      .limit(50)
  ]);

  type Rule = {
    id: string;
    scope: 'product' | 'category';
    product_id: string | null;
    category_id: string | null;
    override_type: 'absolute_price' | 'percent_discount';
    absolute_price: number | null;
    percent_discount: number | null;
    effective_start: string | null;
    effective_end: string | null;
    created_at: string;
    product: { name: string; sku: string } | null;
    category: { name: string } | null;
  };

  const rules = (rulesRes.data ?? []) as unknown as Rule[];

  // Conflict detection: any rule that shares scope+target with another rule for this client.
  const counts = new Map<string, number>();
  for (const r of rules) {
    const key = `${r.scope}:${r.product_id ?? r.category_id ?? ''}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const conflictingIds = new Set<string>();
  for (const r of rules) {
    const key = `${r.scope}:${r.product_id ?? r.category_id ?? ''}`;
    if ((counts.get(key) ?? 0) > 1) conflictingIds.add(r.id);
  }

  return {
    rules,
    products: (productsRes.data ?? []) as Array<{ id: string; sku: string; name: string }>,
    categories: (categoriesRes.data ?? []) as Array<{ id: string; name: string }>,
    conflictingIds: [...conflictingIds],
    auditLog: ((auditRes.data ?? []) as unknown as AuditEntry[])
  };
};

export const actions: Actions = {
  create: async ({ params, request, locals: { supabase, user } }) => {
    const form = await request.formData();
    const parsed = parseForm(pricingRuleSchema, form);
    if (!parsed.success) {
      return fail(400, { message: parsed.message, fieldErrors: parsed.fieldErrors });
    }
    const { scope, override_type } = parsed.data;
    const payload = {
      customer_id: params.id,
      scope,
      product_id: scope === 'product' ? parsed.data.product_id : null,
      category_id: scope === 'category' ? parsed.data.category_id : null,
      override_type,
      absolute_price:
        override_type === 'absolute_price' ? parsed.data.absolute_price : null,
      percent_discount:
        override_type === 'percent_discount' ? parsed.data.percent_discount : null,
      effective_start: parsed.data.effective_start,
      effective_end: parsed.data.effective_end
    };
    const { data, error } = await supabase
      .from('customer_pricing_rules')
      .insert(payload)
      .select('id')
      .maybeSingle();
    if (error) return fail(400, { message: error.message, fieldErrors: {} });

    await logAudit(supabase, {
      customer_id: params.id,
      rule_id: data?.id ?? null,
      action: 'create',
      actor_id: user?.id ?? null,
      actor_email: user?.email ?? null,
      changes: payload
    });
    return { saved: true };
  },

  delete: async ({ params, request, locals: { supabase, user } }) => {
    const form = await request.formData();
    const id = String(form.get('id') ?? '');

    const { data: existing } = await supabase
      .from('customer_pricing_rules')
      .select('*')
      .eq('id', id)
      .eq('customer_id', params.id)
      .maybeSingle();

    const { error } = await supabase
      .from('customer_pricing_rules')
      .delete()
      .eq('id', id)
      .eq('customer_id', params.id);
    if (error) return fail(400, { message: error.message, fieldErrors: {} });

    await logAudit(supabase, {
      customer_id: params.id,
      rule_id: id,
      action: 'delete',
      actor_id: user?.id ?? null,
      actor_email: user?.email ?? null,
      changes: existing ?? null
    });
    return { saved: true };
  },

  preview: async ({ params, request, locals: { supabase } }) => {
    const form = await request.formData();
    const parsed = parseForm(pricingPreviewSchema, form);
    if (!parsed.success) {
      return fail(400, { message: parsed.message, fieldErrors: parsed.fieldErrors });
    }
    const productId = parsed.data.product_id;
    const { data, error } = await supabase.rpc('resolve_customer_price', {
      p_customer_id: params.id,
      p_product_id: productId
    });
    if (error)
      return fail(400, {
        previewProductId: productId,
        message: error.message,
        fieldErrors: {}
      });
    return { previewProductId: productId, resolvedPrice: data as number | null };
  }
};

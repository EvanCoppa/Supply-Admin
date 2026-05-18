import { fail } from '@sveltejs/kit';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Actions, PageServerLoad } from './$types';

const PAGE_SIZE = 50;
const MAX_BULK_PRODUCTS = 5000;

type AccessMode = 'all_active' | 'allowlist';
type AccessRow = {
  product_id: string;
  can_view: boolean;
  can_buy: boolean;
};
type ProductScope = 'all' | 'filtered' | 'category' | 'group' | 'selected';
type BulkOperation = 'allow' | 'hide' | 'buyable' | 'view_only' | 'clear';

function modeFromValue(value: unknown): AccessMode {
  return value === 'all_active' ? 'all_active' : 'allowlist';
}

function escapeLike(value: string) {
  return value.replaceAll('%', '\\%').replaceAll('_', '\\_');
}

function accessFor(mode: AccessMode, row: AccessRow | undefined) {
  const can_view = row?.can_view ?? (mode === 'all_active' ? true : false);
  return {
    can_view,
    can_buy: can_view && (row?.can_buy ?? true),
    has_override: !!row
  };
}

function summarizeAccess(mode: AccessMode, accessRows: AccessRow[], productIds: string[]) {
  const access = new Map(accessRows.map((row) => [row.product_id, row]));
  let visible = 0;
  let buyable = 0;
  let overrides = 0;

  for (const productId of productIds) {
    const row = access.get(productId);
    const state = accessFor(mode, row);
    if (state.can_view) visible += 1;
    if (state.can_buy) buyable += 1;
    if (row) overrides += 1;
  }

  return {
    total: productIds.length,
    visible,
    buyable,
    hidden: productIds.length - visible,
    overrides
  };
}

async function getGroupProductIds(
  supabase: SupabaseClient,
  groupId: string
): Promise<string[]> {
  if (!groupId) return [];

  const { data, error } = await supabase
    .from('featured_groups')
    .select('product_ids')
    .eq('id', groupId)
    .maybeSingle();

  if (error || !data) return [];
  return Array.isArray(data.product_ids) ? data.product_ids.filter(Boolean) : [];
}

async function resolveProductIds(
  supabase: SupabaseClient,
  scope: ProductScope,
  form: FormData
): Promise<string[]> {
  const search = String(form.get('q') ?? '').trim();
  const categoryId = String(form.get('category_id') ?? '').trim();
  const groupId = String(form.get('group_id') ?? '').trim();

  if (scope === 'selected') {
    return String(form.get('product_ids') ?? '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean)
      .slice(0, MAX_BULK_PRODUCTS);
  }

  const scopedCategoryId = scope === 'category' ? String(form.get('bulk_category_id') ?? '').trim() : categoryId;
  const scopedGroupId = scope === 'group' ? String(form.get('bulk_group_id') ?? '').trim() : groupId;
  const groupProductIds =
    (scope === 'group' || (scope === 'filtered' && scopedGroupId))
      ? await getGroupProductIds(supabase, scopedGroupId)
      : [];

  if ((scope === 'category' && !scopedCategoryId) || (scope === 'group' && !scopedGroupId)) return [];
  if ((scope === 'group' || (scope === 'filtered' && scopedGroupId)) && groupProductIds.length === 0) return [];

  let query = supabase
    .from('products')
    .select('id')
    .eq('status', 'active')
    .order('name')
    .limit(MAX_BULK_PRODUCTS);

  if ((scope === 'filtered' || scope === 'category') && scopedCategoryId) {
    query = query.eq('category_id', scopedCategoryId);
  }
  if (scope === 'filtered' && search) {
    const escaped = escapeLike(search);
    query = query.or(`name.ilike.%${escaped}%,sku.ilike.%${escaped}%`);
  }
  if (scope === 'group' || (scope === 'filtered' && scopedGroupId)) {
    query = query.in('id', groupProductIds);
  }

  const { data } = await query;
  return (data ?? []).map((row) => row.id);
}

export const load: PageServerLoad = async ({ params, locals: { supabase }, url }) => {
  const search = (url.searchParams.get('q') ?? '').trim();
  const categoryId = (url.searchParams.get('category') ?? '').trim();
  const groupId = (url.searchParams.get('group') ?? '').trim();
  const page = Math.max(1, Number(url.searchParams.get('page') ?? '1'));
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const [customerRes, accessRes, categoriesRes, groupsRes, activeProductsRes] = await Promise.all([
    supabase
      .from('customers')
      .select('catalog_access_mode')
      .eq('id', params.id)
      .maybeSingle(),
    supabase
      .from('customer_product_access')
      .select('product_id, can_view, can_buy')
      .eq('customer_id', params.id),
    supabase.from('categories').select('id, name').order('name'),
    supabase.from('featured_groups').select('id, name, product_ids').order('name'),
    supabase
      .from('products')
      .select('id, category_id')
      .eq('status', 'active')
      .limit(MAX_BULK_PRODUCTS)
  ]);

  const mode = modeFromValue(customerRes.data?.catalog_access_mode);
  const accessRows = (accessRes.data ?? []) as AccessRow[];
  const access = new Map(accessRows.map((row) => [row.product_id, row]));
  const activeProducts = (activeProductsRes.data ?? []) as Array<{ id: string; category_id: string | null }>;
  const activeIds = activeProducts.map((product) => product.id);
  const activeIdSet = new Set(activeIds);
  const selectedGroupProductIds = groupId ? await getGroupProductIds(supabase, groupId) : [];

  let productsQuery = supabase
    .from('products')
    .select('id, sku, name, status, category_id, category:categories(id, name)', { count: 'exact' })
    .eq('status', 'active')
    .order('name')
    .range(from, to);

  if (search) {
    const escaped = escapeLike(search);
    productsQuery = productsQuery.or(`name.ilike.%${escaped}%,sku.ilike.%${escaped}%`);
  }
  if (categoryId) productsQuery = productsQuery.eq('category_id', categoryId);
  if (groupId) {
    if (selectedGroupProductIds.length === 0) {
      productsQuery = productsQuery.in('id', ['00000000-0000-0000-0000-000000000000']);
    } else {
      productsQuery = productsQuery.in('id', selectedGroupProductIds);
    }
  }

  const productsRes = await productsQuery;
  const categories = (categoriesRes.data ?? []) as Array<{ id: string; name: string }>;
  const groups = (groupsRes.data ?? []) as Array<{ id: string; name: string; product_ids: string[] | null }>;

  const categorySummaries = categories.map((category) => {
    const ids = activeProducts
      .filter((product) => product.category_id === category.id)
      .map((product) => product.id);
    return { ...category, ...summarizeAccess(mode, accessRows, ids) };
  });

  const groupSummaries = groups.map((group) => {
    const ids = (group.product_ids ?? []).filter((id) => activeIdSet.has(id));
    return { id: group.id, name: group.name, ...summarizeAccess(mode, accessRows, ids) };
  });

  return {
    mode,
    search,
    filters: { categoryId, groupId },
    products: ((productsRes.data ?? []) as unknown as Array<{
      id: string;
      sku: string;
      name: string;
      status: 'active';
      category_id: string | null;
      category: { id: string; name: string } | null;
    }>).map((product) => ({
      ...product,
      ...accessFor(mode, access.get(product.id))
    })),
    total: productsRes.count ?? 0,
    page,
    pageSize: PAGE_SIZE,
    summary: summarizeAccess(mode, accessRows, activeIds),
    categories: categorySummaries,
    groups: groupSummaries
  };
};

export const actions: Actions = {
  saveMode: async ({ params, request, locals: { supabase } }) => {
    const form = await request.formData();
    const mode = String(form.get('catalog_access_mode') ?? '');
    if (mode !== 'all_active' && mode !== 'allowlist') {
      return fail(400, { message: 'Invalid catalog access mode.' });
    }

    const { error } = await supabase
      .from('customers')
      .update({ catalog_access_mode: mode })
      .eq('id', params.id);

    if (error) return fail(400, { message: error.message });
    return { saved: true };
  },

  setAccess: async ({ params, request, locals: { supabase } }) => {
    const form = await request.formData();
    const product_id = String(form.get('product_id') ?? '');
    const can_view = form.get('can_view') === 'on';
    const can_buy = can_view && form.get('can_buy') === 'on';

    if (!product_id) return fail(400, { message: 'Missing product.' });

    const { error } = await supabase.from('customer_product_access').upsert({
      customer_id: params.id,
      product_id,
      can_view,
      can_buy,
      updated_at: new Date().toISOString()
    });

    if (error) return fail(400, { message: error.message });
    return { saved: true };
  },

  bulkAccess: async ({ params, request, locals: { supabase } }) => {
    const form = await request.formData();
    const scope = String(form.get('scope') ?? '') as ProductScope;
    const operation = String(form.get('operation') ?? '') as BulkOperation;

    if (!['all', 'filtered', 'category', 'group', 'selected'].includes(scope)) {
      return fail(400, { message: 'Choose a valid product scope.' });
    }
    if (!['allow', 'hide', 'buyable', 'view_only', 'clear'].includes(operation)) {
      return fail(400, { message: 'Choose a valid bulk action.' });
    }

    const productIds = await resolveProductIds(supabase, scope, form);
    if (productIds.length === 0) return fail(400, { message: 'No matching active products found.' });

    if (operation === 'clear') {
      const { error } = await supabase
        .from('customer_product_access')
        .delete()
        .eq('customer_id', params.id)
        .in('product_id', productIds);
      if (error) return fail(400, { message: error.message });
      return { saved: true, affected: productIds.length };
    }

    const nextState = {
      allow: { can_view: true, can_buy: true },
      buyable: { can_view: true, can_buy: true },
      view_only: { can_view: true, can_buy: false },
      hide: { can_view: false, can_buy: false }
    }[operation];

    const now = new Date().toISOString();
    const { error } = await supabase.from('customer_product_access').upsert(
      productIds.map((product_id) => ({
        customer_id: params.id,
        product_id,
        ...nextState,
        updated_at: now
      }))
    );

    if (error) return fail(400, { message: error.message });
    return { saved: true, affected: productIds.length };
  },

  clearAccess: async ({ params, request, locals: { supabase } }) => {
    const form = await request.formData();
    const product_id = String(form.get('product_id') ?? '');
    if (!product_id) return fail(400, { message: 'Missing product.' });

    const { error } = await supabase
      .from('customer_product_access')
      .delete()
      .eq('customer_id', params.id)
      .eq('product_id', product_id);

    if (error) return fail(400, { message: error.message });
    return { saved: true };
  }
};

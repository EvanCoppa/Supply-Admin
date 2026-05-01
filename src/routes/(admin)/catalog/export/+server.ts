import type { RequestHandler } from './$types';
import { toCsv } from '$lib/csv';

const EXPORT_COLUMNS = [
  'sku',
  'name',
  'description',
  'category',
  'manufacturer',
  'unit_of_measure',
  'pack_size',
  'base_price',
  'tax_class',
  'weight_grams',
  'status'
];

const PAGE = 1000;

export const GET: RequestHandler = async ({ url, locals: { supabase } }) => {
  const search = url.searchParams.get('q')?.trim() ?? '';
  const status = url.searchParams.get('status') ?? '';
  const categoryId = url.searchParams.get('category') ?? '';

  type Row = {
    sku: string;
    name: string;
    description: string | null;
    manufacturer: string | null;
    unit_of_measure: string | null;
    pack_size: number | null;
    base_price: number;
    tax_class: string | null;
    weight_grams: number | null;
    status: string;
    category: { name: string | null } | null;
  };

  const all: Row[] = [];
  let from = 0;

  while (true) {
    let query = supabase
      .from('products')
      .select(
        'sku, name, description, manufacturer, unit_of_measure, pack_size, base_price, tax_class, weight_grams, status, category:categories(name)'
      )
      .order('sku', { ascending: true })
      .range(from, from + PAGE - 1);

    if (search) query = query.or(`name.ilike.%${search}%,sku.ilike.%${search}%`);
    if (status === 'active' || status === 'archived') query = query.eq('status', status);
    if (categoryId) query = query.eq('category_id', categoryId);

    const { data, error } = await query;
    if (error) {
      return new Response(`error: ${error.message}`, { status: 500 });
    }
    const rows = (data ?? []) as unknown as Row[];
    all.push(...rows);
    if (rows.length < PAGE) break;
    from += PAGE;
  }

  const records = all.map((r) => ({
    sku: r.sku,
    name: r.name,
    description: r.description ?? '',
    category: r.category?.name ?? '',
    manufacturer: r.manufacturer ?? '',
    unit_of_measure: r.unit_of_measure ?? '',
    pack_size: r.pack_size ?? '',
    base_price: r.base_price,
    tax_class: r.tax_class ?? '',
    weight_grams: r.weight_grams ?? '',
    status: r.status
  }));

  const csv = toCsv(EXPORT_COLUMNS, records);
  const stamp = new Date().toISOString().slice(0, 10);
  const suffixParts = [search && `q-${search}`, status && `status-${status}`, categoryId && `cat-${categoryId.slice(0, 8)}`]
    .filter(Boolean)
    .join('_');
  const suffix = suffixParts ? `_${suffixParts}` : '';

  return new Response(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="catalog_${stamp}${suffix}.csv"`,
      'Cache-Control': 'no-store'
    }
  });
};

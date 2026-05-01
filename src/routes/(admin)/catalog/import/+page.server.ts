import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { parseCsv, rowsToObjects } from '$lib/csv';

const PRODUCT_CSV_COLUMNS = [
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
] as const;

const REQUIRED_COLUMNS = ['sku', 'name', 'base_price'] as const;

type ProductImportRow = {
  sku: string;
  name: string;
  description: string | null;
  category_id: string | null;
  manufacturer: string | null;
  unit_of_measure: string | null;
  pack_size: number | null;
  base_price: number;
  tax_class: string | null;
  weight_grams: number | null;
  status: 'active' | 'archived';
};

export interface PreviewRow {
  rowNumber: number;
  raw: Record<string, string>;
  parsed: ProductImportRow | null;
  errors: string[];
  exists: boolean;
}

function nullableStr(value: string | undefined): string | null {
  if (value === undefined) return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

function parseNumber(value: string | undefined, errors: string[], field: string): number | null {
  if (value === undefined || value.trim() === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n)) {
    errors.push(`${field} must be numeric (got "${value}").`);
    return null;
  }
  return n;
}

function validateRow(
  raw: Record<string, string>,
  rowNumber: number,
  categoryByKey: Map<string, string>,
  existingSkus: Set<string>
): PreviewRow {
  const errors: string[] = [];

  const sku = (raw.sku ?? '').trim();
  const name = (raw.name ?? '').trim();
  const status = (raw.status ?? '').trim().toLowerCase() || 'active';
  const description = nullableStr(raw.description);
  const manufacturer = nullableStr(raw.manufacturer);
  const unit_of_measure = nullableStr(raw.unit_of_measure);
  const tax_class = nullableStr(raw.tax_class);
  const categoryRaw = nullableStr(raw.category);

  if (!sku) errors.push('sku is required.');
  if (!name) errors.push('name is required.');

  const pack_size = parseNumber(raw.pack_size, errors, 'pack_size');
  if (pack_size !== null && (!Number.isInteger(pack_size) || pack_size < 1)) {
    errors.push('pack_size must be a positive integer.');
  }
  const weight_grams = parseNumber(raw.weight_grams, errors, 'weight_grams');
  if (weight_grams !== null && weight_grams < 0) {
    errors.push('weight_grams must be non-negative.');
  }
  const base_price = parseNumber(raw.base_price, errors, 'base_price');
  if (raw.base_price === undefined || raw.base_price.trim() === '') {
    errors.push('base_price is required.');
  } else if (base_price !== null && base_price < 0) {
    errors.push('base_price must be non-negative.');
  }

  if (status !== 'active' && status !== 'archived') {
    errors.push(`status must be "active" or "archived" (got "${status}").`);
  }

  let category_id: string | null = null;
  if (categoryRaw) {
    const id = categoryByKey.get(categoryRaw.toLowerCase());
    if (!id) {
      errors.push(`category "${categoryRaw}" does not exist.`);
    } else {
      category_id = id;
    }
  }

  const exists = sku ? existingSkus.has(sku.toLowerCase()) : false;

  const parsed: ProductImportRow | null =
    errors.length === 0 && base_price !== null
      ? {
          sku,
          name,
          description,
          category_id,
          manufacturer,
          unit_of_measure,
          pack_size,
          base_price,
          tax_class,
          weight_grams,
          status: status as 'active' | 'archived'
        }
      : null;

  return { rowNumber, raw, parsed, errors, exists };
}

export const load: PageServerLoad = async () => {
  return {
    columns: PRODUCT_CSV_COLUMNS as readonly string[],
    requiredColumns: REQUIRED_COLUMNS as readonly string[]
  };
};

export const actions: Actions = {
  preview: async ({ request, locals: { supabase } }) => {
    const form = await request.formData();
    const file = form.get('csv');
    if (!(file instanceof File) || file.size === 0) {
      return fail(400, { stage: 'upload', message: 'Choose a CSV file.' });
    }

    const text = await file.text();
    const parsed = parseCsv(text);
    if (parsed.header.length === 0) {
      return fail(400, { stage: 'upload', message: 'CSV is empty.' });
    }

    const missing = REQUIRED_COLUMNS.filter((c) => !parsed.header.includes(c));
    if (missing.length > 0) {
      return fail(400, {
        stage: 'upload',
        message: `Missing required columns: ${missing.join(', ')}.`
      });
    }

    const objects = rowsToObjects(parsed);
    if (objects.length === 0) {
      return fail(400, { stage: 'upload', message: 'CSV has a header but no rows.' });
    }
    if (objects.length > 5000) {
      return fail(400, {
        stage: 'upload',
        message: `Too many rows (${objects.length}). Split into batches under 5000.`
      });
    }

    const skus = Array.from(
      new Set(
        objects
          .map((r) => (r.sku ?? '').trim())
          .filter((s) => s.length > 0)
      )
    );

    const [categoriesRes, existingRes] = await Promise.all([
      supabase.from('categories').select('id, name, slug'),
      skus.length > 0
        ? supabase.from('products').select('sku').in('sku', skus)
        : Promise.resolve({ data: [] as Array<{ sku: string }>, error: null })
    ]);

    if (categoriesRes.error) {
      return fail(500, { stage: 'upload', message: categoriesRes.error.message });
    }

    const categoryByKey = new Map<string, string>();
    for (const c of categoriesRes.data ?? []) {
      const row = c as { id: string; name: string; slug: string | null };
      if (row.name) categoryByKey.set(row.name.toLowerCase(), row.id);
      if (row.slug) categoryByKey.set(row.slug.toLowerCase(), row.id);
    }
    const existingSkus = new Set(
      ((existingRes.data ?? []) as Array<{ sku: string }>).map((r) => r.sku.toLowerCase())
    );

    // Surface duplicate SKUs within the upload itself.
    const seenInFile = new Map<string, number>();
    const duplicateInFile = new Set<string>();
    for (const obj of objects) {
      const k = (obj.sku ?? '').trim().toLowerCase();
      if (!k) continue;
      if (seenInFile.has(k)) duplicateInFile.add(k);
      seenInFile.set(k, (seenInFile.get(k) ?? 0) + 1);
    }

    const previews: PreviewRow[] = objects.map((raw, idx) => {
      const row = validateRow(raw, idx + 2, categoryByKey, existingSkus);
      const k = (raw.sku ?? '').trim().toLowerCase();
      if (k && duplicateInFile.has(k)) {
        row.errors.unshift(`Duplicate sku "${raw.sku}" within this CSV.`);
      }
      return row;
    });

    const validRows = previews.filter((p) => p.errors.length === 0 && p.parsed);
    const errorCount = previews.length - validRows.length;
    const newCount = validRows.filter((p) => !p.exists).length;
    const updateCount = validRows.filter((p) => p.exists).length;

    return {
      stage: 'preview' as const,
      header: parsed.header,
      previews,
      summary: {
        total: previews.length,
        valid: validRows.length,
        errors: errorCount,
        toCreate: newCount,
        toUpdate: updateCount
      },
      payload: validRows.map((p) => p.parsed)
    };
  },

  commit: async ({ request, locals: { supabase } }) => {
    const form = await request.formData();
    const raw = form.get('payload');
    if (typeof raw !== 'string' || !raw) {
      return fail(400, { stage: 'preview', message: 'Nothing to import.' });
    }
    let rows: ProductImportRow[];
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) throw new Error('payload not an array');
      rows = parsed as ProductImportRow[];
    } catch (e) {
      return fail(400, { stage: 'preview', message: 'Invalid import payload.' });
    }
    if (rows.length === 0) {
      return fail(400, { stage: 'preview', message: 'No valid rows to import.' });
    }

    const { error: upsertErr } = await supabase
      .from('products')
      .upsert(rows, { onConflict: 'sku' });
    if (upsertErr) {
      return fail(400, { stage: 'preview', message: upsertErr.message });
    }

    // Make sure inventory rows exist for any newly created products.
    const skus = rows.map((r) => r.sku);
    const { data: created } = await supabase
      .from('products')
      .select('id')
      .in('sku', skus);
    if (created && created.length > 0) {
      const inventoryRows = (created as Array<{ id: string }>).map((p) => ({
        product_id: p.id
      }));
      await supabase
        .from('inventory')
        .upsert(inventoryRows, { onConflict: 'product_id', ignoreDuplicates: true });
    }

    return {
      stage: 'committed' as const,
      message: `Imported ${rows.length} product${rows.length === 1 ? '' : 's'}.`,
      count: rows.length
    };
  }
};

import { fail } from '@sveltejs/kit';
import type { Actions } from './$types';
import { calculateSalePrice } from '$lib/utils';

type CsvRow = Record<string, string>;

type ValidationError = {
  row: number;
  sku: string;
  message: string;
};

type ImportPreview = {
  totalRows: number;
  imported: number;
  categoriesCreated: number;
  pricesNeedingReview: number;
  inventoryRowsUpserted: number;
  errors: ValidationError[];
};

const HEADER_ALIASES = {
  name: ['name', 'product name', 'product', 'item', 'item name', 'description'],
  sku: ['sku', 'mfr sku', 'manufacturer sku', 'mfr_sku', 'manufacturer_sku'],
  category: ['category', 'category name'],
  lastPurchased: ['last purchased', 'last_purchased', 'last purchase date'],
  totalOrders: ['total orders', 'total_orders', 'orders'],
  lastPurchasedQuantity: [
    'last purchased qty',
    'last purchased quantity',
    'last_purchased_qty',
    'last_purchased_quantity'
  ],
  cost: ['cost', 'unit cost', 'unit_cost', 'our price', 'our_price'],
  price: ['price', 'base price', 'base_price', 'sale price', 'sale_price'],
  quantityOnHand: ['quantity on hand', 'quantity_on_hand', 'on hand', 'stock', 'stock on hand'],
  lowStockThreshold: ['low stock threshold', 'low_stock_threshold', 'threshold']
} as const;

function normalizeHeader(header: string): string {
  return header
    .trim()
    .toLowerCase()
    .replace(/^\uFEFF/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');
}

function getValue(row: CsvRow, aliases: readonly string[]): string {
  for (const alias of aliases) {
    const value = row[alias];
    if (value !== undefined) return value.trim();
  }
  return '';
}

function parseCsv(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = '';
  let quoted = false;

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    const next = input[i + 1];

    if (quoted) {
      if (char === '"' && next === '"') {
        value += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        value += char;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(value);
      value = '';
    } else if (char === '\n') {
      row.push(value);
      rows.push(row);
      row = [];
      value = '';
    } else if (char !== '\r') {
      value += char;
    }
  }

  row.push(value);
  rows.push(row);

  return rows.filter((r) => r.some((cell) => cell.trim().length > 0));
}

function rowsToObjects(rows: string[][]): CsvRow[] {
  const [rawHeaders, ...dataRows] = rows;
  if (!rawHeaders) return [];

  const headers = rawHeaders.map(normalizeHeader);
  const nameAliases = HEADER_ALIASES.name.map(normalizeHeader);
  const firstHeaderIsName = !headers.some((h) => nameAliases.includes(h));

  return dataRows.map((dataRow) => {
    const row: CsvRow = {};
    headers.forEach((header, index) => {
      if (header) row[header] = dataRow[index] ?? '';
    });
    if (firstHeaderIsName && headers[0]) {
      row['name'] = dataRow[0] ?? '';
    }
    return row;
  });
}

function parseOptionalInteger(value: string): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : Number.NaN;
}

function parseOptionalMoney(value: string): { value: number; needsReview: boolean } {
  const trimmed = value.trim();
  if (!trimmed || trimmed === '?') return { value: 0, needsReview: true };
  const parsed = Number(trimmed.replace(/[$,]/g, ''));
  if (!Number.isFinite(parsed) || parsed < 0) return { value: 0, needsReview: true };
  return { value: parsed, needsReview: false };
}

function parseSourceDate(value: string): string | null {
  if (!value) return null;

  const serial = Number(value);
  if (Number.isFinite(serial) && serial > 0) {
    const excelEpoch = Date.UTC(1899, 11, 30);
    return new Date(excelEpoch + serial * 86_400_000).toISOString();
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export const actions: Actions = {
  default: async ({ request, locals: { supabase } }) => {
    const form = await request.formData();
    const file = form.get('file');

    if (!(file instanceof File) || file.size === 0) {
      return fail(400, { message: 'Choose a CSV file to import.' });
    }

    const text = await file.text();
    const rows = rowsToObjects(parseCsv(text));
    const errors: ValidationError[] = [];

    const categoryNames = new Set<string>();
    const products = rows.map((row, index) => {
      const rowNumber = index + 2;
      const name = getValue(row, HEADER_ALIASES.name.map(normalizeHeader));
      const sku = getValue(row, HEADER_ALIASES.sku.map(normalizeHeader));
      const category = getValue(row, HEADER_ALIASES.category.map(normalizeHeader));
      const totalOrders = parseOptionalInteger(
        getValue(row, HEADER_ALIASES.totalOrders.map(normalizeHeader))
      );
      const lastPurchasedQuantity = parseOptionalInteger(
        getValue(row, HEADER_ALIASES.lastPurchasedQuantity.map(normalizeHeader))
      );
      const quantityOnHand = parseOptionalInteger(
        getValue(row, HEADER_ALIASES.quantityOnHand.map(normalizeHeader))
      );
      const lowStockThreshold = parseOptionalInteger(
        getValue(row, HEADER_ALIASES.lowStockThreshold.map(normalizeHeader))
      );
      const cost = parseOptionalMoney(getValue(row, HEADER_ALIASES.cost.map(normalizeHeader)));
      const priceFromCsv = parseOptionalMoney(getValue(row, HEADER_ALIASES.price.map(normalizeHeader)));

      // If cost is provided, derive sale price from it. Otherwise use CSV price.
      const unitCost = cost.value > 0 ? cost.value : 0;
      const price = cost.value > 0
        ? { value: calculateSalePrice(unitCost), needsReview: false }
        : priceFromCsv;

      if (!name) errors.push({ row: rowNumber, sku, message: 'Product name is required.' });
      if (!sku) errors.push({ row: rowNumber, sku, message: 'SKU is required.' });
      if (Number.isNaN(totalOrders)) {
        errors.push({ row: rowNumber, sku, message: 'Total Orders must be an integer.' });
      }
      if (Number.isNaN(lastPurchasedQuantity)) {
        errors.push({ row: rowNumber, sku, message: 'Last Purchased Qty must be an integer.' });
      }
      if (Number.isNaN(quantityOnHand)) {
        errors.push({ row: rowNumber, sku, message: 'Quantity On Hand must be an integer.' });
      }
      if (Number.isNaN(lowStockThreshold)) {
        errors.push({ row: rowNumber, sku, message: 'Low Stock Threshold must be an integer.' });
      }
      if (category) categoryNames.add(category);

      return {
        rowNumber,
        name,
        sku,
        category,
        totalOrders,
        lastPurchasedQuantity,
        quantityOnHand,
        lowStockThreshold,
        unitCost,
        price,
        lastPurchasedAt: parseSourceDate(
          getValue(row, HEADER_ALIASES.lastPurchased.map(normalizeHeader))
        )
      };
    });

    if (errors.length > 0) {
      return fail(400, {
        message: 'Fix the CSV errors and upload it again.',
        result: {
          totalRows: rows.length,
          imported: 0,
          categoriesCreated: 0,
          pricesNeedingReview: products.filter((p) => p.price.needsReview).length,
          inventoryRowsUpserted: 0,
          errors
        } satisfies ImportPreview
      });
    }

    const existingCategories = await supabase.from('categories').select('id, name');
    if (existingCategories.error) {
      return fail(400, { message: existingCategories.error.message });
    }

    const categoryMap = new Map(
      (existingCategories.data ?? []).map((category) => [category.name.toLowerCase(), category.id])
    );
    const missingCategories = [...categoryNames].filter(
      (category) => !categoryMap.has(category.toLowerCase())
    );

    if (missingCategories.length > 0) {
      const { error } = await supabase.from('categories').insert(
        missingCategories.map((name) => ({
          name,
          slug: slugify(name),
          display_order: 0
        }))
      );
      if (error) return fail(400, { message: error.message });

      const refreshed = await supabase.from('categories').select('id, name');
      if (refreshed.error) return fail(400, { message: refreshed.error.message });
      categoryMap.clear();
      for (const category of refreshed.data ?? []) {
        categoryMap.set(category.name.toLowerCase(), category.id);
      }
    }

    const now = new Date().toISOString();
    const productPayload = products.map((product) => ({
      sku: product.sku,
      name: product.name,
      category_id: product.category
        ? (categoryMap.get(product.category.toLowerCase()) ?? null)
        : null,
      unit_cost: product.unitCost,
      base_price: product.price.value,
      price_needs_review: product.price.needsReview,
      source_system: 'smile_inventory_csv',
      source_last_purchased_at: product.lastPurchasedAt,
      source_total_orders: product.totalOrders,
      source_last_purchased_quantity: product.lastPurchasedQuantity,
      imported_at: now,
      status: 'active'
    }));

    const upsertedProducts = await supabase
      .from('products')
      .upsert(productPayload, { onConflict: 'sku' })
      .select('id, sku');

    if (upsertedProducts.error) {
      return fail(400, { message: upsertedProducts.error.message });
    }

    const productIdBySku = new Map(
      (upsertedProducts.data ?? []).map((product) => [product.sku, product.id])
    );
    const inventoryPayload = products
      .map((product) => {
        const productId = productIdBySku.get(product.sku);
        if (!productId) return null;
        return {
          product_id: productId,
          quantity_on_hand: product.quantityOnHand ?? 0,
          low_stock_threshold: product.lowStockThreshold ?? 0
        };
      })
      .filter(
        (
          row
        ): row is { product_id: string; quantity_on_hand: number; low_stock_threshold: number } =>
          Boolean(row)
      );

    const inventoryUpsert = await supabase.from('inventory').upsert(inventoryPayload);
    if (inventoryUpsert.error) {
      return fail(400, { message: inventoryUpsert.error.message });
    }

    return {
      message: `Imported ${products.length} products.`,
      result: {
        totalRows: rows.length,
        imported: products.length,
        categoriesCreated: missingCategories.length,
        pricesNeedingReview: products.filter((p) => p.price.needsReview).length,
        inventoryRowsUpserted: inventoryPayload.length,
        errors: []
      } satisfies ImportPreview
    };
  }
};

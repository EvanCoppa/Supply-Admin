import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  balanceDue,
  calculateInvoiceTotals,
  createInvoiceWithLines,
  createPaymentIntent,
  defaultDueDate,
  lineTotal,
  loadInvoiceBundle,
  normalizeInvoiceLines,
  replaceInvoiceLines,
  roundMoney,
  statusAfterPayment
} from './invoices';
import type { Invoice } from '$lib/types/db';
import type { InvoiceLineInput } from '$lib/schemas/invoice';

describe('roundMoney', () => {
  it('rounds to two decimal places', () => {
    expect(roundMoney(1.005)).toBe(1.01);
    expect(roundMoney(1.004)).toBe(1.0);
    expect(roundMoney(123.456)).toBe(123.46);
  });

  it('handles zero', () => {
    expect(roundMoney(0)).toBe(0);
  });
});

describe('defaultDueDate', () => {
  const issuedAt = new Date('2026-01-01T00:00:00Z');

  it('returns same day for due_on_receipt', () => {
    expect(defaultDueDate('due_on_receipt', issuedAt).toISOString()).toBe(
      '2026-01-01T00:00:00.000Z'
    );
  });

  it('adds 15 days for net_15', () => {
    expect(defaultDueDate('net_15', issuedAt).toISOString()).toBe('2026-01-16T00:00:00.000Z');
  });

  it('adds 30 days for net_30', () => {
    expect(defaultDueDate('net_30', issuedAt).toISOString()).toBe('2026-01-31T00:00:00.000Z');
  });

  it('adds 60 days for net_60', () => {
    expect(defaultDueDate('net_60', issuedAt).toISOString()).toBe('2026-03-02T00:00:00.000Z');
  });

  it('defaults to net_30 when terms is null', () => {
    expect(defaultDueDate(null, issuedAt).toISOString()).toBe('2026-01-31T00:00:00.000Z');
  });

  it('returns same day for prepaid', () => {
    expect(defaultDueDate('prepaid', issuedAt).toISOString()).toBe('2026-01-01T00:00:00.000Z');
  });

  it('uses current time by default', () => {
    const result = defaultDueDate('due_on_receipt');
    expect(Number.isFinite(result.getTime())).toBe(true);
  });
});

describe('balanceDue', () => {
  it('subtracts amount_paid from total', () => {
    expect(balanceDue({ total: 100, amount_paid: 25 })).toBe(75);
  });

  it('floors at zero when overpaid', () => {
    expect(balanceDue({ total: 50, amount_paid: 100 })).toBe(0);
  });
});

describe('lineTotal', () => {
  it('computes quantity × price + tax − discount', () => {
    expect(lineTotal({ quantity: 2, unit_price: 10, discount: 1, tax: 0.5 })).toBe(19.5);
  });

  it('treats zero discount/tax as no-op', () => {
    expect(lineTotal({ quantity: 3, unit_price: 5, discount: 0, tax: 0 })).toBe(15);
  });

  it('floors at zero', () => {
    expect(lineTotal({ quantity: 1, unit_price: 5, discount: 100, tax: 0 })).toBe(0);
  });
});

describe('calculateInvoiceTotals', () => {
  const lines = [
    { quantity: 2, unit_price: 10, discount: 0, tax: 1 },
    { quantity: 1, unit_price: 5, discount: 1, tax: 0 }
  ];

  it('computes subtotal, tax, total', () => {
    const totals = calculateInvoiceTotals(lines, 2, 0);
    expect(totals.subtotal).toBe(25);
    expect(totals.tax).toBe(1);
    expect(totals.shipping).toBe(2);
    expect(totals.discount).toBe(0);
    expect(totals.total).toBe(27);
  });

  it('subtracts header discount and line-level discounts', () => {
    const totals = calculateInvoiceTotals(lines, 0, 5);
    // subtotal 25 - header discount 5 + tax 1 = 21; minus line discount 1 = 20
    expect(totals.discount).toBe(5);
    expect(totals.total).toBe(20);
  });

  it('floors total at zero', () => {
    const totals = calculateInvoiceTotals(lines, 0, 9999);
    expect(totals.total).toBe(0);
  });

  it('defaults shipping and header discount to zero', () => {
    const totals = calculateInvoiceTotals(lines);
    expect(totals.shipping).toBe(0);
    expect(totals.discount).toBe(0);
  });
});

describe('normalizeInvoiceLines', () => {
  it('rounds money fields and assigns display order', () => {
    const result = normalizeInvoiceLines([
      {
        description: '  Widget  ',
        quantity: 2.005,
        unit_price: 9.999,
        discount: 0,
        tax: 0,
        product_sku_snapshot: '  SKU1  '
      }
    ]);
    expect(result[0]!.description).toBe('Widget');
    expect(result[0]!.unit_price).toBe(10);
    expect(result[0]!.product_sku_snapshot).toBe('SKU1');
    expect(result[0]!.display_order).toBe(0);
  });

  it('coerces optional snapshot fields to null when blank', () => {
    const result = normalizeInvoiceLines([
      {
        description: 'X',
        quantity: 1,
        unit_price: 1,
        discount: 0,
        tax: 0,
        product_sku_snapshot: '   ',
        product_name_snapshot: ''
      }
    ]);
    expect(result[0]!.product_sku_snapshot).toBeNull();
    expect(result[0]!.product_name_snapshot).toBeNull();
  });
});

describe('statusAfterPayment', () => {
  it('marks paid when amount covers total', () => {
    expect(statusAfterPayment({ total: 100 }, 100)).toBe('paid');
    expect(statusAfterPayment({ total: 100 }, 150)).toBe('paid');
  });

  it('marks partially_paid when amount is less', () => {
    expect(statusAfterPayment({ total: 100 }, 50)).toBe('partially_paid');
  });
});

interface InsertChain {
  insert: ReturnType<typeof vi.fn>;
}

function buildSupabaseForInsert(
  insertResults: {
    selectSingle?: { data: unknown; error: unknown };
    rawError?: { message: string } | null;
  }[]
): {
  supabase: SupabaseClient;
  calls: { table: string; op: string; payload?: unknown }[];
} {
  const calls: { table: string; op: string; payload?: unknown }[] = [];
  let insertIdx = 0;
  const from = vi.fn((table: string) => {
    return {
      insert: (payload: unknown) => {
        const result = insertResults[insertIdx++] ?? { rawError: null };
        calls.push({ table, op: 'insert', payload });
        return {
          select: vi.fn().mockReturnValue({
            single: vi
              .fn()
              .mockResolvedValue(
                result.selectSingle ?? { data: null, error: result.rawError ?? null }
              )
          }),
          then: (resolve: (value: { error: unknown }) => unknown) =>
            resolve({ error: result.rawError ?? null })
        };
      },
      delete: () => ({
        eq: vi.fn().mockImplementation((_col: string, val: unknown) => {
          calls.push({ table, op: 'delete', payload: val });
          return Promise.resolve({ error: null });
        })
      })
    } as unknown as InsertChain;
  });
  return { supabase: { from } as unknown as SupabaseClient, calls };
}

describe('createInvoiceWithLines', () => {
  const sampleLines: InvoiceLineInput[] = [
    {
      description: 'Item',
      quantity: 2,
      unit_price: 10,
      discount: 0,
      tax: 0
    }
  ];

  it('inserts invoice + line items and returns invoice', async () => {
    const { supabase } = buildSupabaseForInsert([
      { selectSingle: { data: { id: 'inv-1', total: 20 }, error: null } },
      { rawError: null }
    ]);
    const result = await createInvoiceWithLines(supabase, { customer_id: 'cust-1' }, sampleLines);
    expect(result.id).toBe('inv-1');
  });

  it('throws when invoice insert fails', async () => {
    const { supabase } = buildSupabaseForInsert([
      { selectSingle: { data: null, error: { message: 'invoice insert failed' } } }
    ]);
    await expect(
      createInvoiceWithLines(supabase, { customer_id: 'cust-1' }, sampleLines)
    ).rejects.toThrow(/invoice insert failed/);
  });

  it('rolls back invoice when line insert fails', async () => {
    const { supabase, calls } = buildSupabaseForInsert([
      { selectSingle: { data: { id: 'inv-1' }, error: null } },
      { rawError: { message: 'line err' } }
    ]);
    await expect(
      createInvoiceWithLines(supabase, { customer_id: 'cust-1' }, sampleLines)
    ).rejects.toThrow(/line err/);
    expect(calls.some((c) => c.op === 'delete' && c.payload === 'inv-1')).toBe(true);
  });
});

describe('replaceInvoiceLines', () => {
  function buildMock(
    deleteError: { message: string } | null,
    insertError: { message: string } | null,
    updateError: { message: string } | null
  ): SupabaseClient {
    const tableHandler = (table: string) => {
      if (table === 'invoice_line_items') {
        return {
          delete: () => ({
            eq: vi.fn().mockResolvedValue({ error: deleteError })
          }),
          insert: vi.fn().mockResolvedValue({ error: insertError })
        };
      }
      if (table === 'invoices') {
        return {
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: updateError })
          })
        };
      }
      return {};
    };
    return { from: vi.fn().mockImplementation(tableHandler) } as unknown as SupabaseClient;
  }

  const lines: InvoiceLineInput[] = [
    { description: 'A', quantity: 1, unit_price: 5, discount: 0, tax: 0 }
  ];

  it('returns totals on success', async () => {
    const supabase = buildMock(null, null, null);
    const totals = await replaceInvoiceLines(supabase, 'inv-1', lines, { shipping: 1 });
    expect(totals.total).toBe(6);
  });

  it('throws when delete fails', async () => {
    const supabase = buildMock({ message: 'del fail' }, null, null);
    await expect(replaceInvoiceLines(supabase, 'inv-1', lines, {})).rejects.toThrow(/del fail/);
  });

  it('throws when insert fails', async () => {
    const supabase = buildMock(null, { message: 'ins fail' }, null);
    await expect(replaceInvoiceLines(supabase, 'inv-1', lines, {})).rejects.toThrow(/ins fail/);
  });

  it('throws when update fails', async () => {
    const supabase = buildMock(null, null, { message: 'upd fail' });
    await expect(replaceInvoiceLines(supabase, 'inv-1', lines, {})).rejects.toThrow(/upd fail/);
  });
});

describe('loadInvoiceBundle', () => {
  type QueryResult = { data: unknown; error: { message: string } | null };

  function build(
    invoiceResult: QueryResult,
    linesResult: QueryResult,
    emailsResult: QueryResult,
    paymentsResult: QueryResult,
    expectCustomerFilter = false
  ): SupabaseClient {
    const from = vi.fn((table: string) => {
      if (table === 'invoices') {
        const maybeSingle = vi.fn().mockResolvedValue(invoiceResult);
        const innerEq2 = { maybeSingle };
        const innerEq1 = expectCustomerFilter
          ? { eq: vi.fn().mockReturnValue(innerEq2) }
          : { maybeSingle, eq: vi.fn().mockReturnValue(innerEq2) };
        return {
          select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue(innerEq1) })
        };
      }
      const order = vi
        .fn()
        .mockResolvedValue(
          table === 'invoice_line_items'
            ? linesResult
            : table === 'invoice_email_events'
              ? emailsResult
              : paymentsResult
        );
      const eq = vi.fn().mockReturnValue({ order });
      return { select: vi.fn().mockReturnValue({ eq }) };
    });
    return { from } as unknown as SupabaseClient;
  }

  it('returns null when invoice does not exist', async () => {
    const supabase = build(
      { data: null, error: null },
      { data: [], error: null },
      { data: [], error: null },
      { data: [], error: null }
    );
    const result = await loadInvoiceBundle(supabase, 'inv-1');
    expect(result).toBeNull();
  });

  it('throws when invoice query errors', async () => {
    const supabase = build(
      { data: null, error: { message: 'db err' } },
      { data: [], error: null },
      { data: [], error: null },
      { data: [], error: null }
    );
    await expect(loadInvoiceBundle(supabase, 'inv-1')).rejects.toThrow(/db err/);
  });

  it('returns the bundled invoice, lines, emails, and intents', async () => {
    const supabase = build(
      { data: { id: 'inv-1' }, error: null },
      { data: [{ id: 'line-1' }], error: null },
      { data: [{ id: 'evt-1' }], error: null },
      { data: [{ id: 'pi-1' }], error: null }
    );
    const result = await loadInvoiceBundle(supabase, 'inv-1');
    expect(result?.invoice.id).toBe('inv-1');
    expect(result?.lines).toHaveLength(1);
    expect(result?.emailEvents).toHaveLength(1);
    expect(result?.paymentIntents).toHaveLength(1);
  });
});

describe('createPaymentIntent', () => {
  const invoice = {
    id: 'inv-1',
    customer_id: 'cust-1',
    total: 100,
    amount_paid: 0,
    status: 'issued'
  } as unknown as Invoice;

  function makeSupabase(
    insertResult: { data: unknown; error: unknown },
    updateError: { message: string } | null = null
  ): SupabaseClient {
    const single = vi.fn().mockResolvedValue(insertResult);
    const select = vi.fn().mockReturnValue({ single });
    const insert = vi.fn().mockReturnValue({ select });
    const update = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: updateError })
    });
    const from = vi.fn().mockImplementation(() => ({ insert, update }));
    return { from } as unknown as SupabaseClient;
  }

  it('throws when nothing is due', async () => {
    await expect(
      createPaymentIntent(
        makeSupabase({ data: null, error: null }),
        { ...invoice, total: 50, amount_paid: 50 },
        'http://app'
      )
    ).rejects.toThrow(/balance due/);
  });

  it('throws for void/refunded invoices', async () => {
    await expect(
      createPaymentIntent(
        makeSupabase({ data: null, error: null }),
        { ...invoice, status: 'void' },
        'http://app'
      )
    ).rejects.toThrow(/cannot be paid/);
  });

  it('throws if insert fails', async () => {
    const supabase = makeSupabase({ data: null, error: { message: 'insert nope' } });
    await expect(createPaymentIntent(supabase, invoice, 'http://app')).rejects.toThrow(
      /insert nope/
    );
  });

  it('throws if update fails', async () => {
    const supabase = makeSupabase(
      { data: { id: 'pi-1' }, error: null },
      { message: 'update nope' }
    );
    await expect(createPaymentIntent(supabase, invoice, 'http://app')).rejects.toThrow(
      /update nope/
    );
  });

  it('returns the intent on success and trims trailing slash from app URL', async () => {
    const supabase = makeSupabase({ data: { id: 'pi-1' }, error: null });
    const result = await createPaymentIntent(supabase, invoice, 'http://app/');
    expect((result as { id: string }).id).toBe('pi-1');
  });
});

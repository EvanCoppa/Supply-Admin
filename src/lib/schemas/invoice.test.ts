import { describe, expect, it } from 'vitest';
import {
  INVOICE_STATUSES,
  INVOICE_TERMS,
  invoiceCreateSchema,
  invoiceFromOrderSchema,
  invoiceLineInputSchema,
  invoicePaymentRecordSchema,
  invoiceSendSchema,
  invoiceStatusSchema,
  invoiceUpdateSchema,
  parseInvoiceLineItems
} from './invoice';

const validLine = {
  description: 'Widget',
  quantity: 2,
  unit_price: 10
};

describe('invoiceLineInputSchema', () => {
  it('applies defaults for discount and tax', () => {
    const r = invoiceLineInputSchema.parse(validLine);
    expect(r.discount).toBe(0);
    expect(r.tax).toBe(0);
  });

  it('requires a positive quantity', () => {
    expect(invoiceLineInputSchema.safeParse({ ...validLine, quantity: 0 }).success).toBe(false);
    expect(invoiceLineInputSchema.safeParse({ ...validLine, quantity: -1 }).success).toBe(false);
  });

  it('rejects negative money fields', () => {
    expect(invoiceLineInputSchema.safeParse({ ...validLine, unit_price: -1 }).success).toBe(false);
    expect(invoiceLineInputSchema.safeParse({ ...validLine, discount: -1 }).success).toBe(false);
    expect(invoiceLineInputSchema.safeParse({ ...validLine, tax: -1 }).success).toBe(false);
  });

  it('rejects empty description', () => {
    expect(invoiceLineInputSchema.safeParse({ ...validLine, description: '' }).success).toBe(false);
  });
});

describe('invoiceCreateSchema', () => {
  const valid = {
    customer_id: 'cust-1',
    line_items_json: '[]'
  };

  it('applies term default', () => {
    expect(invoiceCreateSchema.parse(valid).terms).toBe('net_30');
  });

  it('rejects missing customer_id', () => {
    expect(invoiceCreateSchema.safeParse({ ...valid, customer_id: '' }).success).toBe(false);
  });

  it('parses checkbox-style issue_now', () => {
    expect(invoiceCreateSchema.parse({ ...valid, issue_now: 'on' }).issue_now).toBe(true);
    expect(invoiceCreateSchema.parse({ ...valid, issue_now: 'true' }).issue_now).toBe(true);
    expect(invoiceCreateSchema.parse({ ...valid }).issue_now).toBe(false);
  });

  it('rejects invalid date', () => {
    expect(invoiceCreateSchema.safeParse({ ...valid, due_at: 'not-a-date' }).success).toBe(false);
  });

  it('accepts iso date strings', () => {
    expect(invoiceCreateSchema.parse({ ...valid, due_at: '2026-01-01' }).due_at).toBe('2026-01-01');
  });

  it('coerces blank numeric inputs to 0', () => {
    const r = invoiceCreateSchema.parse({ ...valid, shipping: '', discount: '' });
    expect(r.shipping).toBe(0);
    expect(r.discount).toBe(0);
  });

  it('rejects bad email', () => {
    expect(invoiceCreateSchema.safeParse({ ...valid, billing_email: 'no-at' }).success).toBe(false);
  });
});

describe('invoiceUpdateSchema', () => {
  it('omits customer_id from required fields', () => {
    const r = invoiceUpdateSchema.parse({ line_items_json: '[]' });
    expect((r as { customer_id?: string }).customer_id).toBeUndefined();
  });

  it('accepts an optional status', () => {
    expect(invoiceUpdateSchema.parse({ line_items_json: '[]', status: 'paid' }).status).toBe(
      'paid'
    );
  });
});

describe('invoiceFromOrderSchema', () => {
  const valid = { order_id: 'order-1', due_days: 30 };

  it('rejects due_days out of range', () => {
    expect(invoiceFromOrderSchema.safeParse({ ...valid, due_days: -1 }).success).toBe(false);
    expect(invoiceFromOrderSchema.safeParse({ ...valid, due_days: 366 }).success).toBe(false);
  });

  it('defaults issue_now to true when undefined', () => {
    expect(invoiceFromOrderSchema.parse(valid).issue_now).toBe(true);
  });

  it('treats explicit "false" string as false', () => {
    expect(invoiceFromOrderSchema.parse({ ...valid, issue_now: 'false' }).issue_now).toBe(false);
  });
});

describe('invoiceStatusSchema', () => {
  for (const status of INVOICE_STATUSES) {
    it(`accepts ${status}`, () => {
      expect(invoiceStatusSchema.parse({ status }).status).toBe(status);
    });
  }
});

describe('invoicePaymentRecordSchema', () => {
  it('rejects non-positive amounts', () => {
    expect(invoicePaymentRecordSchema.safeParse({ amount: 0 }).success).toBe(false);
    expect(invoicePaymentRecordSchema.safeParse({ amount: -5 }).success).toBe(false);
  });

  it('accepts positive amounts', () => {
    expect(invoicePaymentRecordSchema.parse({ amount: 12.5 }).amount).toBe(12.5);
  });
});

describe('invoiceSendSchema', () => {
  it('parses reminder flag', () => {
    expect(invoiceSendSchema.parse({ reminder: 'on' }).reminder).toBe(true);
    expect(invoiceSendSchema.parse({}).reminder).toBe(false);
  });

  it('validates recipient email when provided', () => {
    expect(invoiceSendSchema.parse({ recipient: 'a@b.co' }).recipient).toBe('a@b.co');
    expect(invoiceSendSchema.safeParse({ recipient: 'nope' }).success).toBe(false);
  });
});

describe('parseInvoiceLineItems', () => {
  it('parses a valid JSON array', () => {
    const items = parseInvoiceLineItems(JSON.stringify([validLine]));
    expect(items).toHaveLength(1);
    expect(items[0]!.description).toBe('Widget');
  });

  it('throws on malformed JSON', () => {
    expect(() => parseInvoiceLineItems('not json')).toThrow(/valid JSON/);
  });

  it('throws when array is empty', () => {
    expect(() => parseInvoiceLineItems('[]')).toThrow(/at least one/);
  });

  it('throws first validation error message', () => {
    expect(() =>
      parseInvoiceLineItems(JSON.stringify([{ description: '', quantity: 1, unit_price: 1 }]))
    ).toThrow(/description/);
  });
});

describe('INVOICE_TERMS', () => {
  it('contains expected values', () => {
    expect(INVOICE_TERMS).toContain('net_30');
    expect(INVOICE_TERMS).toContain('prepaid');
  });
});

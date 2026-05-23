import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

vi.mock('$env/dynamic/private', () => ({
  env: {
    RESEND_API_KEY: 'rk_test',
    INVOICE_FROM_EMAIL: 'invoices@example.com'
  }
}));

import { sendInvoiceEmail } from './invoice-email';

type FetchMock = ReturnType<typeof vi.fn>;

function makeFetchMock(response: { ok: boolean; body?: unknown; status?: number }): FetchMock {
  return vi.fn(async () => ({
    ok: response.ok,
    status: response.status ?? (response.ok ? 200 : 400),
    json: async () => response.body ?? {}
  })) as FetchMock;
}

function makeSupabase(): {
  supabase: SupabaseClient;
  inserts: { table: string; row: unknown }[];
  updates: { table: string; patch: unknown; id: unknown }[];
} {
  const inserts: { table: string; row: unknown }[] = [];
  const updates: { table: string; patch: unknown; id: unknown }[] = [];
  const from = vi.fn((table: string) => ({
    insert: vi.fn(async (row: unknown) => {
      inserts.push({ table, row });
      return { error: null };
    }),
    update: vi.fn((patch: unknown) => ({
      eq: vi.fn(async (_col: string, val: unknown) => {
        updates.push({ table, patch, id: val });
        return { error: null };
      })
    }))
  }));
  return { supabase: { from } as unknown as SupabaseClient, inserts, updates };
}

const baseInvoice = {
  id: 'inv-1',
  customer_id: 'cust-1',
  invoice_number: 'INV-001',
  total: 100,
  amount_paid: 25,
  due_at: '2026-01-15T00:00:00Z',
  customer_memo: 'Thanks for your business <3',
  customer: { business_name: 'Acme', email: 'billing@acme.example' }
};

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe('sendInvoiceEmail', () => {
  it('sends a "send" email and updates sent_at on success', async () => {
    globalThis.fetch = makeFetchMock({ ok: true, body: { id: 'resend-1' } });
    const { supabase, inserts, updates } = makeSupabase();
    const result = await sendInvoiceEmail(supabase, {
      invoice: baseInvoice as never,
      recipient: 'to@example.com',
      kind: 'send',
      portalUrl: 'http://app/portal'
    });

    expect(result.ok).toBe(true);
    const sentEvent = inserts.find((i) => i.table === 'invoice_email_events');
    expect((sentEvent?.row as { status: string }).status).toBe('sent');
    expect((sentEvent?.row as { provider_message_id: string }).provider_message_id).toBe(
      'resend-1'
    );
    expect((sentEvent?.row as { subject: string }).subject).toBe('Invoice: INV-001');
    const invoiceUpdate = updates.find((u) => u.table === 'invoices');
    expect(invoiceUpdate?.patch).toHaveProperty('sent_at');
  });

  it('uses "Reminder:" subject and updates last_reminded_at for reminder kind', async () => {
    globalThis.fetch = makeFetchMock({ ok: true, body: { id: 'resend-2' } });
    const { supabase, inserts, updates } = makeSupabase();
    await sendInvoiceEmail(supabase, {
      invoice: baseInvoice as never,
      recipient: 'to@example.com',
      kind: 'reminder',
      portalUrl: 'http://app/portal'
    });
    const evt = inserts.find((i) => i.table === 'invoice_email_events');
    expect((evt?.row as { subject: string }).subject).toBe('Reminder: INV-001');
    const invoiceUpdate = updates.find((u) => u.table === 'invoices');
    expect(invoiceUpdate?.patch).toHaveProperty('last_reminded_at');
  });

  it('records a failed event and does not update the invoice when Resend returns an error', async () => {
    globalThis.fetch = makeFetchMock({
      ok: false,
      status: 422,
      body: { message: 'invalid recipient' }
    });
    const { supabase, inserts, updates } = makeSupabase();
    const result = await sendInvoiceEmail(supabase, {
      invoice: baseInvoice as never,
      recipient: 'to@example.com',
      kind: 'send',
      portalUrl: 'http://app/portal'
    });
    expect(result.ok).toBe(false);
    expect(result.message).toBe('invalid recipient');
    const evt = inserts.find((i) => i.table === 'invoice_email_events');
    expect((evt?.row as { status: string }).status).toBe('failed');
    expect(updates.length).toBe(0);
  });

  it('records a failed event when fetch throws', async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error('network down');
    });
    const { supabase, inserts } = makeSupabase();
    const result = await sendInvoiceEmail(supabase, {
      invoice: baseInvoice as never,
      recipient: 'to@example.com',
      kind: 'send',
      portalUrl: 'http://app/portal'
    });
    expect(result.ok).toBe(false);
    expect(result.message).toBe('network down');
    const evt = inserts.find((i) => i.table === 'invoice_email_events');
    expect((evt?.row as { error_message: string }).error_message).toBe('network down');
  });

  it('handles missing customer_memo and missing due_at gracefully', async () => {
    globalThis.fetch = makeFetchMock({ ok: true, body: { id: 'r' } });
    const { supabase } = makeSupabase();
    const result = await sendInvoiceEmail(supabase, {
      invoice: { ...baseInvoice, customer_memo: null, due_at: null } as never,
      recipient: 'to@example.com',
      kind: 'send',
      portalUrl: 'http://app/portal'
    });
    expect(result.ok).toBe(true);

    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    const body = JSON.parse((fetchMock.mock.calls[0]![1] as { body: string }).body);
    expect(body.text).toContain('on receipt');
    expect(body.html).not.toContain('customer_memo');
  });

  it('escapes HTML in customer memo and portal URL', async () => {
    globalThis.fetch = makeFetchMock({ ok: true, body: { id: 'r' } });
    const { supabase } = makeSupabase();
    await sendInvoiceEmail(supabase, {
      invoice: { ...baseInvoice, customer_memo: '<script>alert(1)</script>' } as never,
      recipient: 'to@example.com',
      kind: 'send',
      portalUrl: 'http://app/portal?x="quoted"'
    });
    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    const body = JSON.parse((fetchMock.mock.calls[0]![1] as { body: string }).body);
    expect(body.html).not.toContain('<script>');
    expect(body.html).toContain('&lt;script&gt;');
    expect(body.html).toContain('&quot;quoted&quot;');
  });

  it('falls back to body.error or default message when message is missing on failure', async () => {
    globalThis.fetch = makeFetchMock({ ok: false, body: { error: 'rate_limited' } });
    const { supabase } = makeSupabase();
    const result = await sendInvoiceEmail(supabase, {
      invoice: baseInvoice as never,
      recipient: 'to@example.com',
      kind: 'send',
      portalUrl: 'http://app/portal'
    });
    expect(result.message).toBe('rate_limited');
  });
});

describe('sendInvoiceEmail with missing env config', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('records a skipped event when RESEND_API_KEY is missing', async () => {
    vi.doMock('$env/dynamic/private', () => ({ env: {} }));
    const { sendInvoiceEmail: send } = await import('./invoice-email');
    const { supabase, inserts } = makeSupabase();
    const result = await send(supabase, {
      invoice: baseInvoice as never,
      recipient: 'to@example.com',
      kind: 'send',
      portalUrl: 'http://app/portal'
    });
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/not configured/);
    const evt = inserts.find((i) => i.table === 'invoice_email_events');
    expect((evt?.row as { status: string }).status).toBe('skipped');
  });
});

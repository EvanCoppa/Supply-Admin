import type { SupabaseClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/private';
import type { Invoice } from '$lib/types/db';
import { balanceDue } from './invoices';

type EmailKind = 'send' | 'reminder';

interface SendInvoiceEmailInput {
  invoice: Invoice & { customer?: { business_name: string; email: string | null } | null };
  recipient: string;
  kind: EmailKind;
  portalUrl: string;
}

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

function invoiceSubject(invoice: Invoice, kind: EmailKind) {
  const prefix = kind === 'reminder' ? 'Reminder' : 'Invoice';
  return `${prefix}: ${invoice.invoice_number}`;
}

function renderInvoiceText(input: SendInvoiceEmailInput) {
  const name = input.invoice.customer?.business_name ?? 'Customer';
  const due = input.invoice.due_at
    ? new Date(input.invoice.due_at).toLocaleDateString('en-US')
    : 'on receipt';
  return [
    `${name},`,
    '',
    `${invoiceSubject(input.invoice, input.kind)} is ready in your Supply portal.`,
    `Amount due: ${currency.format(balanceDue(input.invoice))}`,
    `Due date: ${due}`,
    '',
    `View and pay: ${input.portalUrl}`,
    '',
    input.invoice.customer_memo ?? ''
  ]
    .filter((line, index, lines) => line !== '' || lines[index - 1] !== '')
    .join('\n');
}

function renderInvoiceHtml(input: SendInvoiceEmailInput) {
  const amount = currency.format(balanceDue(input.invoice));
  const due = input.invoice.due_at
    ? new Date(input.invoice.due_at).toLocaleDateString('en-US')
    : 'on receipt';
  const memo = input.invoice.customer_memo
    ? `<p style="margin:16px 0 0;color:#334155">${escapeHtml(input.invoice.customer_memo)}</p>`
    : '';
  return `
    <div style="font-family:Inter,Arial,sans-serif;color:#0f172a;line-height:1.5">
      <h1 style="font-size:20px;margin:0 0 12px">${escapeHtml(invoiceSubject(input.invoice, input.kind))}</h1>
      <p style="margin:0 0 12px">Your invoice is ready in the Supply portal.</p>
      <p style="margin:0"><strong>Amount due:</strong> ${amount}</p>
      <p style="margin:0 0 20px"><strong>Due date:</strong> ${escapeHtml(due)}</p>
      <p style="margin:0 0 20px">
        <a href="${escapeHtml(input.portalUrl)}" style="background:#0f172a;color:white;padding:10px 14px;text-decoration:none;border-radius:6px;display:inline-block">
          View and pay invoice
        </a>
      </p>
      ${memo}
    </div>
  `;
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export async function sendInvoiceEmail(supabase: SupabaseClient, input: SendInvoiceEmailInput) {
  const subject = invoiceSubject(input.invoice, input.kind);
  const baseEvent = {
    invoice_id: input.invoice.id,
    customer_id: input.invoice.customer_id,
    type: input.kind,
    recipient: input.recipient,
    subject,
    provider: 'resend'
  };

  if (!env.RESEND_API_KEY || !env.INVOICE_FROM_EMAIL) {
    await supabase.from('invoice_email_events').insert({
      ...baseEvent,
      status: 'skipped',
      error_message: 'Resend is not configured.'
    });
    return { ok: false, message: 'Resend is not configured.' };
  }

  let providerMessageId: string | null = null;
  let errorMessage: string | null = null;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: env.INVOICE_FROM_EMAIL,
        to: input.recipient,
        subject,
        text: renderInvoiceText(input),
        html: renderInvoiceHtml(input)
      })
    });
    const body = (await res.json().catch(() => ({}))) as {
      id?: string;
      message?: string;
      error?: string;
    };
    providerMessageId = body.id ?? null;
    if (!res.ok) errorMessage = body.message ?? body.error ?? 'Resend send failed.';
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : 'Resend send failed.';
  }

  const sent = !errorMessage;
  await supabase.from('invoice_email_events').insert({
    ...baseEvent,
    status: sent ? 'sent' : 'failed',
    provider_message_id: providerMessageId,
    error_message: errorMessage
  });

  if (sent) {
    const patch =
      input.kind === 'reminder'
        ? { last_reminded_at: new Date().toISOString() }
        : { sent_at: new Date().toISOString() };
    await supabase.from('invoices').update(patch).eq('id', input.invoice.id);
  }

  return sent
    ? { ok: true, message: 'Invoice email sent.' }
    : { ok: false, message: errorMessage ?? 'Send failed.' };
}

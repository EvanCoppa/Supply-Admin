import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { loadInvoiceBundle } from '$lib/server/invoices';
import { invoicePdfFilename, renderInvoicePdf } from '$lib/server/invoice-pdf';

export const GET: RequestHandler = async ({ params, locals: { supabase } }) => {
  const bundle = await loadInvoiceBundle(supabase, params.id);
  if (!bundle) throw error(404, 'Invoice not found');

  const pdf = await renderInvoicePdf(bundle);
  return new Response(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${invoicePdfFilename(bundle.invoice)}"`,
      'Cache-Control': 'private, no-store'
    }
  });
};

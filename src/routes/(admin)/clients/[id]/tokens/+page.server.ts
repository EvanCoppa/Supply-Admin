import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { parseForm, tokenCreateSchema } from '$lib/schemas';
import { env } from '$env/dynamic/private';

export const load: PageServerLoad = async ({ params, locals: { supabase } }) => {
  const { data } = await supabase
    .from('api_tokens')
    .select('id, label, last_used_at, revoked_at, created_at')
    .eq('customer_id', params.id)
    .order('created_at', { ascending: false });
  return { tokens: data ?? [] };
};

function generateTokenString(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return (
    'supply_' +
    Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
  );
}

async function hashToken(raw: string): Promise<string> {
  const encoded = new TextEncoder().encode(raw);
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export const actions: Actions = {
  create: async ({ params, request, locals: { supabase } }) => {
    const form = await request.formData();
    const parsed = parseForm(tokenCreateSchema, form);
    if (!parsed.success) {
      return fail(400, { message: parsed.message, fieldErrors: parsed.fieldErrors });
    }
    const plaintext = generateTokenString();
    const token_hash = await hashToken(plaintext);

    const { error } = await supabase
      .from('api_tokens')
      .insert({ customer_id: params.id, token_hash, label: parsed.data.label });
    if (error) return fail(400, { message: error.message, fieldErrors: {} });

    return { created: { plaintext, label: parsed.data.label } };
  },

  revoke: async ({ params, request, locals: { supabase } }) => {
    const form = await request.formData();
    const id = String(form.get('id') ?? '');
    const { error } = await supabase
      .from('api_tokens')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', id)
      .eq('customer_id', params.id);
    if (error) return fail(400, { message: error.message, fieldErrors: {} });
    return { saved: true };
  },

  pushToGuaranteeth: async ({ params, request, locals: { supabase } }) => {
    const form = await request.formData();
    const orgId = String(form.get('org_id') ?? '').trim();
    const plaintext = String(form.get('plaintext') ?? '').trim();

    if (!orgId || !plaintext) {
      return fail(400, { message: 'Org ID and token are required.', fieldErrors: {} });
    }

    const guaranteethUrl = env.GUARANTEETH_API_URL ?? 'https://preview.yessmile.ai/';
    const secret = env.SUPPLY_ADMIN_SYNC_SECRET;
    if (!secret) {
      return fail(500, {
        message: 'SUPPLY_ADMIN_SYNC_SECRET must be set.',
        fieldErrors: {}
      });
    }

    const { data: customer, error: cErr } = await supabase
      .from('customers')
      .select('external_code')
      .eq('id', params.id)
      .maybeSingle();
    if (cErr || !customer) {
      return fail(400, { message: 'Customer lookup failed.', fieldErrors: {} });
    }
    if (!customer.external_code) {
      return fail(400, {
        message: 'Set an External code on the customer profile before pushing.',
        fieldErrors: {}
      });
    }

    try {
      const resp = await fetch(
        `${guaranteethUrl.replace(/\/$/, '')}/api/admin/link-supply-account`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${secret}`
          },
          body: JSON.stringify({
            orgId: Number.isNaN(Number(orgId)) ? orgId : Number(orgId),
            supplyCustomerCode: customer.external_code,
            supplyApiToken: plaintext
          })
        }
      );

      if (!resp.ok) {
        const body = await resp.text();
        return fail(resp.status, {
          message: `Guaranteeth rejected push (${resp.status}): ${body.slice(0, 200)}`,
          fieldErrors: {}
        });
      }
      return { pushed: { orgId } };
    } catch (e) {
      return fail(500, {
        message: `Failed to reach Guaranteeth: ${(e as Error).message}`,
        fieldErrors: {}
      });
    }
  }
};

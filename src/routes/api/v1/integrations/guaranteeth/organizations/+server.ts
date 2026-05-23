import { json, error } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';
import { createSupabaseAdminClient } from '$lib/supabase.server';
import { generateSupplyToken, hashSupplyToken, readBearerToken } from '$lib/server/supply-auth';
import { deriveExternalCode } from '$lib/schemas/customer';

type RegistrationPayload = {
  orgId?: number | string;
  name?: string;
  email?: string | null;
  phone?: string | null;
  address?: unknown;
  metadata?: Record<string, unknown>;
  rotateToken?: boolean;
};

function requireIntegrationSecret(request: Request) {
  const expected = env['GUARANTEETH_INTEGRATION_SECRET'];
  if (!expected) throw error(500, 'GUARANTEETH_INTEGRATION_SECRET must be set');
  const actual = readBearerToken(request);
  if (actual !== expected) throw error(401, 'Invalid integration secret');
}

function cleanOptionalString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

export const POST: RequestHandler = async ({ request }) => {
  requireIntegrationSecret(request);

  let body: RegistrationPayload;
  try {
    body = await request.json();
  } catch {
    throw error(400, 'Invalid JSON');
  }

  const orgId = body.orgId === undefined || body.orgId === null ? '' : String(body.orgId).trim();
  const name = cleanOptionalString(body.name);
  if (!orgId || !name) {
    throw error(400, 'orgId and name are required');
  }

  const supabase = createSupabaseAdminClient();

  const { data: existingLink, error: linkError } = await supabase
    .from('guaranteeth_organization_links')
    .select('customer_id')
    .eq('guaranteeth_org_id', orgId)
    .maybeSingle();

  if (linkError) {
    console.error('[guaranteeth-register] link lookup failed', linkError);
    throw error(500, 'Link lookup failed');
  }

  let customerId = existingLink?.customer_id as string | undefined;
  const externalCode = `gs_${orgId}`.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64);
  const customerPayload = {
    business_name: name,
    email: cleanOptionalString(body.email),
    phone: cleanOptionalString(body.phone),
    external_code: externalCode.length >= 3 ? externalCode : deriveExternalCode(name),
    catalog_access_mode: 'allowlist',
    status: 'active',
    lifecycle_stage: 'active'
  };

  if (customerId) {
    const { error: customerUpdateError } = await supabase
      .from('customers')
      .update(customerPayload)
      .eq('id', customerId);
    if (customerUpdateError) {
      console.error('[guaranteeth-register] customer update failed', customerUpdateError);
      throw error(500, 'Customer update failed');
    }
  } else {
    const { data: customer, error: customerCreateError } = await supabase
      .from('customers')
      .insert(customerPayload)
      .select('id')
      .single();
    if (customerCreateError || !customer) {
      console.error('[guaranteeth-register] customer create failed', customerCreateError);
      throw error(500, customerCreateError?.message ?? 'Customer create failed');
    }
    customerId = customer.id;
  }

  const metadata = {
    ...(body.metadata ?? {}),
    ...(body.address !== undefined ? { address: body.address } : {})
  };

  const { error: upsertLinkError } = await supabase.from('guaranteeth_organization_links').upsert(
    {
      customer_id: customerId,
      guaranteeth_org_id: orgId,
      org_name: name,
      org_email: cleanOptionalString(body.email),
      org_phone: cleanOptionalString(body.phone),
      metadata,
      updated_at: new Date().toISOString()
    },
    { onConflict: 'guaranteeth_org_id' }
  );

  if (upsertLinkError) {
    console.error('[guaranteeth-register] link upsert failed', upsertLinkError);
    throw error(500, 'Link upsert failed');
  }

  let supplyApiToken: string | null = null;
  const { data: activeTokens, error: tokenLookupError } = await supabase
    .from('api_tokens')
    .select('id')
    .eq('customer_id', customerId)
    .is('revoked_at', null)
    .limit(1);

  if (tokenLookupError) {
    console.error('[guaranteeth-register] token lookup failed', tokenLookupError);
    throw error(500, 'Token lookup failed');
  }

  if (body.rotateToken && activeTokens?.length) {
    const { error: revokeError } = await supabase
      .from('api_tokens')
      .update({ revoked_at: new Date().toISOString() })
      .eq('customer_id', customerId)
      .is('revoked_at', null);
    if (revokeError) {
      console.error('[guaranteeth-register] token revoke failed', revokeError);
      throw error(500, 'Token rotation failed');
    }
  }

  if (body.rotateToken || !activeTokens?.length) {
    supplyApiToken = generateSupplyToken();
    const token_hash = await hashSupplyToken(supplyApiToken);
    const { error: tokenCreateError } = await supabase.from('api_tokens').insert({
      customer_id: customerId,
      token_hash,
      label: 'Guaranteed Slides'
    });
    if (tokenCreateError) {
      console.error('[guaranteeth-register] token create failed', tokenCreateError);
      throw error(500, 'Token create failed');
    }
  }

  return json({
    customerId,
    supplyCustomerCode: customerPayload.external_code,
    supplyApiToken,
    tokenReturned: !!supplyApiToken
  });
};

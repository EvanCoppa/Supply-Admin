import { error } from '@sveltejs/kit';
import type { SupabaseClient } from '@supabase/supabase-js';

export function generateSupplyToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return (
    'supply_' +
    Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
  );
}

export async function hashSupplyToken(raw: string): Promise<string> {
  const encoded = new TextEncoder().encode(raw);
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function readBearerToken(request: Request): string {
  const auth = request.headers.get('authorization') ?? '';
  const [scheme, token] = auth.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    throw error(401, 'Missing bearer token');
  }
  return token;
}

export async function requireSupplyCustomer(
  request: Request,
  supabase: SupabaseClient
): Promise<{ customerId: string; tokenId: string }> {
  const token = readBearerToken(request);
  if (!token.startsWith('supply_')) {
    throw error(401, 'Invalid token');
  }

  const token_hash = await hashSupplyToken(token);
  const { data, error: tokenError } = await supabase
    .from('api_tokens')
    .select('id, customer_id, revoked_at')
    .eq('token_hash', token_hash)
    .maybeSingle();

  if (tokenError) {
    console.error('[supply-api] token lookup failed', tokenError);
    throw error(500, 'Token lookup failed');
  }
  if (!data || data.revoked_at) {
    throw error(401, 'Invalid token');
  }

  await supabase
    .from('api_tokens')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', data.id);

  return { customerId: data.customer_id, tokenId: data.id };
}

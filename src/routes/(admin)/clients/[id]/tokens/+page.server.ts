import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

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
    'sk_' +
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
    const label = String(form.get('label') ?? '').trim() || null;
    const plaintext = generateTokenString();
    const token_hash = await hashToken(plaintext);

    const { error } = await supabase
      .from('api_tokens')
      .insert({ customer_id: params.id, token_hash, label });
    if (error) return fail(400, { message: error.message });

    return { created: { plaintext, label } };
  },

  revoke: async ({ params, request, locals: { supabase } }) => {
    const form = await request.formData();
    const id = String(form.get('id') ?? '');
    const { error } = await supabase
      .from('api_tokens')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', id)
      .eq('customer_id', params.id);
    if (error) return fail(400, { message: error.message });
    return { saved: true };
  }
};

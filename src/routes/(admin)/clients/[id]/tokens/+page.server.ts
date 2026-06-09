import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { parseForm, tokenCreateSchema } from '$lib/schemas';
import { createSupabaseAdminClient } from '$lib/supabase.server';
import { env } from '$env/dynamic/private';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LOGIN_ROLES = ['owner', 'buyer', 'viewer'] as const;
type LoginRole = (typeof LOGIN_ROLES)[number];

export interface ShopLogin {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  role: LoginRole;
  is_primary: boolean;
  deactivated_at: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  email_confirmed: boolean;
}

export const load: PageServerLoad = async ({ params, locals: { supabase } }) => {
  const admin = createSupabaseAdminClient();

  const [tokensRes, profilesRes] = await Promise.all([
    supabase
      .from('api_tokens')
      .select('id, label, last_used_at, revoked_at, created_at')
      .eq('customer_id', params.id)
      .order('created_at', { ascending: false }),
    admin
      .from('customer_profiles')
      .select(
        'id, email, first_name, last_name, phone, role, is_primary, deactivated_at, created_at'
      )
      .eq('customer_id', params.id)
      .order('is_primary', { ascending: false })
      .order('created_at', { ascending: false })
  ]);

  const profiles = (profilesRes.data ?? []) as Omit<
    ShopLogin,
    'last_sign_in_at' | 'email_confirmed'
  >[];

  // Enrich each login with auth-side state (last sign-in, confirmation).
  const logins: ShopLogin[] = await Promise.all(
    profiles.map(async (p) => {
      const { data } = await admin.auth.admin.getUserById(p.id);
      return {
        ...p,
        last_sign_in_at: data.user?.last_sign_in_at ?? null,
        email_confirmed: !!data.user?.email_confirmed_at
      };
    })
  );

  return { tokens: tokensRes.data ?? [], logins };
};

/** Ensure only one login is flagged primary for this customer. */
async function clearPrimaryLogins(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  customerId: string,
  exceptId?: string
) {
  let q = admin
    .from('customer_profiles')
    .update({ is_primary: false })
    .eq('customer_id', customerId)
    .eq('is_primary', true);
  if (exceptId) q = q.neq('id', exceptId);
  return q;
}

/** Confirm a login id belongs to this customer before mutating it. */
async function ownsLogin(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  customerId: string,
  loginId: string
) {
  const { data } = await admin
    .from('customer_profiles')
    .select('id')
    .eq('id', loginId)
    .eq('customer_id', customerId)
    .maybeSingle();
  return !!data;
}

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

    const guaranteethUrl = env['GUARANTEETH_API_URL'] ?? 'https://preview.yessmile.ai/';
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
  },

  createLogin: async ({ params, request }) => {
    const form = await request.formData();
    const email = String(form.get('email') ?? '')
      .trim()
      .toLowerCase();
    const password = String(form.get('password') ?? '');
    const first_name = String(form.get('first_name') ?? '').trim() || null;
    const last_name = String(form.get('last_name') ?? '').trim() || null;
    const phone = String(form.get('phone') ?? '').trim() || null;
    const role = String(form.get('role') ?? 'buyer').trim();
    const is_primary = form.get('is_primary') === 'on';

    if (!email || !EMAIL_RE.test(email)) {
      return fail(400, { loginMessage: 'Enter a valid email address.' });
    }
    if (password.length < 8) {
      return fail(400, { loginMessage: 'Password must be at least 8 characters.' });
    }
    if (!LOGIN_ROLES.includes(role as LoginRole)) {
      return fail(400, { loginMessage: 'Invalid role selected.' });
    }

    const admin = createSupabaseAdminClient();
    const { data: created, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { customer_id: params.id, role }
    });
    if (error || !created.user) {
      return fail(400, { loginMessage: error?.message ?? 'Could not create login.' });
    }

    if (is_primary) await clearPrimaryLogins(admin, params.id);

    const { error: profileError } = await admin.from('customer_profiles').insert({
      id: created.user.id,
      customer_id: params.id,
      email,
      first_name,
      last_name,
      phone,
      role,
      is_primary
    });

    if (profileError) {
      await admin.auth.admin.deleteUser(created.user.id);
      return fail(400, { loginMessage: profileError.message ?? 'Could not create login.' });
    }

    return { loginSaved: 'Login created.' };
  },

  resetPassword: async ({ params, request }) => {
    const form = await request.formData();
    const id = String(form.get('id') ?? '').trim();
    const password = String(form.get('password') ?? '');

    if (!id) return fail(400, { loginMessage: 'Missing login id.' });
    if (password.length < 8) {
      return fail(400, { loginMessage: 'Password must be at least 8 characters.' });
    }

    const admin = createSupabaseAdminClient();
    if (!(await ownsLogin(admin, params.id, id))) {
      return fail(400, { loginMessage: 'Login not found for this customer.' });
    }

    const { error } = await admin.auth.admin.updateUserById(id, { password });
    if (error) return fail(400, { loginMessage: error.message ?? 'Could not reset password.' });

    return { loginSaved: 'Password updated.' };
  },

  toggleLogin: async ({ params, request }) => {
    const form = await request.formData();
    const id = String(form.get('id') ?? '').trim();
    const deactivate = form.get('deactivate') === 'true';

    if (!id) return fail(400, { loginMessage: 'Missing login id.' });

    const admin = createSupabaseAdminClient();
    const { error } = await admin
      .from('customer_profiles')
      .update({ deactivated_at: deactivate ? new Date().toISOString() : null })
      .eq('id', id)
      .eq('customer_id', params.id);
    if (error) return fail(400, { loginMessage: error.message ?? 'Could not update login.' });

    return { loginSaved: deactivate ? 'Login deactivated.' : 'Login reactivated.' };
  },

  deleteLogin: async ({ params, request }) => {
    const form = await request.formData();
    const id = String(form.get('id') ?? '').trim();
    if (!id) return fail(400, { loginMessage: 'Missing login id.' });

    const admin = createSupabaseAdminClient();
    if (!(await ownsLogin(admin, params.id, id))) {
      return fail(400, { loginMessage: 'Login not found for this customer.' });
    }

    const { error } = await admin
      .from('customer_profiles')
      .delete()
      .eq('id', id)
      .eq('customer_id', params.id);
    if (error) return fail(400, { loginMessage: error.message ?? 'Could not delete login.' });

    // Remove the underlying auth user so the email can be reused.
    const { error: authError } = await admin.auth.admin.deleteUser(id);
    if (authError) {
      return fail(400, {
        loginMessage: `Login removed, but the auth account could not be deleted: ${authError.message}`
      });
    }

    return { loginSaved: 'Login deleted.' };
  }
};

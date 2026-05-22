import { createServerClient, type CookieMethodsServer } from '@supabase/ssr';
import { error, type Handle, redirect } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { PUBLIC_SUPABASE_PUBLISHABLE_KEY, PUBLIC_SUPABASE_URL } from '$env/static/public';
import type { UserProfile } from '$lib/types/db';

const PUBLIC_PATHS = [
  '/login',
  '/auth',
  '/api/v1/products',
  '/api/v1/orders',
  '/api/v1/reorder-plan',
  '/api/v1/integrations/guaranteeth/organizations'
];

const supabase: Handle = async ({ event, resolve }) => {
  const cookies: CookieMethodsServer = {
    getAll: () => event.cookies.getAll(),
    setAll: (cookiesToSet) => {
      cookiesToSet.forEach(({ name, value, options }) => {
        event.cookies.set(name, value, { ...options, path: '/' });
      });
    }
  };

  event.locals.supabase = createServerClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    cookies
  });

  event.locals.safeGetSession = async () => {
    const {
      data: { session }
    } = await event.locals.supabase.auth.getSession();
    if (!session) return { session: null, user: null };

    const {
      data: { user },
      error
    } = await event.locals.supabase.auth.getUser();
    if (error) return { session: null, user: null };

    return { session, user };
  };

  return resolve(event, {
    filterSerializedResponseHeaders: (name) =>
      name === 'content-range' || name === 'x-supabase-api-version'
  });
};

const authGuard: Handle = async ({ event, resolve }) => {
  const { session, user } = await event.locals.safeGetSession();
  event.locals.session = session;
  event.locals.user = user;
  event.locals.profile = null;

  const isPublic = PUBLIC_PATHS.some((p) => event.url.pathname.startsWith(p));
  const isApi = event.url.pathname.startsWith('/api/');
  const isPortal = event.url.pathname.startsWith('/portal');
  const isInvoiceApi = event.url.pathname.startsWith('/api/v1/invoices');

  if (!session || !user) {
    if (!isPublic) {
      if (isApi) throw error(401, 'Not signed in.');
      const next = encodeURIComponent(event.url.pathname + event.url.search);
      throw redirect(303, `/login?next=${next}`);
    }
    return resolve(event);
  }

  const { data: profile } = await event.locals.supabase
    .from('user_profiles')
    .select('id, role, customer_id, display_name, created_at, updated_at')
    .eq('id', user.id)
    .maybeSingle();

  event.locals.profile = profile as UserProfile | null;

  if (isPublic) {
    if (event.url.pathname === '/login' && profile?.role === 'admin') {
      throw redirect(303, '/');
    }
    if (event.url.pathname === '/login' && profile?.role === 'customer') {
      throw redirect(303, '/portal/invoices');
    }
    return resolve(event);
  }

  if (isPortal) {
    if (profile?.role === 'customer' && profile.customer_id) return resolve(event);
    if (profile?.role === 'admin') throw redirect(303, '/');
    await event.locals.supabase.auth.signOut();
    throw redirect(303, '/login?error=not_customer');
  }

  if (isInvoiceApi) {
    if (profile?.role === 'admin') return resolve(event);
    if (profile?.role === 'customer' && profile.customer_id) return resolve(event);
    throw error(403, 'Forbidden.');
  }

  if (profile?.role !== 'admin') {
    await event.locals.supabase.auth.signOut();
    if (isApi) throw error(403, 'Forbidden.');
    throw redirect(303, '/login?error=not_admin');
  }

  if (event.url.pathname === '/login' && profile?.role === 'admin') {
    throw redirect(303, '/');
  }

  return resolve(event);
};

export const handle: Handle = sequence(supabase, authGuard);

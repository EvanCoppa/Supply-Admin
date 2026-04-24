import { env } from '$env/dynamic/public';

const PUBLIC_API_BASE_URL = env.PUBLIC_API_BASE_URL ?? '';

export interface ApiCallOpts {
  path: string;
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  accessToken: string;
}

export async function callApi<T = unknown>(opts: ApiCallOpts): Promise<{
  ok: boolean;
  status: number;
  data?: T;
  error?: { code?: string; message: string };
}> {
  if (!PUBLIC_API_BASE_URL) {
    return {
      ok: false,
      status: 0,
      error: { code: 'config', message: 'PUBLIC_API_BASE_URL is not set.' }
    };
  }

  const res = await fetch(`${PUBLIC_API_BASE_URL.replace(/\/$/, '')}${opts.path}`, {
    method: opts.method ?? 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${opts.accessToken}`
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined
  });

  const contentType = res.headers.get('content-type') ?? '';
  const payload = contentType.includes('application/json') ? await res.json() : await res.text();

  if (!res.ok) {
    const err =
      typeof payload === 'object' && payload
        ? { code: (payload as any).code, message: (payload as any).message ?? res.statusText }
        : { message: typeof payload === 'string' ? payload : res.statusText };
    return { ok: false, status: res.status, error: err };
  }
  return { ok: true, status: res.status, data: payload as T };
}

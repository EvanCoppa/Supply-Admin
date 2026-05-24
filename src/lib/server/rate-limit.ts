import { env } from '$env/dynamic/private';

export interface RateLimitOptions {
  limit: number;
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
}

export const DEFAULT_RATE_LIMIT: RateLimitOptions = { limit: 60, windowMs: 60_000 };
export const INTEGRATION_RATE_LIMIT: RateLimitOptions = { limit: 30, windowMs: 60_000 };

const MAX_TRACKED_KEYS = 10_000;

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export function checkRateLimit(
  key: string,
  options: RateLimitOptions = DEFAULT_RATE_LIMIT,
  now: number = Date.now()
): RateLimitResult {
  const { limit, windowMs } = options;

  let bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + windowMs };
    buckets.set(key, bucket);
  }

  if (buckets.size > MAX_TRACKED_KEYS) {
    for (const [k, b] of buckets) {
      if (b.resetAt <= now) buckets.delete(k);
    }
  }

  bucket.count += 1;
  const remaining = Math.max(0, limit - bucket.count);
  const resetAt = Math.ceil(bucket.resetAt / 1000);
  const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));

  return {
    allowed: bucket.count <= limit,
    limit,
    remaining,
    resetAt,
    retryAfterSeconds
  };
}

export function resetRateLimits(): void {
  buckets.clear();
}

export function rateLimitKey(request: Request, clientIp: string | null): string {
  const auth = request.headers.get('authorization') ?? '';
  const [scheme, token] = auth.split(' ');
  if (scheme?.toLowerCase() === 'bearer' && token) {
    return `tok:${token}`;
  }
  return `ip:${clientIp ?? 'unknown'}`;
}

export function rateLimitOptionsForPath(pathname: string): RateLimitOptions | null {
  if (!pathname.startsWith('/api/v1')) return null;
  if (pathname === '/api/v1' || pathname === '/api/v1/') return null;
  if (pathname.startsWith('/api/v1/integrations/')) return INTEGRATION_RATE_LIMIT;
  return DEFAULT_RATE_LIMIT;
}

export function isRateLimitingDisabled(): boolean {
  const flag = env['RATE_LIMIT_DISABLED'];
  return flag === 'true' || flag === '1';
}

export function applyRateLimitHeaders(headers: Headers, result: RateLimitResult): void {
  headers.set('X-RateLimit-Limit', String(result.limit));
  headers.set('X-RateLimit-Remaining', String(result.remaining));
  headers.set('X-RateLimit-Reset', String(result.resetAt));
}

export function rateLimitExceededResponse(result: RateLimitResult): Response {
  const headers = new Headers({ 'content-type': 'application/json' });
  applyRateLimitHeaders(headers, result);
  headers.set('Retry-After', String(result.retryAfterSeconds));
  return new Response(
    JSON.stringify({
      message: `Rate limit exceeded. Retry after ${result.retryAfterSeconds}s.`
    }),
    { status: 429, headers }
  );
}

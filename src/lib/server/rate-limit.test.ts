import { beforeEach, describe, expect, it } from 'vitest';
import {
  checkRateLimit,
  rateLimitKey,
  rateLimitOptionsForPath,
  resetRateLimits,
  DEFAULT_RATE_LIMIT,
  INTEGRATION_RATE_LIMIT
} from './rate-limit';

describe('checkRateLimit', () => {
  beforeEach(() => resetRateLimits());

  it('allows requests up to the limit', () => {
    const opts = { limit: 3, windowMs: 1_000 };
    for (let i = 0; i < 3; i++) {
      const result = checkRateLimit('k1', opts, 1_000);
      expect(result.allowed).toBe(true);
    }
    expect(checkRateLimit('k1', opts, 1_000).allowed).toBe(false);
  });

  it('reports remaining count correctly', () => {
    const opts = { limit: 5, windowMs: 1_000 };
    const first = checkRateLimit('k', opts, 1_000);
    expect(first.remaining).toBe(4);
    const second = checkRateLimit('k', opts, 1_000);
    expect(second.remaining).toBe(3);
  });

  it('returns retryAfterSeconds >= 1 on rejection', () => {
    const opts = { limit: 1, windowMs: 60_000 };
    checkRateLimit('k', opts, 1_000);
    const result = checkRateLimit('k', opts, 1_500);
    expect(result.allowed).toBe(false);
    expect(result.retryAfterSeconds).toBeGreaterThanOrEqual(1);
  });

  it('resets the bucket once the window elapses', () => {
    const opts = { limit: 2, windowMs: 1_000 };
    checkRateLimit('k', opts, 1_000);
    checkRateLimit('k', opts, 1_000);
    expect(checkRateLimit('k', opts, 1_000).allowed).toBe(false);
    expect(checkRateLimit('k', opts, 2_500).allowed).toBe(true);
  });

  it('tracks separate keys independently', () => {
    const opts = { limit: 1, windowMs: 1_000 };
    expect(checkRateLimit('a', opts, 1_000).allowed).toBe(true);
    expect(checkRateLimit('b', opts, 1_000).allowed).toBe(true);
    expect(checkRateLimit('a', opts, 1_000).allowed).toBe(false);
  });
});

describe('rateLimitKey', () => {
  function req(headers: Record<string, string> = {}): Request {
    return new Request('http://x/', { headers });
  }

  it('keys by bearer token when present', () => {
    expect(rateLimitKey(req({ authorization: 'Bearer supply_abc' }), '1.2.3.4')).toBe(
      'tok:supply_abc'
    );
  });

  it('falls back to client IP when unauthenticated', () => {
    expect(rateLimitKey(req(), '1.2.3.4')).toBe('ip:1.2.3.4');
  });

  it('uses "unknown" when no IP is available', () => {
    expect(rateLimitKey(req(), null)).toBe('ip:unknown');
  });

  it('ignores non-bearer auth schemes', () => {
    expect(rateLimitKey(req({ authorization: 'Basic dXNlcjpwYXNz' }), '5.5.5.5')).toBe(
      'ip:5.5.5.5'
    );
  });
});

describe('rateLimitOptionsForPath', () => {
  it('returns null for non-v1 paths', () => {
    expect(rateLimitOptionsForPath('/api/search')).toBeNull();
    expect(rateLimitOptionsForPath('/login')).toBeNull();
  });

  it('returns null for the discovery endpoint', () => {
    expect(rateLimitOptionsForPath('/api/v1')).toBeNull();
    expect(rateLimitOptionsForPath('/api/v1/')).toBeNull();
  });

  it('uses tighter limits for integration webhooks', () => {
    expect(rateLimitOptionsForPath('/api/v1/integrations/guaranteeth/organizations')).toEqual(
      INTEGRATION_RATE_LIMIT
    );
  });

  it('uses the default limit for partner endpoints', () => {
    expect(rateLimitOptionsForPath('/api/v1/products')).toEqual(DEFAULT_RATE_LIMIT);
    expect(rateLimitOptionsForPath('/api/v1/invoices/123')).toEqual(DEFAULT_RATE_LIMIT);
  });
});

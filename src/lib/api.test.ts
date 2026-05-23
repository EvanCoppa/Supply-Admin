import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$env/dynamic/public', () => ({
  env: { PUBLIC_API_BASE_URL: 'https://api.example.com' }
}));

import { callApi } from './api';

const originalFetch = globalThis.fetch;

function mockFetchOnce(response: Partial<Response> & { _body?: unknown; _contentType?: string }) {
  globalThis.fetch = vi.fn(async () => {
    const headers = new Headers({ 'content-type': response._contentType ?? 'application/json' });
    return {
      ok: response.ok ?? true,
      status: response.status ?? 200,
      statusText: response.statusText ?? 'OK',
      headers,
      json: async () => response._body,
      text: async () => (typeof response._body === 'string' ? response._body : '')
    } as unknown as Response;
  });
}

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe('callApi', () => {
  it('sends a POST with a JSON body and Authorization header by default', async () => {
    const spy = vi.fn(
      async () =>
        new Response(JSON.stringify({ id: 1 }), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
    );
    globalThis.fetch = spy;

    const result = await callApi({ path: '/things', body: { a: 1 }, accessToken: 'tok' });

    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
    expect(result.data).toEqual({ id: 1 });

    const firstCall = spy.mock.calls[0] as unknown as [string, RequestInit];
    expect(firstCall[0]).toBe('https://api.example.com/things');
    expect(firstCall[1].method).toBe('POST');
    expect((firstCall[1].headers as Record<string, string>)['Authorization']).toBe('Bearer tok');
    expect(firstCall[1].body).toBe(JSON.stringify({ a: 1 }));
  });

  it('omits the body when none is provided', async () => {
    const spy = vi.fn(
      async () => new Response('ok', { status: 200, headers: { 'content-type': 'text/plain' } })
    );
    globalThis.fetch = spy;

    await callApi({ path: '/p', method: 'GET', accessToken: 'tok' });

    const firstCall = spy.mock.calls[0] as unknown as [string, RequestInit];
    expect(firstCall[1].body).toBeUndefined();
    expect(firstCall[1].method).toBe('GET');
  });

  it('parses text responses when content-type is not JSON', async () => {
    mockFetchOnce({ ok: true, status: 200, _body: 'hello', _contentType: 'text/plain' });
    const result = await callApi({ path: '/p', accessToken: 'tok' });
    expect(result.ok).toBe(true);
    expect(result.data).toBe('hello');
  });

  it('extracts JSON error message and code on failure', async () => {
    mockFetchOnce({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      _body: { message: 'nope', code: 'bad_request' }
    });

    const result = await callApi({ path: '/p', accessToken: 'tok' });
    expect(result.ok).toBe(false);
    expect(result.status).toBe(400);
    expect(result.error?.message).toBe('nope');
    expect(result.error?.code).toBe('bad_request');
  });

  it('falls back to statusText when JSON has no message', async () => {
    mockFetchOnce({ ok: false, status: 500, statusText: 'Server Error', _body: {} });
    const result = await callApi({ path: '/p', accessToken: 'tok' });
    expect(result.error?.message).toBe('Server Error');
  });

  it('uses raw text body as message for non-JSON errors', async () => {
    mockFetchOnce({
      ok: false,
      status: 502,
      statusText: 'Bad Gateway',
      _body: 'upstream is down',
      _contentType: 'text/plain'
    });
    const result = await callApi({ path: '/p', accessToken: 'tok' });
    expect(result.error?.message).toBe('upstream is down');
  });

  it('strips trailing slash from the base URL', async () => {
    // Re-mock module to use a trailing slash.
    vi.resetModules();
    vi.doMock('$env/dynamic/public', () => ({
      env: { PUBLIC_API_BASE_URL: 'https://api.example.com/' }
    }));
    const spy = vi.fn(
      async () =>
        new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } })
    );
    globalThis.fetch = spy;
    const { callApi: callApiReloaded } = await import('./api');
    await callApiReloaded({ path: '/p', accessToken: 'tok' });
    const firstCall = spy.mock.calls[0] as unknown as [string, RequestInit];
    expect(firstCall[0]).toBe('https://api.example.com/p');
  });
});

describe('callApi with no base URL', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('returns a config error when base URL is missing', async () => {
    vi.doMock('$env/dynamic/public', () => ({ env: {} }));
    const { callApi: callApiNoConfig } = await import('./api');
    const result = await callApiNoConfig({ path: '/p', accessToken: 'tok' });
    expect(result.ok).toBe(false);
    expect(result.status).toBe(0);
    expect(result.error?.code).toBe('config');
  });
});

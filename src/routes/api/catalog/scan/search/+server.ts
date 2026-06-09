import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';

/**
 * THROWAWAY / DEBUG endpoint backing /catalog/barcode-match.
 *
 * Given a product SKU, it asks the UPC database for candidate items that carry
 * real barcode numbers, scores how well each one matches the SKU, and returns
 * everything — including a verbose `debug` trace — so the barcode-match page can
 * show exactly what happened behind the scenes.
 *
 * Matching is SKU-only: the SKU is the search keyword, and a candidate scores
 * 100% when one of its identifiers (UPC / EAN / model / MPN) equals the SKU.
 */

type DebugStep = {
  label: string;
  detail: unknown;
  at: number; // ms since request start
};

type Candidate = {
  barcode: string;
  title: string;
  brand: string | null;
  score: number;
  reasons: string[];
};

// --- tiny string helpers (no deps) ---------------------------------------

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Collapse an identifier to bare alphanumerics, e.g. "LCE-1227" -> "lce1227". */
function normalizeId(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function tokens(s: string): string[] {
  return normalize(s).split(' ').filter(Boolean);
}

/** Jaccard token overlap, 0..1 */
function tokenOverlap(a: string, b: string): number {
  const ta = new Set(tokens(a));
  const tb = new Set(tokens(b));
  if (ta.size === 0 || tb.size === 0) return 0;
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared++;
  return shared / new Set([...ta, ...tb]).size;
}

function scoreBySku(
  sku: string,
  item: {
    upc: string | null;
    ean: string | null;
    model: string | null;
    mpn: string | null;
    title: string;
  }
): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  const target = normalizeId(sku);

  if (target) {
    const matched = (['upc', 'ean', 'model', 'mpn'] as const).find(
      (field) => item[field] && normalizeId(item[field]) === target
    );
    if (matched) {
      reasons.push(`exact SKU match on ${matched}`);
      return { score: 1, reasons };
    }
  }

  // Fallback: how much of the SKU shows up in the model / title text.
  const overlap = Math.max(tokenOverlap(sku, item.model ?? ''), tokenOverlap(sku, item.title));
  reasons.push(`SKU↔model/title overlap ${(overlap * 100).toFixed(0)}%`);
  return { score: Math.round(overlap * 100) / 100, reasons };
}

// -------------------------------------------------------------------------

export const GET: RequestHandler = async ({ url }) => {
  const start = Date.now();
  const debug: DebugStep[] = [];
  const log = (label: string, detail: unknown) =>
    debug.push({ label, detail, at: Date.now() - start });

  const sku = (url.searchParams.get('sku') ?? '').trim();

  log('input', { sku });

  if (!sku) {
    log('aborted', 'no SKU provided');
    return json({ candidates: [], debug });
  }

  const searchUrl = env['UPC_SEARCH_API_URL'] || 'https://api.upcitemdb.com/prod/trial/search';
  const apiKey = env['UPC_LOOKUP_API_KEY'];

  const requestUrl = new URL(searchUrl);
  requestUrl.searchParams.set('s', sku);
  requestUrl.searchParams.set('match_mode', '0');
  requestUrl.searchParams.set('type', 'product');
  if (apiKey) requestUrl.searchParams.set('key', apiKey);

  log('request', {
    url: requestUrl.toString().replace(apiKey ?? '__no_key__', apiKey ? '***' : '__no_key__'),
    keyword: sku,
    hasApiKey: Boolean(apiKey)
  });

  let rawItems: {
    ean?: string;
    upc?: string;
    title?: string;
    brand?: string;
    model?: string;
    mpn?: string;
  }[] = [];
  try {
    const res = await fetch(requestUrl.toString(), {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(5000)
    });
    log('response.status', { ok: res.ok, status: res.status, statusText: res.statusText });

    const text = await res.text();
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      log('response.parseError', { bodyPreview: text.slice(0, 500) });
    }

    if (parsed && typeof parsed === 'object') {
      const body = parsed as {
        code?: string;
        total?: number;
        items?: typeof rawItems;
      };
      log('response.meta', {
        code: body.code,
        total: body.total,
        returned: body.items?.length ?? 0
      });
      rawItems = body.items ?? [];
    }

    if (!res.ok) {
      log('warning', 'upstream returned a non-OK status; results may be empty or rate-limited');
    }
  } catch (err) {
    log('fetchError', { message: err instanceof Error ? err.message : String(err) });
    return json({ candidates: [], debug, error: 'lookup failed' });
  }

  const candidates: Candidate[] = rawItems
    .map((item) => {
      const barcode = (item.ean || item.upc || '').trim();
      const { score, reasons } = scoreBySku(sku, {
        upc: item.upc ?? null,
        ean: item.ean ?? null,
        model: item.model ?? null,
        mpn: item.mpn ?? null,
        title: item.title ?? ''
      });
      return {
        barcode,
        title: item.title ?? '(untitled)',
        brand: item.brand ?? null,
        score,
        reasons
      };
    })
    .filter((c) => c.barcode)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);

  log(
    'scored',
    candidates.map((c) => ({ barcode: c.barcode, score: c.score, title: c.title }))
  );
  log('done', { totalMs: Date.now() - start, candidateCount: candidates.length });

  return json({ candidates, debug });
};

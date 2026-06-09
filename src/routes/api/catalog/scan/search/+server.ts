import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';

/**
 * THROWAWAY / DEBUG endpoint backing /catalog/barcode-match.
 *
 * Given a product name (+ optional manufacturer), it asks the UPC database for
 * candidate items that have real barcode numbers, scores how well each one
 * matches, and returns everything — including a verbose `debug` trace — so the
 * barcode-match page can show exactly what happened behind the scenes.
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

// --- tiny string-similarity helpers (no deps) ----------------------------

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
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

function scoreCandidate(
  query: { name: string; manufacturer: string | null },
  item: { title: string; brand: string | null }
): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  const overlap = tokenOverlap(query.name, item.title);
  reasons.push(`name↔title token overlap ${(overlap * 100).toFixed(0)}%`);
  let score = overlap;

  if (query.manufacturer && item.brand) {
    const brandOverlap = tokenOverlap(query.manufacturer, item.brand);
    if (brandOverlap > 0) {
      score = Math.min(1, score + brandOverlap * 0.25);
      reasons.push(`brand match +${(brandOverlap * 25).toFixed(0)}%`);
    } else {
      reasons.push('brand mismatch');
    }
  }

  return { score: Math.round(score * 100) / 100, reasons };
}

// -------------------------------------------------------------------------

export const GET: RequestHandler = async ({ url }) => {
  const start = Date.now();
  const debug: DebugStep[] = [];
  const log = (label: string, detail: unknown) =>
    debug.push({ label, detail, at: Date.now() - start });

  const name = (url.searchParams.get('name') ?? '').trim();
  const manufacturer = (url.searchParams.get('manufacturer') ?? '').trim() || null;

  log('input', { name, manufacturer });

  if (!name) {
    log('aborted', 'no product name provided');
    return json({ candidates: [], debug });
  }

  const searchUrl =
    env['UPC_SEARCH_API_URL'] || 'https://api.upcitemdb.com/prod/trial/search';
  const apiKey = env['UPC_LOOKUP_API_KEY'];

  // Build the keyword query: manufacturer + name tends to give tighter results.
  const keyword = [manufacturer, name].filter(Boolean).join(' ').trim();
  const requestUrl = new URL(searchUrl);
  requestUrl.searchParams.set('s', keyword);
  requestUrl.searchParams.set('match_mode', '0');
  requestUrl.searchParams.set('type', 'product');
  if (apiKey) requestUrl.searchParams.set('key', apiKey);

  log('request', {
    url: requestUrl.toString().replace(apiKey ?? '__no_key__', apiKey ? '***' : '__no_key__'),
    keyword,
    hasApiKey: Boolean(apiKey)
  });

  let rawItems: { ean?: string; upc?: string; title?: string; brand?: string }[] = [];
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
        items?: { ean?: string; upc?: string; title?: string; brand?: string }[];
      };
      log('response.meta', { code: body.code, total: body.total, returned: body.items?.length ?? 0 });
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
      const { score, reasons } = scoreCandidate(
        { name, manufacturer },
        { title: item.title ?? '', brand: item.brand ?? null }
      );
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

  log('scored', candidates.map((c) => ({ barcode: c.barcode, score: c.score, title: c.title })));
  log('done', { totalMs: Date.now() - start, candidateCount: candidates.length });

  return json({ candidates, debug });
};

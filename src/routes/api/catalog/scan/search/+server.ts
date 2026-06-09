import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';

/**
 * THROWAWAY / DEBUG endpoint backing /catalog/barcode-match.
 *
 * Given a product NAME (and optional manufacturer / SKU), it asks the UPC
 * database for candidate items that carry real barcode numbers, scores how well
 * each one matches, and returns everything — including a verbose `debug` trace —
 * so the barcode-match page can show exactly what happened behind the scenes.
 *
 * Why name and not SKU: these are internal SKUs (e.g. "LSP-1228"). upcitemdb
 * only indexes manufacturer barcodes, public model numbers and product titles,
 * so a SKU keyword search always returns NOT_FOUND. The product name is the only
 * key upcitemdb can actually match on.
 *
 * Scoring blends title overlap with brand agreement, then penalises ambiguous
 * results (a keyword that returns thousands of hits is a weak signal). A rare
 * exact identifier match (UPC/EAN/model/MPN == SKU) still scores 100%.
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

/**
 * Build a clean search keyword from a noisy catalog name. Strips leading
 * parentheticals ("(Level 3) …"), trademark glyphs and trailing pack-size tags
 * ("50/Bx", "100/Pk") that only confuse upcitemdb's keyword index, while keeping
 * the distinctive brand/size words that actually help it match.
 */
function buildQuery(name: string): string {
  let q = name;
  // drop one or more leading "(...)" groups
  while (/^\s*\([^)]*\)\s*/.test(q)) q = q.replace(/^\s*\([^)]*\)\s*/, '');
  q = q.replace(/[®™©]/g, ' ');
  // trailing pack-size like ", 50/Bx" or " 100/Pk" or " 2/Bx"
  q = q.replace(/[,\s]*\b\d+\s*\/\s*[a-z]{1,4}\b\s*$/i, '');
  q = q.replace(/\s+/g, ' ').trim();
  // keep it focused — long tails dilute the keyword search
  return q.split(' ').slice(0, 12).join(' ');
}

/** Does the returned brand actually appear in the product name? */
function brandMatches(name: string, brand: string | null): boolean {
  if (!brand) return false;
  const bt = tokens(brand);
  if (bt.length === 0) return false;
  const nameSet = new Set(tokens(name));
  return bt.every((t) => nameSet.has(t));
}

/**
 * A source-agnostic candidate. Both upcitemdb (consumer goods) and AccessGUDID
 * (FDA medical-device registry) are normalised into this shape before scoring,
 * so the matching logic doesn't care where a barcode came from.
 */
type RawCandidate = {
  barcode: string; // the number we'd assign to the product
  title: string; // descriptive text to token-match against the name
  brand: string | null;
  ids: string[]; // every identifier to test for an exact SKU match
  total: number; // result-set size from the source (drives the ambiguity penalty)
  source: 'upcitemdb' | 'gudid';
};

function scoreCandidate(
  query: string,
  name: string,
  sku: string,
  c: RawCandidate
): { score: number; reasons: string[] } {
  const reasons: string[] = [];

  // Rare but decisive: an internal SKU that happens to equal a real identifier.
  const target = normalizeId(sku);
  if (target && c.ids.some((id) => normalizeId(id) === target)) {
    reasons.push(`exact SKU match (${c.source})`);
    return { score: 1, reasons };
  }

  const overlap = tokenOverlap(query, c.title);
  reasons.push(`title overlap ${(overlap * 100).toFixed(0)}%`);

  // Brand agreement is a strong positive — anchors the fuzzy title match.
  const brandOk = brandMatches(name, c.brand);
  let score = brandOk ? overlap * 0.7 + 0.3 : overlap;
  if (brandOk) reasons.push(`brand "${c.brand}" present in name`);

  // Ambiguity penalty: for upcitemdb a huge result set is weak evidence, so cap
  // confidence unless the title genuinely overlaps a lot. Skipped for GUDID,
  // whose Solr backend OR-matches (millions of "results") but ranks relevance —
  // its result count says nothing about how good the top hit is.
  if (c.source === 'upcitemdb') {
    if (c.total > 100 && overlap < 0.6) {
      score *= 0.6;
      reasons.push(`ambiguous (${c.total} results) — confidence reduced`);
    } else if (c.total > 25 && overlap < 0.5) {
      score *= 0.8;
      reasons.push(`broad result set (${c.total}) — confidence reduced`);
    }
  }

  reasons.push(`source: ${c.source}`);
  return { score: Math.round(Math.min(score, 0.99) * 100) / 100, reasons };
}

// --- sources -------------------------------------------------------------

/** upcitemdb: consumer-goods UPC/EAN database. Keyed by the env API key. */
async function fetchUpcItemDb(
  query: string,
  log: (label: string, detail: unknown) => void
): Promise<RawCandidate[]> {
  const searchUrl = env['UPC_SEARCH_API_URL'] || 'https://api.upcitemdb.com/prod/trial/search';
  const apiKey = env['UPC_LOOKUP_API_KEY'];

  const requestUrl = new URL(searchUrl);
  requestUrl.searchParams.set('s', query);
  requestUrl.searchParams.set('match_mode', '0');
  requestUrl.searchParams.set('type', 'product');
  if (apiKey) requestUrl.searchParams.set('key', apiKey);

  log('upcitemdb.request', { keyword: query, hasApiKey: Boolean(apiKey) });

  try {
    const res = await fetch(requestUrl.toString(), {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(5000)
    });
    const text = await res.text();
    type UpcItem = {
      ean?: string;
      upc?: string;
      title?: string;
      brand?: string;
      model?: string;
      mpn?: string;
    };
    let body: { code?: string; total?: number; items?: UpcItem[] } = {};
    try {
      body = JSON.parse(text);
    } catch {
      log('upcitemdb.parseError', { status: res.status, bodyPreview: text.slice(0, 300) });
      return [];
    }

    const items = body.items ?? [];
    const total = body.total ?? items.length;
    log('upcitemdb.meta', {
      ok: res.ok,
      status: res.status,
      code: body.code,
      total,
      returned: items.length
    });
    if (!res.ok || body.code === 'TOO_FAST') {
      log('upcitemdb.warning', 'non-OK / rate-limited; results may be empty');
    }

    return items
      .map((item): RawCandidate => {
        const barcode = (item.ean || item.upc || '').trim();
        return {
          barcode,
          title: item.title ?? '',
          brand: item.brand ?? null,
          ids: [item.upc, item.ean, item.model, item.mpn].filter(Boolean) as string[],
          total,
          source: 'upcitemdb'
        };
      })
      .filter((c) => c.barcode);
  } catch (err) {
    log('upcitemdb.error', { message: err instanceof Error ? err.message : String(err) });
    return [];
  }
}

/**
 * AccessGUDID: the FDA's public registry of medical/dental devices. Free, no key,
 * and covers exactly the non-retail stock upcitemdb misses. The barcode is the
 * Primary device identifier (the GTIN/HIBC printed on the package).
 */
async function fetchGudid(
  query: string,
  log: (label: string, detail: unknown) => void
): Promise<RawCandidate[]> {
  const base = env['GUDID_SEARCH_API_URL'] || 'https://accessgudid.nlm.nih.gov/devices/search.json';
  const requestUrl = new URL(base);
  requestUrl.searchParams.set('query', query);

  log('gudid.request', { keyword: query });

  try {
    const res = await fetch(requestUrl.toString(), {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(6000)
    });
    const text = await res.text();
    let body: {
      search_results?: {
        number_results?: string;
        result?: {
          brandName?: string;
          companyName?: string;
          modelNumber?: string;
          gmdnTerms?: { termName?: string }[];
          ID?: { deviceId?: string; type?: string }[];
        }[];
      };
    } = {};
    try {
      body = JSON.parse(text);
    } catch {
      log('gudid.parseError', { status: res.status, bodyPreview: text.slice(0, 300) });
      return [];
    }

    const result = body.search_results?.result ?? [];
    const total = Number(body.search_results?.number_results ?? result.length) || result.length;
    log('gudid.meta', { ok: res.ok, status: res.status, total, returned: result.length });

    return result
      .map((d): RawCandidate => {
        const idList = d.ID ?? [];
        const primary = idList.find((i) => i.type === 'Primary') ?? idList[0];
        const barcode = (primary?.deviceId ?? '').trim();
        const gmdn = d.gmdnTerms?.[0]?.termName ?? '';
        // Company name is folded into the title so multi-brand names like
        // "3M Cavit" still token-match even when brandName is just "Cavit".
        const title = [d.companyName, d.brandName, d.modelNumber, gmdn].filter(Boolean).join(' ');
        return {
          barcode,
          title,
          brand: d.brandName ?? d.companyName ?? null,
          ids: [d.modelNumber, ...idList.map((i) => i.deviceId)].filter(Boolean) as string[],
          total,
          source: 'gudid'
        };
      })
      .filter((c) => c.barcode);
  } catch (err) {
    log('gudid.error', { message: err instanceof Error ? err.message : String(err) });
    return [];
  }
}

// -------------------------------------------------------------------------

export const GET: RequestHandler = async ({ url }) => {
  const start = Date.now();
  const debug: DebugStep[] = [];
  const log = (label: string, detail: unknown) =>
    debug.push({ label, detail, at: Date.now() - start });

  const name = (url.searchParams.get('name') ?? '').trim();
  const sku = (url.searchParams.get('sku') ?? '').trim();

  if (!name) {
    log('aborted', 'no product name provided');
    return json({ candidates: [], debug });
  }

  const query = buildQuery(name);
  log('input', { name, sku, query });

  if (!query) {
    log('aborted', 'name produced an empty search keyword');
    return json({ candidates: [], debug });
  }

  // Query both sources in parallel: upcitemdb covers consumer goods, AccessGUDID
  // covers FDA-registered medical/dental devices. Neither alone covers this
  // catalog; together they do.
  const [retail, medical] = await Promise.all([fetchUpcItemDb(query, log), fetchGudid(query, log)]);

  // Score every candidate, then collapse duplicate barcodes (the same product
  // can surface from both sources), keeping the highest-scoring instance.
  const byBarcode = new Map<string, Candidate>();
  for (const c of [...retail, ...medical]) {
    const { score, reasons } = scoreCandidate(query, name, sku, c);
    const scored: Candidate = {
      barcode: c.barcode,
      title: c.title || '(untitled)',
      brand: c.brand,
      score,
      reasons
    };
    const existing = byBarcode.get(c.barcode);
    if (!existing || scored.score > existing.score) byBarcode.set(c.barcode, scored);
  }

  const candidates = [...byBarcode.values()].sort((a, b) => b.score - a.score).slice(0, 8);

  log(
    'scored',
    candidates.map((c) => ({ barcode: c.barcode, score: c.score, title: c.title }))
  );
  log('done', {
    totalMs: Date.now() - start,
    fromRetail: retail.length,
    fromMedical: medical.length,
    candidateCount: candidates.length
  });

  return json({ candidates, debug });
};

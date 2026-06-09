<script lang="ts">
  import { enhance } from '$app/forms';
  import { invalidateAll } from '$app/navigation';

  let { data } = $props();

  type Candidate = {
    barcode: string;
    title: string;
    brand: string | null;
    score: number;
    reasons: string[];
  };
  type DebugStep = { label: string; detail: unknown; at: number };

  type Product = {
    id: string;
    sku: string;
    name: string;
    manufacturer: string | null;
    barcode: string | null;
  };

  type RowState = {
    loading: boolean;
    candidates: Candidate[] | null;
    error: string | null;
    assigned: string | null;
  };

  const rows = $state<Record<string, RowState>>({});
  const DEFAULT_ROW: RowState = { loading: false, candidates: null, error: null, assigned: null };

  // Read-only lookup — safe to call during render. Returns a shared default
  // when no entry exists yet (never mutates `rows`).
  function rowState(id: string): RowState {
    return rows[id] ?? DEFAULT_ROW;
  }

  // Create-on-demand — only call from event handlers, never during render.
  function ensureRow(id: string): RowState {
    return (rows[id] ??= { loading: false, candidates: null, error: null, assigned: null });
  }

  // ---- global debug console -------------------------------------------------
  type LogLine = { ts: string; level: 'info' | 'warn' | 'error'; msg: string };
  let logLines = $state<LogLine[]>([]);
  let autoScroll = $state(true);
  let logEl = $state<HTMLDivElement | null>(null);

  function logf(level: LogLine['level'], msg: string) {
    const ts = new Date().toISOString().slice(11, 23);
    logLines = [...logLines, { ts, level, msg }];
    if (autoScroll && logEl) queueMicrotask(() => logEl?.scrollTo({ top: logEl.scrollHeight }));
  }
  const info = (m: string) => logf('info', m);
  const warn = (m: string) => logf('warn', m);
  const errLog = (m: string) => logf('error', m);
  function clearLog() {
    logLines = [];
  }

  // ---- search ---------------------------------------------------------------
  async function findBarcodes(p: Product) {
    const st = ensureRow(p.id);
    st.loading = true;
    st.error = null;
    st.candidates = null;

    const params = new URLSearchParams({ name: p.name });
    if (p.manufacturer) params.set('manufacturer', p.manufacturer);

    info(`[${p.sku}] → GET /api/catalog/scan/search?${params.toString()}`);
    const started = performance.now();

    try {
      const res = await fetch(`/api/catalog/scan/search?${params.toString()}`);
      const ms = Math.round(performance.now() - started);
      info(`[${p.sku}] ← HTTP ${res.status} in ${ms}ms`);

      const body = (await res.json()) as {
        candidates: Candidate[];
        debug?: DebugStep[];
        error?: string;
      };

      // Replay the server-side debug trace into the console.
      for (const step of body.debug ?? []) {
        const detail = typeof step.detail === 'string' ? step.detail : JSON.stringify(step.detail);
        const line = `[${p.sku}]   server@${step.at}ms ${step.label}: ${detail}`;
        if (step.label.toLowerCase().includes('error')) errLog(line);
        else if (step.label.toLowerCase().includes('warn')) warn(line);
        else info(line);
      }

      if (body.error) {
        st.error = body.error;
        errLog(`[${p.sku}] error: ${body.error}`);
      }

      st.candidates = body.candidates ?? [];
      info(`[${p.sku}] ✓ ${st.candidates.length} candidate(s)`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      st.error = msg;
      errLog(`[${p.sku}] ✗ ${msg}`);
    } finally {
      st.loading = false;
    }
  }

  function scoreColor(score: number): string {
    if (score >= 0.6) return 'bg-green-100 text-green-800';
    if (score >= 0.3) return 'bg-amber-100 text-amber-800';
    return 'bg-slate-100 text-slate-600';
  }

  const remaining = $derived(data.products.filter((p: Product) => !p.barcode).length);
</script>

<div class="grid h-[calc(100vh-3.5rem)] grid-cols-1 lg:grid-cols-[1fr_30rem]">
  <!-- Left: product list -->
  <div class="overflow-y-auto p-6">
    <div class="mb-4 flex items-start justify-between gap-4">
      <div>
        <div
          class="mb-1 inline-flex items-center gap-2 rounded bg-amber-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-800"
        >
          Throwaway / debug tool
        </div>
        <h1 class="text-xl font-semibold">Barcode Matching</h1>
        <p class="text-sm text-slate-500">
          {data.onlyMissing
            ? `${remaining} active product(s) without a barcode`
            : `${data.products.length} active product(s)`}
        </p>
      </div>
      <div class="flex gap-2 text-sm">
        <a
          href="?{data.onlyMissing ? 'all=1' : ''}"
          class="rounded border border-slate-300 px-3 py-1.5 hover:bg-slate-100"
        >
          {data.onlyMissing ? 'Show all' : 'Only missing'}
        </a>
      </div>
    </div>

    {#if data.loadError}
      <div class="mb-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{data.loadError}</div>
    {/if}

    <div class="space-y-3">
      {#each data.products as p (p.id)}
        {@const st = rowState(p.id)}
        <div class="rounded-lg border border-slate-200 bg-white p-4">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="truncate font-medium">{p.name}</p>
              <p class="text-xs text-slate-500">
                SKU {p.sku}{p.manufacturer ? ` · ${p.manufacturer}` : ''}
              </p>
              {#if p.barcode}
                <p class="mt-1 text-xs font-mono text-green-700">barcode: {p.barcode}</p>
              {:else if st.assigned}
                <p class="mt-1 text-xs font-mono text-green-700">✓ assigned: {st.assigned}</p>
              {:else}
                <p class="mt-1 text-xs text-slate-400">no barcode</p>
              {/if}
            </div>
            <button
              onclick={() => findBarcodes(p)}
              disabled={st.loading}
              class="shrink-0 rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {st.loading ? 'Searching…' : 'Find barcodes'}
            </button>
          </div>

          {#if st.error}
            <p class="mt-2 text-sm text-red-600">{st.error}</p>
          {/if}

          {#if st.candidates}
            {#if st.candidates.length === 0}
              <p class="mt-3 text-sm text-slate-500">No candidates found.</p>
            {:else}
              <ul class="mt-3 space-y-2">
                {#each st.candidates as c (c.barcode)}
                  <li
                    class="flex items-center gap-3 rounded border border-slate-100 bg-slate-50 px-3 py-2"
                  >
                    <span class="rounded px-1.5 py-0.5 text-xs font-semibold {scoreColor(c.score)}">
                      {(c.score * 100).toFixed(0)}%
                    </span>
                    <div class="min-w-0 flex-1">
                      <p class="truncate text-sm">{c.title}</p>
                      <p class="font-mono text-xs text-slate-500">
                        {c.barcode}{c.brand ? ` · ${c.brand}` : ''}
                      </p>
                      <p class="text-[11px] text-slate-400">{c.reasons.join(' · ')}</p>
                    </div>
                    <form
                      method="POST"
                      action="?/assign"
                      use:enhance={() => {
                        info(`[${p.sku}] assigning barcode ${c.barcode}…`);
                        return async ({ result }) => {
                          if (result.type === 'success') {
                            st.assigned = c.barcode;
                            st.candidates = null;
                            info(`[${p.sku}] ✓ saved barcode ${c.barcode}`);
                            await invalidateAll();
                          } else if (result.type === 'failure') {
                            const m = (result.data?.message as string) ?? 'assign failed';
                            st.error = m;
                            warn(`[${p.sku}] ✗ ${m}`);
                          }
                        };
                      }}
                    >
                      <input type="hidden" name="productId" value={p.id} />
                      <input type="hidden" name="barcode" value={c.barcode} />
                      <button
                        type="submit"
                        class="shrink-0 rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium hover:bg-slate-100"
                      >
                        Assign
                      </button>
                    </form>
                  </li>
                {/each}
              </ul>
            {/if}
          {/if}
        </div>
      {/each}

      {#if data.products.length === 0}
        <p class="text-sm text-slate-500">Nothing to match. 🎉</p>
      {/if}
    </div>
  </div>

  <!-- Right: debug console -->
  <div class="flex flex-col border-l border-slate-200 bg-slate-950">
    <div class="flex items-center justify-between border-b border-slate-800 px-4 py-2.5">
      <span class="text-sm font-semibold text-slate-200">Debug console</span>
      <div class="flex items-center gap-3 text-xs text-slate-400">
        <label class="flex items-center gap-1">
          <input type="checkbox" bind:checked={autoScroll} /> auto-scroll
        </label>
        <button onclick={clearLog} class="rounded px-2 py-0.5 hover:bg-slate-800">clear</button>
      </div>
    </div>
    <div bind:this={logEl} class="flex-1 overflow-y-auto p-3 font-mono text-[11px] leading-relaxed">
      {#if logLines.length === 0}
        <p class="text-slate-600">Click “Find barcodes” to see what happens behind the scenes…</p>
      {/if}
      {#each logLines as line}
        <div
          class="whitespace-pre-wrap break-all"
          class:text-slate-300={line.level === 'info'}
          class:text-amber-400={line.level === 'warn'}
          class:text-red-400={line.level === 'error'}
        >
          <span class="text-slate-600">{line.ts}</span>
          {line.msg}
        </div>
      {/each}
    </div>
  </div>
</div>

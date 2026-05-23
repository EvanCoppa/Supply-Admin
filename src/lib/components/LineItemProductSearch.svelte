<script lang="ts">
  export type LineProductHit = {
    id: string;
    sku: string;
    name: string;
    description: string | null;
    manufacturer: string | null;
    unit_of_measure: string | null;
    pack_size: number | null;
    base_price: number | string | null;
  };

  interface Props {
    /** SKU snapshot already set on the line, displayed when nothing is being searched. */
    selectedSku?: string | null;
    /** Called when a product is picked. Parent applies the values to its line. */
    onSelect: (product: LineProductHit) => void;
    /** Called when the field is cleared. */
    onClear?: () => void;
    placeholder?: string;
  }

  let { selectedSku, onSelect, onClear, placeholder = 'Find item by SKU or name…' }: Props = $props();

  let q = $state('');
  let open = $state(false);
  let loading = $state(false);
  let hits = $state<LineProductHit[]>([]);
  let activeIdx = $state(-1);
  let inputEl: HTMLInputElement | undefined = $state();
  let debounceId: ReturnType<typeof setTimeout> | null = null;
  let abortCtl: AbortController | null = null;

  function runSearch(value: string) {
    if (abortCtl) abortCtl.abort();
    if (value.trim().length < 2) {
      hits = [];
      activeIdx = -1;
      loading = false;
      return;
    }
    abortCtl = new AbortController();
    loading = true;
    fetch(`/api/search?q=${encodeURIComponent(value.trim())}`, { signal: abortCtl.signal })
      .then((r) => (r.ok ? r.json() : { products: [] }))
      .then((data) => {
        hits = (data.products ?? []) as LineProductHit[];
        activeIdx = hits.length > 0 ? 0 : -1;
        loading = false;
      })
      .catch((e) => {
        if (e?.name !== 'AbortError') loading = false;
      });
  }

  function onInput(e: Event) {
    const value = (e.target as HTMLInputElement).value;
    q = value;
    open = true;
    if (debounceId) clearTimeout(debounceId);
    debounceId = setTimeout(() => runSearch(value), 180);
  }

  function pick(product: LineProductHit) {
    onSelect(product);
    q = '';
    hits = [];
    open = false;
    activeIdx = -1;
    inputEl?.blur();
  }

  function onKeydown(e: KeyboardEvent) {
    if (!open) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (hits.length > 0) activeIdx = (activeIdx + 1) % hits.length;
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (hits.length > 0) activeIdx = (activeIdx - 1 + hits.length) % hits.length;
    } else if (e.key === 'Enter') {
      const hit = hits[activeIdx] ?? hits[0];
      if (hit) {
        e.preventDefault();
        pick(hit);
      }
    } else if (e.key === 'Escape') {
      open = false;
    }
  }

  function clearSelection() {
    q = '';
    hits = [];
    open = false;
    onClear?.();
  }
</script>

<div class="relative w-44">
  <div class="flex items-center gap-1">
    <input
      bind:this={inputEl}
      type="search"
      value={q}
      oninput={onInput}
      onfocus={() => (open = true)}
      onblur={() => setTimeout(() => (open = false), 120)}
      onkeydown={onKeydown}
      {placeholder}
      class="min-w-0 flex-1 rounded border border-slate-300 px-2 py-1 font-mono text-xs focus:border-sky-500 focus:outline-none"
    />
    {#if selectedSku && !q}
      <button
        type="button"
        onclick={clearSelection}
        aria-label="Clear item"
        title="Clear item"
        class="rounded border border-slate-300 px-1 text-xs text-slate-500 hover:bg-slate-100"
      >
        ×
      </button>
    {/if}
  </div>
  {#if selectedSku && !q}
    <p class="mt-0.5 truncate font-mono text-[10px] text-slate-500" title={selectedSku}>{selectedSku}</p>
  {/if}

  {#if open && q.trim().length >= 2}
    <div class="absolute left-0 top-full z-20 mt-1 w-72 overflow-hidden rounded-md border border-slate-200 bg-white shadow-lg">
      {#if loading}
        <p class="px-3 py-2 text-xs text-slate-500">Searching…</p>
      {:else if hits.length === 0}
        <p class="px-3 py-2 text-xs text-slate-500">No matching items.</p>
      {:else}
        <ul class="max-h-64 divide-y divide-slate-100 overflow-y-auto text-sm">
          {#each hits as hit, i (hit.id)}
            <li>
              <button
                type="button"
                onmousedown={(e) => {
                  e.preventDefault();
                  pick(hit);
                }}
                onmouseenter={() => (activeIdx = i)}
                class="block w-full px-3 py-1.5 text-left"
                class:bg-sky-50={i === activeIdx}
              >
                <div class="flex items-baseline justify-between gap-2">
                  <span class="font-mono text-xs text-slate-500">{hit.sku}</span>
                  <span class="text-xs text-slate-400">
                    {hit.unit_of_measure ?? ''}
                    {hit.pack_size ? `×${hit.pack_size}` : ''}
                  </span>
                </div>
                <div class="truncate">{hit.name}</div>
                {#if hit.base_price !== null && hit.base_price !== undefined}
                  <div class="text-xs text-slate-500">${Number(hit.base_price).toFixed(2)}</div>
                {/if}
              </button>
            </li>
          {/each}
        </ul>
      {/if}
    </div>
  {/if}
</div>

<script lang="ts">
  import { goto } from '$app/navigation';
  import { currency } from '$lib/format';

  type ProductHit = { id: string; sku: string; name: string; status: string };
  type CustomerHit = { id: string; business_name: string; email: string | null };
  type OrderHit = {
    id: string;
    status: string;
    total: number;
    placed_at: string;
    customer: { business_name: string } | null;
  };

  type Hit = { href: string; label: string; group: string };

  let q = $state('');
  let open = $state(false);
  let loading = $state(false);
  let products = $state<ProductHit[]>([]);
  let customers = $state<CustomerHit[]>([]);
  let orders = $state<OrderHit[]>([]);
  let activeIdx = $state(-1);
  let debounceId: ReturnType<typeof setTimeout> | null = null;
  let abortCtl: AbortController | null = null;
  let rootEl: HTMLDivElement | undefined = $state();

  const hits = $derived<Hit[]>([
    ...products.map((p) => ({
      href: `/catalog/${p.id}`,
      label: `${p.sku} · ${p.name}`,
      group: 'Products'
    })),
    ...customers.map((c) => ({
      href: `/clients/${c.id}`,
      label: c.business_name,
      group: 'Clients'
    })),
    ...orders.map((o) => ({
      href: `/orders/${o.id}`,
      label: `${o.id.slice(0, 8)} · ${o.customer?.business_name ?? '—'} · ${currency(o.total)}`,
      group: 'Orders'
    }))
  ]);

  function reset() {
    products = [];
    customers = [];
    orders = [];
    activeIdx = -1;
  }

  function runSearch(value: string) {
    if (abortCtl) abortCtl.abort();
    if (value.trim().length < 2) {
      reset();
      loading = false;
      return;
    }
    abortCtl = new AbortController();
    loading = true;
    fetch(`/api/search?q=${encodeURIComponent(value.trim())}`, { signal: abortCtl.signal })
      .then((r) => (r.ok ? r.json() : { products: [], customers: [], orders: [] }))
      .then((data) => {
        products = data.products ?? [];
        customers = data.customers ?? [];
        orders = data.orders ?? [];
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

  function navigate(hit: Hit) {
    open = false;
    q = '';
    reset();
    goto(hit.href);
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
        navigate(hit);
      }
    } else if (e.key === 'Escape') {
      open = false;
    }
  }

  function onDocClick(e: MouseEvent) {
    if (!rootEl) return;
    if (!rootEl.contains(e.target as Node)) open = false;
  }

  function onGlobalKey(e: KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      const input = rootEl?.querySelector('input');
      input?.focus();
      open = true;
    }
  }

  $effect(() => {
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onGlobalKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onGlobalKey);
    };
  });

  function groupHeader(i: number): string | null {
    if (i === 0) return hits[0].group;
    return hits[i].group !== hits[i - 1].group ? hits[i].group : null;
  }
</script>

<div bind:this={rootEl} class="relative w-72">
  <input
    type="search"
    placeholder="Search SKU, customer, order…"
    value={q}
    oninput={onInput}
    onfocus={() => (open = true)}
    onkeydown={onKeydown}
    class="w-full rounded border border-slate-300 bg-white px-3 py-1.5 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
    aria-label="Global search"
  />
  <kbd
    class="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded border border-slate-200 bg-slate-50 px-1 text-[10px] text-slate-400"
  >
    ⌘K
  </kbd>

  {#if open && q.trim().length >= 2}
    <div
      class="absolute right-0 z-30 mt-1 w-[420px] max-w-[90vw] overflow-hidden rounded-md border border-slate-200 bg-white shadow-lg"
    >
      {#if loading}
        <p class="px-3 py-3 text-xs text-slate-500">Searching…</p>
      {:else if hits.length === 0}
        <p class="px-3 py-3 text-xs text-slate-500">No matches.</p>
      {:else}
        <ul>
          {#each hits as hit, i (hit.href)}
            {@const header = groupHeader(i)}
            {#if header}
              <li
                class="border-b border-slate-100 bg-slate-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500"
              >
                {header}
              </li>
            {/if}
            <li class="border-b border-slate-100 last:border-b-0">
              <button
                type="button"
                onclick={() => navigate(hit)}
                onmouseenter={() => (activeIdx = i)}
                class="block w-full px-3 py-2 text-left text-sm"
                class:bg-sky-50={i === activeIdx}
              >
                {hit.label}
              </button>
            </li>
          {/each}
        </ul>
      {/if}
    </div>
  {/if}
</div>

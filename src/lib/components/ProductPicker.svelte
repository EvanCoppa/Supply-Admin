<script lang="ts">
  import { Button, Card } from '$lib/components/ui';

  type Product = { id: string; sku: string; name: string };

  interface Props {
    products: Product[];
    /** Hidden form field name. Selected ids are emitted as a comma-separated string. */
    name?: string;
    /** Initially selected product ids. */
    initial?: string[];
    /** Hide products with these ids. */
    exclude?: string[];
    placeholder?: string;
  }

  let {
    products,
    name = 'product_ids',
    initial = [],
    exclude = [],
    placeholder = 'Search SKU or name…'
  }: Props = $props();

  const excludeSet = $derived(new Set(exclude));
  // svelte-ignore state_referenced_locally
  let selected = $state<string[]>([...initial]);
  let q = $state('');

  const productMap = $derived(new Map(products.map((p) => [p.id, p])));
  const filtered = $derived.by(() => {
    const term = q.trim().toLowerCase();
    return products
      .filter((p) => !excludeSet.has(p.id) && !selected.includes(p.id))
      .filter(
        (p) =>
          term === '' ||
          p.sku.toLowerCase().includes(term) ||
          p.name.toLowerCase().includes(term)
      )
      .slice(0, 50);
  });

  function add(id: string) {
    if (!selected.includes(id)) selected = [...selected, id];
    q = '';
  }

  function remove(id: string) {
    selected = selected.filter((x) => x !== id);
  }

  function move(id: string, direction: -1 | 1) {
    const i = selected.indexOf(id);
    const j = i + direction;
    if (i < 0 || j < 0 || j >= selected.length) return;
    const next = [...selected];
    [next[i], next[j]] = [next[j], next[i]];
    selected = next;
  }
</script>

<div class="space-y-2">
  <input type="hidden" {name} value={selected.join(',')} />

  <Card>
    {#if selected.length === 0}
      <p class="px-3 py-3 text-xs text-slate-500">No products selected.</p>
    {:else}
      <ul class="divide-y divide-slate-100 text-sm">
        {#each selected as id, i (id)}
          {@const p = productMap.get(id)}
          <li class="flex items-center gap-2 px-3 py-1.5">
            <span class="w-6 font-mono text-xs text-slate-400">{i + 1}</span>
            {#if p}
              <span class="font-mono text-xs text-slate-500">{p.sku}</span>
              <span class="min-w-0 flex-1 truncate">{p.name}</span>
            {:else}
              <span class="font-mono text-xs text-slate-400">{id.slice(0, 8)}</span>
              <span class="text-slate-400">unknown product</span>
            {/if}
            <div class="flex gap-1">
              <Button
                variant="outline"
                size="xs"
                aria-label="Move up"
                onclick={() => move(id, -1)}
                disabled={i === 0}
              >↑</Button>
              <Button
                variant="outline"
                size="xs"
                aria-label="Move down"
                onclick={() => move(id, 1)}
                disabled={i === selected.length - 1}
              >↓</Button>
              <Button variant="destructive" size="xs" onclick={() => remove(id)}>Remove</Button>
            </div>
          </li>
        {/each}
      </ul>
    {/if}
  </Card>

  <Card>
    <input
      type="search"
      bind:value={q}
      {placeholder}
      class="w-full rounded-t border-b border-slate-200 px-3 py-1.5 text-sm focus:outline-none"
    />
    {#if filtered.length === 0}
      <p class="px-3 py-2 text-xs text-slate-500">No matching products.</p>
    {:else}
      <ul class="max-h-56 divide-y divide-slate-100 overflow-y-auto text-sm">
        {#each filtered as p (p.id)}
          <li>
            <button
              type="button"
              onclick={() => add(p.id)}
              class="block w-full px-3 py-1.5 text-left hover:bg-slate-50"
            >
              <span class="font-mono text-xs text-slate-500">{p.sku}</span>
              {p.name}
            </button>
          </li>
        {/each}
      </ul>
    {/if}
  </Card>
</div>

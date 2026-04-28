<script lang="ts">
  import { enhance } from '$app/forms';
  import { invalidateAll } from '$app/navigation';

  let { data, form } = $props();

  type Item = (typeof data.items)[number];

  // svelte-ignore state_referenced_locally
  let order = $state<Item[]>([...data.items]);
  let dragId = $state<string | null>(null);
  let savingOrder = $state(false);
  let orderError = $state<string | null>(null);

  $effect(() => {
    // Re-sync local order when server data changes (e.g. after add/remove).
    order = [...data.items];
  });

  function onDragStart(e: DragEvent, id: string) {
    dragId = id;
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', id);
    }
  }

  function onDragOver(e: DragEvent, overId: string) {
    if (!dragId || dragId === overId) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    const from = order.findIndex((i) => i.id === dragId);
    const to = order.findIndex((i) => i.id === overId);
    if (from < 0 || to < 0) return;
    const next = [...order];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    order = next;
  }

  async function onDrop() {
    if (!dragId) return;
    dragId = null;
    await persist();
  }

  async function persist() {
    savingOrder = true;
    orderError = null;
    const fd = new FormData();
    fd.set('ids', order.map((i) => i.id).join(','));
    const res = await fetch('?/reorder', {
      method: 'POST',
      body: fd,
      headers: { 'x-sveltekit-action': 'true' }
    });
    savingOrder = false;
    if (!res.ok) {
      orderError = 'Failed to save new order. Reverting.';
      order = [...data.items];
      return;
    }
    await invalidateAll();
  }
</script>

<div class="space-y-5">
  {#if form?.message}
    <div class="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">
      {form.message}
    </div>
  {/if}
  {#if orderError}
    <div class="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">
      {orderError}
    </div>
  {/if}

  <div class="grid gap-3 sm:grid-cols-2">
    <form
      method="POST"
      action="?/addProduct"
      use:enhance
      class="flex gap-2 rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
    >
      <select
        name="product_id"
        class="flex-1 rounded border border-slate-300 px-2 py-1.5 text-sm"
      >
        <option value="">Add individual product…</option>
        {#each data.products as p}
          <option value={p.id}>{p.sku} · {p.name}</option>
        {/each}
      </select>
      <button
        type="submit"
        class="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
      >
        Add
      </button>
    </form>

    <form
      method="POST"
      action="?/addGroup"
      use:enhance
      class="flex gap-2 rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
    >
      <select name="group_id" class="flex-1 rounded border border-slate-300 px-2 py-1.5 text-sm">
        <option value="">Add featured group…</option>
        {#each data.groups as g}
          <option value={g.id}>{g.name}</option>
        {/each}
      </select>
      <button
        type="submit"
        class="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
      >
        Add
      </button>
    </form>
  </div>

  <div class="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
    <div class="flex items-center justify-between border-b border-slate-200 px-4 py-2">
      <p class="text-xs text-slate-500">Drag rows to reorder. Order saves automatically.</p>
      {#if savingOrder}
        <span class="text-xs text-slate-500">Saving…</span>
      {/if}
    </div>
    {#if order.length === 0}
      <p class="px-4 py-10 text-center text-sm text-slate-500">
        No featured items yet. Add a product or group above.
      </p>
    {:else}
      <ul class="divide-y divide-slate-100 text-sm">
        {#each order as item, i (item.id)}
          <li
            draggable="true"
            ondragstart={(e) => onDragStart(e, item.id)}
            ondragover={(e) => onDragOver(e, item.id)}
            ondrop={onDrop}
            ondragend={() => (dragId = null)}
            class="flex items-center gap-3 px-4 py-2"
            class:bg-sky-50={dragId === item.id}
            class:opacity-60={dragId === item.id}
          >
            <span
              class="cursor-grab select-none text-slate-400"
              aria-hidden="true"
              title="Drag to reorder"
            >
              ⋮⋮
            </span>
            <span class="w-8 font-mono text-xs text-slate-500">{i + 1}</span>
            <span class="w-16 text-xs uppercase tracking-wider text-slate-500">
              {item.product_id ? 'Product' : 'Group'}
            </span>
            <div class="min-w-0 flex-1 truncate">
              {#if item.product_id}
                <span class="font-mono text-xs text-slate-500">{item.product?.sku ?? ''}</span>
                {item.product?.name ?? '—'}
              {:else}
                {item.group?.name ?? '—'}
              {/if}
            </div>
            <form method="POST" action="?/remove" use:enhance>
              <input type="hidden" name="id" value={item.id} />
              <button
                type="submit"
                class="rounded border border-red-300 px-2 py-0.5 text-xs text-red-700 hover:bg-red-50"
              >
                Remove
              </button>
            </form>
          </li>
        {/each}
      </ul>
    {/if}
  </div>
</div>

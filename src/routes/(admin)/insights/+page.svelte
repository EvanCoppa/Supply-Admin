<script lang="ts">
  import { enhance } from '$app/forms';
  import { currency, dateShort } from '$lib/format';

  let { data, form } = $props();

  const watchedIds = $derived(new Set(data.watchlist.map((w) => w.product_id)));

  function daysSince(iso: string): number {
    const d = new Date(iso);
    return Math.floor((Date.now() - d.getTime()) / 86_400_000);
  }
</script>

<svelte:head><title>Insights · Supply Admin</title></svelte:head>

<section class="space-y-6">
  <header>
    <h1 class="text-2xl font-semibold">Demand insights</h1>
    <p class="text-sm text-slate-500">
      Trending items and repeat-order patterns across all clients, last 30 days.
    </p>
  </header>

  {#if form?.message}
    <div class="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">
      {form.message}
    </div>
  {/if}

  <div class="grid gap-5 lg:grid-cols-2">
    <div class="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h2 class="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-500">
        Top items (last 30 days)
      </h2>
      {#if data.velocity.length === 0}
        <p class="text-sm text-slate-500">No orders in the last 30 days.</p>
      {:else}
        <table class="w-full text-sm">
          <thead class="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th class="px-2 py-2 text-left font-medium">Item</th>
              <th class="px-2 py-2 text-right font-medium">Qty</th>
              <th class="px-2 py-2 text-right font-medium">Orders</th>
              <th class="px-2 py-2 text-right font-medium">Clients</th>
              <th class="px-2 py-2 text-right font-medium">Revenue</th>
              <th class="px-2 py-2 text-right font-medium">Watch</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            {#each data.velocity as v (v.product_id)}
              <tr class="hover:bg-slate-50">
                <td class="px-2 py-2">
                  <a class="text-sky-700 hover:underline" href="/inventory/{v.product_id}">
                    {v.name ?? '—'}
                  </a>
                  <p class="font-mono text-[10px] text-slate-400">{v.sku ?? ''}</p>
                </td>
                <td class="px-2 py-2 text-right font-medium"
                  >{Number(v.total_qty).toLocaleString()}</td
                >
                <td class="px-2 py-2 text-right text-slate-600">{v.order_count}</td>
                <td class="px-2 py-2 text-right text-slate-600">{v.unique_customers}</td>
                <td class="px-2 py-2 text-right text-slate-600">{currency(v.revenue)}</td>
                <td class="px-2 py-2 text-right">
                  {#if watchedIds.has(v.product_id)}
                    <span class="rounded bg-amber-50 px-2 py-0.5 text-xs text-amber-800"
                      >★ watching</span
                    >
                  {:else}
                    <form method="POST" action="?/watch" use:enhance class="inline">
                      <input type="hidden" name="product_id" value={v.product_id} />
                      <button
                        type="submit"
                        class="rounded border border-slate-300 px-2 py-0.5 text-xs text-slate-700 hover:bg-slate-100"
                      >
                        + Watch
                      </button>
                    </form>
                  {/if}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      {/if}
    </div>

    <div class="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h2 class="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-500">
        Repeat patterns (2+ orders in 30 days)
      </h2>
      {#if data.repeats.length === 0}
        <p class="text-sm text-slate-500">No repeat-order patterns yet.</p>
      {:else}
        <ul class="space-y-2 text-sm">
          {#each data.repeats as r (`${r.customer_id}-${r.product_id}`)}
            <li class="rounded border border-slate-100 px-3 py-2">
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <p class="truncate font-medium">
                    <a class="text-sky-700 hover:underline" href="/clients/{r.customer_id}/trends">
                      {r.customer_name}
                    </a>
                    <span class="text-slate-500"> ordered </span>
                    <a class="text-slate-800 hover:underline" href="/inventory/{r.product_id}">
                      {r.product_name ?? r.product_sku ?? '—'}
                    </a>
                  </p>
                  <p class="text-xs text-slate-500">
                    {r.order_count} times · {Number(r.total_qty).toLocaleString()} units · last
                    {daysSince(r.last_ordered_at)}d ago
                  </p>
                </div>
                {#if !watchedIds.has(r.product_id)}
                  <form method="POST" action="?/watch" use:enhance>
                    <input type="hidden" name="product_id" value={r.product_id} />
                    <button
                      type="submit"
                      class="shrink-0 rounded border border-slate-300 px-2 py-0.5 text-xs text-slate-700 hover:bg-slate-100"
                    >
                      + Watch
                    </button>
                  </form>
                {/if}
              </div>
            </li>
          {/each}
        </ul>
      {/if}
    </div>
  </div>

  <div class="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
    <h2 class="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-500">
      Watch list ({data.watchlist.length})
    </h2>
    {#if data.watchlist.length === 0}
      <p class="text-sm text-slate-500">
        Nothing on the watch list. Add items from the trending or repeat tables to flag them for
        stock-up consideration.
      </p>
    {:else}
      <ul class="divide-y divide-slate-100 text-sm">
        {#each data.watchlist as w (w.id)}
          <li class="flex items-center justify-between gap-3 py-2">
            <div>
              <a
                class="font-medium text-sky-700 hover:underline"
                href="/inventory/{w.product?.id ?? w.product_id}"
              >
                {w.product?.name ?? '—'}
              </a>
              <p class="font-mono text-[10px] text-slate-400">{w.product?.sku ?? ''}</p>
              {#if w.notes}
                <p class="text-xs text-slate-500">{w.notes}</p>
              {/if}
            </div>
            <div class="flex items-center gap-2 text-xs text-slate-500">
              <span>added {dateShort(w.created_at)}</span>
              <form method="POST" action="?/unwatch" use:enhance>
                <input type="hidden" name="id" value={w.id} />
                <button
                  type="submit"
                  class="rounded border border-slate-300 px-2 py-0.5 hover:bg-slate-100"
                >
                  Remove
                </button>
              </form>
            </div>
          </li>
        {/each}
      </ul>
    {/if}
  </div>
</section>

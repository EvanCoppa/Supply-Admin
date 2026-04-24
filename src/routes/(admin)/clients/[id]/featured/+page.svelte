<script lang="ts">
  import { enhance } from '$app/forms';

  let { data, form } = $props();
</script>

<div class="space-y-5">
  {#if form?.message}
    <div class="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">
      {form.message}
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
    {#if data.items.length === 0}
      <p class="px-4 py-10 text-center text-sm text-slate-500">
        No featured items yet. Add a product or group above.
      </p>
    {:else}
      <table class="w-full text-sm">
        <thead class="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
          <tr>
            <th class="px-4 py-2 text-left font-medium w-16">Order</th>
            <th class="px-4 py-2 text-left font-medium">Type</th>
            <th class="px-4 py-2 text-left font-medium">Target</th>
            <th class="px-4 py-2"></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          {#each data.items as item}
            <tr>
              <td class="px-4 py-2 font-mono text-xs">{item.display_order}</td>
              <td class="px-4 py-2">{item.product_id ? 'Product' : 'Group'}</td>
              <td class="px-4 py-2">
                {#if item.product_id}
                  <span class="font-mono text-xs text-slate-500">{item.product?.sku ?? ''}</span>
                  {item.product?.name ?? '—'}
                {:else}
                  {item.group?.name ?? '—'}
                {/if}
              </td>
              <td class="px-4 py-2 text-right">
                <div class="inline-flex gap-1">
                  <form method="POST" action="?/reorder" use:enhance>
                    <input type="hidden" name="id" value={item.id} />
                    <input type="hidden" name="direction" value="up" />
                    <button
                      type="submit"
                      class="rounded border border-slate-300 px-2 py-0.5 text-xs hover:bg-slate-100"
                    >
                      ↑
                    </button>
                  </form>
                  <form method="POST" action="?/reorder" use:enhance>
                    <input type="hidden" name="id" value={item.id} />
                    <input type="hidden" name="direction" value="down" />
                    <button
                      type="submit"
                      class="rounded border border-slate-300 px-2 py-0.5 text-xs hover:bg-slate-100"
                    >
                      ↓
                    </button>
                  </form>
                  <form method="POST" action="?/remove" use:enhance>
                    <input type="hidden" name="id" value={item.id} />
                    <button
                      type="submit"
                      class="rounded border border-red-300 px-2 py-0.5 text-xs text-red-700 hover:bg-red-50"
                    >
                      Remove
                    </button>
                  </form>
                </div>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
  </div>
</div>

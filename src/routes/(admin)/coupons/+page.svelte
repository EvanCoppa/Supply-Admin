<script lang="ts">
  import { enhance } from '$app/forms';
  import { currency, dateTime } from '$lib/format';
  import type { Coupon } from '$lib/types/db';

  let { data, form } = $props();

  let editingId = $state<string | null>(null);
  let showCreate = $state(false);

  // Build a datetime-local input value (local tz) from a stored UTC timestamp.
  function toLocalInput(iso: string | null): string {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function discountLabel(c: Coupon): string {
    if (c.discount_type === 'percent') {
      return `${c.discount_value}%${c.max_discount ? ` · max ${currency(c.max_discount)}` : ''}`;
    }
    return currency(c.discount_value);
  }

  type Status = { label: string; cls: string };
  function status(c: Coupon): Status {
    const now = Date.now();
    if (!c.active) return { label: 'Inactive', cls: 'bg-slate-100 text-slate-600' };
    if (c.expires_at && new Date(c.expires_at).getTime() < now)
      return { label: 'Expired', cls: 'bg-amber-100 text-amber-800' };
    if (c.starts_at && new Date(c.starts_at).getTime() > now)
      return { label: 'Scheduled', cls: 'bg-sky-100 text-sky-800' };
    if (c.usage_limit != null && c.times_redeemed >= c.usage_limit)
      return { label: 'Used up', cls: 'bg-amber-100 text-amber-800' };
    return { label: 'Active', cls: 'bg-emerald-100 text-emerald-800' };
  }
</script>

<svelte:head><title>Coupons · Supply Admin</title></svelte:head>

{#snippet fields(c: Coupon | null)}
  <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
    <label class="block">
      <span class="mb-1 block text-xs font-medium">Code</span>
      <input
        name="code"
        value={c?.code ?? ''}
        required
        placeholder="SAVE10"
        class="w-full rounded border border-slate-300 px-2 py-1.5 font-mono text-sm uppercase"
      />
    </label>
    <label class="block">
      <span class="mb-1 block text-xs font-medium">Discount type</span>
      <select
        name="discount_type"
        value={c?.discount_type ?? 'fixed'}
        class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
      >
        <option value="fixed">Fixed ($)</option>
        <option value="percent">Percent (%)</option>
      </select>
    </label>
    <label class="block">
      <span class="mb-1 block text-xs font-medium">Discount value</span>
      <input
        name="discount_value"
        type="number"
        step="0.01"
        min="0"
        value={c?.discount_value ?? ''}
        required
        class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
      />
    </label>
    <label class="block sm:col-span-2 lg:col-span-3">
      <span class="mb-1 block text-xs font-medium">Description</span>
      <input
        name="description"
        value={c?.description ?? ''}
        placeholder="Optional internal note"
        class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
      />
    </label>
    <label class="block">
      <span class="mb-1 block text-xs font-medium">Minimum subtotal ($)</span>
      <input
        name="min_subtotal"
        type="number"
        step="0.01"
        min="0"
        value={c?.min_subtotal ?? ''}
        placeholder="0"
        class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
      />
    </label>
    <label class="block">
      <span class="mb-1 block text-xs font-medium">Max discount cap ($)</span>
      <input
        name="max_discount"
        type="number"
        step="0.01"
        min="0"
        value={c?.max_discount ?? ''}
        placeholder="No cap"
        class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
      />
    </label>
    <label class="block">
      <span class="mb-1 block text-xs font-medium">Usage limit</span>
      <input
        name="usage_limit"
        type="number"
        step="1"
        min="0"
        value={c?.usage_limit ?? ''}
        placeholder="Unlimited"
        class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
      />
    </label>
    <label class="block">
      <span class="mb-1 block text-xs font-medium">Starts at</span>
      <input
        name="starts_at"
        type="datetime-local"
        value={toLocalInput(c?.starts_at ?? null)}
        class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
      />
    </label>
    <label class="block">
      <span class="mb-1 block text-xs font-medium">Expires at</span>
      <input
        name="expires_at"
        type="datetime-local"
        value={toLocalInput(c?.expires_at ?? null)}
        class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
      />
    </label>
    <label class="flex items-center gap-2 pt-5 text-sm">
      <input
        name="active"
        type="checkbox"
        checked={c ? c.active : true}
        class="h-4 w-4 rounded border-slate-300"
      />
      Active
    </label>
  </div>
{/snippet}

<section class="space-y-4">
  <header class="flex items-start justify-between gap-4">
    <div>
      <h1 class="text-2xl font-semibold">Coupons</h1>
      <p class="text-sm text-slate-500">
        Discount codes customers can apply at checkout. Codes are case-insensitive.
      </p>
    </div>
    <button
      type="button"
      onclick={() => (showCreate = !showCreate)}
      class="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
    >
      {showCreate ? 'Close' : 'New coupon'}
    </button>
  </header>

  {#if form?.message}
    <div class="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">
      {form.message}
    </div>
  {/if}
  {#if data.loadError}
    <div class="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">
      Couldn’t load coupons: {data.loadError}
    </div>
  {/if}

  {#if showCreate}
    <form
      method="POST"
      action="?/create"
      use:enhance={() =>
        async ({ update, result }) => {
          await update();
          if (result.type === 'success') showCreate = false;
        }}
      class="space-y-3 rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
    >
      {@render fields(null)}
      <div class="flex justify-end">
        <button
          type="submit"
          class="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
        >
          Create coupon
        </button>
      </div>
    </form>
  {/if}

  <div class="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
    {#if data.coupons.length === 0}
      <p class="px-4 py-10 text-center text-sm text-slate-500">No coupons yet.</p>
    {:else}
      <table class="w-full text-sm">
        <thead class="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
          <tr>
            <th class="px-3 py-2 text-left font-medium">Code</th>
            <th class="px-3 py-2 text-left font-medium">Discount</th>
            <th class="px-3 py-2 text-right font-medium">Min spend</th>
            <th class="px-3 py-2 text-left font-medium">Window</th>
            <th class="px-3 py-2 text-right font-medium">Used</th>
            <th class="px-3 py-2 text-left font-medium">Status</th>
            <th class="px-3 py-2 text-right font-medium"></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          {#each data.coupons as coupon (coupon.id)}
            {#if editingId === coupon.id}
              <tr>
                <td colspan="7" class="bg-slate-50 px-3 py-4">
                  <form
                    method="POST"
                    action="?/update"
                    use:enhance={() =>
                      async ({ update, result }) => {
                        await update();
                        if (result.type === 'success') editingId = null;
                      }}
                    class="space-y-3"
                  >
                    <input type="hidden" name="id" value={coupon.id} />
                    {@render fields(coupon)}
                    <div class="flex justify-end gap-2">
                      <button
                        type="button"
                        onclick={() => (editingId = null)}
                        class="rounded border border-slate-300 px-3 py-1.5 text-xs hover:bg-slate-100"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        class="rounded bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
                      >
                        Save
                      </button>
                    </div>
                  </form>
                </td>
              </tr>
            {:else}
              {@const st = status(coupon)}
              <tr class="hover:bg-slate-50">
                <td class="px-3 py-2">
                  <span class="font-mono font-medium">{coupon.code}</span>
                  {#if coupon.description}
                    <p class="text-xs text-slate-500">{coupon.description}</p>
                  {/if}
                </td>
                <td class="px-3 py-2">{discountLabel(coupon)}</td>
                <td class="px-3 py-2 text-right">
                  {coupon.min_subtotal > 0 ? currency(coupon.min_subtotal) : '—'}
                </td>
                <td class="px-3 py-2 text-xs text-slate-600">
                  {#if coupon.starts_at || coupon.expires_at}
                    {dateTime(coupon.starts_at)} → {dateTime(coupon.expires_at)}
                  {:else}
                    —
                  {/if}
                </td>
                <td class="px-3 py-2 text-right">
                  {coupon.times_redeemed}{coupon.usage_limit != null
                    ? ` / ${coupon.usage_limit}`
                    : ''}
                </td>
                <td class="px-3 py-2">
                  <span class="inline-block rounded px-2 py-0.5 text-xs font-medium {st.cls}">
                    {st.label}
                  </span>
                </td>
                <td class="px-3 py-2 text-right whitespace-nowrap">
                  <form method="POST" action="?/toggle" use:enhance class="inline">
                    <input type="hidden" name="id" value={coupon.id} />
                    <input type="hidden" name="active" value={(!coupon.active).toString()} />
                    <button
                      type="submit"
                      class="rounded border border-slate-300 px-2 py-0.5 text-xs hover:bg-slate-100"
                    >
                      {coupon.active ? 'Disable' : 'Enable'}
                    </button>
                  </form>
                  <button
                    type="button"
                    onclick={() => (editingId = coupon.id)}
                    class="rounded border border-slate-300 px-2 py-0.5 text-xs hover:bg-slate-100"
                  >
                    Edit
                  </button>
                  <form
                    method="POST"
                    action="?/delete"
                    use:enhance
                    class="inline"
                    onsubmit={(e) => {
                      if (!confirm(`Delete coupon ${coupon.code}?`)) e.preventDefault();
                    }}
                  >
                    <input type="hidden" name="id" value={coupon.id} />
                    <button
                      type="submit"
                      class="rounded border border-red-300 px-2 py-0.5 text-xs text-red-700 hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </form>
                </td>
              </tr>
            {/if}
          {/each}
        </tbody>
      </table>
    {/if}
  </div>
</section>

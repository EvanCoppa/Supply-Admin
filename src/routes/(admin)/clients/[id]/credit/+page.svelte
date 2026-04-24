<script lang="ts">
  import { enhance } from '$app/forms';
  import { currency, dateTime } from '$lib/format';

  let { data, form } = $props();
  const c = $derived(data.credit);
</script>

<div class="space-y-5">
  {#if form?.message}
    <div class="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">{form.message}</div>
  {/if}
  {#if form?.saved}
    <div class="rounded border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">Saved.</div>
  {/if}

  {#if c}
    <div class="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 text-sm shadow-sm sm:grid-cols-4">
      <div>
        <p class="text-xs uppercase tracking-wider text-slate-500">Credit limit</p>
        <p class="font-semibold">{currency(c.credit_limit)}</p>
      </div>
      <div>
        <p class="text-xs uppercase tracking-wider text-slate-500">Net terms</p>
        <p class="font-semibold">{c.net_terms_days != null ? `Net ${c.net_terms_days}` : '—'}</p>
      </div>
      <div>
        <p class="text-xs uppercase tracking-wider text-slate-500">Status</p>
        <p class="font-semibold">
          {#if c.on_hold}
            <span class="rounded bg-red-50 px-1.5 py-0.5 text-xs text-red-700">On hold</span>
          {:else}
            <span class="rounded bg-emerald-50 px-1.5 py-0.5 text-xs text-emerald-700">OK</span>
          {/if}
        </p>
      </div>
      <div>
        <p class="text-xs uppercase tracking-wider text-slate-500">Updated</p>
        <p class="text-slate-600">{dateTime(c.updated_at)}</p>
      </div>
    </div>
  {/if}

  <form
    method="POST"
    action="?/save"
    use:enhance
    class="grid gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-2"
  >
    <label class="block">
      <span class="mb-1 block text-sm font-medium">Credit limit (USD)</span>
      <input
        type="number"
        step="0.01"
        min="0"
        name="credit_limit"
        value={c?.credit_limit ?? 0}
        class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
      />
    </label>
    <label class="block">
      <span class="mb-1 block text-sm font-medium">Net terms (days)</span>
      <input
        type="number"
        min="0"
        name="net_terms_days"
        value={c?.net_terms_days ?? ''}
        placeholder="e.g. 30"
        class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
      />
    </label>
    <label class="inline-flex items-center gap-2 text-sm sm:col-span-2">
      <input type="checkbox" name="on_hold" checked={c?.on_hold ?? false} />
      Place account on credit hold
    </label>
    <label class="block sm:col-span-2">
      <span class="mb-1 block text-sm font-medium">Hold reason</span>
      <textarea
        name="hold_reason"
        rows="2"
        class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
        placeholder="Only shown internally"
      >{c?.hold_reason ?? ''}</textarea>
    </label>
    <div class="sm:col-span-2 flex justify-end">
      <button
        type="submit"
        class="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
      >
        Save credit terms
      </button>
    </div>
  </form>
</div>

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

  <form
    method="POST"
    action="?/create"
    use:enhance
    class="grid gap-3 rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-3"
  >
    <p class="sm:col-span-3 font-semibold">New address</p>
    <label class="block">
      <span class="mb-1 block text-xs font-medium">Label</span>
      <input name="label" class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm" />
    </label>
    <label class="block sm:col-span-2">
      <span class="mb-1 block text-xs font-medium">Line 1</span>
      <input
        name="line1"
        required
        class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
      />
    </label>
    <label class="block sm:col-span-3">
      <span class="mb-1 block text-xs font-medium">Line 2</span>
      <input name="line2" class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm" />
    </label>
    <label class="block">
      <span class="mb-1 block text-xs font-medium">City</span>
      <input name="city" required class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm" />
    </label>
    <label class="block">
      <span class="mb-1 block text-xs font-medium">Region</span>
      <input
        name="region"
        required
        class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
      />
    </label>
    <label class="block">
      <span class="mb-1 block text-xs font-medium">Postal code</span>
      <input
        name="postal_code"
        required
        class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
      />
    </label>
    <label class="block">
      <span class="mb-1 block text-xs font-medium">Country (ISO 2)</span>
      <input
        name="country"
        required
        maxlength="2"
        placeholder="US"
        class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm uppercase"
      />
    </label>
    <label class="inline-flex items-center gap-2 text-sm sm:col-span-2">
      <input type="checkbox" name="is_default_shipping" />
      Set as default shipping
    </label>
    <div class="sm:col-span-3 flex justify-end">
      <button
        type="submit"
        class="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
      >
        Add address
      </button>
    </div>
  </form>

  <div class="space-y-3">
    {#if data.addresses.length === 0}
      <p class="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
        No addresses yet.
      </p>
    {:else}
      {#each data.addresses as a}
        <div
          class="flex items-start justify-between rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
        >
          <div class="space-y-0.5 text-sm">
            <div class="flex items-center gap-2">
              <span class="font-medium">{a.label ?? 'Address'}</span>
              {#if a.is_default_shipping}
                <span class="rounded bg-sky-50 px-2 py-0.5 text-xs text-sky-700">Default shipping</span>
              {/if}
            </div>
            <p>{a.line1}{a.line2 ? `, ${a.line2}` : ''}</p>
            <p class="text-slate-600">
              {a.city}, {a.region} {a.postal_code} · {a.country}
            </p>
          </div>
          <div class="flex gap-2">
            {#if !a.is_default_shipping}
              <form method="POST" action="?/setDefault" use:enhance>
                <input type="hidden" name="id" value={a.id} />
                <button
                  type="submit"
                  class="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-100"
                >
                  Set default
                </button>
              </form>
            {/if}
            <form method="POST" action="?/delete" use:enhance>
              <input type="hidden" name="id" value={a.id} />
              <button
                type="submit"
                onclick={(e) => {
                  if (!confirm('Delete this address?')) e.preventDefault();
                }}
                class="rounded border border-red-300 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
              >
                Delete
              </button>
            </form>
          </div>
        </div>
      {/each}
    {/if}
  </div>
</div>

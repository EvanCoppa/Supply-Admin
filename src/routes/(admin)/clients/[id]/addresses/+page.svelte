<script lang="ts">
  import { enhance } from '$app/forms';
  import AddressInput from '$lib/components/AddressInput.svelte';

  let { data, form } = $props();
</script>

<div class="space-y-5">
  {#if form?.message}
    <div class="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">
      {form.message}
    </div>
  {/if}

  <form method="POST" action="?/create" use:enhance class="space-y-4">
    <div class="space-y-3">
      <h2 class="font-semibold">New address</h2>
      <AddressInput label="Address details" namePrefix="" hideLabel={true} />

      <label class="inline-flex items-center gap-2 text-sm">
        <input type="checkbox" name="is_default_shipping" />
        Set as default shipping
      </label>
    </div>

    <div class="flex justify-end">
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
      <p
        class="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500"
      >
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
                <span class="rounded bg-sky-50 px-2 py-0.5 text-xs text-sky-700"
                  >Default shipping</span
                >
              {/if}
            </div>
            <p>{a.line1}{a.line2 ? `, ${a.line2}` : ''}</p>
            <p class="text-slate-600">
              {a.city}, {a.region}
              {a.postal_code} · {a.country}
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

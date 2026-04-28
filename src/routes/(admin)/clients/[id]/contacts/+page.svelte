<script lang="ts">
  import { enhance } from '$app/forms';

  let { data, form } = $props();

  let showCreate = $state(false);
  let editingId = $state<string | null>(null);
</script>

<div class="space-y-5">
  {#if form?.message}
    <div class="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">
      {form.message}
    </div>
  {/if}
  {#if form?.saved}
    <div class="rounded border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
      Saved.
    </div>
  {/if}

  <div class="flex items-center justify-between">
    <div>
      <h2 class="font-semibold">Contacts</h2>
      <p class="text-sm text-slate-500">
        {data.contacts.length} on file
      </p>
    </div>
    <button
      type="button"
      onclick={() => {
        showCreate = !showCreate;
        editingId = null;
      }}
      class="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
    >
      {showCreate ? 'Cancel' : 'New contact'}
    </button>
  </div>

  {#if showCreate}
    <form
      method="POST"
      action="?/create"
      use:enhance={() => () => {
        showCreate = false;
      }}
      class="grid gap-3 rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-3"
    >
      <label class="block">
        <span class="mb-1 block text-xs font-medium">First name</span>
        <input name="first_name" class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm" />
      </label>
      <label class="block">
        <span class="mb-1 block text-xs font-medium">Last name</span>
        <input name="last_name" class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm" />
      </label>
      <label class="block">
        <span class="mb-1 block text-xs font-medium">Title</span>
        <input name="title" class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm" />
      </label>
      <label class="block">
        <span class="mb-1 block text-xs font-medium">Email</span>
        <input type="email" name="email" class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm" />
      </label>
      <label class="block">
        <span class="mb-1 block text-xs font-medium">Phone</span>
        <input type="tel" name="phone" class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm" />
      </label>
      <label class="block">
        <span class="mb-1 block text-xs font-medium">Mobile</span>
        <input type="tel" name="mobile_phone" class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm" />
      </label>
      <label class="block">
        <span class="mb-1 block text-xs font-medium">Role</span>
        <select name="role" class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm">
          <option value="">—</option>
          <option value="primary">Primary</option>
          <option value="billing">Billing</option>
          <option value="shipping">Shipping</option>
          <option value="clinical">Clinical</option>
          <option value="other">Other</option>
        </select>
      </label>
      <label class="block sm:col-span-2">
        <span class="mb-1 block text-xs font-medium">Notes</span>
        <input name="notes" class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm" />
      </label>
      <label class="inline-flex items-center gap-2 text-sm sm:col-span-3">
        <input type="checkbox" name="is_primary" />
        Primary contact for account
      </label>
      <div class="sm:col-span-3 flex justify-end">
        <button
          type="submit"
          class="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
        >
          Save contact
        </button>
      </div>
    </form>
  {/if}

  <div class="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
    {#if data.contacts.length === 0}
      <p class="px-4 py-10 text-center text-sm text-slate-500">No contacts yet.</p>
    {:else}
      <ul class="divide-y divide-slate-100">
        {#each data.contacts as ct}
          <li class="px-4 py-3">
            {#if editingId === ct.id}
              <form
                method="POST"
                action="?/update"
                use:enhance={() => () => {
                  editingId = null;
                }}
                class="grid gap-3 sm:grid-cols-3"
              >
                <input type="hidden" name="id" value={ct.id} />
                <label class="block">
                  <span class="mb-1 block text-xs font-medium">First name</span>
                  <input
                    name="first_name"
                    value={ct.first_name ?? ''}
                    class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                  />
                </label>
                <label class="block">
                  <span class="mb-1 block text-xs font-medium">Last name</span>
                  <input
                    name="last_name"
                    value={ct.last_name ?? ''}
                    class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                  />
                </label>
                <label class="block">
                  <span class="mb-1 block text-xs font-medium">Title</span>
                  <input
                    name="title"
                    value={ct.title ?? ''}
                    class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                  />
                </label>
                <label class="block">
                  <span class="mb-1 block text-xs font-medium">Email</span>
                  <input
                    type="email"
                    name="email"
                    value={ct.email ?? ''}
                    class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                  />
                </label>
                <label class="block">
                  <span class="mb-1 block text-xs font-medium">Phone</span>
                  <input
                    type="tel"
                    name="phone"
                    value={ct.phone ?? ''}
                    class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                  />
                </label>
                <label class="block">
                  <span class="mb-1 block text-xs font-medium">Mobile</span>
                  <input
                    type="tel"
                    name="mobile_phone"
                    value={ct.mobile_phone ?? ''}
                    class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                  />
                </label>
                <label class="block">
                  <span class="mb-1 block text-xs font-medium">Role</span>
                  <select name="role" class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm">
                    <option value="" selected={!ct.role}>—</option>
                    {#each ['primary', 'billing', 'shipping', 'clinical', 'other'] as r}
                      <option value={r} selected={ct.role === r}>{r}</option>
                    {/each}
                  </select>
                </label>
                <label class="block sm:col-span-2">
                  <span class="mb-1 block text-xs font-medium">Notes</span>
                  <input
                    name="notes"
                    value={ct.notes ?? ''}
                    class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                  />
                </label>
                <label class="inline-flex items-center gap-2 text-sm sm:col-span-3">
                  <input type="checkbox" name="is_primary" checked={ct.is_primary} />
                  Primary contact for account
                </label>
                <div class="sm:col-span-3 flex justify-end gap-2">
                  <button
                    type="button"
                    onclick={() => (editingId = null)}
                    class="rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    class="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
                  >
                    Save
                  </button>
                </div>
              </form>
            {:else}
              <div class="flex items-start justify-between gap-4">
                <div>
                  <p class="font-medium">
                    {[ct.first_name, ct.last_name].filter(Boolean).join(' ') || '—'}
                    {#if ct.is_primary}
                      <span class="ml-1 rounded bg-emerald-50 px-1.5 py-0.5 text-xs text-emerald-700">Primary</span>
                    {/if}
                    {#if ct.role}
                      <span class="ml-1 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">{ct.role}</span>
                    {/if}
                  </p>
                  {#if ct.title}
                    <p class="text-xs text-slate-500">{ct.title}</p>
                  {/if}
                  <div class="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
                    {#if ct.email}<span>{ct.email}</span>{/if}
                    {#if ct.phone}<span>{ct.phone}</span>{/if}
                    {#if ct.mobile_phone}<span>mobile: {ct.mobile_phone}</span>{/if}
                  </div>
                  {#if ct.notes}
                    <p class="mt-1 text-xs text-slate-500">{ct.notes}</p>
                  {/if}
                </div>
                <div class="flex gap-2">
                  <button
                    type="button"
                    onclick={() => (editingId = ct.id)}
                    class="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-100"
                  >
                    Edit
                  </button>
                  <form method="POST" action="?/delete" use:enhance>
                    <input type="hidden" name="id" value={ct.id} />
                    <button
                      type="submit"
                      class="rounded border border-red-300 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </form>
                </div>
              </div>
            {/if}
          </li>
        {/each}
      </ul>
    {/if}
  </div>
</div>

<script lang="ts">
  import { enhance } from '$app/forms';

  let { data, form } = $props();
  let c = $derived(data.client);
  let assignedTagSet = $derived(new Set(data.assignedTagIds));
</script>

<svelte:head><title>{c.business_name} · Supply Admin</title></svelte:head>

{#if form?.message}
  <div class="mb-3 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">
    {form.message}
  </div>
{/if}
{#if form?.saved}
  <div class="mb-3 rounded border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
    Saved.
  </div>
{/if}

<form
  method="POST"
  action="?/save"
  use:enhance
  class="grid gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-2"
>
  <label class="block">
    <span class="mb-1 block text-sm font-medium">Business name</span>
    <input
      type="text"
      name="business_name"
      required
      value={c.business_name}
      class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
    />
  </label>
  <label class="block">
    <span class="mb-1 block text-sm font-medium">Status</span>
    <select
      name="status"
      class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
    >
      <option value="active" selected={c.status === 'active'}>Active</option>
      <option value="suspended" selected={c.status === 'suspended'}>Suspended</option>
      <option value="archived" selected={c.status === 'archived'}>Archived</option>
    </select>
  </label>
  <label class="block">
    <span class="mb-1 block text-sm font-medium">Lifecycle stage</span>
    <select
      name="lifecycle_stage"
      class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
    >
      <option value="lead" selected={c.lifecycle_stage === 'lead'}>Lead</option>
      <option value="prospect" selected={c.lifecycle_stage === 'prospect'}>Prospect</option>
      <option value="active" selected={c.lifecycle_stage === 'active'}>Active</option>
      <option value="at_risk" selected={c.lifecycle_stage === 'at_risk'}>At risk</option>
      <option value="churned" selected={c.lifecycle_stage === 'churned'}>Churned</option>
    </select>
  </label>
  <label class="block">
    <span class="mb-1 block text-sm font-medium">Territory</span>
    <select
      name="territory_id"
      class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
    >
      <option value="">— None —</option>
      {#each data.territories as t}
        <option value={t.id} selected={t.id === c.territory_id}>{t.name}</option>
      {/each}
    </select>
  </label>
  <label class="block">
    <span class="mb-1 block text-sm font-medium">Primary contact</span>
    <input
      type="text"
      name="primary_contact_name"
      value={c.primary_contact_name ?? ''}
      class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
    />
  </label>
  <label class="block">
    <span class="mb-1 block text-sm font-medium">Email</span>
    <input
      type="email"
      name="email"
      value={c.email ?? ''}
      class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
    />
  </label>
  <label class="block">
    <span class="mb-1 block text-sm font-medium">Phone</span>
    <input
      type="tel"
      name="phone"
      value={c.phone ?? ''}
      class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
    />
  </label>
  <label class="block">
    <span class="mb-1 block text-sm font-medium">Assigned sales rep</span>
    <select
      name="assigned_sales_rep_id"
      class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
    >
      <option value="">— None —</option>
      {#each data.admins as a}
        <option value={a.id} selected={a.id === c.assigned_sales_rep_id}>
          {a.display_name ?? a.id.slice(0, 8)}
        </option>
      {/each}
    </select>
  </label>

  <div class="sm:col-span-2">
    <span class="mb-1 block text-sm font-medium">Tags</span>
    {#if data.tagOptions.length === 0}
      <p class="text-xs text-slate-500">No tags yet. <a class="text-sky-700 hover:underline" href="/tags">Create one →</a></p>
    {:else}
      <div class="flex flex-wrap gap-2">
        {#each data.tagOptions as tag}
          <label
            class="inline-flex cursor-pointer items-center gap-1.5 rounded border px-2 py-1 text-xs"
            class:border-slate-900={assignedTagSet.has(tag.id)}
            class:bg-slate-900={assignedTagSet.has(tag.id)}
            class:text-white={assignedTagSet.has(tag.id)}
            class:border-slate-300={!assignedTagSet.has(tag.id)}
          >
            <input
              type="checkbox"
              name="tag_id"
              value={tag.id}
              checked={assignedTagSet.has(tag.id)}
              class="hidden"
            />
            {#if tag.color}
              <span class="inline-block h-2 w-2 rounded-full" style="background-color:{tag.color}"></span>
            {/if}
            {tag.name}
          </label>
        {/each}
      </div>
    {/if}
  </div>

  <div class="sm:col-span-2 flex justify-end">
    <button
      type="submit"
      class="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
    >
      Save
    </button>
  </div>
</form>

<script lang="ts">
  import { enhance } from '$app/forms';
  import { dateShort } from '$lib/format';

  let { data, form } = $props();

  const activeCount = $derived(data.admins.filter((a) => !a.deactivated_at).length);
</script>

<svelte:head><title>Admin Users · Supply Admin</title></svelte:head>

<section class="space-y-4">
  <header>
    <h1 class="text-2xl font-semibold">Admin Users</h1>
    <p class="text-sm text-slate-500">
      {activeCount} active · {data.admins.length} total
    </p>
  </header>

  {#if form?.message}
    <div class="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">
      {form.message}
    </div>
  {:else if form?.saved}
    <div class="rounded border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
      Saved.
    </div>
  {/if}

  <form
    method="POST"
    action="?/invite"
    use:enhance
    class="grid gap-3 rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-[1fr_1fr_auto]"
  >
    <label class="block">
      <span class="mb-1 block text-sm font-medium">Email</span>
      <input
        type="email"
        name="email"
        required
        autocomplete="off"
        placeholder="admin@example.com"
        class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
      />
    </label>
    <label class="block">
      <span class="mb-1 block text-sm font-medium">Display name <span class="text-slate-400">(optional)</span></span>
      <input
        name="display_name"
        autocomplete="off"
        class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
      />
    </label>
    <div class="flex items-end">
      <button
        type="submit"
        class="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
      >
        Invite admin
      </button>
    </div>
    <p class="text-xs text-slate-500 sm:col-span-3">
      Sends a Supabase invite email and creates a <code class="rounded bg-slate-100 px-1">user_profiles</code>
      row with <code class="rounded bg-slate-100 px-1">role = 'admin'</code>.
    </p>
  </form>

  <div class="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
    {#if data.admins.length === 0}
      <p class="px-4 py-10 text-center text-sm text-slate-500">No admins yet.</p>
    {:else}
      <table class="w-full text-sm">
        <thead class="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
          <tr>
            <th class="px-4 py-2 text-left font-medium">Name</th>
            <th class="px-4 py-2 text-left font-medium">Auth user id</th>
            <th class="px-4 py-2 text-left font-medium">Status</th>
            <th class="px-4 py-2 text-right font-medium">Created</th>
            <th class="px-4 py-2"></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          {#each data.admins as a}
            {@const isSelf = data.user?.id === a.id}
            {@const isDeactivated = !!a.deactivated_at}
            <tr class={isDeactivated ? 'bg-slate-50 text-slate-400' : ''}>
              <td class="px-4 py-2">
                {a.display_name ?? '—'}
                {#if isSelf}
                  <span class="ml-1 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">you</span>
                {/if}
              </td>
              <td class="px-4 py-2 font-mono text-xs text-slate-500">{a.id}</td>
              <td class="px-4 py-2">
                {#if isDeactivated}
                  <span
                    class="rounded bg-slate-200 px-1.5 py-0.5 text-xs font-medium text-slate-700"
                    title={`Deactivated ${dateShort(a.deactivated_at!)}`}
                  >
                    Deactivated
                  </span>
                {:else}
                  <span class="rounded bg-emerald-100 px-1.5 py-0.5 text-xs font-medium text-emerald-800">
                    Active
                  </span>
                {/if}
              </td>
              <td class="px-4 py-2 text-right text-slate-500">{dateShort(a.created_at)}</td>
              <td class="px-4 py-2 text-right">
                {#if !isDeactivated && !isSelf}
                  <form method="POST" action="?/deactivate" use:enhance>
                    <input type="hidden" name="id" value={a.id} />
                    <button
                      type="submit"
                      onclick={(e) => {
                        if (!confirm(`Deactivate ${a.display_name ?? 'this admin'}? They will no longer be able to sign in.`))
                          e.preventDefault();
                      }}
                      class="rounded border border-red-300 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                    >
                      Deactivate
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
</section>

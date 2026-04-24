<script lang="ts">
  import { dateShort } from '$lib/format';

  let { data } = $props();
</script>

<svelte:head><title>Admin Users · Supply Admin</title></svelte:head>

<section class="space-y-4">
  <header>
    <h1 class="text-2xl font-semibold">Admin Users</h1>
    <p class="text-sm text-slate-500">{data.admins.length} admin{data.admins.length === 1 ? '' : 's'}</p>
  </header>

  <div class="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
    Inviting new admins requires the Supabase service-role key and runs on the API. Provision
    admin accounts via the API endpoint once it's built, or insert rows in
    <code class="rounded bg-amber-100 px-1">user_profiles</code> with
    <code class="rounded bg-amber-100 px-1">role = 'admin'</code> for existing auth users.
  </div>

  <div class="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
    {#if data.admins.length === 0}
      <p class="px-4 py-10 text-center text-sm text-slate-500">No admins yet.</p>
    {:else}
      <table class="w-full text-sm">
        <thead class="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
          <tr>
            <th class="px-4 py-2 text-left font-medium">Name</th>
            <th class="px-4 py-2 text-left font-medium">Auth user id</th>
            <th class="px-4 py-2 text-right font-medium">Created</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          {#each data.admins as a}
            <tr>
              <td class="px-4 py-2">{a.display_name ?? '—'}</td>
              <td class="px-4 py-2 font-mono text-xs text-slate-500">{a.id}</td>
              <td class="px-4 py-2 text-right text-slate-500">{dateShort(a.created_at)}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
  </div>
</section>

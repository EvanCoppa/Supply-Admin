<script lang="ts">
  import { enhance } from '$app/forms';
  import { dateShort, dateTime } from '$lib/format';

  let { data, form } = $props();

  let copied = $state(false);
  function copy(value: string) {
    navigator.clipboard.writeText(value).then(() => {
      copied = true;
      setTimeout(() => (copied = false), 1500);
    });
  }
</script>

<div class="space-y-5">
  {#if form?.message}
    <div class="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">
      {form.message}
    </div>
  {/if}

  {#if form?.pushed}
    <div class="rounded border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
      Pushed to Guaranteeth org {form.pushed.orgId}.
    </div>
  {/if}

  {#if form?.created}
    <div class="space-y-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm">
      <p class="font-semibold text-amber-900">
        Copy this token now — it will not be shown again.
      </p>
      <div class="flex items-center gap-2">
        <code class="flex-1 rounded border border-amber-300 bg-white px-2 py-1.5 font-mono text-xs"
          >{form.created.plaintext}</code
        >
        <button
          type="button"
          onclick={() => copy(form.created.plaintext)}
          class="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-100"
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>

      <form method="POST" action="?/pushToGuaranteeth" use:enhance class="flex flex-wrap items-end gap-2 border-t border-amber-300 pt-3">
        <input type="hidden" name="plaintext" value={form.created.plaintext} />
        <label class="block flex-1 min-w-[200px]">
          <span class="mb-1 block text-xs font-medium text-amber-900">Guaranteeth org ID</span>
          <input
            name="org_id"
            required
            placeholder="e.g. 42"
            class="w-full rounded border border-amber-300 px-2 py-1.5 text-sm"
          />
        </label>
        <button
          type="submit"
          class="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
        >
          Push to Guaranteeth
        </button>
      </form>
      <p class="text-xs text-amber-800">
        Sends this token + the customer's external code to Guaranteeth so the org's
        supply credentials get written without manual SQL.
      </p>
    </div>
  {/if}

  <form
    method="POST"
    action="?/create"
    use:enhance
    class="flex gap-2 rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
  >
    <input
      name="label"
      placeholder="Label (optional) — e.g. staging integration"
      class="flex-1 rounded border border-slate-300 px-2 py-1.5 text-sm"
    />
    <button
      type="submit"
      class="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
    >
      Create token
    </button>
  </form>

  <div class="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
    {#if data.tokens.length === 0}
      <p class="px-4 py-10 text-center text-sm text-slate-500">No tokens yet.</p>
    {:else}
      <table class="w-full text-sm">
        <thead class="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
          <tr>
            <th class="px-4 py-2 text-left font-medium">Label</th>
            <th class="px-4 py-2 text-left font-medium">Created</th>
            <th class="px-4 py-2 text-left font-medium">Last used</th>
            <th class="px-4 py-2 text-left font-medium">Status</th>
            <th class="px-4 py-2"></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          {#each data.tokens as t}
            <tr>
              <td class="px-4 py-2">{t.label ?? '—'}</td>
              <td class="px-4 py-2 text-slate-500">{dateShort(t.created_at)}</td>
              <td class="px-4 py-2 text-slate-500">{dateTime(t.last_used_at)}</td>
              <td class="px-4 py-2">
                {#if t.revoked_at}
                  <span class="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">Revoked</span>
                {:else}
                  <span class="rounded bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">Active</span>
                {/if}
              </td>
              <td class="px-4 py-2 text-right">
                {#if !t.revoked_at}
                  <form method="POST" action="?/revoke" use:enhance>
                    <input type="hidden" name="id" value={t.id} />
                    <button
                      type="submit"
                      onclick={(e) => {
                        if (!confirm('Revoke this token?')) e.preventDefault();
                      }}
                      class="rounded border border-red-300 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                    >
                      Revoke
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
</div>

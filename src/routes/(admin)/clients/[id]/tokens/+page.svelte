<script lang="ts">
  import { enhance } from '$app/forms';
  import { dateShort, dateTime } from '$lib/format';
  import Select from '$lib/components/Select.svelte';

  let { data, form } = $props();

  let copied = $state(false);
  function copy(value: string) {
    void navigator.clipboard.writeText(value).then(() => {
      copied = true;
      setTimeout(() => (copied = false), 1500);
    });
  }

  let showCreateLogin = $state(false);
  let resettingId = $state<string | null>(null);

  const roleLabel: Record<string, string> = {
    owner: 'Owner',
    buyer: 'Buyer',
    viewer: 'Viewer'
  };
</script>

<div class="space-y-10">
  <!-- ───────────────────────── Shop logins ───────────────────────── -->
  <section class="space-y-5">
    <div class="flex items-center justify-between">
      <div>
        <h2 class="font-semibold">Shop logins</h2>
        <p class="text-sm text-slate-500">
          Accounts this customer uses to sign in to the online shop.
        </p>
      </div>
      <button
        type="button"
        onclick={() => (showCreateLogin = !showCreateLogin)}
        class="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
      >
        {showCreateLogin ? 'Cancel' : 'New login'}
      </button>
    </div>

    {#if form?.loginMessage}
      <div class="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">
        {form.loginMessage}
      </div>
    {/if}
    {#if form?.loginSaved}
      <div
        class="rounded border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-900"
      >
        {form.loginSaved}
      </div>
    {/if}

    {#if showCreateLogin}
      <form
        method="POST"
        action="?/createLogin"
        use:enhance={() =>
          async ({ update }) => {
            await update();
            showCreateLogin = false;
          }}
        class="grid gap-3 rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-2"
      >
        <label class="block">
          <span class="mb-1 block text-xs font-medium">Email</span>
          <input
            type="email"
            name="email"
            required
            class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
          />
        </label>
        <label class="block">
          <span class="mb-1 block text-xs font-medium">Temporary password</span>
          <input
            type="text"
            name="password"
            required
            minlength="8"
            placeholder="At least 8 characters"
            class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
          />
        </label>
        <label class="block">
          <span class="mb-1 block text-xs font-medium">First name</span>
          <input
            name="first_name"
            class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
          />
        </label>
        <label class="block">
          <span class="mb-1 block text-xs font-medium">Last name</span>
          <input
            name="last_name"
            class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
          />
        </label>
        <label class="block">
          <span class="mb-1 block text-xs font-medium">Phone</span>
          <input
            type="tel"
            name="phone"
            class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
          />
        </label>
        <label class="block">
          <span class="mb-1 block text-xs font-medium">Role</span>
          <Select name="role" class="w-full">
            <option value="owner">Owner</option>
            <option value="buyer" selected>Buyer</option>
            <option value="viewer">Viewer</option>
          </Select>
        </label>
        <label class="inline-flex items-center gap-2 text-sm sm:col-span-2">
          <input type="checkbox" name="is_primary" />
          Primary login for account
        </label>
        <div class="flex justify-end sm:col-span-2">
          <button
            type="submit"
            class="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
          >
            Create login
          </button>
        </div>
      </form>
    {/if}

    <div class="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      {#if data.logins.length === 0}
        <p class="px-4 py-10 text-center text-sm text-slate-500">No shop logins yet.</p>
      {:else}
        <ul class="divide-y divide-slate-100">
          {#each data.logins as login}
            <li class="px-4 py-3">
              <div class="flex items-start justify-between gap-4">
                <div class="min-w-0">
                  <p class="font-medium">
                    {[login.first_name, login.last_name].filter(Boolean).join(' ') || login.email}
                    {#if login.is_primary}
                      <span
                        class="ml-1 rounded bg-emerald-50 px-1.5 py-0.5 text-xs text-emerald-700"
                        >Primary</span
                      >
                    {/if}
                    <span class="ml-1 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600"
                      >{roleLabel[login.role] ?? login.role}</span
                    >
                    {#if login.deactivated_at}
                      <span class="ml-1 rounded bg-amber-50 px-1.5 py-0.5 text-xs text-amber-700"
                        >Deactivated</span
                      >
                    {/if}
                  </p>
                  <div class="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
                    <span>{login.email}</span>
                    {#if login.phone}<span>{login.phone}</span>{/if}
                    <span class="text-slate-400">
                      Last sign-in: {login.last_sign_in_at
                        ? dateTime(login.last_sign_in_at)
                        : 'never'}
                    </span>
                  </div>
                </div>
                <div class="flex shrink-0 flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    onclick={() => (resettingId = resettingId === login.id ? null : login.id)}
                    class="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-100"
                  >
                    Reset password
                  </button>
                  <form method="POST" action="?/toggleLogin" use:enhance>
                    <input type="hidden" name="id" value={login.id} />
                    <input
                      type="hidden"
                      name="deactivate"
                      value={login.deactivated_at ? 'false' : 'true'}
                    />
                    <button
                      type="submit"
                      class="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-100"
                    >
                      {login.deactivated_at ? 'Reactivate' : 'Deactivate'}
                    </button>
                  </form>
                  <form method="POST" action="?/deleteLogin" use:enhance>
                    <input type="hidden" name="id" value={login.id} />
                    <button
                      type="submit"
                      onclick={(e) => {
                        if (!confirm('Delete this login? This removes their shop access.'))
                          e.preventDefault();
                      }}
                      class="rounded border border-red-300 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </form>
                </div>
              </div>

              {#if resettingId === login.id}
                <form
                  method="POST"
                  action="?/resetPassword"
                  use:enhance={() =>
                    async ({ update }) => {
                      await update();
                      resettingId = null;
                    }}
                  class="mt-3 flex flex-wrap items-end gap-2 border-t border-slate-100 pt-3"
                >
                  <input type="hidden" name="id" value={login.id} />
                  <label class="block flex-1 min-w-[220px]">
                    <span class="mb-1 block text-xs font-medium">New temporary password</span>
                    <input
                      type="text"
                      name="password"
                      required
                      minlength="8"
                      placeholder="At least 8 characters"
                      class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                    />
                  </label>
                  <button
                    type="submit"
                    class="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
                  >
                    Set password
                  </button>
                </form>
              {/if}
            </li>
          {/each}
        </ul>
      {/if}
    </div>
  </section>

  <!-- ───────────────────────── API tokens ───────────────────────── -->
  <section class="space-y-5">
    <div>
      <h2 class="font-semibold">API tokens</h2>
      <p class="text-sm text-slate-500">
        Tokens for programmatic access to this customer's supply account.
      </p>
    </div>

    {#if form?.message}
      <div class="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">
        {form.message}
      </div>
    {/if}

    {#if form?.pushed}
      <div
        class="rounded border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-900"
      >
        Pushed to Guaranteeth org {form.pushed.orgId}.
      </div>
    {/if}

    {#if form?.created}
      <div class="space-y-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm">
        <p class="font-semibold text-amber-900">
          Copy this token now — it will not be shown again.
        </p>
        <div class="flex items-center gap-2">
          <code
            class="flex-1 rounded border border-amber-300 bg-white px-2 py-1.5 font-mono text-xs"
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

        <form
          method="POST"
          action="?/pushToGuaranteeth"
          use:enhance
          class="flex flex-wrap items-end gap-2 border-t border-amber-300 pt-3"
        >
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
          Sends this token + the customer's external code to Guaranteeth so the org's supply
          credentials get written without manual SQL.
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
                    <span class="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600"
                      >Revoked</span
                    >
                  {:else}
                    <span class="rounded bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700"
                      >Active</span
                    >
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
  </section>
</div>

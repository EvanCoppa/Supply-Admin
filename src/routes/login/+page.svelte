<script lang="ts">
  import { enhance } from '$app/forms';

  let { data, form } = $props();

  const bannerFromError = $derived(
    data.errorCode === 'not_admin'
      ? 'Your account does not have admin access. Please sign in with an admin account.'
      : null
  );
</script>

<svelte:head>
  <title>Sign in · Supply Admin</title>
</svelte:head>

<main class="flex min-h-screen items-center justify-center bg-slate-50 px-4">
  <div class="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
    <div class="mb-6 space-y-1">
      <p class="text-sm font-medium uppercase tracking-wider text-sky-600">Supply Admin</p>
      <h1 class="text-2xl font-semibold text-slate-900">Sign in</h1>
      <p class="text-sm text-slate-600">Admin access only.</p>
    </div>

    {#if bannerFromError}
      <div class="mb-4 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
        {bannerFromError}
      </div>
    {/if}

    {#if form?.message}
      <div
        class="mb-4 rounded border px-3 py-2 text-sm"
        class:border-red-300={!form.message.includes('reset email sent')}
        class:bg-red-50={!form.message.includes('reset email sent')}
        class:text-red-900={!form.message.includes('reset email sent')}
        class:border-emerald-300={form.message.includes('reset email sent')}
        class:bg-emerald-50={form.message.includes('reset email sent')}
        class:text-emerald-900={form.message.includes('reset email sent')}
      >
        {form.message}
      </div>
    {/if}

    <form method="POST" action="?/login" use:enhance class="space-y-4">
      <input type="hidden" name="next" value={data.next} />
      <label class="block">
        <span class="mb-1 block text-sm font-medium text-slate-700">Email</span>
        <input
          type="email"
          name="email"
          autocomplete="email"
          required
          value={form?.email ?? ''}
          class="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
        />
      </label>
      <label class="block">
        <span class="mb-1 block text-sm font-medium text-slate-700">Password</span>
        <input
          type="password"
          name="password"
          autocomplete="current-password"
          required
          class="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
        />
      </label>
      <button
        type="submit"
        class="w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
      >
        Sign in
      </button>
    </form>

    <form method="POST" action="?/reset" use:enhance class="mt-4 text-right">
      <input type="hidden" name="email" value={form?.email ?? ''} />
      <button type="submit" class="text-xs text-slate-500 underline hover:text-slate-800">
        Forgot password?
      </button>
    </form>
  </div>
</main>

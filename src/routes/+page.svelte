<script lang="ts">
  let { data } = $props();
  let { user } = $derived(data);
</script>

<section class="space-y-6">
  <header class="space-y-2">
    <p class="text-sm font-medium uppercase tracking-wider text-sky-600">Supply Admin</p>
    <h1 class="text-4xl font-bold tracking-tight text-slate-900">SvelteKit + Tailwind + Supabase</h1>
    <p class="max-w-2xl text-slate-600">
      Starter wired with the Supabase SSR client, cookie-based session handling, and Tailwind v4.
      Copy <code class="rounded bg-slate-200 px-1.5 py-0.5 text-sm">.env.example</code> to
      <code class="rounded bg-slate-200 px-1.5 py-0.5 text-sm">.env</code> and fill in your project credentials to connect.
    </p>
  </header>

  <div class="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
    <h2 class="mb-2 text-lg font-semibold text-slate-900">Session</h2>
    {#if user}
      <p class="text-sm text-slate-700">
        Signed in as <span class="font-mono font-medium text-slate-900">{user.email}</span>
      </p>
    {:else}
      <p class="text-sm text-slate-600">No active session. Auth is configured but no sign-in UI is shipped yet.</p>
    {/if}
  </div>

  <div class="grid gap-4 sm:grid-cols-2">
    <a
      class="group rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition hover:border-sky-400 hover:shadow"
      href="https://kit.svelte.dev/docs"
      target="_blank"
      rel="noreferrer"
    >
      <h3 class="font-semibold text-slate-900 group-hover:text-sky-700">SvelteKit docs →</h3>
      <p class="mt-1 text-sm text-slate-600">Routing, loaders, actions, and adapters.</p>
    </a>
    <a
      class="group rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition hover:border-sky-400 hover:shadow"
      href="https://supabase.com/docs/guides/auth/server-side/sveltekit"
      target="_blank"
      rel="noreferrer"
    >
      <h3 class="font-semibold text-slate-900 group-hover:text-sky-700">Supabase + SvelteKit →</h3>
      <p class="mt-1 text-sm text-slate-600">Server-side auth with @supabase/ssr.</p>
    </a>
  </div>
</section>

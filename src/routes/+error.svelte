<script lang="ts">
  import { page } from '$app/state';
</script>

<svelte:head><title>{page.status} · Supply Admin</title></svelte:head>

<main class="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-12 text-slate-900">
  <div class="w-full max-w-lg rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
    <p class="text-xs uppercase tracking-wider text-red-600">Error {page.status}</p>
    <h1 class="mt-1 text-2xl font-semibold">
      {page.status === 404 ? 'Page not found' : 'Something went wrong'}
    </h1>
    <p class="mt-3 text-sm text-slate-600">
      {page.error?.message ?? 'An unexpected error occurred.'}
    </p>
    {#if page.error && 'code' in page.error && page.error.code}
      <p class="mt-2 text-xs text-slate-500">
        Reference code: <code class="font-mono text-slate-700">{page.error.code}</code>
      </p>
    {/if}
    <div class="mt-6 flex gap-2">
      <a
        href="/"
        class="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
      >
        Back to dashboard
      </a>
      <button
        type="button"
        onclick={() => window.location.reload()}
        class="rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100"
      >
        Retry
      </button>
    </div>
  </div>
</main>

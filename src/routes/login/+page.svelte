<script lang="ts">
  import { enhance } from '$app/forms';

  let { form } = $props();
</script>

<main class="flex min-h-screen items-center justify-center p-4">
  <form
    method="POST"
    use:enhance
    class="w-full max-w-sm space-y-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
  >
    <h1 class="text-xl font-semibold">Admin sign in</h1>

    {#if form?.error}
      <div class="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
        {form.error}
      </div>
    {/if}

    <label class="block text-sm">
      <span class="mb-1 block font-medium text-slate-700">Email</span>
      <input
        name="email"
        type="email"
        required
        autocomplete="email"
        class="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none"
      />
    </label>

    <label class="block text-sm">
      <span class="mb-1 block font-medium text-slate-700">Password</span>
      <input
        name="password"
        type="password"
        required
        autocomplete="current-password"
        class="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none"
      />
    </label>

    <button
      type="submit"
      class="w-full rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
    >
      Sign in
    </button>
  </form>
</main>

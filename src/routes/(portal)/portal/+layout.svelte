<script lang="ts">
  let { data, children } = $props();
</script>

<svelte:head><title>Supply Portal</title></svelte:head>

<div class="min-h-screen bg-slate-50 text-slate-900">
  <header class="border-b border-slate-200 bg-white">
    <div class="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
      <div>
        <p class="text-xs font-medium uppercase tracking-wider text-sky-700">Supply Portal</p>
        <h1 class="font-semibold">{data.customer.business_name}</h1>
      </div>
      <div class="flex items-center gap-4 text-sm">
        <a class="font-medium text-slate-900" href="/portal/invoices">Invoices</a>
        <form method="POST" action="/logout">
          <button class="rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100">
            Sign out
          </button>
        </form>
      </div>
    </div>
  </header>

  <main class="mx-auto max-w-6xl px-4 py-6">
    {@render children()}
  </main>
</div>

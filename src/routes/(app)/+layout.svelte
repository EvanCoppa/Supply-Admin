<script lang="ts">
  let { data, children } = $props();
</script>

<div class="min-h-screen">
  <header class="border-b border-slate-200 bg-white">
    <div class="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
      <a href="/dashboard" class="text-sm font-semibold tracking-tight">Supply Admin</a>
      <nav class="flex items-center gap-5 text-sm text-slate-600">
        <a href="/dashboard" class="hover:text-slate-900">Dashboard</a>
        <a href="/products" class="hover:text-slate-900">Products</a>
        <a href="/customers" class="hover:text-slate-900">Customers</a>
        <a href="/orders" class="hover:text-slate-900">Orders</a>
        <span class="text-slate-400">|</span>
        <span class="text-slate-500">{data.profile?.display_name ?? 'Admin'}</span>
        <form method="POST" action="/auth/logout">
          <button type="submit" class="text-slate-600 hover:text-slate-900">Sign out</button>
        </form>
      </nav>
    </div>
  </header>

  <main class="mx-auto max-w-6xl px-4 py-6">
    {@render children()}
  </main>
</div>

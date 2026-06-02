<script lang="ts">
  import { page } from '$app/state';
  import { filterNavSectionsByRole } from '$lib/nav';
  import { formatRole } from '$lib/permissions';
  import GlobalSearch from '$lib/components/GlobalSearch.svelte';
  import * as Icons from '@lucide/svelte';
  import type { Component } from 'svelte';

  let { data, children } = $props();

  const navSections = $derived(filterNavSectionsByRole(data.profile?.role ?? 'customer'));

  function isActive(href: string) {
    if (href === '/') return page.url.pathname === '/';
    return page.url.pathname === href || page.url.pathname.startsWith(href + '/');
  }

  function getIcon(iconName: string): Component {
    return Icons[iconName as keyof typeof Icons] as Component;
  }
</script>

<div class="flex min-h-screen bg-slate-50 text-slate-900">
  <aside class="w-60 shrink-0 border-r border-slate-200 bg-white">
    <div class="px-5 py-5">
      <p class="text-xs font-semibold uppercase tracking-wider text-sky-600">Evolution</p>
      <h1 class="text-md font-semibold text-slate-900">Supply Admin</h1>
    </div>
    <nav class="px-3 py-2">
      {#each navSections as section}
        <p class="px-3 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          {section.heading}
        </p>
        <ul class="space-y-0.5">
          {#each section.items as item}
            {@const Icon = getIcon(item.icon)}
            <li>
              <a
                href={item.href}
                class="flex items-center gap-2 rounded px-3 py-1.5 text-sm transition-colors"
                class:bg-slate-900={isActive(item.href)}
                class:text-white={isActive(item.href)}
                class:text-slate-700={!isActive(item.href)}
                class:hover:bg-slate-100={!isActive(item.href)}
              >
                <Icon class="h-4 w-4 flex-shrink-0" aria-hidden="true" />
                {item.label}
              </a>
            </li>
          {/each}
        </ul>
      {/each}
    </nav>
  </aside>

  <div class="flex min-w-0 flex-1 flex-col">
    <header
      class="flex items-center justify-between gap-4 border-b border-slate-200 bg-white px-6 py-3"
    >
      <GlobalSearch />
      <div class="flex items-center gap-3 text-sm">
        <div class="text-right">
          <p class="text-slate-600">{data.user?.email}</p>
          {#if data.profile?.role}
            <p class="text-xs text-slate-500">{formatRole(data.profile.role)}</p>
          {/if}
        </div>
        <form method="POST" action="/logout">
          <button
            type="submit"
            class="rounded border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
          >
            Sign out
          </button>
        </form>
      </div>
    </header>
    <main class="flex-1 px-6 py-6">
      {@render children()}
    </main>
  </div>
</div>

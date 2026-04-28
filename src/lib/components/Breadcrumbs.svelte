<script lang="ts">
  export type Crumb = { label: string; href?: string };

  interface Props {
    items: Crumb[];
  }

  let { items }: Props = $props();
</script>

<nav class="text-xs text-slate-500" aria-label="Breadcrumb">
  <ol class="flex flex-wrap items-center gap-1">
    {#each items as item, i (i + item.label)}
      <li class="flex items-center gap-1">
        {#if item.href && i < items.length - 1}
          <a class="hover:text-slate-900 hover:underline" href={item.href}>{item.label}</a>
        {:else}
          <span class="text-slate-700" aria-current={i === items.length - 1 ? 'page' : undefined}>
            {item.label}
          </span>
        {/if}
        {#if i < items.length - 1}
          <span class="text-slate-300">/</span>
        {/if}
      </li>
    {/each}
  </ol>
</nav>

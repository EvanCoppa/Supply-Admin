<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cn } from '$lib/utils';

  interface Props {
    label: string;
    help?: string;
    error?: string;
    class?: string;
    children: Snippet;
  }

  let { label, help, error, class: className, children }: Props = $props();
</script>

<label class={cn('block', className)}>
  <span class="mb-1 block text-sm font-medium">{label}</span>
  {@render children()}
  {#if error}
    <p class="mt-1 text-xs text-red-700">{error}</p>
  {:else if help}
    <p class="mt-1 text-xs text-slate-500">{help}</p>
  {/if}
</label>

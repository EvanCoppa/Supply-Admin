<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLAttributes } from 'svelte/elements';
  import { cn } from '$lib/utils';

  interface Props extends HTMLAttributes<HTMLElement> {
    children: Snippet;
  }

  let { class: className, children, ...rest }: Props = $props();
</script>

<kbd
  class={cn('rounded border border-slate-200 bg-slate-50 px-1 text-[10px] text-slate-400', className)}
  {...rest}
>
  {@render children()}
</kbd>

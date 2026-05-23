<script lang="ts">
  import type { HTMLTextareaAttributes } from 'svelte/elements';
  import { cn } from '$lib/utils';

  interface Props extends HTMLTextareaAttributes {}

  let { class: className, value, ...rest }: Props = $props();
</script>

<textarea
  class={cn(
    'w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500',
    className
  )}
  {...rest}>{value ?? ''}</textarea>

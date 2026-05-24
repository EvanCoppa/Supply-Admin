<script lang="ts">
  import { ChevronDown } from '@lucide/svelte';
  import type { HTMLSelectAttributes } from 'svelte/elements';
  import type { Snippet } from 'svelte';
  import { cn } from '$lib/utils';

  type Props = Omit<HTMLSelectAttributes, 'value'> & {
    class?: string;
    value?: HTMLSelectAttributes['value'];
    children?: Snippet;
  };

  let {
    class: className = '',
    value = $bindable(),
    children,
    ...rest
  }: Props = $props();
</script>

<div class={cn('relative inline-block', className)}>
  <select
    bind:value
    class="block w-full appearance-none rounded border border-slate-300 bg-white py-1.5 pr-9 pl-2 text-sm"
    {...rest}
  >
    {@render children?.()}
  </select>
  <ChevronDown
    aria-hidden="true"
    class="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-slate-500"
  />
</div>

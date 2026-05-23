<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLAttributes } from 'svelte/elements';
  import { cn } from '$lib/utils';

  export type BadgeTone = 'slate' | 'sky' | 'indigo' | 'violet' | 'emerald' | 'red';
  export type BadgeVariant = 'soft' | 'solid';

  interface Props extends HTMLAttributes<HTMLSpanElement> {
    tone?: BadgeTone;
    variant?: BadgeVariant;
    children: Snippet;
  }

  let {
    tone = 'slate',
    variant = 'soft',
    class: className,
    children,
    ...rest
  }: Props = $props();

  const soft: Record<BadgeTone, string> = {
    slate: 'bg-slate-100 text-slate-700',
    sky: 'bg-sky-50 text-sky-700',
    indigo: 'bg-indigo-50 text-indigo-700',
    violet: 'bg-violet-50 text-violet-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    red: 'bg-red-50 text-red-700'
  };

  const solid: Record<BadgeTone, string> = {
    slate: 'bg-slate-900/80 text-white',
    sky: 'bg-sky-600/90 text-white',
    indigo: 'bg-indigo-600/90 text-white',
    violet: 'bg-violet-600/90 text-white',
    emerald: 'bg-emerald-600/90 text-white',
    red: 'bg-red-600/90 text-white'
  };

  const toneClass = $derived(variant === 'solid' ? solid[tone] : soft[tone]);
</script>

<span
  class={cn('inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium', toneClass, className)}
  {...rest}
>
  {@render children()}
</span>

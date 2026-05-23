<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLButtonAttributes } from 'svelte/elements';
  import { cn } from '$lib/utils';

  export type ButtonVariant = 'primary' | 'outline' | 'destructive' | 'ghost';
  export type ButtonSize = 'xs' | 'sm' | 'md';

  interface Props extends HTMLButtonAttributes {
    variant?: ButtonVariant;
    size?: ButtonSize;
    children: Snippet;
  }

  let {
    variant = 'primary',
    size = 'sm',
    type = 'button',
    class: className,
    children,
    ...rest
  }: Props = $props();

  const variants: Record<ButtonVariant, string> = {
    primary: 'bg-slate-900 text-white hover:bg-slate-800',
    outline: 'border border-slate-300 text-slate-700 hover:bg-slate-100',
    destructive: 'border border-red-300 text-red-700 hover:bg-red-50',
    ghost: 'text-slate-700 hover:bg-slate-100'
  };

  const sizes: Record<ButtonSize, string> = {
    xs: 'px-1.5 py-0.5 text-xs',
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-sm'
  };
</script>

<button
  {type}
  class={cn(
    'inline-flex items-center justify-center gap-1 rounded font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50',
    variants[variant],
    sizes[size],
    className
  )}
  {...rest}
>
  {@render children()}
</button>

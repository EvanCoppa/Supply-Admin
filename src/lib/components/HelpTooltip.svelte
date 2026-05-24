<script module>
  let counter = 0;
</script>

<script lang="ts">
  import CircleHelp from '@lucide/svelte/icons/circle-help';

  interface Props {
    text: string;
    class?: string;
  }

  let { text, class: className = '' }: Props = $props();
  const uid = ++counter;
  let visible = $state(false);
</script>

<span class="relative inline-flex items-center {className}">
  <button
    type="button"
    aria-label="Help"
    aria-describedby="help-tooltip-{uid}"
    class="inline-flex cursor-default rounded focus:outline-none focus-visible:ring-1 focus-visible:ring-slate-400"
    onmouseenter={() => (visible = true)}
    onmouseleave={() => (visible = false)}
    onfocus={() => (visible = true)}
    onblur={() => (visible = false)}
    onclick={(e) => e.stopPropagation()}
  >
    <CircleHelp
      aria-hidden="true"
      class="size-3.5 transition-colors {visible ? 'text-slate-600' : 'text-slate-400'}"
    />
  </button>

  {#if visible}
    <span
      id="help-tooltip-{uid}"
      role="tooltip"
      class="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 w-max max-w-[220px] whitespace-normal rounded bg-slate-800 px-2 py-1 text-xs text-white shadow-sm"
    >
      {text}
      <span
        class="absolute top-full left-1/2 -translate-x-1/2 border-x-4 border-x-transparent border-t-4 border-t-slate-800"
      ></span>
    </span>
  {/if}
</span>

<script lang="ts">
  interface Item {
    label: string;
    value: number;
    sub?: string;
    href?: string;
  }

  interface Props {
    data: Item[];
    formatValue?: (v: number) => string;
    color?: string;
  }

  let { data, formatValue = (v) => v.toLocaleString(), color = '#0284c7' }: Props = $props();

  const max = $derived(Math.max(1, ...data.map((d) => d.value)));
</script>

<ul class="space-y-2">
  {#each data as item}
    <li class="text-sm">
      <div class="mb-1 flex items-baseline justify-between gap-3">
        <div class="min-w-0 flex-1">
          {#if item.href}
            <a
              href={item.href}
              class="truncate font-medium text-slate-700 hover:text-sky-700 hover:underline"
            >
              {item.label}
            </a>
          {:else}
            <span class="truncate font-medium text-slate-700">{item.label}</span>
          {/if}
          {#if item.sub}
            <span class="ml-1 text-xs text-slate-400">{item.sub}</span>
          {/if}
        </div>
        <span class="shrink-0 font-mono text-xs text-slate-600">{formatValue(item.value)}</span>
      </div>
      <div class="h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          class="h-full rounded-full transition-all"
          style="width: {(item.value / max) * 100}%; background-color: {color};"
        ></div>
      </div>
    </li>
  {/each}
</ul>

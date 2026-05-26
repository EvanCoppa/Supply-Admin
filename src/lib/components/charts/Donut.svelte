<script lang="ts">
  interface Slice {
    label: string;
    value: number;
    color: string;
  }

  interface Props {
    data: Slice[];
    size?: number;
    thickness?: number;
    centerLabel?: string;
    centerValue?: string;
    formatValue?: (v: number) => string;
  }

  let {
    data,
    size = 160,
    thickness = 24,
    centerLabel = '',
    centerValue = '',
    formatValue = (v) => v.toLocaleString()
  }: Props = $props();

  const radius = $derived((size - thickness) / 2);
  const cx = $derived(size / 2);
  const cy = $derived(size / 2);
  const circumference = $derived(2 * Math.PI * radius);
  const total = $derived(data.reduce((a, b) => a + b.value, 0));

  type Seg = { color: string; offset: number; length: number; pct: number };
  const segments: Seg[] = $derived.by(() => {
    if (total <= 0) return [];
    let cumulative = 0;
    return data.map((d) => {
      const pct = d.value / total;
      const length = pct * circumference;
      const seg: Seg = { color: d.color, offset: cumulative, length, pct };
      cumulative += length;
      return seg;
    });
  });
</script>

<div class="flex items-center gap-4">
  <div class="relative shrink-0" style="width: {size}px; height: {size}px;">
    <svg width={size} height={size} viewBox="0 0 {size} {size}" style="transform: rotate(-90deg);">
      <circle {cx} {cy} r={radius} fill="none" stroke="#f1f5f9" stroke-width={thickness} />
      {#each segments as seg}
        <circle
          {cx}
          {cy}
          r={radius}
          fill="none"
          stroke={seg.color}
          stroke-width={thickness}
          stroke-dasharray="{seg.length} {circumference - seg.length}"
          stroke-dashoffset={-seg.offset}
        />
      {/each}
    </svg>
    {#if centerValue || centerLabel}
      <div class="absolute inset-0 flex flex-col items-center justify-center text-center">
        {#if centerValue}
          <p class="text-lg font-semibold text-slate-800">{centerValue}</p>
        {/if}
        {#if centerLabel}
          <p class="text-[10px] uppercase tracking-wider text-slate-500">{centerLabel}</p>
        {/if}
      </div>
    {/if}
  </div>

  <ul class="min-w-0 flex-1 space-y-1.5 text-sm">
    {#each data as d}
      <li class="flex items-center justify-between gap-2">
        <span class="flex min-w-0 items-center gap-2">
          <span class="h-2.5 w-2.5 shrink-0 rounded-sm" style="background-color: {d.color};"></span>
          <span class="truncate text-slate-700">{d.label}</span>
        </span>
        <span class="shrink-0 font-mono text-xs text-slate-500">
          {formatValue(d.value)}
          {#if total > 0}
            <span class="ml-1 text-slate-400">{Math.round((d.value / total) * 100)}%</span>
          {/if}
        </span>
      </li>
    {/each}
  </ul>
</div>

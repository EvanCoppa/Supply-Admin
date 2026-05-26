<script lang="ts">
  interface Point {
    label: string;
    value: number;
    secondary?: number;
  }

  interface Props {
    data: Point[];
    height?: number;
    formatValue?: (v: number) => string;
    formatSecondary?: (v: number) => string;
    stroke?: string;
    secondaryStroke?: string;
  }

  let {
    data,
    height = 220,
    formatValue = (v) => v.toLocaleString(),
    formatSecondary,
    stroke = '#0284c7',
    secondaryStroke = '#94a3b8'
  }: Props = $props();

  const width = 800;
  const padding = { top: 16, right: 16, bottom: 28, left: 56 };
  const innerW = $derived(width - padding.left - padding.right);
  const innerH = $derived(height - padding.top - padding.bottom);

  const max = $derived(Math.max(1, ...data.map((d) => d.value)));
  const niceMax = $derived(niceCeil(max));

  function niceCeil(v: number): number {
    if (v <= 0) return 1;
    const exp = Math.floor(Math.log10(v));
    const base = Math.pow(10, exp);
    const f = v / base;
    let nice: number;
    if (f <= 1) nice = 1;
    else if (f <= 2) nice = 2;
    else if (f <= 2.5) nice = 2.5;
    else if (f <= 5) nice = 5;
    else nice = 10;
    return nice * base;
  }

  const stepX = $derived(data.length > 1 ? innerW / (data.length - 1) : innerW);

  const points = $derived(
    data.map((d, i) => {
      const x = padding.left + i * stepX;
      const y = padding.top + (1 - d.value / niceMax) * innerH;
      return { x, y, d };
    })
  );

  const linePath = $derived(
    points.length ? 'M' + points.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' L') : ''
  );

  const areaPath = $derived.by(() => {
    const first = points[0];
    const last = points[points.length - 1];
    if (!first || !last) return '';
    const baseY = (padding.top + innerH).toFixed(2);
    return `${linePath} L${last.x.toFixed(2)},${baseY} L${first.x.toFixed(2)},${baseY} Z`;
  });

  const gridLines = $derived(
    [0, 0.25, 0.5, 0.75, 1].map((t) => ({
      y: padding.top + t * innerH,
      value: niceMax * (1 - t)
    }))
  );

  const xTicks = $derived.by(() => {
    if (data.length === 0) return [] as { x: number; label: string }[];
    const desired = Math.min(7, data.length);
    const step = Math.max(1, Math.floor(data.length / desired));
    const out: { x: number; label: string }[] = [];
    for (let i = 0; i < data.length; i += step) {
      const d = data[i];
      if (d) out.push({ x: padding.left + i * stepX, label: d.label });
    }
    return out;
  });

  let hoverIdx = $state<number | null>(null);
  let svgEl: SVGSVGElement | undefined = $state();

  const hover = $derived.by(() => {
    if (hoverIdx === null) return null;
    const p = points[hoverIdx];
    const d = data[hoverIdx];
    if (!p || !d) return null;
    return { p, d };
  });

  function handleMove(e: MouseEvent) {
    if (!svgEl || data.length === 0) return;
    const rect = svgEl.getBoundingClientRect();
    const xRatio = (e.clientX - rect.left) / rect.width;
    const xInChart = xRatio * width - padding.left;
    if (xInChart < 0 || xInChart > innerW) {
      hoverIdx = null;
      return;
    }
    const idx = Math.round(xInChart / stepX);
    hoverIdx = Math.max(0, Math.min(data.length - 1, idx));
  }

  function handleLeave() {
    hoverIdx = null;
  }
</script>

<div class="relative w-full">
  <svg
    bind:this={svgEl}
    viewBox="0 0 {width} {height}"
    class="w-full"
    role="img"
    aria-label="Trend chart"
    onmousemove={handleMove}
    onmouseleave={handleLeave}
  >
    <defs>
      <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color={stroke} stop-opacity="0.35" />
        <stop offset="100%" stop-color={stroke} stop-opacity="0" />
      </linearGradient>
    </defs>

    {#each gridLines as g}
      <line
        x1={padding.left}
        x2={width - padding.right}
        y1={g.y}
        y2={g.y}
        stroke="#e2e8f0"
        stroke-dasharray="2 3"
      />
      <text
        x={padding.left - 8}
        y={g.y + 4}
        text-anchor="end"
        font-size="10"
        fill="#94a3b8"
        font-family="ui-sans-serif, system-ui">{formatValue(g.value)}</text
      >
    {/each}

    <path d={areaPath} fill="url(#areaGradient)" />
    <path
      d={linePath}
      fill="none"
      {stroke}
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    />

    {#if formatSecondary && data.some((d) => d.secondary !== undefined)}
      {@const secMax = Math.max(1, ...data.map((d) => d.secondary ?? 0))}
      {@const secPoints = data
        .map((d, i) => {
          const x = padding.left + i * stepX;
          const y = padding.top + (1 - (d.secondary ?? 0) / secMax) * innerH;
          return `${x.toFixed(2)},${y.toFixed(2)}`;
        })
        .join(' ')}
      <polyline
        points={secPoints}
        fill="none"
        stroke={secondaryStroke}
        stroke-width="1.5"
        stroke-dasharray="4 3"
        opacity="0.8"
      />
    {/if}

    {#each xTicks as t}
      <text
        x={t.x}
        y={height - 8}
        text-anchor="middle"
        font-size="10"
        fill="#94a3b8"
        font-family="ui-sans-serif, system-ui">{t.label}</text
      >
    {/each}

    {#if hover}
      <line
        x1={hover.p.x}
        x2={hover.p.x}
        y1={padding.top}
        y2={padding.top + innerH}
        stroke="#475569"
        stroke-width="1"
        stroke-dasharray="2 2"
      />
      <circle cx={hover.p.x} cy={hover.p.y} r="4" fill={stroke} stroke="#fff" stroke-width="2" />
    {/if}
  </svg>

  {#if hover}
    <div
      class="pointer-events-none absolute top-2 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs shadow-sm"
      style="left: {(hover.p.x / width) * 100}%; transform: translateX(-50%);"
    >
      <p class="font-medium text-slate-700">{hover.d.label}</p>
      <p class="text-slate-900">{formatValue(hover.d.value)}</p>
      {#if formatSecondary && hover.d.secondary !== undefined}
        <p class="text-slate-500">{formatSecondary(hover.d.secondary)}</p>
      {/if}
    </div>
  {/if}
</div>

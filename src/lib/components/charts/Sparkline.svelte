<script lang="ts">
  interface Props {
    values: number[];
    width?: number;
    height?: number;
    stroke?: string;
    fill?: string;
  }

  let { values, width = 80, height = 24, stroke = '#0284c7', fill = '#bae6fd' }: Props = $props();

  const max = $derived(Math.max(1, ...values));
  const min = $derived(Math.min(0, ...values));
  const range = $derived(Math.max(1, max - min));
  const stepX = $derived(values.length > 1 ? width / (values.length - 1) : width);

  const points = $derived(
    values
      .map((v, i) => {
        const x = i * stepX;
        const y = height - ((v - min) / range) * (height - 2) - 1;
        return `${x.toFixed(2)},${y.toFixed(2)}`;
      })
      .join(' ')
  );

  const areaPath = $derived(
    values.length
      ? `M0,${height} L${points.split(' ').join(' L')} L${width.toFixed(2)},${height} Z`
      : ''
  );
</script>

<svg viewBox="0 0 {width} {height}" {width} {height} preserveAspectRatio="none" aria-hidden="true">
  <path d={areaPath} {fill} opacity="0.6" />
  <polyline
    {points}
    fill="none"
    {stroke}
    stroke-width="1.5"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
</svg>

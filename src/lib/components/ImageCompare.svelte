<script lang="ts">
  interface Props {
    before: string;
    after: string;
    beforeLabel?: string;
    afterLabel?: string;
  }

  let { before, after, beforeLabel = 'Source', afterLabel = 'Generated' }: Props = $props();

  type Mode = 'side' | 'slider';
  let mode = $state<Mode>('side');
  let position = $state(50);
  let containerEl = $state<HTMLDivElement | null>(null);
  let dragging = $state(false);

  function setFromClientX(clientX: number) {
    if (!containerEl) return;
    const rect = containerEl.getBoundingClientRect();
    const pct = ((clientX - rect.left) / rect.width) * 100;
    position = Math.min(100, Math.max(0, pct));
  }

  function onPointerDown(event: PointerEvent) {
    dragging = true;
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    setFromClientX(event.clientX);
  }

  function onPointerMove(event: PointerEvent) {
    if (!dragging) return;
    setFromClientX(event.clientX);
  }

  function onPointerUp(event: PointerEvent) {
    dragging = false;
    (event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
  }
</script>

<div class="space-y-4">
  <div class="flex items-center justify-between">
    <h2 class="text-sm font-semibold text-slate-700">Before / After</h2>
    <div class="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs">
      <button
        type="button"
        onclick={() => (mode = 'side')}
        class="rounded-md px-2.5 py-1 font-medium transition-colors"
        class:bg-white={mode === 'side'}
        class:shadow-sm={mode === 'side'}
        class:text-slate-900={mode === 'side'}
        class:text-slate-500={mode !== 'side'}
      >
        Side by side
      </button>
      <button
        type="button"
        onclick={() => (mode = 'slider')}
        class="rounded-md px-2.5 py-1 font-medium transition-colors"
        class:bg-white={mode === 'slider'}
        class:shadow-sm={mode === 'slider'}
        class:text-slate-900={mode === 'slider'}
        class:text-slate-500={mode !== 'slider'}
      >
        Slider
      </button>
    </div>
  </div>

  {#if mode === 'side'}
    <div class="grid gap-4 md:grid-cols-2">
      <figure class="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
        <figcaption class="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">{beforeLabel}</figcaption>
        <img src={before} alt={beforeLabel} class="aspect-square w-full rounded border border-slate-100 object-contain" />
      </figure>
      <figure class="rounded-lg border border-slate-200 bg-white p-3 shadow-sm ring-2 ring-sky-100">
        <figcaption class="mb-2 text-xs font-semibold uppercase tracking-wider text-sky-700">{afterLabel}</figcaption>
        <img src={after} alt={afterLabel} class="aspect-square w-full rounded border border-slate-100 object-contain" />
      </figure>
    </div>
  {:else}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      bind:this={containerEl}
      class="relative aspect-square w-full max-w-2xl select-none overflow-hidden rounded-lg border border-slate-200 bg-slate-100 shadow-sm"
      onpointerdown={onPointerDown}
      onpointermove={onPointerMove}
      onpointerup={onPointerUp}
    >
      <img
        src={before}
        alt={beforeLabel}
        class="absolute inset-0 h-full w-full object-contain"
        draggable="false"
      />
      <div
        class="absolute inset-0 overflow-hidden"
        style="clip-path: inset(0 0 0 {position}%);"
      >
        <img
          src={after}
          alt={afterLabel}
          class="absolute inset-0 h-full w-full object-contain"
          draggable="false"
        />
      </div>

      <span class="pointer-events-none absolute left-3 top-3 rounded-md bg-slate-900/80 px-2 py-0.5 text-xs font-medium text-white">{beforeLabel}</span>
      <span class="pointer-events-none absolute right-3 top-3 rounded-md bg-sky-600/90 px-2 py-0.5 text-xs font-medium text-white">{afterLabel}</span>

      <div
        class="pointer-events-none absolute inset-y-0 w-0.5 bg-white shadow-[0_0_0_1px_rgba(15,23,42,0.15)]"
        style="left: {position}%;"
      ></div>
      <div
        class="pointer-events-none absolute top-1/2 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white shadow-md ring-1 ring-slate-200"
        style="left: {position}%;"
      >
        <svg viewBox="0 0 24 24" class="h-4 w-4 text-slate-700" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="15 6 9 12 15 18" />
          <polyline points="9 6 15 12 9 18" />
        </svg>
      </div>
    </div>
    <p class="text-xs text-slate-500">Drag the handle to compare.</p>
  {/if}
</div>

<script lang="ts">
  import { onDestroy } from 'svelte';
  import { Camera, CameraOff, Check, X, Loader2, Volume2, VolumeX } from '@lucide/svelte';
  import type { Product } from '$lib/types/db';

  interface Props {
    onSelect?: (product: Partial<Product>) => void;
    open?: boolean;
  }

  let { onSelect, open = $bindable(false) }: Props = $props();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let reader: any = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let controls: any = null;
  let video = $state<HTMLVideoElement | null>(null);

  let scanning = $state(false);
  let starting = $state(false);
  let cameraError = $state<string | null>(null);
  let soundOn = $state(true);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let audioCtx: any = null;

  type ScanStatus =
    | { kind: 'idle' }
    | { kind: 'looking'; code: string }
    | { kind: 'found'; product: Partial<Product> }
    | { kind: 'notfound'; code: string }
    | { kind: 'error'; message: string };

  let status = $state<ScanStatus>({ kind: 'idle' });
  let lastCode = '';
  const CLEAR_AFTER_MISSES = 5;

  function tone(freq: number, startAt: number, durationMs: number) {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const t = audioCtx.currentTime + startAt;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.25, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + durationMs / 1000);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(t);
    osc.stop(t + durationMs / 1000);
  }

  function beep(kind: 'found' | 'notfound' | 'error') {
    if (!soundOn) return;
    try {
      if (!audioCtx) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const Ctx = window.AudioContext || (window as any).webkitAudioContext;
        if (!Ctx) return;
        audioCtx = new Ctx();
      }
      if (audioCtx.state === 'suspended') void audioCtx.resume();
      if (kind === 'found') {
        tone(880, 0, 90);
        tone(1320, 0.09, 110);
      } else if (kind === 'notfound') {
        tone(300, 0, 220);
      } else {
        tone(260, 0, 140);
        tone(200, 0.14, 180);
      }
    } catch {
      // Audio is best-effort
    }
  }

  async function startScanning() {
    if (scanning || starting) return;
    cameraError = null;
    starting = true;
    try {
      if (!reader) {
        const { BrowserMultiFormatReader } = await import('@zxing/browser');
        reader = new BrowserMultiFormatReader(undefined, {
          delayBetweenScanAttempts: 100,
          delayBetweenScanSuccess: 100
        });
      }
      let misses = 0;
      controls = await reader.decodeFromConstraints(
        { video: { facingMode: { ideal: 'environment' } } },
        video,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (result: any) => {
          if (result) {
            misses = 0;
            onDetected(result.getText());
          } else if (++misses >= CLEAR_AFTER_MISSES) {
            misses = 0;
            lastCode = '';
          }
        }
      );
      scanning = true;
    } catch (err) {
      cameraError =
        err instanceof DOMException && err.name === 'NotAllowedError'
          ? 'Camera access was blocked. Please allow camera permission.'
          : 'Could not start the camera. Please try again.';
    } finally {
      starting = false;
    }
  }

  function stopScanning() {
    controls?.stop();
    controls = null;
    scanning = false;
  }

  function onDetected(code: string) {
    if (code === lastCode) return;
    lastCode = code;
    void handleCode(code);
  }

  async function handleCode(raw: string) {
    const code = raw.trim();
    if (!code || status.kind === 'looking') return;
    status = { kind: 'looking', code };

    try {
      const res = await fetch(`/api/catalog/scan/lookup?code=${encodeURIComponent(code)}`);
      if (!res.ok) throw new Error('lookup failed');
      const { product } = (await res.json()) as { product: Partial<Product> | null };

      if (!product) {
        beep('notfound');
        status = { kind: 'notfound', code };
        return;
      }

      status = { kind: 'found', product };
      beep('found');
    } catch {
      beep('error');
      status = { kind: 'error', message: 'Something went wrong. Please try again.' };
    }
  }

  function selectProduct(product: Partial<Product>) {
    onSelect?.(product);
    close();
  }

  function close() {
    stopScanning();
    open = false;
    status = { kind: 'idle' };
    lastCode = '';
  }

  let statusTimer: ReturnType<typeof setTimeout> | null = null;
  $effect(() => {
    if (statusTimer) clearTimeout(statusTimer);
    if (status.kind === 'found' || status.kind === 'notfound' || status.kind === 'error') {
      statusTimer = setTimeout(() => {
        status = { kind: 'idle' };
      }, 3000);
    }
  });

  onDestroy(() => {
    if (statusTimer) clearTimeout(statusTimer);
    stopScanning();
  });
</script>

<svelte:window onkeydown={(e) => open && e.key === 'Escape' && close()} />

{#if open}
  <!-- Backdrop -->
  <button
    type="button"
    aria-label="Close scanner"
    onclick={close}
    class="fixed inset-0 z-40 bg-black/50"
  ></button>

  <!-- Modal -->
  <div class="pointer-events-none fixed inset-0 z-50 flex items-center justify-center p-4">
    <div class="pointer-events-auto w-full max-w-2xl overflow-hidden rounded-lg bg-white shadow-xl">
      <!-- Header -->
      <div class="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <h2 class="text-lg font-semibold">Scan Product Barcode</h2>
        <button onclick={close} class="rounded hover:bg-slate-100 p-1.5" aria-label="Close">
          <X class="size-5" />
        </button>
      </div>

      <!-- Camera viewport -->
      <div class="relative aspect-video w-full bg-black">
        <video
          bind:this={video}
          class="h-full w-full object-cover {scanning ? '' : 'opacity-0'}"
          playsinline
          muted
        ></video>

        {#if scanning}
          <!-- Scanning reticle -->
          <div class="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div class="relative h-40 w-4/5 max-w-sm">
              <span
                class="absolute left-0 top-0 size-7 rounded-tl-lg border-l-4 border-t-4 border-white/90"
              ></span>
              <span
                class="absolute right-0 top-0 size-7 rounded-tr-lg border-r-4 border-t-4 border-white/90"
              ></span>
              <span
                class="absolute bottom-0 left-0 size-7 rounded-bl-lg border-b-4 border-l-4 border-white/90"
              ></span>
              <span
                class="absolute bottom-0 right-0 size-7 rounded-br-lg border-b-4 border-r-4 border-white/90"
              ></span>
              <div class="absolute inset-x-0 top-1/2 h-0.5 animate-pulse bg-slate-400/80"></div>
            </div>
          </div>
        {:else}
          <div
            class="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center text-white/80"
          >
            <Camera class="size-10" />
            <p class="px-6 text-sm">Camera is off</p>
          </div>
        {/if}

        <!-- Sound toggle -->
        <button
          type="button"
          onclick={() => (soundOn = !soundOn)}
          class="absolute right-3 top-3 flex size-9 items-center justify-center rounded-full bg-black/55 text-white/90 transition hover:bg-black/70"
          aria-label={soundOn ? 'Mute scan sounds' : 'Unmute scan sounds'}
        >
          {#if soundOn}
            <Volume2 class="size-5" />
          {:else}
            <VolumeX class="size-5" />
          {/if}
        </button>

        <!-- Live status pill -->
        {#if status.kind !== 'idle'}
          <div class="absolute inset-x-3 bottom-3 flex justify-center">
            {#if status.kind === 'looking'}
              <span
                class="flex items-center gap-2 rounded-full bg-black/70 px-3 py-1.5 text-sm font-medium text-white"
              >
                <Loader2 class="size-4 animate-spin" /> Looking up {status.code}…
              </span>
            {:else if status.kind === 'found'}
              <span
                class="flex items-center gap-2 rounded-full bg-green-600 px-3 py-1.5 text-sm font-medium text-white"
              >
                <Check class="size-4" /> Found: {status.product.name || status.product.sku}
              </span>
            {:else if status.kind === 'notfound'}
              <span
                class="flex items-center gap-2 rounded-full bg-amber-500 px-3 py-1.5 text-sm font-medium text-white"
              >
                <X class="size-4" /> No match for {status.code}
              </span>
            {:else if status.kind === 'error'}
              <span
                class="flex items-center gap-2 rounded-full bg-red-600 px-3 py-1.5 text-sm font-medium text-white"
              >
                <X class="size-4" />
                {status.message}
              </span>
            {/if}
          </div>
        {/if}
      </div>

      <!-- Controls -->
      <div class="flex items-center justify-between gap-3 border-t border-slate-200 p-4">
        <button
          onclick={close}
          class="rounded border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
        >
          Cancel
        </button>
        {#if scanning}
          <button
            onclick={stopScanning}
            class="rounded border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 flex items-center gap-2"
          >
            <CameraOff class="size-4" /> Stop camera
          </button>
        {:else}
          <button
            onclick={startScanning}
            disabled={starting}
            class="rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {#if starting}
              <Loader2 class="size-4 animate-spin inline mr-2" />
              Starting…
            {:else}
              <Camera class="size-4 inline mr-2" />
              Start scanning
            {/if}
          </button>
        {/if}
      </div>

      {#if cameraError}
        <div class="border-t border-slate-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {cameraError}
        </div>
      {/if}

      <!-- Found product action -->
      {#if status.kind === 'found'}
        <div class="border-t border-slate-200 bg-slate-50 px-4 py-3">
          <p class="mb-2 text-sm text-slate-700">Fill form with this product?</p>
          <button
            onclick={() => selectProduct(status.kind === 'found' ? status.product : {})}
            class="w-full rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Use this product
          </button>
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  :global(body) {
    overflow: hidden;
  }
</style>

<script lang="ts">
  import { enhance } from '$app/forms';
  import ImageUploader from '$lib/components/ImageUploader.svelte';
  import ImageCompare from '$lib/components/ImageCompare.svelte';
  import Sparkles from '@lucide/svelte/icons/sparkles';
  import WandSparkles from '@lucide/svelte/icons/wand-sparkles';
  import Upload from '@lucide/svelte/icons/upload';
  import RefreshCw from '@lucide/svelte/icons/refresh-cw';
  import LoaderCircle from '@lucide/svelte/icons/loader-circle';
  import CircleCheck from '@lucide/svelte/icons/circle-check';
  import ImageIcon from '@lucide/svelte/icons/image';
  import X from '@lucide/svelte/icons/x';

  let { form: serverForm } = $props();

  type PageState = 'upload' | 'preview' | 'generating' | 'result' | 'error';

  let currentState = $state<PageState>('upload');
  let selectedFile = $state<File | null>(null);
  let beforeUrl = $state<string>('');
  let context = $state<string>('');
  let contextInitialized = false;
  let progress = $state(0);
  let progressTimer: ReturnType<typeof setInterval> | null = null;
  let clientError = $state<string>('');
  let result = $state<{ imageDataUrl: string; originalDataUrl?: string } | null>(null);
  let serverError = $state<string>('');
  let formEl = $state<HTMLFormElement | null>(null);
  let fileInputEl = $state<HTMLInputElement | null>(null);

  const STEPS: { key: PageState; label: string }[] = [
    { key: 'upload', label: 'Upload' },
    { key: 'preview', label: 'Preview' },
    { key: 'generating', label: 'Generate' },
    { key: 'result', label: 'Result' }
  ];

  function stepIndex(s: PageState) {
    const i = STEPS.findIndex((x) => x.key === s);
    return i === -1 ? 0 : i;
  }

  // Initial server-rendered form result (e.g. on full page reload after submit).
  $effect(() => {
    if (!contextInitialized && serverForm?.context) {
      context = serverForm.context;
      contextInitialized = true;
    }
    if (serverForm?.imageDataUrl && !result) {
      result = {
        imageDataUrl: serverForm.imageDataUrl,
        originalDataUrl: serverForm.originalDataUrl
      };
      currentState = 'result';
    } else if (serverForm?.message && !serverError) {
      serverError = serverForm.message;
      currentState = 'error';
    }
  });

  // Keep the hidden file input in sync with selectedFile for FormData submits.
  $effect(() => {
    if (fileInputEl && selectedFile) {
      const dt = new DataTransfer();
      dt.items.add(selectedFile);
      fileInputEl.files = dt.files;
    }
  });

  function handleSelected(file: File) {
    clientError = '';
    if (beforeUrl.startsWith('blob:')) URL.revokeObjectURL(beforeUrl);
    selectedFile = file;
    beforeUrl = URL.createObjectURL(file);
    currentState = 'preview';
  }

  function handleUploadError(message: string) {
    clientError = message;
  }

  function startProgress() {
    progress = 0;
    progressTimer = setInterval(() => {
      progress = Math.min(progress + 6, 92);
    }, 400);
  }

  function stopProgress() {
    if (progressTimer) {
      clearInterval(progressTimer);
      progressTimer = null;
    }
    progress = 100;
  }

  function startOver() {
    if (beforeUrl.startsWith('blob:')) URL.revokeObjectURL(beforeUrl);
    selectedFile = null;
    beforeUrl = '';
    context = '';
    clientError = '';
    serverError = '';
    result = null;
    progress = 0;
    currentState = 'upload';
  }

  function retry() {
    serverError = '';
    currentState = selectedFile ? 'preview' : 'upload';
  }

  function regenerate() {
    if (!selectedFile) return;
    formEl?.requestSubmit();
  }

  function downloadName() {
    const base = selectedFile?.name.replace(/\.[^.]+$/, '') ?? 'product';
    return `${base}-generated.png`;
  }

  $effect(() => {
    return () => {
      if (beforeUrl.startsWith('blob:')) URL.revokeObjectURL(beforeUrl);
      if (progressTimer) clearInterval(progressTimer);
    };
  });
</script>

<svelte:head><title>Product Image Studio · Supply Admin</title></svelte:head>

<section class="mx-auto max-w-5xl space-y-6">
  <!-- Header -->
  <header class="flex flex-col items-center text-center">
    <div class="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-slate-900 to-slate-700 shadow-md">
      <WandSparkles class="h-6 w-6 text-white" />
    </div>
    <h1 class="text-3xl font-semibold tracking-tight text-slate-900">Product Image Studio</h1>
    <p class="mt-1 max-w-xl text-sm text-slate-500">
      Upload a rough product photo and Gemini will return a clean, professional ecommerce shot.
    </p>
    <div class="mt-3 inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700">
      <Sparkles class="h-3.5 w-3.5" />
      Powered by Gemini 2.5 Flash
    </div>
  </header>

  <!-- Stepper -->
  <ol class="mx-auto flex max-w-md items-center justify-between text-xs">
    {#each STEPS as step, i}
      {@const active = step.key === currentState}
      {@const done = stepIndex(currentState) > i}
      <li class="flex flex-1 items-center">
        <span
          class="flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold transition-colors"
          class:bg-slate-900={active || done}
          class:text-white={active || done}
          class:bg-slate-200={!active && !done}
          class:text-slate-500={!active && !done}
        >{i + 1}</span>
        <span
          class="ml-2 hidden font-medium sm:inline"
          class:text-slate-900={active}
          class:text-slate-400={!active}
        >{step.label}</span>
        {#if i < STEPS.length - 1}
          <span class="mx-3 h-px flex-1 bg-slate-200"></span>
        {/if}
      </li>
    {/each}
  </ol>

  <form
    bind:this={formEl}
    method="POST"
    enctype="multipart/form-data"
    use:enhance={() => {
      currentState = 'generating';
      startProgress();
      return async ({ result: formResult, update }) => {
        await update({ reset: false });
        stopProgress();
        if (formResult.type === 'success' && formResult.data?.imageDataUrl) {
          result = {
            imageDataUrl: formResult.data.imageDataUrl as string,
            originalDataUrl: formResult.data.originalDataUrl as string | undefined
          };
          currentState = 'result';
        } else if (formResult.type === 'failure') {
          serverError = (formResult.data?.message as string) ?? 'Generation failed.';
          currentState = 'error';
        } else if (formResult.type === 'error') {
          serverError = formResult.error?.message ?? 'Generation failed.';
          currentState = 'error';
        }
      };
    }}
    class="space-y-5"
  >
    <input
      bind:this={fileInputEl}
      type="file"
      name="image"
      accept="image/jpeg,image/png,image/webp"
      class="hidden"
      aria-hidden="true"
      tabindex="-1"
    />
    <input type="hidden" name="context" value={context} />

    <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
      {#if currentState === 'upload'}
        <div class="space-y-5">
          <ImageUploader onSelected={handleSelected} onError={handleUploadError} />
          {#if clientError}
            <div class="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              <X class="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span>{clientError}</span>
            </div>
          {/if}
        </div>

      {:else if currentState === 'preview'}
        <div class="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div class="relative">
            <img
              src={beforeUrl}
              alt="Source preview"
              class="aspect-square w-full rounded-xl border border-slate-200 bg-slate-50 object-contain shadow-sm"
            />
            <span class="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-md bg-slate-900/85 px-2 py-1 text-xs font-medium text-white backdrop-blur">
              <Upload class="h-3.5 w-3.5" />
              Source photo
            </span>
            <button
              type="button"
              onclick={startOver}
              class="absolute right-3 top-3 inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-slate-700 shadow-sm ring-1 ring-slate-200 transition hover:bg-white hover:text-slate-900"
              aria-label="Remove photo"
            >
              <X class="h-4 w-4" />
            </button>
          </div>

          <div class="flex flex-col">
            <label class="block">
              <span class="mb-1 block text-sm font-medium text-slate-700">
                Extra context <span class="font-normal text-slate-400">(optional)</span>
              </span>
              <textarea
                bind:value={context}
                rows="6"
                placeholder="e.g. 3-pack of dental cement syringes, teal label, show all three tubes standing upright with a soft shadow"
                class="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
              ></textarea>
            </label>
            <p class="mt-1.5 text-xs text-slate-500">
              Tell Gemini anything specific about the product — angle, count, packaging, colors to preserve.
            </p>

            <div class="mt-auto flex flex-wrap items-center gap-2 pt-5">
              <button
                type="submit"
                class="group inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
              >
                <Sparkles class="h-4 w-4 transition-transform group-hover:rotate-12" />
                Generate image
              </button>
              <button
                type="button"
                onclick={startOver}
                class="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                <RefreshCw class="h-4 w-4" />
                Choose different photo
              </button>
            </div>
          </div>
        </div>

      {:else if currentState === 'generating'}
        <div class="flex flex-col items-center justify-center space-y-7 py-12">
          <div class="relative">
            <div class="h-20 w-20 animate-spin rounded-full border-4 border-slate-200 border-t-slate-900"></div>
            <div class="absolute inset-0 flex items-center justify-center">
              <Sparkles class="h-7 w-7 animate-pulse text-slate-700" />
            </div>
          </div>

          <div class="w-full max-w-sm">
            <div class="h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div
                class="h-full rounded-full bg-gradient-to-r from-slate-700 to-sky-500 transition-all duration-500"
                style="width: {progress}%"
              ></div>
            </div>
            <p class="mt-2 text-center text-xs text-slate-500">{progress}%</p>
          </div>

          <div class="text-center">
            <p class="flex items-center justify-center gap-2 text-base font-semibold text-slate-900">
              <LoaderCircle class="h-4 w-4 animate-spin" />
              Generating your studio shot…
            </p>
            <p class="mt-1 text-sm text-slate-500">This usually takes 5–15 seconds.</p>
          </div>

          <div class="grid w-full max-w-2xl grid-cols-2 gap-3 md:grid-cols-4">
            {#each ['White background', 'Soft shadow', 'Faithful to source', 'Square crop'] as feature}
              <div class="flex items-center justify-center gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700">
                <CircleCheck class="h-3.5 w-3.5 text-sky-600" />
                <span>{feature}</span>
              </div>
            {/each}
          </div>
        </div>

      {:else if currentState === 'error'}
        <div class="flex flex-col items-center justify-center space-y-5 py-12">
          <div class="flex h-14 w-14 items-center justify-center rounded-full bg-red-50 ring-1 ring-red-200">
            <X class="h-7 w-7 text-red-600" />
          </div>
          <div class="max-w-md text-center">
            <p class="text-base font-semibold text-slate-900">Generation failed</p>
            <p class="mt-1 text-sm text-slate-600">{serverError || 'Something went wrong.'}</p>
          </div>
          <div class="flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onclick={retry}
              class="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              <RefreshCw class="h-4 w-4" />
              Try again
            </button>
            <button
              type="button"
              onclick={startOver}
              class="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Start over
            </button>
          </div>
        </div>

      {:else if currentState === 'result' && result}
        <div class="space-y-6">
          <ImageCompare
            before={result.originalDataUrl ?? beforeUrl}
            after={result.imageDataUrl}
          />

          <div class="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5">
            <div class="flex items-start gap-2 text-sm">
              <CircleCheck class="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600" />
              <span class="text-slate-700">Studio shot ready. Download or regenerate to try a different take.</span>
            </div>
            <div class="flex flex-wrap items-center gap-2">
              <a
                href={result.imageDataUrl}
                download={downloadName()}
                class="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
              >
                <ImageIcon class="h-4 w-4" />
                Download
              </a>
              <button
                type="button"
                onclick={regenerate}
                class="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                <RefreshCw class="h-4 w-4" />
                Regenerate
              </button>
              <button
                type="button"
                onclick={startOver}
                class="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                <Upload class="h-4 w-4" />
                New photo
              </button>
            </div>
          </div>
        </div>
      {/if}
    </div>
  </form>

  <!-- How it works -->
  {#if currentState === 'upload'}
    <div class="grid gap-3 sm:grid-cols-3">
      {#each [
        { n: 1, title: 'Upload your photo', body: 'Drag and drop a phone photo of the product — any angle, any lighting.' },
        { n: 2, title: 'Add context', body: 'Optionally describe the product so Gemini preserves the key details.' },
        { n: 3, title: 'Download the shot', body: 'Get a clean white-background ecommerce image, ready for the catalog.' }
      ] as step}
        <div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div class="mb-2 flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">{step.n}</div>
          <p class="text-sm font-semibold text-slate-900">{step.title}</p>
          <p class="mt-1 text-xs text-slate-500">{step.body}</p>
        </div>
      {/each}
    </div>
  {/if}
</section>

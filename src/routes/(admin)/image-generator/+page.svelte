<script lang="ts">
  import { enhance } from '$app/forms';

  let { form } = $props();

  let submitting = $state(false);
  let previewUrl = $state<string | null>(null);
  let selectedName = $state<string | null>(null);

  function onFileChange(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    if (!file) {
      previewUrl = null;
      selectedName = null;
      return;
    }
    previewUrl = URL.createObjectURL(file);
    selectedName = file.name;
  }

  function downloadName() {
    const base = selectedName?.replace(/\.[^.]+$/, '') ?? 'product';
    return `${base}-generated.png`;
  }
</script>

<svelte:head><title>Image Generator · Supply Admin</title></svelte:head>

<section class="space-y-5">
  <header>
    <h1 class="text-2xl font-semibold">Product Image Generator</h1>
    <p class="text-sm text-slate-500">
      Upload a rough product photo and Gemini will return a clean, professional ecommerce shot you can download.
    </p>
  </header>

  {#if form?.message}
    <div class="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">
      {form.message}
    </div>
  {/if}

  <form
    method="POST"
    enctype="multipart/form-data"
    class="rounded-lg border border-slate-200 bg-white p-5 shadow-sm space-y-4"
    use:enhance={() => {
      submitting = true;
      return async ({ update }) => {
        await update({ reset: false });
        submitting = false;
      };
    }}
  >
    <label class="block">
      <span class="mb-1 block text-sm font-medium text-slate-700">Source photo</span>
      <input
        type="file"
        name="image"
        accept="image/jpeg,image/png,image/webp"
        required
        onchange={onFileChange}
        class="block w-full text-sm file:mr-3 file:rounded file:border-0 file:bg-slate-900 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white hover:file:bg-slate-800"
      />
      <span class="mt-1 block text-xs text-slate-500">JPEG, PNG, or WebP up to 10 MB.</span>
    </label>

    <label class="block">
      <span class="mb-1 block text-sm font-medium text-slate-700">Extra context <span class="font-normal text-slate-400">(optional)</span></span>
      <textarea
        name="context"
        rows="4"
        value={form?.context ?? ''}
        placeholder="e.g. 3-pack of dental cement syringes, teal label, show all three tubes standing upright with a soft shadow"
        class="block w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
      ></textarea>
      <span class="mt-1 block text-xs text-slate-500">
        Tell Gemini anything specific about the product — angle, count, packaging, colors to preserve.
      </span>
    </label>

    <div class="flex items-center gap-3">
      <button
        type="submit"
        disabled={submitting}
        class="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
      >
        {submitting ? 'Generating…' : 'Generate image'}
      </button>
      {#if submitting}
        <span class="text-sm text-slate-500">This usually takes 5–15 seconds.</span>
      {/if}
    </div>
  </form>

  {#if previewUrl || form?.imageDataUrl}
    <div class="grid gap-4 md:grid-cols-2">
      <div class="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 class="mb-2 text-sm font-semibold text-slate-700">Source</h2>
        {#if previewUrl}
          <img src={previewUrl} alt="Source preview" class="w-full rounded border border-slate-100" />
        {:else if form?.originalDataUrl}
          <img src={form.originalDataUrl} alt="Source" class="w-full rounded border border-slate-100" />
        {/if}
      </div>

      <div class="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div class="mb-2 flex items-center justify-between">
          <h2 class="text-sm font-semibold text-slate-700">Generated</h2>
          {#if form?.imageDataUrl}
            <a
              href={form.imageDataUrl}
              download={downloadName()}
              class="rounded border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
            >
              Download
            </a>
          {/if}
        </div>
        {#if form?.imageDataUrl}
          <img src={form.imageDataUrl} alt="Generated product" class="w-full rounded border border-slate-100" />
        {:else}
          <div class="flex h-full min-h-50 items-center justify-center text-sm text-slate-400">
            Your professional photo will appear here.
          </div>
        {/if}
      </div>
    </div>
  {/if}
</section>

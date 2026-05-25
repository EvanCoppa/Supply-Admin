<script lang="ts">
  import { enhance } from '$app/forms';
  import Upload from '@lucide/svelte/icons/upload';
  import FolderOpen from '@lucide/svelte/icons/folder-open';
  import CircleCheck from '@lucide/svelte/icons/circle-check';
  import CircleAlert from '@lucide/svelte/icons/circle-alert';
  import X from '@lucide/svelte/icons/x';
  import LoaderCircle from '@lucide/svelte/icons/loader-circle';
  import Image from '@lucide/svelte/icons/image';

  let { data, form: serverForm } = $props();

  type Product = { id: string; sku: string; name: string; hasImage: boolean };
  type MatchStatus = 'matched-sku' | 'matched-name' | 'ambiguous' | 'unmatched' | 'invalid';

  type Match = {
    file: File;
    filename: string;
    productId: string | null;
    productLabel: string | null;
    productSku: string | null;
    productHadImage: boolean;
    status: MatchStatus;
    note?: string;
  };

  const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);
  const MAX_BYTES = 10 * 1024 * 1024;

  let selectedFiles = $state<File[]>([]);
  let submitting = $state(false);

  let fileInputEl = $state<HTMLInputElement | null>(null);

  function normalize(s: string): string {
    return s
      .toLowerCase()
      .replace(/\.[^.]+$/, '')
      .replace(/[^a-z0-9]+/g, '');
  }

  function stripExt(s: string): string {
    return s.replace(/\.[^.]+$/, '');
  }

  // Pre-compute lookup indexes for fast matching.
  const indexes = $derived.by(() => {
    const bySku = new Map<string, Product>();
    const byName = new Map<string, Product[]>();
    for (const p of data.products) {
      bySku.set(normalize(p.sku), p);
      const nameKey = normalize(p.name);
      const bucket = byName.get(nameKey) ?? [];
      bucket.push(p);
      byName.set(nameKey, bucket);
    }
    return { bySku, byName };
  });

  const matches = $derived.by<Match[]>(() => {
    return selectedFiles.map((file): Match => {
      const baseName = stripExt(file.name);
      const key = normalize(file.name);

      if (!ALLOWED_TYPES.has(file.type)) {
        return {
          file,
          filename: file.name,
          productId: null,
          productLabel: null,
          productSku: null,
          productHadImage: false,
          status: 'invalid',
          note: 'Unsupported type (use JPEG, PNG, WebP, or AVIF).'
        };
      }
      if (file.size > MAX_BYTES) {
        return {
          file,
          filename: file.name,
          productId: null,
          productLabel: null,
          productSku: null,
          productHadImage: false,
          status: 'invalid',
          note: 'File exceeds 10 MB.'
        };
      }

      const skuHit = indexes.bySku.get(key);
      if (skuHit) {
        return {
          file,
          filename: file.name,
          productId: skuHit.id,
          productLabel: skuHit.name,
          productSku: skuHit.sku,
          productHadImage: skuHit.hasImage,
          status: 'matched-sku',
          note: `Matched by SKU "${skuHit.sku}".`
        };
      }

      const nameHits = indexes.byName.get(key);
      const soleNameHit = nameHits?.length === 1 ? nameHits[0] : undefined;
      if (soleNameHit) {
        return {
          file,
          filename: file.name,
          productId: soleNameHit.id,
          productLabel: soleNameHit.name,
          productSku: soleNameHit.sku,
          productHadImage: soleNameHit.hasImage,
          status: 'matched-name',
          note: `Matched by name "${soleNameHit.name}".`
        };
      }
      if (nameHits && nameHits.length > 1) {
        return {
          file,
          filename: file.name,
          productId: null,
          productLabel: null,
          productSku: null,
          productHadImage: false,
          status: 'ambiguous',
          note: `Filename "${baseName}" matches ${nameHits.length} products by name.`
        };
      }

      return {
        file,
        filename: file.name,
        productId: null,
        productLabel: null,
        productSku: null,
        productHadImage: false,
        status: 'unmatched',
        note: 'No product matched this filename.'
      };
    });
  });

  const matchedCount = $derived(
    matches.filter((m) => m.status === 'matched-sku' || m.status === 'matched-name').length
  );
  const ambiguousCount = $derived(matches.filter((m) => m.status === 'ambiguous').length);
  const unmatchedCount = $derived(matches.filter((m) => m.status === 'unmatched').length);
  const invalidCount = $derived(matches.filter((m) => m.status === 'invalid').length);
  const replaceCount = $derived(
    matches.filter(
      (m) => (m.status === 'matched-sku' || m.status === 'matched-name') && m.productHadImage
    ).length
  );

  function handleFileChange(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    selectedFiles = input.files ? Array.from(input.files) : [];
  }

  function clearSelection() {
    selectedFiles = [];
    if (fileInputEl) fileInputEl.value = '';
  }

  function badgeClass(status: MatchStatus): string {
    switch (status) {
      case 'matched-sku':
        return 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200';
      case 'matched-name':
        return 'bg-sky-50 text-sky-700 ring-1 ring-sky-200';
      case 'ambiguous':
        return 'bg-amber-50 text-amber-800 ring-1 ring-amber-200';
      case 'unmatched':
        return 'bg-slate-100 text-slate-600 ring-1 ring-slate-200';
      case 'invalid':
        return 'bg-red-50 text-red-700 ring-1 ring-red-200';
    }
  }

  function badgeLabel(status: MatchStatus): string {
    switch (status) {
      case 'matched-sku':
        return 'SKU match';
      case 'matched-name':
        return 'Name match';
      case 'ambiguous':
        return 'Ambiguous';
      case 'unmatched':
        return 'No match';
      case 'invalid':
        return 'Invalid';
    }
  }

  const serverResults = $derived(
    (serverForm?.upload as { results?: unknown } | undefined)?.results as
      | {
          filename: string;
          productSku: string | null;
          status: 'uploaded' | 'failed';
          message?: string;
        }[]
      | undefined
  );
  const serverOk = $derived((serverForm?.upload as { ok?: boolean } | undefined)?.ok === true);
  const serverMessage = $derived(
    (serverForm?.upload as { message?: string } | undefined)?.message ?? ''
  );
</script>

<svelte:head><title>Bulk image upload · Supply Admin</title></svelte:head>

<section class="mx-auto max-w-5xl space-y-6">
  <header class="space-y-1">
    <a href="/catalog" class="text-xs text-slate-500 hover:underline">← Back to catalog</a>
    <h1 class="text-2xl font-semibold">Bulk product image upload</h1>
    <p class="text-sm text-slate-500">
      Pick a folder of images. Filenames are auto-matched to products by SKU first, then by name.
      Each matched image becomes that product's preview, replacing any existing one.
    </p>
  </header>

  {#if serverForm?.upload}
    <div
      class="flex items-start gap-3 rounded-lg border p-4 text-sm"
      class:border-emerald-200={serverOk}
      class:bg-emerald-50={serverOk}
      class:text-emerald-900={serverOk}
      class:border-red-200={!serverOk}
      class:bg-red-50={!serverOk}
      class:text-red-900={!serverOk}
    >
      {#if serverOk}
        <CircleCheck class="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-600" />
      {:else}
        <CircleAlert class="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600" />
      {/if}
      <div class="flex-1 space-y-2">
        <p class="font-semibold">{serverMessage}</p>
        {#if serverResults && serverResults.length > 0}
          <details class="text-xs">
            <summary class="cursor-pointer text-slate-700 hover:underline">View details</summary>
            <ul class="mt-2 space-y-1">
              {#each serverResults as r}
                <li class="flex items-center gap-2">
                  {#if r.status === 'uploaded'}
                    <CircleCheck class="h-3.5 w-3.5 text-emerald-600" />
                  {:else}
                    <X class="h-3.5 w-3.5 text-red-600" />
                  {/if}
                  <span class="font-mono">{r.filename}</span>
                  {#if r.productSku}
                    <span class="text-slate-500">→ {r.productSku}</span>
                  {/if}
                  {#if r.message}
                    <span class="text-slate-500">— {r.message}</span>
                  {/if}
                </li>
              {/each}
            </ul>
          </details>
        {/if}
      </div>
    </div>
  {/if}

  <form
    method="POST"
    action="?/upload"
    enctype="multipart/form-data"
    use:enhance={({ formData, cancel }) => {
      if (matchedCount === 0) {
        cancel();
        return;
      }
      formData.delete('productIds');
      formData.delete('files');
      for (const m of matches) {
        if ((m.status === 'matched-sku' || m.status === 'matched-name') && m.productId !== null) {
          formData.append('productIds', m.productId);
          formData.append('files', m.file, m.filename);
        }
      }
      submitting = true;
      return async ({ update }) => {
        await update();
        submitting = false;
        selectedFiles = [];
        if (fileInputEl) fileInputEl.value = '';
      };
    }}
    class="space-y-5"
  >
    <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <label
        for="folder-input"
        class="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center transition hover:border-slate-400 hover:bg-slate-100"
      >
        <FolderOpen class="h-10 w-10 text-slate-400" />
        <div>
          <p class="text-sm font-semibold text-slate-900">
            {selectedFiles.length === 0
              ? 'Choose a folder of images'
              : `${selectedFiles.length} file${selectedFiles.length === 1 ? '' : 's'} selected`}
          </p>
          <p class="mt-0.5 text-xs text-slate-500">
            JPEG, PNG, WebP, or AVIF · up to 10 MB each. Subfolders are included.
          </p>
        </div>
        <span
          class="inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white"
        >
          <Upload class="h-3.5 w-3.5" />
          Browse folder
        </span>
      </label>
      <input
        id="folder-input"
        bind:this={fileInputEl}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        multiple
        webkitdirectory
        onchange={handleFileChange}
        class="hidden"
      />

      {#if selectedFiles.length > 0}
        <div class="mt-4 flex flex-wrap items-center gap-3 text-xs text-slate-600">
          <span
            class="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-1 text-emerald-700"
          >
            <CircleCheck class="h-3.5 w-3.5" />
            {matchedCount} matched
          </span>
          {#if ambiguousCount > 0}
            <span
              class="inline-flex items-center gap-1 rounded bg-amber-50 px-2 py-1 text-amber-800"
            >
              <CircleAlert class="h-3.5 w-3.5" />
              {ambiguousCount} ambiguous
            </span>
          {/if}
          {#if unmatchedCount > 0}
            <span
              class="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-1 text-slate-600"
            >
              {unmatchedCount} unmatched
            </span>
          {/if}
          {#if invalidCount > 0}
            <span class="inline-flex items-center gap-1 rounded bg-red-50 px-2 py-1 text-red-700">
              <X class="h-3.5 w-3.5" />
              {invalidCount} invalid
            </span>
          {/if}
          {#if replaceCount > 0}
            <span class="text-slate-500">({replaceCount} will replace an existing image)</span>
          {/if}
          <button
            type="button"
            onclick={clearSelection}
            class="ml-auto text-slate-500 hover:text-slate-900 hover:underline"
          >
            Clear
          </button>
        </div>
      {/if}
    </div>

    {#if matches.length > 0}
      <div class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table class="w-full text-sm">
          <thead class="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th class="px-4 py-2 text-left font-medium">Preview</th>
              <th class="px-4 py-2 text-left font-medium">Filename</th>
              <th class="px-4 py-2 text-left font-medium">Match</th>
              <th class="px-4 py-2 text-left font-medium">Product</th>
              <th class="px-4 py-2 text-left font-medium">Note</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            {#each matches as m (m.filename + m.file.size + m.file.lastModified)}
              <tr class="hover:bg-slate-50/60">
                <td class="px-4 py-2">
                  {#if m.status !== 'invalid'}
                    <img
                      src={URL.createObjectURL(m.file)}
                      alt={m.filename}
                      class="h-10 w-10 rounded border border-slate-200 object-cover"
                      loading="lazy"
                    />
                  {:else}
                    <div
                      class="flex h-10 w-10 items-center justify-center rounded border border-dashed border-slate-300 bg-slate-50 text-slate-400"
                    >
                      <Image class="h-4 w-4" />
                    </div>
                  {/if}
                </td>
                <td class="px-4 py-2 font-mono text-xs text-slate-700">{m.filename}</td>
                <td class="px-4 py-2">
                  <span class="inline-block rounded px-2 py-0.5 text-xs {badgeClass(m.status)}">
                    {badgeLabel(m.status)}
                  </span>
                </td>
                <td class="px-4 py-2 text-slate-700">
                  {#if m.productId}
                    <a class="text-sky-700 hover:underline" href="/catalog/{m.productId}">
                      {m.productLabel}
                    </a>
                    <span class="text-xs text-slate-500"> · {m.productSku}</span>
                    {#if m.productHadImage}
                      <span class="ml-1 text-xs text-amber-700">(will replace)</span>
                    {/if}
                  {:else}
                    <span class="text-slate-400">—</span>
                  {/if}
                </td>
                <td class="px-4 py-2 text-xs text-slate-500">{m.note ?? ''}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>

      <div class="flex items-center justify-end gap-3">
        <p class="text-xs text-slate-500">
          Only the {matchedCount} matched file{matchedCount === 1 ? '' : 's'} will upload. Ambiguous,
          unmatched, and invalid files are skipped.
        </p>
        <button
          type="submit"
          disabled={matchedCount === 0 || submitting}
          class="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {#if submitting}
            <LoaderCircle class="h-4 w-4 animate-spin" />
            Uploading…
          {:else}
            <Upload class="h-4 w-4" />
            Upload {matchedCount} image{matchedCount === 1 ? '' : 's'}
          {/if}
        </button>
      </div>
    {/if}
  </form>
</section>

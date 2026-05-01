<script lang="ts">
  import Upload from '@lucide/svelte/icons/upload';
  import ImageIcon from '@lucide/svelte/icons/image';

  interface Props {
    onSelected: (file: File) => void;
    accept?: string;
    maxBytes?: number;
    onError?: (message: string) => void;
  }

  let {
    onSelected,
    accept = 'image/jpeg,image/png,image/webp',
    maxBytes = 10 * 1024 * 1024,
    onError
  }: Props = $props();

  const acceptList = $derived(accept.split(',').map((s) => s.trim()));

  let dragging = $state(false);
  let inputEl = $state<HTMLInputElement | null>(null);

  function validate(file: File): string | null {
    if (!acceptList.includes(file.type)) {
      return 'Image must be JPEG, PNG, or WebP.';
    }
    if (file.size > maxBytes) {
      const mb = Math.round(maxBytes / 1024 / 1024);
      return `Image must be ${mb} MB or smaller.`;
    }
    return null;
  }

  function handleFile(file: File | null | undefined) {
    if (!file) return;
    const err = validate(file);
    if (err) {
      onError?.(err);
      return;
    }
    onSelected(file);
  }

  function onChange(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    handleFile(input.files?.[0]);
    input.value = '';
  }

  function onDrop(event: DragEvent) {
    event.preventDefault();
    dragging = false;
    handleFile(event.dataTransfer?.files?.[0]);
  }

  function onDragOver(event: DragEvent) {
    event.preventDefault();
    dragging = true;
  }

  function onDragLeave(event: DragEvent) {
    event.preventDefault();
    dragging = false;
  }

  function openPicker() {
    inputEl?.click();
  }
</script>

<div class="space-y-3">
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    role="button"
    tabindex="0"
    onclick={openPicker}
    onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && openPicker()}
    ondrop={onDrop}
    ondragover={onDragOver}
    ondragleave={onDragLeave}
    class="group relative flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-14 text-center transition-all"
    class:border-sky-400={dragging}
    class:bg-sky-50={dragging}
    class:border-slate-300={!dragging}
    class:bg-slate-50={!dragging}
    class:hover:border-sky-300={!dragging}
    class:hover:bg-white={!dragging}
  >
    <input
      bind:this={inputEl}
      type="file"
      {accept}
      onchange={onChange}
      class="hidden"
    />

    <div
      class="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-sm ring-1 transition-all group-hover:scale-105"
      class:ring-sky-300={dragging}
      class:ring-slate-200={!dragging}
    >
      {#if dragging}
        <ImageIcon class="h-6 w-6 text-sky-600" />
      {:else}
        <Upload class="h-6 w-6 text-slate-700" />
      {/if}
    </div>

    <p class="text-sm font-semibold text-slate-900">
      {dragging ? 'Drop to upload' : 'Drag a photo here, or click to browse'}
    </p>
    <p class="mt-1 text-xs text-slate-500">JPEG, PNG, or WebP — up to {Math.round(maxBytes / 1024 / 1024)} MB</p>
  </div>
</div>

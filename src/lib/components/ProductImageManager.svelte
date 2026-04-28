<script lang="ts">
  import { enhance } from '$app/forms';

  interface Props {
    productId: string;
    images: string[];
    imageUrls: Record<string, string>;
  }

  let { productId, images, imageUrls }: Props = $props();
  let busy = $state(false);
  let pendingError: string | null = $state(null);
</script>

<section class="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
  <div class="mb-3 flex items-center justify-between">
    <h2 class="font-semibold">Images</h2>
    <p class="text-xs text-slate-500">
      {images.length} image{images.length === 1 ? '' : 's'}
    </p>
  </div>

  {#if pendingError}
    <p class="mb-3 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">
      {pendingError}
    </p>
  {/if}

  {#if images.length === 0}
    <p class="mb-3 rounded border border-dashed border-slate-300 px-3 py-6 text-center text-sm text-slate-500">
      No images yet. Upload below.
    </p>
  {:else}
    <ul class="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {#each images as path, idx (path)}
        <li
          class="flex flex-col gap-2 rounded border border-slate-200 bg-slate-50 p-2"
          class:ring-2={idx === 0}
          class:ring-emerald-500={idx === 0}
        >
          <div class="relative aspect-square overflow-hidden rounded bg-white">
            {#if imageUrls[path]}
              <img
                src={imageUrls[path]}
                alt={`Product image ${idx + 1}`}
                class="h-full w-full object-contain"
                loading="lazy"
              />
            {:else}
              <div class="flex h-full items-center justify-center text-xs text-slate-400">
                no preview
              </div>
            {/if}
            {#if idx === 0}
              <span
                class="absolute left-1 top-1 rounded bg-emerald-600 px-1.5 py-0.5 text-[10px] font-semibold text-white"
              >
                PRIMARY
              </span>
            {/if}
          </div>

          <p class="truncate font-mono text-[10px] text-slate-500" title={path}>{path}</p>

          <div class="flex flex-wrap gap-1">
            <form
              method="POST"
              action="?/move-image"
              use:enhance={() => {
                busy = true;
                return async ({ update }) => {
                  await update();
                  busy = false;
                };
              }}
            >
              <input type="hidden" name="path" value={path} />
              <input type="hidden" name="direction" value="up" />
              <button
                type="submit"
                disabled={busy || idx === 0}
                class="rounded border border-slate-300 px-2 py-0.5 text-xs hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Move up"
              >
                ↑
              </button>
            </form>
            <form
              method="POST"
              action="?/move-image"
              use:enhance={() => {
                busy = true;
                return async ({ update }) => {
                  await update();
                  busy = false;
                };
              }}
            >
              <input type="hidden" name="path" value={path} />
              <input type="hidden" name="direction" value="down" />
              <button
                type="submit"
                disabled={busy || idx === images.length - 1}
                class="rounded border border-slate-300 px-2 py-0.5 text-xs hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Move down"
              >
                ↓
              </button>
            </form>
            {#if idx !== 0}
              <form
                method="POST"
                action="?/move-image"
                use:enhance={() => {
                  busy = true;
                  return async ({ update }) => {
                    await update();
                    busy = false;
                  };
                }}
              >
                <input type="hidden" name="path" value={path} />
                <input type="hidden" name="direction" value="primary" />
                <button
                  type="submit"
                  disabled={busy}
                  class="rounded border border-slate-300 px-2 py-0.5 text-xs hover:bg-slate-100 disabled:opacity-40"
                >
                  Make primary
                </button>
              </form>
            {/if}
            <form
              method="POST"
              action="?/delete-image"
              use:enhance={({ cancel }) => {
                if (!confirm('Delete this image? This removes it from storage.')) {
                  cancel();
                  return;
                }
                busy = true;
                return async ({ update }) => {
                  await update();
                  busy = false;
                };
              }}
            >
              <input type="hidden" name="path" value={path} />
              <button
                type="submit"
                disabled={busy}
                class="rounded border border-red-300 px-2 py-0.5 text-xs text-red-700 hover:bg-red-50 disabled:opacity-40"
              >
                Delete
              </button>
            </form>
          </div>
        </li>
      {/each}
    </ul>
  {/if}

  <form
    method="POST"
    action="?/upload-image"
    enctype="multipart/form-data"
    use:enhance={({ formData, cancel }) => {
      const file = formData.get('image');
      if (!(file instanceof File) || file.size === 0) {
        pendingError = 'Choose a file to upload.';
        cancel();
        return;
      }
      pendingError = null;
      busy = true;
      return async ({ result, update, formElement }) => {
        await update({ reset: false });
        if (result.type === 'failure' && result.data && typeof result.data.message === 'string') {
          pendingError = result.data.message;
        } else {
          formElement.reset();
        }
        busy = false;
      };
    }}
    class="flex flex-wrap items-center gap-2"
  >
    <input type="hidden" name="productId" value={productId} />
    <input
      type="file"
      name="image"
      accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
      required
      class="text-sm"
    />
    <button
      type="submit"
      disabled={busy}
      class="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
    >
      {busy ? 'Uploading…' : 'Upload image'}
    </button>
    <p class="basis-full text-xs text-slate-500">
      PNG, JPEG, WebP, GIF, or AVIF. Max 10 MB. The first image is the primary.
    </p>
  </form>
</section>

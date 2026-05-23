<script lang="ts" generics="T extends string">
  interface Props {
    value: T;
    options: ReadonlyArray<{ value: T; label: string }>;
    onChange: (value: T) => void;
  }

  let { value, options, onChange }: Props = $props();
</script>

<div class="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs">
  {#each options as opt (opt.value)}
    <button
      type="button"
      onclick={() => onChange(opt.value)}
      class="rounded-md px-2.5 py-1 font-medium transition-colors"
      class:bg-white={value === opt.value}
      class:shadow-sm={value === opt.value}
      class:text-slate-900={value === opt.value}
      class:text-slate-500={value !== opt.value}
    >
      {opt.label}
    </button>
  {/each}
</div>

<script lang="ts">
  import { currency } from '$lib/format';

  interface Props {
    subtotal: number;
    taxAmount: number;
    taxRate: number;
    state: string | null;
    county?: string | null;
  }

  let { subtotal, taxAmount, taxRate, state, county } = $props();

  const taxPercentage = taxRate * 100;
</script>

<div class="rounded-lg border border-slate-200 bg-white p-4 shadow-sm text-sm">
  <h3 class="mb-3 font-semibold">Tax calculation</h3>
  <dl class="space-y-2">
    <div class="flex justify-between">
      <dt class="text-slate-600">Subtotal</dt>
      <dd class="font-medium">{currency(subtotal)}</dd>
    </div>

    <div class="flex justify-between border-t border-slate-200 pt-2">
      <dt class="text-slate-600">
        Tax rate
        {#if state}
          <span class="text-xs text-slate-500">({state}{county ? ` · ${county}` : ''})</span>
        {/if}
      </dt>
      <dd class="font-mono">{(taxPercentage).toFixed(2)}%</dd>
    </div>

    <div class="flex justify-between border-t border-slate-200 pt-2 font-semibold">
      <dt>Tax amount</dt>
      <dd>{currency(taxAmount)}</dd>
    </div>
  </dl>
</div>

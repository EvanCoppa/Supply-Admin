<script lang="ts">
  import type { OrderStatus } from '$lib/types/db';
  import { Badge } from '$lib/components/ui';

  interface Props {
    status: OrderStatus | string;
  }

  let { status }: Props = $props();

  const statusClass: Record<string, string> = {
    pending_payment: 'bg-slate-100 text-slate-600',
    paid: 'bg-sky-50 text-sky-700',
    fulfilled: 'bg-indigo-50 text-indigo-700',
    shipped: 'bg-violet-50 text-violet-700',
    delivered: 'bg-emerald-50 text-emerald-700',
    cancelled: 'bg-slate-200 text-slate-700',
    refunded: 'bg-red-50 text-red-700'
  };
</script>

<Badge class={statusClass[status] ?? ''}>{status}</Badge>

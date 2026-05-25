<script lang="ts">
  import { goto } from '$app/navigation';
  import Select from '$lib/components/Select.svelte';
  import HelpTooltip from '$lib/components/HelpTooltip.svelte';

  let { data } = $props();
  let isSubmitting = $state(false);

  async function handleSubmit(e: SubmitEvent) {
    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);

    isSubmitting = true;
    try {
      const response = await fetch('/api/v1/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          customerId: formData.get('customerId'),
          status: formData.get('status') || 'pending',
          paymentMethod: formData.get('paymentMethod')
        })
      });

      if (response.ok) {
        const order = await response.json();
        await goto(`/orders/${order.id}`);
      } else {
        console.error('Failed to create order');
      }
    } finally {
      isSubmitting = false;
    }
  }
</script>

<svelte:head><title>New Order · Supply Admin</title></svelte:head>

<section class="space-y-4">
  <header class="flex items-baseline justify-between">
    <div>
      <div class="flex items-center gap-2">
        <h1 class="text-2xl font-semibold">Create New Order</h1>
        <HelpTooltip text="Create a new order manually for a customer" />
      </div>
    </div>
    <a
      href="/orders"
      class="rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100"
    >
      Back to Orders
    </a>
  </header>

  <form
    onsubmit={async (e) => {
      e.preventDefault();
      await handleSubmit(e);
    }}
    class="max-w-md space-y-4 rounded border border-slate-200 bg-white p-4"
  >
    <div>
      <label for="customerId" class="block text-sm font-medium text-slate-900"> Customer </label>
      <Select name="customerId" required>
        <option value="">Select a customer</option>
        {#each data.customers as customer}
          <option value={customer.id}>{customer.business_name}</option>
        {/each}
      </Select>
    </div>

    <div>
      <label for="status" class="block text-sm font-medium text-slate-900"> Status </label>
      <Select name="status">
        <option value="pending">Pending</option>
        <option value="processing">Processing</option>
        <option value="completed">Completed</option>
        <option value="cancelled">Cancelled</option>
      </Select>
    </div>

    <div>
      <label for="paymentMethod" class="block text-sm font-medium text-slate-900">
        Payment Method
      </label>
      <Select name="paymentMethod">
        <option value="">None</option>
        <option value="credit_card">Credit Card</option>
        <option value="bank_transfer">Bank Transfer</option>
        <option value="check">Check</option>
        <option value="cash">Cash</option>
      </Select>
    </div>

    <div class="flex gap-2 pt-4">
      <button
        type="submit"
        disabled={isSubmitting}
        class="rounded bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-700 disabled:bg-slate-400"
      >
        {isSubmitting ? 'Creating...' : 'Create Order'}
      </button>
      <a
        href="/orders"
        class="rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100"
      >
        Cancel
      </a>
    </div>
  </form>
</section>

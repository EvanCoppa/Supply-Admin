<script lang="ts">
  import AddressAutocomplete from './AddressAutocomplete.svelte';

  interface Props {
    label?: string;
    namePrefix?: string;
    initialLabel?: string;
    initialLine1?: string;
    initialLine2?: string;
    initialCity?: string;
    initialRegion?: string;
    initialPostalCode?: string;
    initialCountry?: string;
    required?: boolean;
    hideLabel?: boolean;
  }

  let {
    label = 'Address',
    namePrefix = 'address',
    initialLabel = '',
    initialLine1 = '',
    initialLine2 = '',
    initialCity = '',
    initialRegion = '',
    initialPostalCode = '',
    initialCountry = '',
    required = true,
    hideLabel = false
  }: Props = $props();

  let formData = $state({
    label: '',
    line1: '',
    line2: '',
    city: '',
    region: '',
    postal_code: '',
    country: ''
  });

  // Initialize form data with provided values
  $effect(() => {
    formData.label = initialLabel;
    formData.line1 = initialLine1;
    formData.line2 = initialLine2;
    formData.city = initialCity;
    formData.region = initialRegion;
    formData.postal_code = initialPostalCode;
    formData.country = initialCountry;
  });

  // Export current address data for programmatic access
  export function getAddress() {
    return formData;
  }

  // Reset form to initial values
  export function reset() {
    formData = {
      label: initialLabel,
      line1: initialLine1,
      line2: initialLine2,
      city: initialCity,
      region: initialRegion,
      postal_code: initialPostalCode,
      country: initialCountry
    };
  }
</script>

<div class="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
  {#if !hideLabel}
    <h3 class="font-semibold text-slate-900">{label}</h3>
  {/if}

  <!-- Search input -->
  <div>
    <label class="block">
      <span class="mb-1 block text-xs font-medium">Search address</span>
      <AddressAutocomplete
        on:select={(
          e: CustomEvent<{
            line1: string;
            line2: string;
            city: string;
            region: string;
            postal_code: string;
            country: string;
          }>
        ) => {
          const detail = e.detail;
          formData.line1 = detail.line1 ?? '';
          formData.line2 = detail.line2 ?? '';
          formData.city = detail.city ?? '';
          formData.region = detail.region ?? '';
          formData.postal_code = detail.postal_code ?? '';
          formData.country = detail.country ?? '';
        }}
      />
    </label>
  </div>

  <!-- Address fields -->
  <div class="grid gap-3 sm:grid-cols-3">
    <label class="block">
      <span class="mb-1 block text-xs font-medium">Label</span>
      <input
        name={namePrefix ? `${namePrefix}_label` : 'label'}
        bind:value={formData.label}
        placeholder="e.g., Warehouse, Shipping"
        class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
      />
    </label>

    <label class="block sm:col-span-2">
      <span class="mb-1 block text-xs font-medium">Line 1 {required ? '*' : ''}</span>
      <input
        name={namePrefix ? `${namePrefix}_line1` : 'line1'}
        bind:value={formData.line1}
        {required}
        class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
      />
    </label>

    <label class="block sm:col-span-3">
      <span class="mb-1 block text-xs font-medium">Line 2</span>
      <input
        name={namePrefix ? `${namePrefix}_line2` : 'line2'}
        bind:value={formData.line2}
        placeholder="Apartment, suite, etc."
        class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
      />
    </label>

    <label class="block">
      <span class="mb-1 block text-xs font-medium">City {required ? '*' : ''}</span>
      <input
        name={namePrefix ? `${namePrefix}_city` : 'city'}
        bind:value={formData.city}
        {required}
        class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
      />
    </label>

    <label class="block">
      <span class="mb-1 block text-xs font-medium">Region {required ? '*' : ''}</span>
      <input
        name={namePrefix ? `${namePrefix}_region` : 'region'}
        bind:value={formData.region}
        placeholder="State, province, etc."
        {required}
        class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
      />
    </label>

    <label class="block">
      <span class="mb-1 block text-xs font-medium">Postal code {required ? '*' : ''}</span>
      <input
        name={namePrefix ? `${namePrefix}_postal_code` : 'postal_code'}
        bind:value={formData.postal_code}
        {required}
        class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
      />
    </label>

    <label class="block">
      <span class="mb-1 block text-xs font-medium">Country {required ? '*' : ''}</span>
      <input
        name={namePrefix ? `${namePrefix}_country` : 'country'}
        bind:value={formData.country}
        {required}
        maxlength="2"
        placeholder="US"
        class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm uppercase"
      />
    </label>
  </div>
</div>

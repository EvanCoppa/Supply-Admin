<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  interface NominatimResult {
    display_name: string;
    address: {
      house_number?: string;
      road?: string;
      city?: string;
      town?: string;
      county?: string;
      state?: string;
      postcode?: string;
      country?: string;
      country_code?: string;
    };
    lat: string;
    lon: string;
  }

  interface AddressData {
    line1: string;
    line2: string;
    city: string;
    region: string;
    postal_code: string;
    country: string;
  }

  const dispatch = createEventDispatcher<{ select: AddressData }>();

  let q = $state('');
  let results: NominatimResult[] = $state([]);
  let isLoading = $state(false);
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let showResults = $state(false);

  async function searchAddresses(query: string) {
    if (query.trim().length < 3) {
      results = [];
      return;
    }

    isLoading = true;
    try {
      const params = new URLSearchParams({
        q: query,
        format: 'json',
        addressdetails: '1',
        limit: '10'
      });

      const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
        headers: {
          'User-Agent': 'SupplyAdmin-AddressSearch'
        }
      });

      if (!response.ok) throw new Error('Search failed');
      results = await response.json();
      showResults = true;
    } catch (error) {
      console.error('Address search error:', error);
      results = [];
    } finally {
      isLoading = false;
    }
  }

  function handleInput(e: Event) {
    const target = e.target as HTMLInputElement;
    q = target.value;

    if (debounceTimer) clearTimeout(debounceTimer);

    if (q.trim().length === 0) {
      results = [];
      showResults = false;
      return;
    }

    debounceTimer = setTimeout(() => {
      searchAddresses(q);
    }, 300);
  }

  function selectAddress(result: NominatimResult) {
    const addr = result.address;
    const streetNumber = addr.house_number ? `${addr.house_number} ` : '';
    const road = addr.road ?? '';

    const address: AddressData = {
      line1: `${streetNumber}${road}`.trim() || result.display_name.split(',')[0],
      line2: '',
      city: addr.city || addr.town || '',
      region: addr.state || addr.county || '',
      postal_code: addr.postcode || '',
      country: (addr.country_code || '').toUpperCase()
    };

    q = '';
    results = [];
    showResults = false;

    dispatch('select', address);
  }

  function handleClickOutside(e: Event) {
    const target = e.target as HTMLElement;
    if (!target.closest('.address-autocomplete')) {
      showResults = false;
    }
  }
</script>

<svelte:document onmousedown={handleClickOutside} />

<div class="address-autocomplete relative">
  <input
    type="text"
    value={q}
    oninput={handleInput}
    placeholder="Search address or coordinates..."
    class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm focus:border-slate-400 focus:outline-none"
  />

  {#if showResults}
    <div class="absolute top-full left-0 right-0 z-10 mt-1 rounded border border-slate-300 bg-white shadow-lg">
      {#if isLoading}
        <div class="px-3 py-2 text-xs text-slate-500">Searching...</div>
      {:else if results.length === 0}
        <div class="px-3 py-2 text-xs text-slate-500">
          {q.trim().length < 3 ? 'Type at least 3 characters' : 'No addresses found'}
        </div>
      {:else}
        <ul class="max-h-64 divide-y divide-slate-100 overflow-y-auto">
          {#each results as result (result.display_name)}
            <li>
              <button
                type="button"
                onclick={() => selectAddress(result)}
                class="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
              >
                <div class="truncate font-medium text-slate-900">{result.address.road || result.display_name.split(',')[0]}</div>
                <div class="truncate text-xs text-slate-600">{result.display_name}</div>
              </button>
            </li>
          {/each}
        </ul>
      {/if}
    </div>
  {/if}
</div>

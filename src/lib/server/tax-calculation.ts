import type { SupabaseClient } from '@supabase/supabase-js';

export async function calculateTaxForAddress(
  supabase: SupabaseClient,
  address: Record<string, unknown>,
  subtotal: number
): Promise<{ tax: number; rate: number; state: string | null; county: string | null }> {
  if (!address || subtotal <= 0) {
    return { tax: 0, rate: 0, state: null, county: null };
  }

  const state = extractState(address);
  if (!state) {
    return { tax: 0, rate: 0, state: null, county: null };
  }

  const county = extractCounty(address);

  try {
    let query = supabase
      .from('tax_rates')
      .select('tax_rate')
      .eq('state_code', state.toUpperCase())
      .lte('effective_from', new Date().toISOString())
      .or(`effective_to.is.null,effective_to.gt.${new Date().toISOString()}`)
      .order('effective_from', { ascending: false });

    // If county is available, try county-level rate first
    if (county) {
      query = query.eq('county_code', county);
    } else {
      query = query.is('county_code', null);
    }

    const { data: taxRateData } = await query.limit(1).single();

    if (!taxRateData) {
      // Fallback to state-level if county not found
      if (county) {
        const { data: stateLevelData } = await supabase
          .from('tax_rates')
          .select('tax_rate')
          .eq('state_code', state.toUpperCase())
          .is('county_code', null)
          .lte('effective_from', new Date().toISOString())
          .or(`effective_to.is.null,effective_to.gt.${new Date().toISOString()}`)
          .order('effective_from', { ascending: false })
          .limit(1)
          .single();

        if (stateLevelData) {
          const rate = parseRate(stateLevelData.tax_rate);
          return {
            tax: Math.round(subtotal * rate * 100) / 100,
            rate,
            state,
            county: null
          };
        }
      }
      return { tax: 0, rate: 0, state, county };
    }

    const rate = parseRate(taxRateData.tax_rate);
    return {
      tax: Math.round(subtotal * rate * 100) / 100,
      rate,
      state,
      county: county ?? null
    };
  } catch (err) {
    console.error('[tax-calculation] error', err);
    return { tax: 0, rate: 0, state, county };
  }
}

function parseRate(rate: unknown): number {
  if (typeof rate === 'number') return rate;
  if (typeof rate === 'string') return parseFloat(rate);
  return 0;
}

function extractState(address: Record<string, unknown>): string | null {
  return (
    (address['state'] as string) ||
    (address['state_province'] as string) ||
    (address['province'] as string) ||
    (address['administrative_area_level_1'] as string) ||
    null
  );
}

function extractCounty(address: Record<string, unknown>): string | null {
  return (address['county_code'] as string) || null;
}

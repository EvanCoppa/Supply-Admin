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

const US_STATE_CODES: Record<string, string> = {
  alabama: 'AL', alaska: 'AK', arizona: 'AZ', arkansas: 'AR', california: 'CA',
  colorado: 'CO', connecticut: 'CT', delaware: 'DE', florida: 'FL', georgia: 'GA',
  hawaii: 'HI', idaho: 'ID', illinois: 'IL', indiana: 'IN', iowa: 'IA',
  kansas: 'KS', kentucky: 'KY', louisiana: 'LA', maine: 'ME', maryland: 'MD',
  massachusetts: 'MA', michigan: 'MI', minnesota: 'MN', mississippi: 'MS',
  missouri: 'MO', montana: 'MT', nebraska: 'NE', nevada: 'NV',
  'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY',
  'north carolina': 'NC', 'north dakota': 'ND', ohio: 'OH', oklahoma: 'OK',
  oregon: 'OR', pennsylvania: 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
  'south dakota': 'SD', tennessee: 'TN', texas: 'TX', utah: 'UT', vermont: 'VT',
  virginia: 'VA', washington: 'WA', 'west virginia': 'WV', wisconsin: 'WI',
  wyoming: 'WY', 'district of columbia': 'DC'
};

function normalizeStateCode(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length === 2) return trimmed.toUpperCase();
  const code = US_STATE_CODES[trimmed.toLowerCase()];
  return code ?? null;
}

function extractState(address: Record<string, unknown>): string | null {
  const raw =
    (address['state'] as string) ||
    (address['state_province'] as string) ||
    (address['province'] as string) ||
    (address['administrative_area_level_1'] as string) ||
    null;
  return normalizeStateCode(raw);
}

function extractCounty(address: Record<string, unknown>): string | null {
  return (address['county_code'] as string) || null;
}

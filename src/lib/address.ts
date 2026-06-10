/**
 * Formats an address snapshot (JSONB from orders.shipping_address_snapshot)
 * into display lines. Snapshots from the admin UI use customer_addresses
 * columns (line1, line2, city, region, postal_code, country); API orders
 * accept a freeform record, so common aliases are handled too.
 */
export function addressLines(snapshot: Record<string, unknown> | null | undefined): string[] {
  if (!snapshot) return [];

  const get = (...keys: string[]): string | null => {
    for (const key of keys) {
      const value = snapshot[key];
      if (typeof value === 'string' && value.trim()) return value.trim();
    }
    return null;
  };

  const lines: string[] = [];
  const line1 = get('line1', 'address1', 'street', 'address');
  const line2 = get('line2', 'address2');
  if (line1) lines.push(line1);
  if (line2) lines.push(line2);

  const city = get('city');
  const region = get('region', 'state', 'province');
  const postal = get('postal_code', 'zip', 'postcode');
  const regionPostal = [region, postal].filter(Boolean).join(' ');
  const cityLine = [city, regionPostal].filter(Boolean).join(', ');
  if (cityLine) lines.push(cityLine);

  const country = get('country');
  if (country) lines.push(country);

  if (lines.length === 0) {
    for (const value of Object.values(snapshot)) {
      if (typeof value === 'string' && value.trim()) lines.push(value.trim());
    }
  }

  return lines;
}

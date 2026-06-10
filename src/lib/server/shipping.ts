import { env } from '$env/dynamic/private';

const EASYPOST_BASE_URL = 'https://api.easypost.com/v2';

export class ShippingError extends Error {}

export interface ShippingAddress {
  name: string | null;
  street1: string;
  street2: string | null;
  city: string;
  state: string;
  zip: string;
  country: string;
  phone: string | null;
}

export interface ShippingRate {
  id: string;
  carrier: string;
  service: string;
  rate: number;
  currency: string;
  delivery_days: number | null;
}

export interface ShipmentQuote {
  shipment_id: string;
  rates: ShippingRate[];
}

export interface PurchasedLabel {
  carrier: string;
  service: string;
  rate: number;
  tracking_number: string;
  tracking_url: string | null;
  label_url: string;
}

export function isShippingConfigured() {
  return Boolean(env['EASYPOST_API_KEY']);
}

/**
 * Maps an order's `shipping_address_snapshot` JSONB into EasyPost's address
 * shape. Snapshots store the state under `state` (admin-created orders) or
 * `region` (storefront address records); both are accepted.
 */
export function buildToAddress(
  snapshot: Record<string, unknown> | null,
  recipientName?: string | null
): ShippingAddress {
  if (!snapshot) throw new ShippingError('Order has no shipping address snapshot.');
  const str = (key: string) => {
    const v = snapshot[key];
    return typeof v === 'string' && v.trim() !== '' ? v.trim() : null;
  };
  const street1 = str('line1') ?? str('street1');
  const city = str('city');
  const state = str('state') ?? str('region');
  const zip = str('postal_code') ?? str('zip');
  if (!street1 || !city || !state || !zip) {
    const missing = [
      !street1 && 'street',
      !city && 'city',
      !state && 'state',
      !zip && 'postal code'
    ].filter((v): v is string => Boolean(v));
    throw new ShippingError(`Shipping address is missing: ${missing.join(', ')}.`);
  }
  return {
    name: recipientName?.trim() || str('label'),
    street1,
    street2: str('line2') ?? str('street2'),
    city,
    state,
    zip,
    country: str('country') ?? 'US',
    phone: str('phone')
  };
}

export function getFromAddress(): ShippingAddress {
  const street1 = env['SHIP_FROM_STREET1'];
  const city = env['SHIP_FROM_CITY'];
  const state = env['SHIP_FROM_STATE'];
  const zip = env['SHIP_FROM_ZIP'];
  if (!street1 || !city || !state || !zip) {
    const missing = [
      !street1 && 'SHIP_FROM_STREET1',
      !city && 'SHIP_FROM_CITY',
      !state && 'SHIP_FROM_STATE',
      !zip && 'SHIP_FROM_ZIP'
    ].filter((v): v is string => Boolean(v));
    throw new ShippingError(`Ship-from address is not configured (${missing.join(', ')}).`);
  }
  return {
    name: env['SHIP_FROM_NAME'] || null,
    street1,
    street2: env['SHIP_FROM_STREET2'] || null,
    city,
    state,
    zip,
    country: env['SHIP_FROM_COUNTRY'] || 'US',
    phone: env['SHIP_FROM_PHONE'] || null
  };
}

interface EasyPostRate {
  id?: unknown;
  carrier?: unknown;
  service?: unknown;
  rate?: unknown;
  currency?: unknown;
  delivery_days?: unknown;
}

/** Normalizes EasyPost's rate objects and sorts them cheapest-first. */
export function parseRates(raw: unknown): ShippingRate[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .flatMap((r: EasyPostRate) => {
      const rate = Number(r.rate);
      if (typeof r.id !== 'string' || !Number.isFinite(rate)) return [];
      return [
        {
          id: r.id,
          carrier: typeof r.carrier === 'string' ? r.carrier : 'Unknown',
          service: typeof r.service === 'string' ? r.service : '',
          rate,
          currency: typeof r.currency === 'string' ? r.currency : 'USD',
          delivery_days: typeof r.delivery_days === 'number' ? r.delivery_days : null
        }
      ];
    })
    .sort((a, b) => a.rate - b.rate);
}

async function easypostRequest(path: string, body: unknown): Promise<Record<string, unknown>> {
  const apiKey = env['EASYPOST_API_KEY'];
  if (!apiKey) {
    throw new ShippingError('Shipping is not configured (EASYPOST_API_KEY).');
  }
  const res = await fetch(`${EASYPOST_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${apiKey}:`).toString('base64')}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!res.ok) {
    const error = json?.['error'] as { message?: unknown } | undefined;
    const message =
      typeof error?.message === 'string'
        ? `EasyPost: ${error.message}`
        : `EasyPost request failed (${res.status}).`;
    throw new ShippingError(message);
  }
  if (!json) throw new ShippingError('EasyPost returned an unreadable response.');
  return json;
}

export async function createShipment(input: {
  to: ShippingAddress;
  from: ShippingAddress;
  weightOz: number;
}): Promise<ShipmentQuote> {
  const json = await easypostRequest('/shipments', {
    shipment: {
      to_address: input.to,
      from_address: input.from,
      parcel: { weight: input.weightOz }
    }
  });
  const shipmentId = json['id'];
  if (typeof shipmentId !== 'string') {
    throw new ShippingError('EasyPost did not return a shipment id.');
  }
  return { shipment_id: shipmentId, rates: parseRates(json['rates']) };
}

export async function buyShipmentLabel(input: {
  shipmentId: string;
  rateId: string;
}): Promise<PurchasedLabel> {
  const json = await easypostRequest(`/shipments/${encodeURIComponent(input.shipmentId)}/buy`, {
    rate: { id: input.rateId }
  });
  const selectedRate = (json['selected_rate'] ?? {}) as EasyPostRate;
  const postageLabel = (json['postage_label'] ?? {}) as { label_url?: unknown };
  const tracker = (json['tracker'] ?? {}) as { public_url?: unknown };
  const trackingNumber = json['tracking_code'];
  if (typeof trackingNumber !== 'string' || typeof postageLabel.label_url !== 'string') {
    throw new ShippingError('EasyPost purchase succeeded but the label response was incomplete.');
  }
  return {
    carrier: typeof selectedRate.carrier === 'string' ? selectedRate.carrier : 'Unknown',
    service: typeof selectedRate.service === 'string' ? selectedRate.service : '',
    rate: Number(selectedRate.rate) || 0,
    tracking_number: trackingNumber,
    tracking_url: typeof tracker.public_url === 'string' ? tracker.public_url : null,
    label_url: postageLabel.label_url
  };
}

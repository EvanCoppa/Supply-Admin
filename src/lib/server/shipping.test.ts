import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockEnv = vi.hoisted((): Record<string, string | undefined> => ({}));

vi.mock('$env/dynamic/private', () => ({ env: mockEnv }));

import {
  buildToAddress,
  buyShipmentLabel,
  createShipment,
  getFromAddress,
  isShippingConfigured,
  parseRates,
  ShippingError
} from './shipping';

function setEnv(values: Record<string, string | undefined>) {
  for (const key of Object.keys(mockEnv)) delete mockEnv[key];
  Object.assign(mockEnv, values);
}

const FROM_ENV = {
  EASYPOST_API_KEY: 'EZTK_test_key',
  SHIP_FROM_NAME: 'Evolution Supply',
  SHIP_FROM_STREET1: '123 Warehouse Way',
  SHIP_FROM_CITY: 'Tampa',
  SHIP_FROM_STATE: 'FL',
  SHIP_FROM_ZIP: '33601'
};

const SNAPSHOT = {
  label: 'Main office',
  line1: '500 Clinic Ave',
  line2: 'Suite 2',
  city: 'Orlando',
  state: 'FL',
  postal_code: '32801',
  country: 'US'
};

beforeEach(() => {
  setEnv(FROM_ENV);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('isShippingConfigured', () => {
  it('reflects presence of EASYPOST_API_KEY', () => {
    expect(isShippingConfigured()).toBe(true);
    setEnv({});
    expect(isShippingConfigured()).toBe(false);
  });
});

describe('buildToAddress', () => {
  it('maps an admin order snapshot to the EasyPost shape', () => {
    expect(buildToAddress(SNAPSHOT, 'Bright Smiles LLC')).toEqual({
      name: 'Bright Smiles LLC',
      street1: '500 Clinic Ave',
      street2: 'Suite 2',
      city: 'Orlando',
      state: 'FL',
      zip: '32801',
      country: 'US',
      phone: null
    });
  });

  it('accepts region/zip variants and falls back to the address label as name', () => {
    const snapshot = {
      label: 'Main office',
      line1: '500 Clinic Ave',
      city: 'Orlando',
      region: 'FL',
      zip: '32801'
    };
    const addr = buildToAddress(snapshot);
    expect(addr.state).toBe('FL');
    expect(addr.zip).toBe('32801');
    expect(addr.name).toBe('Main office');
    expect(addr.country).toBe('US');
  });

  it('throws when the snapshot is missing', () => {
    expect(() => buildToAddress(null)).toThrow(ShippingError);
  });

  it('lists missing required fields', () => {
    expect(() => buildToAddress({ line1: '500 Clinic Ave' })).toThrow(
      'Shipping address is missing: city, state, postal code.'
    );
  });
});

describe('getFromAddress', () => {
  it('builds the ship-from address from env', () => {
    expect(getFromAddress()).toEqual({
      name: 'Evolution Supply',
      street1: '123 Warehouse Way',
      street2: null,
      city: 'Tampa',
      state: 'FL',
      zip: '33601',
      country: 'US',
      phone: null
    });
  });

  it('throws listing missing env vars', () => {
    setEnv({ ...FROM_ENV, SHIP_FROM_CITY: undefined, SHIP_FROM_ZIP: '' });
    expect(() => getFromAddress()).toThrow('SHIP_FROM_CITY, SHIP_FROM_ZIP');
  });
});

describe('parseRates', () => {
  it('normalizes and sorts rates cheapest-first', () => {
    const rates = parseRates([
      { id: 'rate_2', carrier: 'UPS', service: 'Ground', rate: '12.50', currency: 'USD' },
      { id: 'rate_1', carrier: 'USPS', service: 'Priority', rate: '8.15', delivery_days: 2 }
    ]);
    expect(rates.map((r) => r.id)).toEqual(['rate_1', 'rate_2']);
    expect(rates[0]).toEqual({
      id: 'rate_1',
      carrier: 'USPS',
      service: 'Priority',
      rate: 8.15,
      currency: 'USD',
      delivery_days: 2
    });
    expect(rates[1]?.delivery_days).toBeNull();
  });

  it('drops malformed entries and tolerates non-array input', () => {
    expect(parseRates([{ id: 'rate_1', rate: 'not-a-number' }, { rate: '5.00' }])).toEqual([]);
    expect(parseRates(undefined)).toEqual([]);
  });
});

describe('createShipment', () => {
  const to = buildToAddress(SNAPSHOT, 'Bright Smiles LLC');

  it('posts the shipment and returns id plus parsed rates', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 'shp_123',
          rates: [{ id: 'rate_1', carrier: 'USPS', service: 'Priority', rate: '8.15' }]
        }),
        { status: 200 }
      )
    );
    vi.stubGlobal('fetch', fetchMock);

    const quote = await createShipment({ to, from: getFromAddress(), weightOz: 16 });
    expect(quote.shipment_id).toBe('shp_123');
    expect(quote.rates).toHaveLength(1);

    const [url, init] = fetchMock.mock.calls[0] as [
      string,
      { headers: Record<string, string>; body: string }
    ];
    expect(url).toBe('https://api.easypost.com/v2/shipments');
    expect(init.headers['Authorization']).toBe(
      `Basic ${Buffer.from('EZTK_test_key:').toString('base64')}`
    );
    expect(JSON.parse(init.body).shipment.parcel).toEqual({ weight: 16 });
  });

  it('surfaces EasyPost error messages', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ error: { message: 'Invalid zip' } }), { status: 422 })
        )
    );
    await expect(createShipment({ to, from: getFromAddress(), weightOz: 16 })).rejects.toThrow(
      'EasyPost: Invalid zip'
    );
  });

  it('throws when not configured', async () => {
    setEnv({ ...FROM_ENV, EASYPOST_API_KEY: undefined });
    await expect(createShipment({ to, from: getFromAddress(), weightOz: 16 })).rejects.toThrow(
      'Shipping is not configured'
    );
  });

  it('throws when no shipment id is returned', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ rates: [] }), { status: 200 }))
    );
    await expect(createShipment({ to, from: getFromAddress(), weightOz: 16 })).rejects.toThrow(
      'did not return a shipment id'
    );
  });
});

describe('buyShipmentLabel', () => {
  it('buys the selected rate and returns label details', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          tracking_code: '9400111899560000000000',
          selected_rate: { carrier: 'USPS', service: 'Priority', rate: '8.15' },
          postage_label: { label_url: 'https://assets.easypost.com/label.png' },
          tracker: { public_url: 'https://track.easypost.com/abc' }
        }),
        { status: 200 }
      )
    );
    vi.stubGlobal('fetch', fetchMock);

    const label = await buyShipmentLabel({ shipmentId: 'shp_123', rateId: 'rate_1' });
    expect(label).toEqual({
      carrier: 'USPS',
      service: 'Priority',
      rate: 8.15,
      tracking_number: '9400111899560000000000',
      tracking_url: 'https://track.easypost.com/abc',
      label_url: 'https://assets.easypost.com/label.png'
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, { body: string }];
    expect(url).toBe('https://api.easypost.com/v2/shipments/shp_123/buy');
    expect(JSON.parse(init.body)).toEqual({ rate: { id: 'rate_1' } });
  });

  it('throws when the purchase response is incomplete', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ selected_rate: { carrier: 'USPS' } }), { status: 200 })
        )
    );
    await expect(buyShipmentLabel({ shipmentId: 'shp_123', rateId: 'rate_1' })).rejects.toThrow(
      'label response was incomplete'
    );
  });

  it('throws on an unreadable response body', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('not-json', { status: 200 })));
    await expect(buyShipmentLabel({ shipmentId: 'shp_123', rateId: 'rate_1' })).rejects.toThrow(
      'unreadable response'
    );
  });
});

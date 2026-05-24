import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ url }) => {
  const base = `${url.protocol}//${url.host}/api/v1`;

  return json({
    name: 'Supply Partner API',
    version: '1.0',
    description:
      'Programmatic access for customers and integration partners. All endpoints return JSON.',
    authentication: {
      scheme: 'Bearer token',
      header: 'Authorization: Bearer supply_<token>',
      notes:
        'Tokens are issued per customer. Pass via the Authorization header on every request. Treat tokens as secrets.',
      how_to_obtain:
        'Request an API token from your Supply account manager, or rotate the existing token via the partner integration callback.'
    },
    conventions: {
      base_url: base,
      content_type: 'application/json',
      pagination: {
        style: 'cursor',
        request_params: [
          'limit (1-100, default 24)',
          'cursor (opaque string from previous response)'
        ],
        response_fields: ['items', 'next_cursor (null when end reached)']
      },
      errors: {
        format: 'HTTP status code + JSON body { "message": string }',
        common: {
          '400': 'Invalid request payload or query parameter',
          '401': 'Missing or invalid bearer token',
          '403': 'Token valid but resource is not accessible to this customer',
          '404': 'Resource does not exist or is not visible to this customer',
          '500': 'Server error — safe to retry with backoff'
        }
      },
      money: 'All monetary values are numbers in the customer currency, rounded to 2 decimals.',
      timestamps: 'All timestamps are ISO 8601 strings in UTC.',
      rate_limits: {
        partner_endpoints:
          '60 requests per minute per API token (or per client IP for unauthenticated requests).',
        integration_endpoints: '30 requests per minute per client IP for /api/v1/integrations/*.',
        response_headers: [
          'X-RateLimit-Limit: requests allowed in the current window',
          'X-RateLimit-Remaining: requests remaining in the current window',
          'X-RateLimit-Reset: unix timestamp (seconds) when the window resets'
        ],
        exceeded:
          'On 429 responses, Retry-After indicates the number of seconds to wait before retrying.',
        scope:
          'Limits are enforced per server instance. Distributed deployments may permit a higher aggregate rate.'
      }
    },
    endpoints: [
      {
        name: 'List products',
        method: 'GET',
        path: '/api/v1/products',
        url: `${base}/products`,
        description:
          'Returns the catalog visible to the authenticated customer, with customer-specific pricing and purchase eligibility.',
        query_params: {
          limit: 'integer, 1-100, default 24',
          cursor: 'opaque string from prior response (next_cursor)',
          q: 'search by name, sku, or description',
          category_id: 'filter to a single category'
        },
        response: {
          items: [
            {
              id: 'uuid',
              sku: 'string',
              name: 'string',
              description: 'string | null',
              manufacturer: 'string | null',
              unit_of_measure: 'string | null',
              pack_size: 'number | null',
              image_paths: 'string[]',
              image_url: 'string | null',
              base_price: 'number',
              customer_price: 'number',
              can_buy: 'boolean'
            }
          ],
          next_cursor: 'string | null'
        }
      },
      {
        name: 'Place order',
        method: 'POST',
        path: '/api/v1/orders',
        url: `${base}/orders`,
        description: 'Submits a purchase order on behalf of the authenticated customer.',
        request_body: {
          idempotency_key:
            'string (optional, max 128 chars) — resubmitting with the same key returns the original order',
          shipping_address: 'object | null (optional, free-form address snapshot)',
          items: [
            {
              product_id: 'uuid (required)',
              quantity: 'integer, 1-999 (required)'
            }
          ]
        },
        response: {
          order: {
            id: 'uuid',
            status: 'string',
            subtotal: 'number',
            tax: 'number',
            shipping: 'number',
            total: 'number',
            placed_at: 'timestamp',
            line_items: 'array (only on fresh creation)'
          },
          idempotent: 'boolean — true if a prior order was returned for the given key'
        }
      },
      {
        name: 'List invoices',
        method: 'GET',
        path: '/api/v1/invoices',
        url: `${base}/invoices`,
        description: 'Lists invoices issued to the authenticated customer, newest first.',
        query_params: {
          limit: 'integer, 1-100, default 24',
          cursor: 'opaque string from prior response',
          status: 'draft | issued | paid | partially_paid | overdue | void | refunded',
          payment_status: 'not_started | intent_created | processing | paid | failed | cancelled'
        },
        response: {
          items: 'Invoice[] (see "Get invoice" for shape, minus line_items/billing_address/notes)',
          next_cursor: 'string | null'
        }
      },
      {
        name: 'Get invoice',
        method: 'GET',
        path: '/api/v1/invoices/{id}',
        url: `${base}/invoices/{id}`,
        description: 'Returns a single invoice with line items.',
        response: {
          invoice: {
            id: 'uuid',
            invoice_number: 'string',
            order_id: 'uuid | null',
            status: 'string',
            payment_status: 'string',
            subtotal: 'number',
            tax: 'number',
            shipping: 'number',
            discount: 'number',
            total: 'number',
            amount_paid: 'number',
            amount_due: 'number',
            terms: 'string | null',
            issued_at: 'timestamp | null',
            due_at: 'timestamp | null',
            paid_at: 'timestamp | null',
            sent_at: 'timestamp | null',
            billing_email: 'string | null',
            billing_address: 'object | null',
            customer_memo: 'string | null',
            notes: 'string | null',
            payment_url: 'string | null',
            created_at: 'timestamp',
            updated_at: 'timestamp',
            line_items: [
              {
                id: 'uuid',
                product_id: 'uuid | null',
                product_sku: 'string',
                product_name: 'string',
                description: 'string | null',
                quantity: 'number',
                unit_price: 'number',
                discount: 'number',
                tax: 'number',
                line_total: 'number',
                display_order: 'number'
              }
            ]
          }
        }
      },
      {
        name: 'Reorder plan',
        method: 'GET',
        path: '/api/v1/reorder-plan',
        url: `${base}/reorder-plan`,
        description:
          'Recommends what the customer is likely to need to reorder, derived from their purchase history, average consumption rate, and current supplier inventory.',
        query_params: {
          lookback_days: 'integer, 30-730, default 180 — order history window',
          horizon_days: 'integer, 7-180, default 30 — how far ahead to project demand',
          limit: 'integer, 1-100, default 25',
          include_unavailable: 'boolean, default true — include items currently out of stock',
          include_not_due: 'boolean, default false — include items not yet due for reorder'
        },
        response: {
          customer_id: 'uuid',
          generated_at: 'timestamp',
          lookback_days: 'number',
          horizon_days: 'number',
          window_start: 'timestamp',
          summary: {
            recommended_count: 'number',
            out_of_stock_count: 'number',
            low_stock_count: 'number',
            not_due_count: 'number'
          },
          items: [
            {
              product: 'object (id, sku, name, manufacturer, category, unit_of_measure, pack_size)',
              usage:
                'object (order_count, total_quantity, total_spend, avg_daily_quantity, days_since_last_order, ...)',
              recommendation: {
                recommended_quantity: 'integer',
                recommended_value: 'number',
                fulfillable_quantity: 'integer',
                confidence: 'low | medium | high',
                next_reorder_at: 'timestamp | null',
                days_until_reorder: 'number | null',
                reasons: 'string[]'
              },
              inventory: {
                quantity_on_hand: 'number',
                quantity_reserved: 'number',
                available_quantity: 'number',
                low_stock_threshold: 'number',
                stock_status: 'in_stock | low_stock | out_of_stock',
                updated_at: 'timestamp | null'
              },
              customer_price: 'number'
            }
          ]
        }
      }
    ]
  });
};

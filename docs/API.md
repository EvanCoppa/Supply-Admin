# Supply Partner API

Programmatic access for customers and integration partners. All endpoints return JSON.

A machine-readable version of this document is served at `GET /api/v1`.

## Authentication

All endpoints require a bearer token issued per customer:

```
Authorization: Bearer supply_<token>
```

Treat tokens as secrets. Request a token from your Supply account manager, or rotate the existing token via the partner integration callback.

## Conventions

- **Base URL:** `<host>/api/v1`
- **Content type:** `application/json`
- **Money:** numbers in the customer currency, rounded to 2 decimals.
- **Timestamps:** ISO 8601 strings in UTC.

### Pagination

Cursor-based. Request with `limit` (1-100, default 24) and `cursor` (opaque string from the prior response). Responses include `items` and `next_cursor` (null when the end is reached).

### Errors

HTTP status + JSON body `{ "message": string }`.

| Status | Meaning                                                     |
| ------ | ----------------------------------------------------------- |
| 400    | Invalid request payload or query parameter                  |
| 401    | Missing or invalid bearer token                             |
| 403    | Token valid but resource is not accessible to this customer |
| 404    | Resource does not exist or is not visible to this customer  |
| 429    | Rate limit exceeded — back off and retry per `Retry-After`  |
| 500    | Server error — safe to retry with backoff                   |

### Rate limits

Requests are limited per API token (or per client IP when unauthenticated). Limits are enforced per server instance; distributed deployments may permit a higher aggregate rate in practice.

| Scope                                           | Limit                            |
| ----------------------------------------------- | -------------------------------- |
| Partner endpoints (`/api/v1/*`)                 | 60 requests per minute per token |
| Integration webhooks (`/api/v1/integrations/*`) | 30 requests per minute per IP    |

Every response includes the current window state:

| Header                  | Description                                     |
| ----------------------- | ----------------------------------------------- |
| `X-RateLimit-Limit`     | Requests allowed in the current window          |
| `X-RateLimit-Remaining` | Requests remaining in the current window        |
| `X-RateLimit-Reset`     | Unix timestamp (seconds) when the window resets |

When the limit is exceeded the API returns `429 Too Many Requests` with a `Retry-After` header (seconds) and a JSON body `{ "message": string }`. Clients should treat 429 as transient and retry with exponential backoff, respecting `Retry-After` on each attempt.

Need a higher quota? Contact your Supply account manager.

## Endpoints

### GET /api/v1/products

Returns the catalog visible to the authenticated customer, with customer-specific pricing and purchase eligibility.

**Query params**

| Param         | Description                         |
| ------------- | ----------------------------------- |
| `limit`       | integer, 1-100, default 24          |
| `cursor`      | opaque string from prior response   |
| `q`           | search by name, sku, or description |
| `category_id` | filter to a single category         |

**Response**

```json
{
  "items": [
    {
      "id": "uuid",
      "sku": "string",
      "name": "string",
      "description": "string | null",
      "manufacturer": "string | null",
      "unit_of_measure": "string | null",
      "pack_size": "number | null",
      "image_paths": ["string"],
      "image_url": "string | null",
      "base_price": 0,
      "customer_price": 0,
      "can_buy": true
    }
  ],
  "next_cursor": "string | null"
}
```

### POST /api/v1/orders

Submits a purchase order on behalf of the authenticated customer.

**Request body**

```json
{
  "idempotency_key": "string (optional, max 128 chars)",
  "shipping_address": { "...": "free-form snapshot, optional" },
  "items": [{ "product_id": "uuid", "quantity": 1 }]
}
```

Resubmitting with the same `idempotency_key` returns the original order. `quantity` must be 1-999 per line; up to 100 lines per request.

**Response**

```json
{
  "order": {
    "id": "uuid",
    "status": "string",
    "subtotal": 0,
    "tax": 0,
    "shipping": 0,
    "total": 0,
    "placed_at": "timestamp",
    "line_items": [
      {
        "product_id": "uuid",
        "product_sku_snapshot": "string",
        "product_name_snapshot": "string",
        "quantity": 0,
        "unit_price_snapshot": 0,
        "line_total": 0
      }
    ]
  },
  "idempotent": false
}
```

`line_items` is only present on fresh creation. `idempotent` is true when a prior order was returned for the given key.

### GET /api/v1/invoices

Lists invoices issued to the authenticated customer, newest first.

**Query params**

| Param            | Description                                                                            |
| ---------------- | -------------------------------------------------------------------------------------- |
| `limit`          | integer, 1-100, default 24                                                             |
| `cursor`         | opaque string from prior response                                                      |
| `status`         | `draft` \| `issued` \| `paid` \| `partially_paid` \| `overdue` \| `void` \| `refunded` |
| `payment_status` | `not_started` \| `intent_created` \| `processing` \| `paid` \| `failed` \| `cancelled` |

**Response**

```json
{
  "items": [
    {
      "id": "uuid",
      "invoice_number": "string",
      "order_id": "uuid | null",
      "status": "string",
      "payment_status": "string",
      "subtotal": 0,
      "tax": 0,
      "shipping": 0,
      "discount": 0,
      "total": 0,
      "amount_paid": 0,
      "amount_due": 0,
      "terms": "string | null",
      "issued_at": "timestamp | null",
      "due_at": "timestamp | null",
      "paid_at": "timestamp | null",
      "sent_at": "timestamp | null",
      "billing_email": "string | null",
      "customer_memo": "string | null",
      "payment_url": "string | null",
      "created_at": "timestamp",
      "updated_at": "timestamp"
    }
  ],
  "next_cursor": "string | null"
}
```

### GET /api/v1/invoices/{id}

Returns a single invoice with line items.

**Response**

```json
{
  "invoice": {
    "id": "uuid",
    "invoice_number": "string",
    "order_id": "uuid | null",
    "status": "string",
    "payment_status": "string",
    "subtotal": 0,
    "tax": 0,
    "shipping": 0,
    "discount": 0,
    "total": 0,
    "amount_paid": 0,
    "amount_due": 0,
    "terms": "string | null",
    "issued_at": "timestamp | null",
    "due_at": "timestamp | null",
    "paid_at": "timestamp | null",
    "sent_at": "timestamp | null",
    "billing_email": "string | null",
    "billing_address": { "...": "snapshot" },
    "customer_memo": "string | null",
    "notes": "string | null",
    "payment_url": "string | null",
    "created_at": "timestamp",
    "updated_at": "timestamp",
    "line_items": [
      {
        "id": "uuid",
        "product_id": "uuid | null",
        "product_sku": "string",
        "product_name": "string",
        "description": "string | null",
        "quantity": 0,
        "unit_price": 0,
        "discount": 0,
        "tax": 0,
        "line_total": 0,
        "display_order": 0
      }
    ]
  }
}
```

### GET /api/v1/reorder-plan

Recommends what the customer is likely to need to reorder, derived from their purchase history, average consumption rate, and current supplier inventory.

**Query params**

| Param                 | Description                                                    |
| --------------------- | -------------------------------------------------------------- |
| `lookback_days`       | integer, 30-730, default 180 — order history window            |
| `horizon_days`        | integer, 7-180, default 30 — how far ahead to project demand   |
| `limit`               | integer, 1-100, default 25                                     |
| `include_unavailable` | boolean, default true — include items currently out of stock   |
| `include_not_due`     | boolean, default false — include items not yet due for reorder |

**Response**

```json
{
  "customer_id": "uuid",
  "generated_at": "timestamp",
  "lookback_days": 180,
  "horizon_days": 30,
  "window_start": "timestamp",
  "summary": {
    "recommended_count": 0,
    "out_of_stock_count": 0,
    "low_stock_count": 0,
    "not_due_count": 0
  },
  "items": [
    {
      "product": {
        "id": "uuid",
        "sku": "string",
        "name": "string",
        "manufacturer": "string | null",
        "category": { "id": "uuid", "name": "string" },
        "unit_of_measure": "string | null",
        "pack_size": "number | null"
      },
      "usage": {
        "order_count": 0,
        "total_quantity": 0,
        "total_spend": 0,
        "first_ordered_at": "timestamp",
        "last_ordered_at": "timestamp",
        "last_order_quantity": 0,
        "avg_daily_quantity": 0,
        "avg_30_day_quantity": 0,
        "days_since_last_order": 0,
        "estimated_customer_remaining_quantity": 0
      },
      "recommendation": {
        "recommended_quantity": 0,
        "recommended_value": 0,
        "fulfillable_quantity": 0,
        "confidence": "low | medium | high",
        "next_reorder_at": "timestamp | null",
        "days_until_reorder": "number | null",
        "reasons": ["string"]
      },
      "inventory": {
        "quantity_on_hand": 0,
        "quantity_reserved": 0,
        "available_quantity": 0,
        "low_stock_threshold": 0,
        "stock_status": "in_stock | low_stock | out_of_stock",
        "updated_at": "timestamp | null"
      },
      "customer_price": 0
    }
  ]
}
```

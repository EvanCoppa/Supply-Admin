# Runbook: Inventory Hold Release

**Audience:** Admin operators
**When to use:** Reserved inventory (`inventory.quantity_reserved`) is stuck high after a cart/order was abandoned, an integration crashed mid-checkout, or a cancelled order failed to release stock.

## Background

Each row in `public.inventory` tracks:
- `quantity_on_hand` — physical stock
- `quantity_reserved` — stock allocated to in-flight orders/carts but not yet shipped
- `low_stock_threshold` — used by the reorder planner

Available-to-promise = `quantity_on_hand − quantity_reserved`.
Reservations are decremented when an order is `fulfilled`/`shipped` (consumes on-hand) or `cancelled` (releases reserve). All adjustments are written to `public.inventory_ledger` with a `reason` code.

## Detection

1. **Reorder planner** (`/reports/profitability` or `inventory` page): SKUs showing 0 available but non-zero on-hand usually indicate a stuck hold.
2. **Direct query** (read-only):
   ```sql
   select p.sku, p.name, i.quantity_on_hand, i.quantity_reserved, i.updated_at
   from public.inventory i
   join public.products p on p.id = i.product_id
   where i.quantity_reserved > 0
   order by i.updated_at;
   ```
3. Look for `inventory_ledger` rows with `reason = 'reservation'` that don't have a matching release entry for the same `order_id` or `cart_id`.

## Procedure

### Case A — order was cancelled but reserve didn't drop

1. Pull the order: `/orders/<id>` — confirm status is `cancelled`.
2. Check `inventory_ledger` for the order_id; if no `release` entry exists, file an issue and proceed with manual adjustment.
3. Open `/inventory/<sku>` (or the inventory list) and use **Adjust** with:
   - Delta: `-<stuck-quantity>` against `quantity_reserved` (the adjust form writes a ledger row tagged `manual_adjustment`).
   - Reason code: `manual_adjustment`
   - Note: `Release stuck hold from order <id>` (include the order id verbatim)

### Case B — abandoned cart

Carts are not committed orders. If `cart_items` rows reserve stock and the cart has been idle > 24h:

1. Identify carts via:
   ```sql
   select id, customer_id, updated_at from public.carts
   where updated_at < now() - interval '24 hours' and status = 'active';
   ```
2. Delete the cart rows (or mark abandoned) — the cart's reservations should clear via the same delete trigger. If they don't, fall back to a manual adjustment as in Case A.

### Case C — integration crash mid-checkout

1. Look at `payment_attempts` for the affected order: if status is `failed` or null and order is still `pending_payment`, the hold is real but the customer can't complete.
2. After verifying with the customer they will not retry, cancel the order via the runbook in [order-cancellation.md](./order-cancellation.md). That will release the hold cleanly.

## After

- Re-run the read-only query from "Detection" to confirm `quantity_reserved` dropped.
- Tag the affected client/order with a note in `/clients/<id>/activities`.
- If you applied manual adjustments to > 5 SKUs, file a follow-up issue — that signals a systemic bug worth root-causing instead of patching one at a time.

## Don't

- Do **not** directly `update public.inventory set quantity_reserved = 0` in SQL. It bypasses the ledger and breaks audit/reorder calculations. Always use the admin Adjust action so a ledger row is written.
- Do **not** release a reserve while the order is still `paid` — fulfillment will fail. Cancel or refund first.

## Escalation

Page on-call if the ledger and inventory diverge (i.e., recomputing reserved from `inventory_ledger` doesn't match `inventory.quantity_reserved`). That indicates a write-path bug, not a one-off hold.

# Runbook: Manual Order Cancellation

**Audience:** Admin operators
**When to use:** A customer needs an order voided/refunded before shipment, the order is stuck in a status the UI can't progress, or a fraud signal forces immediate cancellation.

## Safe states to cancel from

The order detail UI (`/orders/[id]`) exposes a **Cancel order** button whenever the order is **not** in `delivered`, `cancelled`, or `refunded`.

| Current status     | UI cancel allowed? | Inventory effect on cancel                              |
| ------------------ | ------------------ | ------------------------------------------------------- |
| `pending_payment`  | Yes                | Reserved stock released                                 |
| `paid`             | Yes                | Reserved stock released; payment refund issued via API  |
| `fulfilled`        | Yes — be careful   | Inventory write-back; payment refund                    |
| `shipped`          | Yes — manual ops   | Coordinate with carrier; treat as RMA-on-arrival        |
| `delivered`        | No — open an RMA   | Use `/rmas` workflow                                    |
| `cancelled`        | n/a                | n/a                                                     |
| `refunded`         | n/a                | n/a                                                     |

## Procedure

1. Open `/orders/<order-id>` in the admin app.
2. Confirm the order metadata:
   - Customer + email (sidebar)
   - Status badge in header
   - Line items + total
   - Any associated **Purchases** (supplier POs). If a purchase is already `ordered` or `received`, cancellation will not reverse the supplier cost.
3. Click **Cancel order** in the sidebar and confirm the prompt.
   - The button calls `POST /api/v1/admin/orders/:id/refund` with `{ "cancel": true }`.
   - The API releases inventory holds, transitions the order to `cancelled`, and (for paid orders) calls the payment gateway to refund the original capture.
4. Wait for the green "Saved." banner. The status badge will update to `cancelled`.
5. If the action fails, the banner will surface `message (code)`. Copy the code into your incident note.

## Common failures

- **`config` / 0**: `PUBLIC_API_BASE_URL` is unset for this environment. Cancellation cannot be issued through the UI — escalate to platform engineering.
- **`401 Not signed in`**: session expired; sign back in and retry.
- **Gateway error (5xx)**: the upstream payment provider rejected the refund. Capture the response code, do **not** retry blindly — a duplicate refund can occur. Reconcile via the gateway dashboard first.
- **Inventory release silently no-op**: if the order never reserved stock (legacy import), check `inventory_ledger` for entries tied to `order_id` and write a manual adjustment if needed (see [inventory-hold-release.md](./inventory-hold-release.md)).

## After cancellation

- Notify the customer (email/CRM note in `/clients/<id>/notes`).
- If purchases were already placed with a supplier, decide whether to:
  - keep them (restock inventory), or
  - cancel the PO with the supplier and update the purchase status manually.
- Log the cancellation reason in `/clients/<id>/activities` so support has context on next contact.

## Escalation

Page on-call platform engineering if:
- The payment gateway returned a 5xx and the order status is now inconsistent (e.g., `cancelled` in DB but capture still active in gateway).
- Inventory totals look wrong after cancel (use the Inventory page to spot-check `on hand` vs `reserved`).

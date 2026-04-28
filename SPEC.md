# Supply Admin — Build Spec

SvelteKit (TypeScript) internal CRM for client staff. Reads/writes Supabase directly via `supabase-js` with RLS gating the `admin` role. Orchestration actions (refunds, inventory adjustments) call the Express API. Source of truth: [dental_supply_platform_requirements.md](../dental_supply_platform_requirements.md).

---

## 1. Project Setup

- [ ] SvelteKit + TypeScript scaffold with strict `tsconfig`.
- [ ] Tailwind CSS configured; shadcn-svelte or equivalent component kit (per `components.json`).
- [ ] Monorepo-aware — imports Zod schemas + generated Supabase types from `packages/shared`.
- [ ] Env schema validated on boot: `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY`, `PUBLIC_API_BASE_URL`, `SENTRY_DSN`.
- [ ] `@supabase/ssr` configured for cookie-based session handling across SSR and client.
- [ ] Separate deployment target from storefront (Vercel or equivalent).

## 2. Authentication

- [ ] Email + password login against Supabase Auth.
- [ ] On login, load `user_profiles` and verify `role === 'admin'`; sign out + redirect non-admin users with a clear message.
- [ ] Role check enforced in a root `+layout.server.ts` hook — every page behind the hook is admin-only.
- [ ] Password reset flow (Supabase built-in).
- [ ] Session refresh handled by `@supabase/ssr`.
- [ ] Sign-out clears cookies and redirects to login.

## 3. Layout & Navigation

- [ ] Top-level nav: Dashboard, Catalog, Inventory, Clients, Orders, Pricing, Featured Items, API Tokens, Admin Users.
- [ ] Breadcrumbs on detail pages.
- [ ] Global search (product SKU, customer name, order ID).
- [ ] Active-user display + sign-out in header.
- [ ] Toast/notification system for success/error feedback on mutations.

## 4. Dashboard

- [ ] Landing page with at-a-glance metrics: orders today, revenue (7d / 30d), low-stock count, recent orders list.
- [ ] Low-stock alert card linking to Inventory filtered by `quantity_on_hand <= low_stock_threshold`.
- [ ] Recent activity feed (last N orders, last N inventory adjustments).

## 5. Catalog Management

- [ ] Product list: paginated table with SKU, name, category, manufacturer, base price, stock, status; searchable + filterable by category/status.
- [ ] Create product form with all required fields (SKU, name, description, category, manufacturer, UoM, pack size, base price, tax class, weight, images, status).
- [ ] Edit product — same form, pre-populated; updates via `supabase-js` under admin RLS.
- [ ] Archive / restore toggle (`status = 'archived' | 'active'`).
- [ ] Image upload to Supabase Storage; stores resulting paths in `products.image_paths` JSONB.
- [ ] Image reorder + delete UI.
- [ ] Category picker supports nested categories.
- [ ] Bulk CSV import — parses, previews, validates, reports per-row errors before commit.
- [ ] Bulk CSV export of full catalog (filtered or all).
- [ ] Form validation via shared Zod schemas (same as API uses).

## 6. Inventory Management

- [ ] Inventory list joining `inventory` + `products`; shows on-hand, reserved, low-stock threshold, last updated.
- [ ] Filter: low-stock only, out-of-stock only, by category.
- [ ] Edit low-stock threshold per product (direct supabase-js update).
- [ ] Manual adjustment modal — calls `POST /api/v1/admin/inventory/adjust` (NOT direct supabase-js) with `product_id`, signed `delta`, reason code, optional notes.
- [ ] Reason codes: `receipt`, `manual_adjustment`, `cycle_count`, `damage`, `other`.
- [ ] Ledger view per product: chronological list from `inventory_ledger` with actor, timestamp, delta, reason, order link if applicable.
- [ ] Visual low-stock indicator in product rows and across the app.

## 7. Client (Customer Business) Management

- [ ] Client list: business name, primary contact, assigned sales rep, status, created date; searchable + filterable.
- [ ] Client detail tabs: Profile, Addresses, Pricing, Featured Items, Orders, Trends, Notes.
- [ ] **Profile tab:** edit business name, contact, email, phone, assigned sales rep (from list of admin users), status (`active` / `suspended` / `archived`).
- [ ] **Addresses tab:** CRUD on `customer_addresses`; default-shipping toggle; ISO country code validated.
- [ ] Create client flow creates `customers` row; optionally invite a login user (creates `auth.users` via Supabase admin API + `user_profiles` row with `role = customer` linked to the new `customer_id`).
- [ ] Suspend client sets `status = 'suspended'` — must also block login (via RLS policy check on status).

## 8. Pricing Rules (Per-Client)

- [ ] Pricing tab on Client Detail: list of `customer_pricing_rules` for this client.
- [ ] Create rule modal:
  - [ ] Scope: `product` or `category` (radio).
  - [ ] Target picker (product picker or category picker, depending on scope).
  - [ ] Override type: `absolute_price` or `percent_discount`.
  - [ ] Value input (validates range: percent 0–100, absolute > 0).
  - [ ] Optional effective-start and effective-end datetimes.
- [ ] Edit rule + delete rule.
- [ ] Rule conflicts flagged in UI (e.g. duplicate scope+target for the same client).
- [ ] Preview pane: "What does this client pay for product X?" calls `rpc('resolve_customer_price', ...)` and shows resolved price + which rule matched.
- [ ] Audit log of rule changes (who changed what when).

## 9. Featured Items (Per-Client)

- [ ] Featured Items tab on Client Detail: ordered list from `customer_featured_items`.
- [ ] Add individual product or featured group.
- [ ] Reorder via drag-and-drop (updates `display_order`).
- [ ] Remove items.
- [ ] Separate Featured Groups page:
  - [ ] CRUD on `featured_groups` (name, description, product_ids).
  - [ ] Product picker with reorderable list persisted to `product_ids` JSONB.

## 10. Order Management

- [ ] Orders list across all customers: status, customer, total, placed date, source (`storefront` / `api`).
- [ ] Filters: status, customer, date range, source.
- [ ] Sort by placed date (default desc), total.
- [ ] Order detail page:
  - [ ] Header: customer link, status, totals, payment reference, source, idempotency key.
  - [ ] Line items table with snapshotted SKU/name/price (NOT live product data).
  - [ ] Shipping address snapshot.
  - [ ] Timeline of status transitions.
  - [ ] Internal notes editor.
  - [ ] Payment attempts sub-section showing full attempt history.
- [ ] Status transition actions: mark fulfilled, mark shipped (with tracking#), mark delivered, cancel.
- [ ] Cancel + refund action calls `POST /api/v1/admin/orders/:id/refund` (NOT direct supabase-js).
- [ ] Partial refund UI (specify amount).
- [ ] Refund confirmation modal summarizes impact (inventory restored, payment refunded).

## 11. Trend Analytics (Per-Client)

On the client detail Trends tab, backed by Postgres views or `rpc()` functions.

- [ ] Order frequency chart: orders per month, last 12 months.
- [ ] Top 10 products by quantity (table + bar chart).
- [ ] Top 10 products by revenue (table + bar chart).
- [ ] Category mix pie/bar chart: share of spend by category.
- [ ] Lapsed items list: products ordered historically but not in last N days (default 90); configurable N.
- [ ] CSV export on each table.
- [ ] Empty states handled gracefully for new clients.
- [ ] Cached query results (stale-while-revalidate) if needed for performance.

## 12. API Token Management

- [ ] Tokens tab on Client Detail (or global Tokens page filtered by client).
- [ ] List tokens with label, last-used, created date, revoked status. **Never display the plaintext token after creation.**
- [ ] Create token: label input → calls API (or direct supabase-js insert via admin-only RLS) → displays plaintext once in a copy-to-clipboard modal with a clear "this will not be shown again" warning.
- [ ] Revoke token action sets `revoked_at = now()`.
- [ ] Rotate token = revoke + create new (UI affordance).

## 13. Admin User Management

- [ ] List admin users (all `user_profiles` with `role = 'admin'`).
- [ ] Invite admin form — creates `auth.users` + `user_profiles` with `role = 'admin'`.
- [ ] Deactivate admin (soft; do not delete).
- [ ] Single role in v1; scaffolding in place for sub-roles if added later.

## 14. Shared Concerns

- [ ] All forms use Zod schemas from `packages/shared` for validation.
- [ ] All `supabase-js` calls go through typed wrappers using generated Supabase types.
- [ ] All mutations show optimistic success toasts and roll back on failure.
- [ ] All destructive actions (archive, revoke, refund, delete) require confirmation.
- [ ] Loading states on every async view (skeletons, not spinners only).
- [ ] Empty states with a clear next action on every list view.
- [ ] Error boundary surfaces backend errors with the canonical `error.code` from the API.

## 15. RLS-Backed Access (What Admin Reads Directly)

- [ ] `products`, `categories`, `featured_groups` — read + write via admin role.
- [ ] `customers`, `customer_addresses`, `customer_featured_items`, `customer_pricing_rules` — read + write via admin role.
- [ ] `orders`, `order_line_items` — read-only via admin role (status transitions below `fulfilled` can be direct; `cancelled`/`refunded` go through API).
- [ ] `inventory` — read via admin role; writes go through Express API only.
- [ ] `inventory_ledger`, `payment_attempts`, `api_tokens`, `user_profiles` — admin-only read; writes as appropriate.

## 16. Observability

- [ ] Sentry wired for client + server.
- [ ] Actor context (admin user email) attached to Sentry events.
- [ ] Log when direct supabase-js writes fail due to RLS (indicates a permission bug).

## 17. Testing

- [ ] Component tests on complex forms (pricing rule, bulk CSV importer, inventory adjustment).
- [ ] E2E tests (Playwright) on:
  - [ ] Login and role enforcement (non-admin bounced).
  - [ ] Create product, edit, archive.
  - [ ] Create pricing rule and verify preview price.
  - [ ] Place inventory adjustment (hits real API).
  - [ ] Refund an order (hits real API, verifies inventory ledger).
  - [ ] Create and revoke API token.
- [ ] Accessibility checks (axe) on primary forms.

## 18. Pre-Launch

- [ ] Every table has a CSV export option where data volume warrants.
- [ ] Every list view has pagination (no unbounded queries).
- [ ] Keyboard navigation works on primary flows.
- [ ] Staging environment seeded with test customers, products, and orders for UAT.
- [ ] Runbook: how to manually cancel a stuck order, how to manually release an inventory hold, how to rotate an admin's credentials.

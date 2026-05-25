# Supply-Admin — Incomplete Features Punch List

## RMAs (done)

- [x] `/rmas/[id]` detail/edit route (view, edit RMA details, items CRUD, status transitions on timeline)
- [x] UI for `rma_items` table — add/edit/remove line items with order-line picker
- [x] Surface RMA status transitions (requested → approved → received → refunded) on detail page (with rejected/cancelled side paths)

## Order Management (done)

- [x] Partial-refund modal with full vs partial radio, validation, and gateway warning (`src/routes/(admin)/orders/[id]/+page.svelte`)
- [x] Replaced next-status dropdown with chronological timeline (pending_payment → paid → fulfilled → shipped → delivered) plus an advance-to-next button

## Pricing Rules (done)

- [x] `customer_pricing_rule_audit` migration in `supabase/migrations/202605230001_customer_pricing_rule_audit.sql` (apply via `npm run migrations:apply`)
- [x] Audit errors now logged instead of silently swallowed (`src/routes/(admin)/clients/[id]/pricing/+page.server.ts`)
- [x] Rule-conflict detection UI was already implemented (verified — duplicate-scope+target flag plus row highlight)

## Testing (~30%) — still open

- [ ] E2E: create product, edit, archive
- [ ] E2E: create pricing rule with preview price
- [ ] E2E: inventory adjustment (API integration)
- [ ] E2E: order refund + inventory ledger verification
- [ ] E2E: API token creation and revocation
- [ ] Add axe accessibility checks on primary forms

## CSV Export (done)

- [x] CSV export endpoint at `/orders/export.csv` (filter-aware) and link on orders list
- [x] CSV export endpoint at `/rmas/export.csv` (filter-aware) and link on RMA list
- [x] Trends page already had CSV export for lapsed items, top products, frequency, and category mix
- [x] Shared CSV helper in `src/lib/csv.ts`

## Observability (partial)

- [x] Structured error hooks (`src/hooks.server.ts`, `src/hooks.client.ts`) — surface `srv_*` / `cli_*` reference codes
- [x] Custom `+error.svelte` boundary surfacing `error.code`
- [ ] Wire reference codes into Sentry (or alternative) — code is structured for it; integration deferred until tool is chosen

## Docs & Accessibility

- [x] Runbook: manual order cancellation (`docs/runbooks/order-cancellation.md`)
- [x] Runbook: inventory hold release (`docs/runbooks/inventory-hold-release.md`)
- [x] Runbook: credential rotation (`docs/runbooks/credential-rotation.md`)
- [ ] Verify keyboard navigation on primary flows

## In-Flight Work to Reconcile

- [x] `claude/add-missing-features-zrBMu` is 35 commits **behind** main and fully contained — its image generator, customer tags, and spec-gap commits are already on `main`. Branch can be deleted.

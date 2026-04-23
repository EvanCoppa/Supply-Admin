# supply-admin

Internal admin / CRM SvelteKit app for the Dental Supply Platform.
Implements the surface described in Section 5.2 of the requirements spec.

## Stack

- SvelteKit (TypeScript), Svelte 5
- Tailwind CSS
- Supabase Auth (email + password) via `@supabase/ssr` for cookie-based SSR
- Direct Supabase reads/writes gated by admin-role RLS; order and inventory
  mutations call the Express API (`supply-api`)

## Phase 1 scope

- Project config, Tailwind, Supabase SSR hooks
- Login page with role check (non-admin users are redirected out)
- Admin shell layout with top nav
- Dashboard placeholder
- Products list page reading `products` via RLS

## Not yet implemented

- Product create/edit/archive UI
- Customers + pricing rules UI
- Orders list + refund action
- Inventory adjustment UI
- Trend analytics views (Section 5.2.7)
- API token management

## Local development

```bash
pnpm install
cp .env.example .env
# fill in Supabase URL + anon key
pnpm dev
```

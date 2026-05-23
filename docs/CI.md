# CI, type safety, and testing

This repo is gated by a strict CI pipeline that runs on every pull request
before merge. The goal is to keep regressions out of `main` for what is a
critical enterprise system.

## Required checks

Every PR must be green on the **CI passed** aggregator job. That job blocks
on:

| Job          | What it runs                                                                                                                                        |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lint`       | `eslint .` + `prettier --check .`                                                                                                                   |
| `typecheck`  | `tsc --noEmit` + `svelte-check`                                                                                                                     |
| `test-unit`  | `vitest run --coverage` with coverage gates                                                                                                         |
| `build`      | `vite build`                                                                                                                                        |
| `test-e2e`   | Playwright against `vite preview`                                                                                                                   |
| `migrations` | Apply every `supabase/migrations/*.sql` to a Postgres service container, then verify `src/lib/types/db.generated.ts` matches the regenerated schema |

CodeQL runs in parallel as an advisory (not a hard gate) on the
`security-events` permission.

Configure branch protection on `main` to require the **CI passed** check
and to require branches to be up to date before merge.

## Local scripts

| Command                 | What it does                                                   |
| ----------------------- | -------------------------------------------------------------- |
| `npm run dev`           | Dev server                                                     |
| `npm run build`         | Production build                                               |
| `npm run lint`          | ESLint + Prettier check                                        |
| `npm run lint:fix`      | Auto-fix lint + format                                         |
| `npm run typecheck`     | `tsc --noEmit` + `svelte-check`                                |
| `npm run test`          | Vitest (single run)                                            |
| `npm run test:watch`    | Vitest watch mode                                              |
| `npm run test:coverage` | Vitest + coverage report                                       |
| `npm run test:e2e`      | Playwright (boots `preview` automatically)                     |
| `npm run db:types`      | Regenerate `src/lib/types/db.generated.ts` from local Supabase |
| `npm run ci:verify`     | Run lint + typecheck + tests + build                           |

## Type safety

`tsconfig.json` opts into the strictest flags available:

- `strict: true` plus
- `noUncheckedIndexedAccess`
- `noImplicitOverride`
- `noFallthroughCasesInSwitch`
- `noPropertyAccessFromIndexSignature`
- `exactOptionalPropertyTypes`
- `noUnusedLocals` / `noUnusedParameters`
- `noImplicitReturns`
- `useUnknownInCatchVariables`
- `verbatimModuleSyntax`

ESLint adds the **`strictTypeChecked`** + **`stylisticTypeChecked`** presets
from `typescript-eslint`, with extra hard bans on `any` and unsafe member
access in `src/lib/server/**`. Boundary validation must use Zod schemas
from `src/lib/schemas/**`.

## Coverage gates

Vitest enforces:

- Global floor: 60% lines/functions/branches/statements
- `src/lib/server/**`: 80% lines/functions/statements, 75% branches
- `src/lib/schemas/**`: 80% lines/functions/statements, 75% branches

These tighter gates target the highest-blast-radius code (server actions,
boundary validators). Add tests as you touch these modules.

## Local git hooks

[Husky](https://typicode.github.io/husky/) is installed via `npm install`
(`prepare` script). Two hooks run automatically:

- **pre-commit**: `lint-staged` formats & lints only staged files.
- **pre-push**: `npm run typecheck && npm run test`.

To bypass (rare — fix the root cause instead): `git push --no-verify`.

## Supabase schema → TypeScript types

The CI `migrations` job spins up Postgres 15 as a service, applies
**every** file in `supabase/migrations/` in lexicographic order, and then
runs `supabase gen types typescript` against the result. If that output
differs from `src/lib/types/db.generated.ts`, the job fails.

The pattern when adding a migration:

1. Write the SQL migration in `supabase/migrations/`.
2. Apply it locally (`supabase db reset`, or against your dev DB).
3. Run `npm run db:types` to regenerate the typed schema.
4. Commit both the migration and the regenerated types.

The hand-written `src/lib/types/db.ts` remains the canonical source for
app-facing domain types for now; the generated file is the source of
truth for raw DB row shapes. Migrate types from `db.ts` to derived
aliases over `db.generated.ts` as code is touched.

## Adding tests

Unit tests live next to the code they cover (`*.test.ts`). E2E tests
live under `e2e/`. Test helpers go in `tests/`.

Required test coverage per change type:

- **New schema or server module**: unit tests for happy path + each
  failure branch.
- **New route**: e2e smoke covering load + the primary user action.
- **Bug fix**: a regression test that fails on the previous code.

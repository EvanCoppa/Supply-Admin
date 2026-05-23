#!/usr/bin/env bash
# Regenerate Supabase TypeScript types from the live schema and fail
# if the result differs from the committed src/lib/types/db.generated.ts.
#
# Requires DATABASE_URL pointing at a database that already has all
# migrations applied (see scripts/apply-migrations.sh).
set -euo pipefail

if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL is not set." >&2
  exit 1
fi

if ! command -v supabase >/dev/null 2>&1; then
  echo "ERROR: supabase CLI is not on PATH." >&2
  echo "Install with: npm i -g supabase  OR  use the setup-cli action in CI." >&2
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TARGET="$ROOT/src/lib/types/db.generated.ts"
TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT

echo "Generating Supabase types from \$DATABASE_URL ..."
supabase gen types typescript --db-url "$DATABASE_URL" >"$TMP"

if [ ! -f "$TARGET" ]; then
  echo "ERROR: $TARGET does not exist. Run 'npm run db:types' and commit the result." >&2
  echo "--- Newly-generated types preview ---" >&2
  head -n 30 "$TMP" >&2
  exit 1
fi

if ! diff -u "$TARGET" "$TMP"; then
  echo "" >&2
  echo "ERROR: src/lib/types/db.generated.ts is out of sync with the database schema." >&2
  echo "Run 'npm run db:types' locally against a freshly-migrated database and commit the result." >&2
  exit 1
fi

echo "src/lib/types/db.generated.ts matches the regenerated schema."

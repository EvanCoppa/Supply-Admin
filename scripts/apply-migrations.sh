#!/usr/bin/env bash
# Apply every supabase/migrations/*.sql file in lexicographic order
# against the database referenced by $DATABASE_URL.
#
# Used by CI (Postgres service container) and locally against a dev DB.
set -euo pipefail

if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL is not set." >&2
  exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "ERROR: psql is not on PATH." >&2
  exit 1
fi

MIGRATIONS_DIR="$(cd "$(dirname "$0")/.." && pwd)/supabase/migrations"

if [ ! -d "$MIGRATIONS_DIR" ]; then
  echo "ERROR: $MIGRATIONS_DIR does not exist." >&2
  exit 1
fi

shopt -s nullglob
files=("$MIGRATIONS_DIR"/*.sql)
if [ "${#files[@]}" -eq 0 ]; then
  echo "No migrations found in $MIGRATIONS_DIR."
  exit 0
fi

# Sort lexicographically so timestamp-prefixed files apply in order.
IFS=$'\n' sorted=($(printf '%s\n' "${files[@]}" | sort))
unset IFS

echo "Applying ${#sorted[@]} migration(s) to $DATABASE_URL"
for f in "${sorted[@]}"; do
  echo ">> $(basename "$f")"
  psql "$DATABASE_URL" \
    --single-transaction \
    --set ON_ERROR_STOP=1 \
    --quiet \
    --no-psqlrc \
    -f "$f"
done
echo "All migrations applied successfully."

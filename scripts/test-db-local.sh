#!/usr/bin/env bash
# Runs the database tests against a throwaway plain Postgres container, using
# tests/db/supabase-shim.sql in place of the Supabase services.
# Use this when `supabase start` is not available. CI uses real Supabase.
set -euo pipefail

cd "$(dirname "$0")/.."
name=little-steps-test-db
port=${TEST_DB_PORT:-54329}

docker rm -f "$name" >/dev/null 2>&1 || true
docker run -d --name "$name" -e POSTGRES_PASSWORD=postgres -p "$port:5432" postgres:17 >/dev/null
trap 'docker rm -f "$name" >/dev/null 2>&1 || true' EXIT

url="postgres://postgres:postgres@127.0.0.1:$port/postgres"
for _ in $(seq 1 60); do
  if psql "$url" -qtAc 'select 1' >/dev/null 2>&1; then break; fi
  sleep 0.5
done

psql "$url" -q -v ON_ERROR_STOP=1 -f tests/db/supabase-shim.sql
for f in supabase/migrations/*.sql; do
  psql "$url" -q -v ON_ERROR_STOP=1 -f "$f"
done

DATABASE_URL="$url" pnpm exec vitest run --project db "$@"

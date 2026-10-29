#!/usr/bin/env bash
# Fail if schema.ts and packages/db/migrations disagree: drizzle-kit check, then generate into a copy of migrations/.
# Offline; the real migrations/ folder is never written.
set -euo pipefail
cd "$(dirname "$0")/../packages/db"

pnpm exec drizzle-kit check

# drizzle-kit prefixes "./" to `out`, so the copy must live under packages/db
# (absolute temp paths break). Gitignored.
work=".drift-check"
cfg=".drift-check.config.ts"
trap 'rm -rf "$work" "$cfg"' EXIT
rm -rf "$work" && mkdir -p "$work/migrations"
cp -R migrations/. "$work/migrations/"
cat > "$cfg" <<'CFG'
import base from "./drizzle.config";
export default { ...base, out: "./.drift-check/migrations" };
CFG

# drizzle-kit can print an error and still exit 0, so require a known outcome.
log="$(pnpm exec drizzle-kit generate --config "$cfg" --name=schema_drift_check 2>&1 || true)"
if ! grep -qE "No schema changes|Your SQL migration file" <<<"$log"; then
  echo "✖ drizzle-kit generate did not finish:" >&2
  echo "$log" | tail -20 >&2
  exit 1
fi

if ! diff -rq migrations "$work/migrations" > /dev/null; then
  echo "✖ packages/db/src/schema.ts has changes with no migration:" >&2
  diff -rq migrations "$work/migrations" | sed "s#$work/migrations#<generated>#" >&2
  echo >&2
  echo "Run: pnpm db:generate --name=<what_changed> and commit the result." >&2
  exit 1
fi
echo "✓ schema.ts matches packages/db/migrations"

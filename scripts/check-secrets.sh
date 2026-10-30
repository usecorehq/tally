#!/usr/bin/env bash
# Block secrets from entering git (pre-commit: --staged; CI: --tree or --range <base>...HEAD).
# Prints file:line with the secret redacted, never the value.
set -euo pipefail

# Extended regexes. Keep them specific: a noisy guard gets bypassed.
PATTERNS=(
  'qcat_(live|test)_[A-Za-z0-9_]{8,}'          # Qore Catalog API keys
  'sb_secret_[A-Za-z0-9_-]{10,}'               # Supabase secret keys
  '-----BEGIN [A-Z ]*PRIVATE KEY-----'         # PEM private keys
  'AKIA[0-9A-Z]{16}'                           # AWS access key ids
  'tcs_[A-Za-z0-9_-]{43}'                      # Connect Tally client secrets
)
REGEX="$(IFS='|'; echo "${PATTERNS[*]}")"

redact() { sed -E "s/(qcat_(live|test)_|sb_secret_)[A-Za-z0-9_-]+/\1<redacted>/g; s/AKIA[0-9A-Z]{16}/AKIA<redacted>/g; s/tcs_[A-Za-z0-9_-]{43}/tcs_<redacted>/g"; }

# Scan unified-diff text: report added lines that match, with file + new line number.
scan_diff() {
  awk -v re="$REGEX" '
    /^\+\+\+ b\// { file = substr($0, 7); next }
    /^@@/ { split($3, a, ","); line = substr(a[1], 2) - 1; next }
    /^\+/ { line++; if ($0 ~ re) { print file ":" line ": " substr($0, 2); hit = 1 } next }
    /^ / { line++ }
    END { exit hit ? 1 : 0 }
  '
}

mode="${1:---staged}"
case "$mode" in
  --staged) out="$(git diff --cached -U0 --no-color | scan_diff)" || true ;;
  --range)  out="$(git diff -U0 --no-color "${2:?usage: --range <base>...HEAD}" | scan_diff)" || true ;;
  --tree)   out="$(git grep -nIE "$REGEX" -- . ':!scripts/check-secrets.sh' || true)" ;;
  *) echo "usage: $0 [--staged | --tree | --range <base>...HEAD]" >&2; exit 2 ;;
esac

if [ -n "$out" ]; then
  echo "✖ Possible secret found — commit blocked:" >&2
  echo "$out" | redact >&2
  echo >&2
  echo "Remove it (real values belong in a gitignored .env, never a .env.example)." >&2
  echo "If a real key was exposed, revoke it." >&2
  exit 1
fi

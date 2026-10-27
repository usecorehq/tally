#!/usr/bin/env bash
# Render docs/diagrams/mermaid/*.mmd → docs/diagrams/images/*.svg.
# Usage: pnpm docs:diagrams [name ...]   (no args = all)
set -euo pipefail
cd "$(dirname "$0")/.."

src=docs/diagrams/mermaid
out=docs/diagrams/images
cfg="$(mktemp)"
trap 'rm -f "$cfg"' EXIT
echo '{ "args": ["--no-sandbox"] }' > "$cfg"

if [ "$#" -gt 0 ]; then names=("$@"); else names=($(ls "$src" | sed 's/\.mmd$//')); fi

for n in "${names[@]}"; do
  npx -y @mermaid-js/mermaid-cli@11 -q -i "$src/$n.mmd" -o "$out/$n.svg" -b white -p "$cfg"
  echo "rendered $out/$n.svg"
done

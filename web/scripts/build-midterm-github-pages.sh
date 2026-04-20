#!/usr/bin/env bash
# Build a midterm-only static export for GitHub Pages (no dashboard, scenarios, maps, etc.).
# Restores `src/app/` after build. Use: GITHUB_ACTIONS=true MIDTERM_EXPORT_ONLY=true (CI sets both).

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

STASH="$ROOT/.midterm-export-stashed-app.$$"

cleanup() {
  if [[ -d "$STASH" ]]; then
    rm -rf "$ROOT/src/app"
    mv "$STASH" "$ROOT/src/app"
  fi
}
trap cleanup EXIT

mv "$ROOT/src/app" "$STASH"

mkdir -p "$ROOT/src/app/midterm"
cp -a "$STASH/midterm/." "$ROOT/src/app/midterm/"
cp "$STASH/globals.css" "$ROOT/src/app/globals.css"
cp "$STASH/layout.tsx" "$ROOT/src/app/layout.tsx"

export MIDTERM_EXPORT_ONLY=true
export GITHUB_ACTIONS=true

npm run build

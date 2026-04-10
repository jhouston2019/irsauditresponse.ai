#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
: "${SUPABASE_URL:=}"
: "${SUPABASE_ANON_KEY:=}"
for f in audit-defense.html audit-success.html; do
  sed -i.bak "s|%%SUPABASE_URL%%|${SUPABASE_URL}|g" "$f"
  sed -i.bak "s|%%SUPABASE_ANON_KEY%%|${SUPABASE_ANON_KEY}|g" "$f"
  rm -f "${f}.bak"
done

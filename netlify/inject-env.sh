#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
: "${SUPABASE_URL:=}"
: "${SUPABASE_ANON_KEY:=}"
: "${STRIPE_PRICE_ID:=${STRIPE_PRICE_RESPONSE:-}}"

HTML_FILES=(
  audit-defense.html
  audit-success.html
  audit-payment.html
  payment.html
  pricing.html
  register.html
  login.html
  app.html
  dashboard.html
  upload.html
)

for f in "${HTML_FILES[@]}"; do
  if [[ -f "$f" ]]; then
    sed -i.bak "s|%%SUPABASE_URL%%|${SUPABASE_URL}|g" "$f"
    sed -i.bak "s|%%SUPABASE_ANON_KEY%%|${SUPABASE_ANON_KEY}|g" "$f"
    sed -i.bak "s|%%STRIPE_PRICE_ID%%|${STRIPE_PRICE_ID}|g" "$f"
    rm -f "${f}.bak"
  fi
done

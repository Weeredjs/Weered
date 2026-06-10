#!/usr/bin/env bash
# Weered guardrails — run anytime, and always before a deploy.
#   (1) API type gate: tsc --noEmit must be clean (the API runs on tsx with no
#       build step, so this is the ONLY thing standing between a type error and
#       production. Kept at 0 as of 2026-05-31.)
#   (2) File-size tripwire: no NEW source file may exceed 1500 lines. Today's
#       known-large files are grandfathered in scripts/oversized-baseline.txt
#       and should shrink over time, never grow the list.
# Exit non-zero on any failure so a deploy script can gate on it.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
fail=0

echo "== [1/2] API type gate (tsc --noEmit) =="
if ( cd "$ROOT/apps/api" && ./node_modules/.bin/tsc --noEmit ); then
  echo "   OK — 0 type errors"
else
  echo "   FAIL — fix the type errors above before deploying"
  fail=1
fi

echo "== [2/2] File-size tripwire (>1500 lines, excl. baseline) =="
BASELINE="$ROOT/scripts/oversized-baseline.txt"
offenders=0
while IFS= read -r -d '' f; do
  rel="${f#$ROOT/}"
  grep -qxF "$rel" "$BASELINE" 2>/dev/null && continue   # grandfathered
  lines=$(wc -l < "$f")
  if [ "$lines" -gt 1500 ]; then
    echo "   FAIL — $rel = $lines lines. Split it (or, if unavoidable, add to scripts/oversized-baseline.txt with a reason)."
    offenders=1
  fi
done < <(find "$ROOT/apps" -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.css' \) \
           -not -path '*/node_modules/*' -not -path '*/.next/*' -not -path '*/dist/*' -print0)
if [ "$offenders" -eq 0 ]; then echo "   OK — no new oversized files"; else fail=1; fi

echo
if [ "$fail" -eq 0 ]; then echo "GUARDRAILS PASSED"; else echo "GUARDRAILS FAILED"; exit 1; fi

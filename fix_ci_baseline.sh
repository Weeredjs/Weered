#!/bin/bash
set -e
cd /opt/weered
BL=scripts/oversized-baseline.txt
if grep -qxF "apps/web/app/foyer/page.tsx" "$BL"; then
  echo "already baselined"
else
  {
    echo "# foyer/page.tsx: client-facing office foyer (masthead + gate + light benefits-document consult)."
    echo "#   Slated for retirement when the office fully folds into Weered (Phase 3); splitting a doomed page = churn."
    echo "apps/web/app/foyer/page.tsx"
  } >> "$BL"
  echo "appended to baseline"
fi
echo "=== run guardrails ==="
bash scripts/check.sh
echo "=== commit + push ==="
git add scripts/oversized-baseline.txt
git -c user.name=Weered -c user.email=dev@weered.ca commit -q -m "ci: baseline foyer/page.tsx (1545 lines) with a reason - foyer is slated for retirement as the office folds into Weered (Phase 3); tripwire was failing CI on the nightly checkpoint" || echo "(nothing to commit)"
git push origin HEAD:main 2>&1 | tail -5
echo "=== pushed head ==="
git log -1 --format='%h %s'
git log origin/main -1 --format='origin/main now at %h' 2>/dev/null || true

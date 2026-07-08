#!/bin/bash
set -e
cd /opt/weered/apps/web
echo "=== web build ==="
pnpm next build > /tmp/proskin_build.log 2>&1 || true
echo "compiled: $(grep -c 'Compiled successfully' /tmp/proskin_build.log)  failed: $(grep -ci 'Failed to compile' /tmp/proskin_build.log)"
if grep -qi "Failed to compile" /tmp/proskin_build.log; then
  echo "--- BUILD FAILED ---"
  grep -iB1 -A10 "Failed to compile" /tmp/proskin_build.log | head -60
  exit 1
fi
pm2 restart weered-web --update-env >/dev/null 2>&1
sleep 5
cd /opt/weered
git add apps/web/app/layout.tsx apps/web/components/RootFrame.tsx
git -c user.name=Weered -c user.email=dev@weered.ca commit -q -m "office: professional ECEB skin on the meeting host (office./meet.eastcoastemployeebenefits.com) - RootFrame swaps the Weered gaming shell for a clean navy frame, providers preserved; weered.ca untouched (host-gated via pre-hydration data-pro-host)" || echo "(nothing to commit)"
git push origin HEAD:main 2>&1 | tail -3
git log -1 --format='%h %s'
echo "=== health ==="
curl -s -o /dev/null -w "web(local): %{http_code}\n" --max-time 15 http://127.0.0.1:3000/ || true

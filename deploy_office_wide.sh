#!/bin/bash
set -e
cd /opt/weered/apps/web
echo "=== web build ==="
pnpm next build > /tmp/office_wide_build.log 2>&1 || true
echo "compiled: $(grep -c 'Compiled successfully' /tmp/office_wide_build.log)  failed: $(grep -ci 'Failed to compile' /tmp/office_wide_build.log)"
if grep -qi "Failed to compile" /tmp/office_wide_build.log; then
  echo "--- BUILD FAILED ---"
  grep -iB1 -A8 "Failed to compile" /tmp/office_wide_build.log | head -50
  exit 1
fi
pm2 restart weered-web --update-env >/dev/null 2>&1
sleep 5
cd /opt/weered
git add apps/web/components/room/RoomCanvas.tsx
git -c user.name=Weered -c user.email=dev@weered.ca commit -q -m "office tab: fill the stage frame - collapse the empty participants canvas when office is open (was splitting height 50/50 and leaving a black void) and let the panel run full frame width" || echo "(nothing to commit)"
git push origin HEAD:main 2>&1 | tail -3
git log -1 --format='%h %s'
curl -s -o /dev/null -w "web: %{http_code}\n" --max-time 15 http://127.0.0.1:3000/ || true

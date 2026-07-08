#!/bin/bash
set -e
cd /opt/weered/apps/web
echo "=== build ==="
pnpm next build > /tmp/office_tab_build.log 2>&1 || true
echo "compiled: $(grep -c 'Compiled successfully' /tmp/office_tab_build.log)  failed: $(grep -ci 'Failed to compile' /tmp/office_tab_build.log)"
if grep -qi "Failed to compile" /tmp/office_tab_build.log; then
  echo "--- BUILD FAILED (tail) ---"
  grep -iB1 -A8 "Failed to compile" /tmp/office_tab_build.log | head -50
  exit 1
fi
pm2 restart weered-web --update-env >/dev/null 2>&1
sleep 5
cd /opt/weered
git add apps/web/components/room/RoomCanvas.tsx apps/web/components/room/RoomStage.tsx
git -c user.name=Weered -c user.email=dev@weered.ca commit -q -m "office: promote the office control surface to a first-class Weered stage module tab (local-only, staff-gated) - retires the right-rail drawer" || echo "(nothing to commit)"
git log -1 --format='%h %s'
echo "=== health ==="
curl -s -o /dev/null -w "web: %{http_code}\n" --max-time 15 http://127.0.0.1:3000/ || true

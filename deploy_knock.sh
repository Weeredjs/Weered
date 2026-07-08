#!/bin/bash
set -e
cd /opt/weered/apps/web
echo "=== web build ==="
pnpm next build > /tmp/knock_build.log 2>&1 || true
echo "compiled: $(grep -c 'Compiled successfully' /tmp/knock_build.log)  failed: $(grep -ci 'Failed to compile' /tmp/knock_build.log)"
if grep -qi "Failed to compile" /tmp/knock_build.log; then
  echo "--- BUILD FAILED ---"
  grep -iB1 -A10 "Failed to compile" /tmp/knock_build.log | head -60
  exit 1
fi
pm2 restart weered-web --update-env >/dev/null 2>&1
sleep 5
cd /opt/weered
git add apps/web/components/room/RoomCanvas.tsx apps/web/components/room/OfficeRail.tsx
git -c user.name=Weered -c user.email=dev@weered.ca commit -q -m "office: knock alerts (chime + browser/OS notification + tab-title flash, room-level so it fires with the office tab closed or Weered backgrounded) and declutter the rail (door control moved up next to the status; drop the idle walk-in log)" || echo "(nothing to commit)"
git push origin HEAD:main 2>&1 | tail -3
git log -1 --format='%h %s'
curl -s -o /dev/null -w "web: %{http_code}\n" --max-time 15 http://127.0.0.1:3000/ || true

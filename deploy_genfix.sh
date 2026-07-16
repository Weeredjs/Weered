#!/bin/bash
set -e
cd /opt/weered/apps/web
echo "=== build ==="
pnpm next build > /tmp/genfix_build.log 2>&1 || true
echo "compiled: $(grep -c 'Compiled successfully' /tmp/genfix_build.log)  failed: $(grep -ci 'Failed to compile' /tmp/genfix_build.log)"
if grep -qi "Failed to compile" /tmp/genfix_build.log; then
  echo "--- BUILD FAILED ---"
  grep -iB2 -A14 "Failed to compile" /tmp/genfix_build.log | head -60
  exit 1
fi
pm2 restart weered-web --update-env >/dev/null 2>&1
sleep 5
curl -s -o /dev/null -w "web: %{http_code}  " --max-time 15 http://127.0.0.1:3000/ || true
curl -s -o /dev/null -w "foyer: %{http_code}\n" --max-time 15 https://office.eastcoastemployeebenefits.com/foyer || true
cd /opt/weered
git add apps/web/app/foyer/page.tsx
git -c user.name=Weered -c user.email=dev@weered.ca commit -q -m "foyer: fix guest drop after a fast admit - connection generation counter in makeRoomConn so disconnect()/a newer connect() aborts an in-flight connect at every await checkpoint (the arrival knock made admit-during-foyer-connect possible; the stale connect survived its token fetch, stomped ref or lingered as a zombie foyer Room, and its later server kick fired the drop handler as an unexpected disconnect). switchTo swallows the expected superseded throw" || echo "(nothing to commit)"
git push origin HEAD:main 2>&1 | tail -2
git log -1 --format='%h %s'

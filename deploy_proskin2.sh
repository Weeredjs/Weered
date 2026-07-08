#!/bin/bash
set -e
cd /opt/weered/apps/web
echo "=== web build ==="
pnpm next build > /tmp/proskin2_build.log 2>&1 || true
echo "compiled: $(grep -c 'Compiled successfully' /tmp/proskin2_build.log)  failed: $(grep -ci 'Failed to compile' /tmp/proskin2_build.log)"
if grep -qi "Failed to compile" /tmp/proskin2_build.log; then
  echo "--- BUILD FAILED ---"
  grep -iB1 -A10 "Failed to compile" /tmp/proskin2_build.log | head -60
  exit 1
fi
pm2 restart weered-web --update-env >/dev/null 2>&1
sleep 5
cd /opt/weered
git add apps/web/components/RootFrame.tsx
git -c user.name=Weered -c user.email=dev@weered.ca commit -q -m "office skin: keep the rails (they're navigation, still important) inside the pro frame, and redirect the ECEB meeting host root/home into the office room (/room/mtg-eceb-office) instead of the Weered home page" || echo "(nothing to commit)"
git push origin HEAD:main 2>&1 | tail -3
git log -1 --format='%h %s'
curl -s -o /dev/null -w "web(local): %{http_code}\n" --max-time 15 http://127.0.0.1:3000/ || true

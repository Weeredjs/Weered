#!/bin/bash
set -e
cd /opt/weered/apps/web
echo "=== web build ==="
pnpm next build > /tmp/press_build.log 2>&1 || true
echo "compiled: $(grep -c 'Compiled successfully' /tmp/press_build.log)  failed: $(grep -ci 'Failed to compile' /tmp/press_build.log)"
if grep -qi "Failed to compile" /tmp/press_build.log; then
  echo "--- BUILD FAILED ---"; grep -iB1 -A8 "Failed to compile" /tmp/press_build.log | head -40; exit 1
fi
pm2 restart weered-web --update-env >/dev/null 2>&1
sleep 5
cd /opt/weered
git add apps/web/app/layout.tsx
git -c user.name=Weered -c user.email=dev@weered.ca commit -q -m "office skin: force the professional 'press' theme (editorial charcoal+brass, de-purpled) on the ECEB meeting host - all features kept, weered.ca untouched" || echo "(nothing to commit)"
git push origin HEAD:main 2>&1 | tail -2
git log -1 --format='%h %s'
curl -s -o /dev/null -w "web(local): %{http_code}\n" --max-time 15 http://127.0.0.1:3000/ || true

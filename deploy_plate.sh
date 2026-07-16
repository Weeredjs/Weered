#!/bin/bash
set -e
cd /opt/weered/apps/web
echo "=== build ==="
pnpm next build > /tmp/plate_build.log 2>&1 || true
echo "compiled: $(grep -c 'Compiled successfully' /tmp/plate_build.log)  failed: $(grep -ci 'Failed to compile' /tmp/plate_build.log)"
if grep -qi "Failed to compile" /tmp/plate_build.log; then
  echo "--- BUILD FAILED ---"
  grep -iB2 -A14 "Failed to compile" /tmp/plate_build.log | head -60
  exit 1
fi
pm2 restart weered-web --update-env >/dev/null 2>&1
sleep 5
curl -s -o /dev/null -w "web: %{http_code}\n" --max-time 15 http://127.0.0.1:3000/ || true
cd /opt/weered
git add apps/web/components/AdvisorCredentialCard.tsx
git -c user.name=Weered -c user.email=dev@weered.ca commit -q -m "review room: the nameplate - advisor card as a brass-on-navy plaque (medallion avatar, embossed anchor seal, certificate corner ticks, satin rule) with two live details: The Sign state mirrored from the office status endpoint + a Halifax wall-clock (minute tick)" || echo "(nothing to commit)"
git push origin HEAD:main 2>&1 | tail -2
git log -1 --format='%h %s'

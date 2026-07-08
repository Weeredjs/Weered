#!/bin/bash
set -e
cd /opt/weered
echo "=== web build ==="
cd /opt/weered/apps/web
pnpm next build > /tmp/presdoc_build.log 2>&1 || true
echo "compiled: $(grep -c 'Compiled successfully' /tmp/presdoc_build.log)  failed: $(grep -ci 'Failed to compile' /tmp/presdoc_build.log)"
if grep -qi "Failed to compile" /tmp/presdoc_build.log; then
  echo "--- WEB BUILD FAILED ---"
  grep -iB1 -A10 "Failed to compile" /tmp/presdoc_build.log | head -60
  exit 1
fi
pm2 restart weered-web --update-env >/dev/null 2>&1

echo "=== restart api (auto-revert auth.ts on failure) ==="
pm2 restart weered-api --update-env >/dev/null 2>&1
ok=0
for i in 1 2 3 4 5 6 7 8; do
  sleep 2
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 http://127.0.0.1:4000/health || echo 000)
  if [ "$code" = "200" ]; then ok=1; break; fi
done
if [ "$ok" != "1" ]; then
  echo "!!! API DID NOT COME BACK (last=$code) — reverting auth.ts"
  cd /opt/weered
  git checkout -- apps/api/src/routes/auth.ts
  pm2 restart weered-api --update-env >/dev/null 2>&1
  sleep 4
  echo "post-revert /health: $(curl -s -o /dev/null -w '%{http_code}' --max-time 5 http://127.0.0.1:4000/health)"
  pm2 logs weered-api --lines 20 --nostream 2>/dev/null | tail -25
  exit 1
fi

echo "=== healthy ==="
curl -s -o /dev/null -w "web: %{http_code}\n" --max-time 15 http://127.0.0.1:3000/ || true
echo "api /health: 200"

cd /opt/weered
git add apps/web/app/foyer/PresentationDoc.tsx apps/web/app/foyer/PlanModule.tsx apps/api/src/routes/auth.ts
git -c user.name=Weered -c user.email=dev@weered.ca commit -q -m "present-to-room: render the client view as the full benefits-document presentation (navy/gold, deployable figures, live outlook gauge driven by the presented projection) matching the engine's /present doc; forward-wire projection.lossRatio for the exact loss-ratio gauge" || echo "(nothing to commit)"
git push origin HEAD:main 2>&1 | tail -3
git log -1 --format='%h %s'

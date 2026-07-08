#!/bin/bash
set -e
cd /opt/weered

echo "=== web build ==="
cd /opt/weered/apps/web
pnpm next build > /tmp/deployable_build.log 2>&1 || true
echo "compiled: $(grep -c 'Compiled successfully' /tmp/deployable_build.log)  failed: $(grep -ci 'Failed to compile' /tmp/deployable_build.log)"
if grep -qi "Failed to compile" /tmp/deployable_build.log; then
  echo "--- WEB BUILD FAILED (renderer typecheck) ---"
  grep -iB1 -A8 "Failed to compile" /tmp/deployable_build.log | head -50
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
  echo "!!! API DID NOT COME BACK (last code=$code) — reverting auth.ts"
  cd /opt/weered
  git checkout -- apps/api/src/routes/auth.ts
  pm2 restart weered-api --update-env >/dev/null 2>&1
  sleep 4
  echo "post-revert /health: $(curl -s -o /dev/null -w '%{http_code}' --max-time 5 http://127.0.0.1:4000/health)"
  echo "--- api error log tail ---"
  pm2 logs weered-api --lines 25 --nostream 2>/dev/null | tail -30
  exit 1
fi

echo "=== healthy ==="
curl -s -o /dev/null -w "web: %{http_code}\n" --max-time 15 http://127.0.0.1:3000/ || true
echo "api /health: 200"
pm2 jlist | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{const a=JSON.parse(d);for(const p of a){if(["weered-web","weered-api"].includes(p.name))console.log(p.name,p.pm2_env.status,"restarts="+p.pm2_env.restart_time)}})'

echo "=== commit ==="
cd /opt/weered
git add apps/web/app/foyer/ReviewDocs.tsx apps/api/src/routes/auth.ts
git -c user.name=Weered -c user.email=dev@weered.ca commit -q -m "fathom: deployable figures - plain consult statements reveal their underlying numbers on click (diagnosis/drivers/levers/appeal basis); widen presented whitelist to pass detail+figures" || echo "(nothing to commit)"
git log -1 --format='%h %s'

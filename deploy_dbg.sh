#!/bin/bash
set -e
cd /opt/weered/apps/web
echo "=== web build (temp debug, not committed) ==="
pnpm next build > /tmp/dbg_build.log 2>&1 || true
echo "compiled: $(grep -c 'Compiled successfully' /tmp/dbg_build.log)  failed: $(grep -ci 'Failed to compile' /tmp/dbg_build.log)"
if grep -qi "Failed to compile" /tmp/dbg_build.log; then
  echo "--- BUILD FAILED ---"; grep -iB1 -A8 "Failed to compile" /tmp/dbg_build.log | head -40; exit 1
fi
pm2 restart weered-web --update-env >/dev/null 2>&1
sleep 5
curl -s -o /dev/null -w "web(local): %{http_code}\n" --max-time 15 http://127.0.0.1:3000/ || true
echo "deployed debug badge (uncommitted)"

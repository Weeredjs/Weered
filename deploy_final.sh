#!/bin/bash
set -e
cd /opt/weered/apps/web
echo "=== web build ==="
pnpm next build > /tmp/final_build.log 2>&1 || true
echo "compiled: $(grep -c 'Compiled successfully' /tmp/final_build.log)  failed: $(grep -ci 'Failed to compile' /tmp/final_build.log)"
if grep -qi "Failed to compile" /tmp/final_build.log; then
  echo "--- BUILD FAILED ---"; grep -iB1 -A8 "Failed to compile" /tmp/final_build.log | head -40; exit 1
fi
pm2 restart weered-web --update-env >/dev/null 2>&1
sleep 5
cd /opt/weered
git add apps/web/components/RootFrame.tsx apps/web/public/brand/eceb-anchor-chrome.svg
git -c user.name=Weered -c user.email=dev@weered.ca commit -q -m "office skin: recolor Weered purple -> ECEB gold in place (no branch swap; injected sheet matches the browser-normalized rgb(124, 58, 237) form; SVG banner ::before recolored via filter) + redraw chrome anchor + redirect-loop guard; debug removed. Room-scoped via data-office-skin, weered.ca untouched" || echo "(nothing to commit)"
git push origin HEAD:main 2>&1 | tail -2
git log -1 --format='%h %s'
curl -s -o /dev/null -w "web(local): %{http_code}\n" --max-time 15 http://127.0.0.1:3000/ || true

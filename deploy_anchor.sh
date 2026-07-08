#!/bin/bash
set -e
cd /opt/weered/apps/web
ls -la public/brand/eceb-anchor-chrome.svg 2>/dev/null && echo "anchor asset present"
echo "=== web build ==="
pnpm next build > /tmp/anchor_build.log 2>&1 || true
echo "compiled: $(grep -c 'Compiled successfully' /tmp/anchor_build.log)  failed: $(grep -ci 'Failed to compile' /tmp/anchor_build.log)"
if grep -qi "Failed to compile" /tmp/anchor_build.log; then
  echo "--- BUILD FAILED ---"; grep -iB1 -A8 "Failed to compile" /tmp/anchor_build.log | head -40; exit 1
fi
pm2 restart weered-web --update-env >/dev/null 2>&1
sleep 5
cd /opt/weered
git add apps/web/components/RootFrame.tsx apps/web/public/brand/eceb-anchor-chrome.svg
git -c user.name=Weered -c user.email=dev@weered.ca commit -q -m "office skin: swap the Weered mark for a chrome ECEB anchor on the meeting host (CSS content-swap, scoped to data-pro-host; weered.ca untouched)" || echo "(nothing to commit)"
git push origin HEAD:main 2>&1 | tail -2
git log -1 --format='%h %s'
curl -s -o /dev/null -w "anchor svg: %{http_code}\n" --max-time 10 http://127.0.0.1:3000/brand/eceb-anchor-chrome.svg || true

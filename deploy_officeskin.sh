#!/bin/bash
set -e
cd /opt/weered/apps/web
echo "=== web build ==="
pnpm next build > /tmp/officeskin_build.log 2>&1 || true
echo "compiled: $(grep -c 'Compiled successfully' /tmp/officeskin_build.log)  failed: $(grep -ci 'Failed to compile' /tmp/officeskin_build.log)"
if grep -qi "Failed to compile" /tmp/officeskin_build.log; then
  echo "--- BUILD FAILED ---"; grep -iB1 -A8 "Failed to compile" /tmp/officeskin_build.log | head -40; exit 1
fi
pm2 restart weered-web --update-env >/dev/null 2>&1
sleep 5
cd /opt/weered
git add apps/web/components/RootFrame.tsx
git -c user.name=Weered -c user.email=dev@weered.ca commit -q -m "office skin: de-purple (press theme) + chrome anchor now apply in any mtg-* meeting room on ANY host (data-office-skin, re-asserted over ThemeRestore, restored on leave) - so entering the office from a weered.ca favourite/desktop works too; full navy frame stays host-scoped" || echo "(nothing to commit)"
git push origin HEAD:main 2>&1 | tail -2
git log -1 --format='%h %s'
curl -s -o /dev/null -w "web(local): %{http_code}\n" --max-time 15 http://127.0.0.1:3000/ || true

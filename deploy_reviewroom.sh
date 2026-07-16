#!/bin/bash
set -e
cd /opt/weered/apps/web
echo "=== web build (the Fathom Review Room) ==="
pnpm next build > /tmp/reviewroom_build.log 2>&1 || true
echo "compiled: $(grep -c 'Compiled successfully' /tmp/reviewroom_build.log)  failed: $(grep -ci 'Failed to compile' /tmp/reviewroom_build.log)"
if grep -qi "Failed to compile" /tmp/reviewroom_build.log; then
  echo "--- BUILD FAILED ---"
  grep -iB2 -A14 "Failed to compile" /tmp/reviewroom_build.log | head -80
  exit 1
fi
pm2 restart weered-web --update-env >/dev/null 2>&1
sleep 6
echo "=== health ==="
curl -s -o /dev/null -w "web(local): %{http_code}\n" --max-time 15 http://127.0.0.1:3000/ || true
curl -s -o /dev/null -w "weered.ca: %{http_code}\n" --max-time 15 https://weered.ca/ || true
curl -s -o /dev/null -w "office foyer: %{http_code}\n" --max-time 15 https://office.eastcoastemployeebenefits.com/foyer || true
echo "=== commit + push ==="
cd /opt/weered
git add apps/web/components/officeSkinCss.ts apps/web/components/RootFrame.tsx \
        apps/web/components/useOfficeSkin.ts apps/web/components/AdvisorCredentialCard.tsx \
        apps/web/components/LeftRail.tsx apps/web/components/room/RoomCanvas.tsx \
        apps/web/components/room/OfficeRail.tsx apps/web/app/foyer/PresentationDoc.tsx \
        apps/web/app/foyer/PlanModule.tsx apps/web/app/foyer/page.tsx
git -c user.name=Weered -c user.email=dev@weered.ca commit -q -m "fathom: The Review Room - full office UX redesign (ink-navy/gold/paper design system, Reconciliation + fair-renewal verdict on the client paper document, Advisor Credential card, Desk/Reception left rail, The Sign + at-the-door queue, Foyer/Parlour/Receiving arrival, module tabs as advisory instruments, present-mode focus pull). All room-scoped via data-office-skin + useOfficeSkin; core Weered byte-identical off-gate" || echo "(nothing to commit)"
git push origin HEAD:main 2>&1 | tail -2
git log -1 --format='%h %s' | head -2

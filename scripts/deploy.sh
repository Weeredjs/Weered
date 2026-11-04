#!/usr/bin/env bash
# Weered deploy — the one command to ship. Runs guardrails, builds the web app
# (Next runs its own tsc during build, which is the web type gate), then
# restarts what changed. Aborts if guardrails fail so a type error or a new
# god-file can never reach production.
#
#   Usage:  bash scripts/deploy.sh [full|web|api|none]   (default: full)
#   server-deploy.sh picks the mode from what changed (scripts/deploy-mode.sh).
#
# Patching without kicking anyone off (James 2026-11-03):
#   - The web builds beside the live site (.next-staged) and is swapped in when
#     done: the site keeps serving through the build, and a failed build
#     changes nothing. The last build's code files stay, so a window opened
#     before the deploy can still load what it asks for.
#   - Only what changed restarts: a web fix never touches the API, so nobody's
#     chat connection drops.
#   - An API restart tells every page first (4012, api lib/restartNotice.ts)
#     and they come straight back; Caddy holds requests while either server
#     restarts (lb_try_duration in /etc/caddy/Caddyfile).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
W="$ROOT/apps/web"
MODE="${1:-full}"
case "$MODE" in
  full | web | api | none) ;;
  *)
    echo "unknown mode: $MODE (full|web|api|none)"
    exit 2
    ;;
esac
has_web() { [ "$MODE" = full ] || [ "$MODE" = web ]; }
has_api() { [ "$MODE" = full ] || [ "$MODE" = api ]; }

echo ">>> Guardrails"
bash "$ROOT/scripts/check.sh"

if has_web; then
  echo ">>> Building web beside the live site (.next-staged)"
  # Route types are build-time only, and the last build's would fail the type
  # check for a page this commit removed.
  rm -rf "$W/.next-staged" "$W/.next/types"
  mkdir -p "$W/.next-staged/cache"
  if [ -d "$W/.next/cache/webpack" ]; then mv "$W/.next/cache/webpack" "$W/.next-staged/cache/webpack"; fi
  built=0
  (cd "$W" && NEXT_DIST_DIR=.next-staged pnpm next build) && built=1
  # Next points these two at the folder it built in; the repo keeps .next.
  git -C "$ROOT" checkout -- apps/web/next-env.d.ts apps/web/tsconfig.json
  if [ "$built" != 1 ]; then
    if [ -d "$W/.next-staged/cache/webpack" ] && [ -d "$W/.next/cache" ]; then
      mv "$W/.next-staged/cache/webpack" "$W/.next/cache/webpack"
    fi
    echo "!!! Web build failed; the live site is untouched"
    exit 1
  fi

  echo ">>> Swapping the new build in"
  rm -rf "$W/.next-prev"
  if [ -d "$W/.next" ]; then
    # The last build's own code files (written during its build), not the
    # older copies it was carrying.
    if [ -f "$W/.next/BUILD_ID" ] && [ -d "$W/.next/static" ]; then
      since=$(($(stat -c %Y "$W/.next/BUILD_ID") - 1800))
      (cd "$W/.next/static" && find . -type f -newermt "@$since" -print0) |
        rsync -a --ignore-existing --from0 --files-from=- "$W/.next/static/" "$W/.next-staged/static/"
    fi
    # The live caches (optimised images, fetched data) move with the site.
    for d in "$W/.next/cache"/*; do
      [ -e "$d" ] || continue
      n="$(basename "$d")"
      [ -e "$W/.next-staged/cache/$n" ] || mv "$d" "$W/.next-staged/cache/$n"
    done
    mv "$W/.next" "$W/.next-prev"
  fi
  mv "$W/.next-staged" "$W/.next"

  echo ">>> Restarting weered-web"
  # A heap ceiling, so a Weered flood can't take the memory Fathom shares
  # (scripts/fence-weered.sh). Set on the restart only, never the build.
  NODE_OPTIONS="--max-old-space-size=1024" pm2 restart weered-web --update-env
fi

if has_api; then
  echo ">>> Restarting weered-api"
  NODE_OPTIONS="--max-old-space-size=1536" pm2 restart weered-api --update-env
fi

if [ "$MODE" != none ]; then bash "$ROOT/scripts/fence-weered.sh"; fi

echo ">>> Waiting for both to answer, then smoke-testing"
for _ in $(seq 1 60); do curl -sf -o /dev/null http://127.0.0.1:4000/health && break || sleep 1; done
for _ in $(seq 1 60); do curl -sf -o /dev/null http://127.0.0.1:3000/build-info && break || sleep 1; done
SMOKE_API_RESTARTED=$(has_api && echo 1 || echo 0) bash "$ROOT/scripts/smoke.sh"

echo ">>> Deploy complete ($MODE)"

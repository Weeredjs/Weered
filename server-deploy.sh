#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
#  weered — server deploy script
#  Runs ON the droplet. Called by deploy.ps1 (Windows) or
#  deploy.sh (Mac/Linux) on your local machine.
#
#  What it does:
#    1. Pull latest from git
#    2. Install deps (pnpm)
#    3. Run prisma migrate
#    4. Build Next.js
#    5. Restart api + web via PM2
#    6. Healthcheck
# ─────────────────────────────────────────────────────────────
set -euo pipefail

REPO_DIR="/opt/weered"
BRANCH="${1:-main}"

log()  { echo -e "\033[36m[deploy]\033[0m $*"; }
ok()   { echo -e "\033[32m[  ok  ]\033[0m $*"; }
fail() { echo -e "\033[31m[ FAIL ]\033[0m $*" >&2; exit 1; }

log "Branch: $BRANCH"
log "Dir:    $REPO_DIR"

# ── 1. Pull ───────────────────────────────────────────────────
cd "$REPO_DIR"
git fetch origin --prune
git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH"
ok "git pull"

# ── 2. Install deps ───────────────────────────────────────────
pnpm install --frozen-lockfile
ok "pnpm install"

# ── 3. Prisma migrate ─────────────────────────────────────────
(cd apps/api && pnpm prisma migrate deploy)
ok "prisma migrate"

# ── 4. Build Next.js ─────────────────────────────────────────
(cd apps/web && pnpm next build)
ok "next build"

# ── 5. Restart services via PM2 ───────────────────────────────
# First deploy: pm2 start will be a no-op if already running
# Subsequent deploys: pm2 reload does a zero-downtime restart

if pm2 list | grep -q "weered-api"; then
  pm2 reload weered-api  --update-env
else
  pm2 start "pnpm dev" --name weered-api  --cwd "$REPO_DIR/apps/api"
fi

if pm2 list | grep -q "weered-web"; then
  pm2 reload weered-web  --update-env
else
  pm2 start "pnpm next start -p 3000" --name weered-web --cwd "$REPO_DIR/apps/web"
fi

pm2 save
ok "pm2 reload"

# ── 6. Healthcheck ────────────────────────────────────────────
log "Waiting for API healthcheck..."
for i in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:4000/health >/dev/null 2>&1; then
    ok "API healthy after ${i}s"
    exit 0
  fi
  sleep 2
done

fail "API never came up. Check: pm2 logs weered-api"

#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
#  weered — droplet-side deploy
#  Called by ./deploy.sh (local) over SSH, or run directly on the droplet.
#  Pulls the branch, then delegates to the CANONICAL guardrailed deploy
#  (scripts/deploy.sh): check.sh (tsc gate + file-size tripwire) -> web build
#  -> pm2 restart (api rebuilds via `pnpm start` = esbuild -> dist) -> smoke.
#
#  Schema changes use `prisma db push` (run manually in apps/api when the schema
#  changes). This project has NO migrations directory, so `prisma migrate deploy`
#  is intentionally NOT used here.
# ─────────────────────────────────────────────────────────────
set -euo pipefail

REPO_DIR="/opt/weered"
BRANCH="${1:-main}"

log() { echo -e "\033[36m[deploy]\033[0m $*"; }

cd "$REPO_DIR"
log "Branch: $BRANCH"
git fetch origin --prune
git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH"
log "git pull ok — handing off to scripts/deploy.sh"

bash scripts/deploy.sh

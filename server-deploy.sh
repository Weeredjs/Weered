#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
#  weered — droplet-side deploy
#  Called by ./deploy.sh (local) over SSH, or run directly on the droplet.
#  Pulls the branch, then delegates to the CANONICAL guardrailed deploy
#  (scripts/deploy.sh): check.sh (tsc gate + file-size tripwire) -> web build
#  beside the live site + swap -> pm2 restart of what changed -> smoke.
#
#  What restarts comes from the files changed since the last deploy
#  (scripts/deploy-mode.sh against .deployed-commit): a web fix never drops
#  anyone's chat connection. A second argument overrides it:
#    bash server-deploy.sh main full|web|api|none
#
#  Schema changes use `prisma db push` (run manually in apps/api when the schema
#  changes). This project has NO migrations directory, so `prisma migrate deploy`
#  is intentionally NOT used here.
# ─────────────────────────────────────────────────────────────
set -euo pipefail

main() {
  local REPO_DIR="/opt/weered" BRANCH="${1:-main}" MODE="${2:-}"
  local STATE="$REPO_DIR/.deployed-commit" prev
  log() { echo -e "\033[36m[deploy]\033[0m $*"; }

  cd "$REPO_DIR"
  log "Branch: $BRANCH"
  git fetch origin --prune
  git checkout "$BRANCH"
  git pull --ff-only origin "$BRANCH"
  log "git pull ok — at $(git log -1 --format='%h %s')"

  if [ -z "$MODE" ]; then
    prev="$(cat "$STATE" 2>/dev/null || true)"
    if [ -n "$prev" ] && git cat-file -e "$prev^{commit}" 2>/dev/null; then
      MODE="$(bash scripts/deploy-mode.sh "$prev" HEAD)"
      log "Changed since ${prev:0:8}: mode $MODE"
    else
      MODE=full
      log "No record of the last deploy: mode full"
    fi
  fi
  bash scripts/deploy.sh "$MODE"
  git rev-parse HEAD >"$STATE"
}

# One line, so bash has read all of it before the pull above can rewrite this file.
main "$@"; exit $?

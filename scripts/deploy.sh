#!/usr/bin/env bash
# Weered deploy — the one command to ship. Runs guardrails, builds the web app
# (Next runs its own tsc during build, which is the web type gate), then
# restarts both pm2 processes. Aborts if guardrails fail so a type error or a
# new god-file can never reach production.
#
#   Usage:  bash scripts/deploy.sh          (full: check + web build + restart)
#           bash scripts/deploy.sh api       (api only: check + restart api)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MODE="${1:-full}"

echo ">>> Guardrails"
bash "$ROOT/scripts/check.sh"

if [ "$MODE" != "api" ]; then
  echo ">>> Building web (next build — also the web type gate)"
  ( cd "$ROOT/apps/web" && pnpm next build )
  echo ">>> Restarting weered-web"
  pm2 restart weered-web --update-env
fi

echo ">>> Restarting weered-api"
pm2 restart weered-api --update-env

echo ">>> Waiting for API to boot, then smoke-testing"
sleep 12   # tsx boot (transpile + Prisma + WS) takes ~5-15s
bash "$ROOT/scripts/smoke.sh"

echo ">>> Deploy complete"

#!/usr/bin/env bash
# Which Weered servers a deploy has to restart, from the files changed between
# two commits: web, api, full (both) or none. Tests, docs, deploy tooling and
# the other apps restart nothing; anything not clearly one side's counts as both.
#   Usage: bash scripts/deploy-mode.sh <from-commit> <to-commit>
set -euo pipefail
web=0
api=0
while IFS= read -r f; do
  case "$f" in
    apps/web/e2e/* | apps/web/test/* | apps/api/test/*) ;;
    apps/mobile/* | apps/desktop/* | apps/mod/* | docs/* | .github/* | *.md) ;;
    # Tooling no running server loads.
    scripts/* | server-deploy.sh | .gitignore | eslint.config.mjs) ;;
    apps/web/*) web=1 ;;
    apps/api/*) api=1 ;;
    *)
      web=1
      api=1
      ;;
  esac
done < <(git diff --name-only "$1" "$2")
if [ "$web$api" = 11 ]; then
  echo full
elif [ "$web" = 1 ]; then
  echo web
elif [ "$api" = 1 ]; then
  echo api
else
  echo none
fi

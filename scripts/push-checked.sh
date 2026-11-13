#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
#  weered: push to main only when the local checks pass.
#
#  The guardrails (types, file sizes), the API's unit tests and the web's unit
#  tests, each run with its real exit code looked at, and the push only after
#  all three. Written because "run the tests | tail && git push" pushes
#  whatever the tests said: a pipe answers with its LAST command, and tail
#  always succeeds. A commit with a failing test reached main that way on
#  2026-11-13 (CI refused to deploy it).
#
#    bash scripts/push-checked.sh
#
#  CI is still the gate for a deploy. This only keeps a red commit off main.
# ─────────────────────────────────────────────────────────────
set -u
cd "$(dirname "$0")/.."
LOG="$(mktemp)"
trap 'rm -f "$LOG"' EXIT

step() {
  local name="$1"
  shift
  "$@" >"$LOG" 2>&1
  local rc=$?
  if [ $rc -ne 0 ]; then
    grep -E "FAIL|×|error TS|Test Files|Tests  |oversized" "$LOG" | head -30
    echo "NOT PUSHED: $name failed (exit $rc)"
    exit 1
  fi
  local summary
  summary=$(grep -E "Tests  |GUARDRAILS PASSED" "$LOG" | tail -1 | sed 's/^ *//')
  echo "ok: $name${summary:+  ($summary)}"
}

step "guardrails" bash scripts/check.sh
step "API unit tests" bash -c "cd apps/api && npx vitest run test/unit"
step "web unit tests" bash -c "cd apps/web && npx vitest run"

git fetch -q origin && git rebase -q origin/main || {
  echo "NOT PUSHED: could not rebase onto origin/main"
  exit 1
}
git push -q origin HEAD:main || {
  echo "NOT PUSHED: git push failed"
  exit 1
}
echo "pushed: $(git log --oneline -1)"

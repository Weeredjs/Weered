#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
#  weered: restart the API if it stops answering.
#
#  pm2 restarts the API when it EXITS. Nothing restarts it when it is still
#  running but answers nothing: a loop that never ends holds the one thread the
#  API and the chat socket share, and the site is down until somebody notices.
#  (The hardening pass of 2026-11-13 closed the ways it found to cause that;
#  this is for the ones nobody has found.)
#
#  Meant to run from cron once a minute:
#    * * * * * /opt/weered/scripts/health-watch.sh >> /var/log/weered-health.log 2>&1
#
#  What it does: asks the API's /health with a 10-second limit. Three misses in
#  a row (three minutes) and it restarts the API, writes one line to the log,
#  and then leaves it alone for ten minutes so a slow start is not restarted
#  again. An answer of ANY kind counts as alive: "the database is down" (503)
#  is the API answering, and restarting the API does not fix a database.
#
#  Run with "check" to see what it would do, changing nothing:
#    bash scripts/health-watch.sh check
# ─────────────────────────────────────────────────────────────
set -u

URL="${WEERED_HEALTH_URL:-http://127.0.0.1:4000/health}"
STATE="${WEERED_HEALTH_STATE:-/var/tmp/weered-health.state}"
MISSES_BEFORE_RESTART=3
QUIET_AFTER_RESTART_S=600
MODE="${1:-run}"

now=$(date +%s)
stamp() { date -u +"%Y-%m-%dT%H:%M:%SZ"; }

misses=0
last_restart=0
if [ -f "$STATE" ]; then
  # Two numbers on one line: misses in a row, time of the last restart.
  read -r misses last_restart <"$STATE" 2>/dev/null || true
  case "$misses" in '' | *[!0-9]*) misses=0 ;; esac
  case "$last_restart" in '' | *[!0-9]*) last_restart=0 ;; esac
fi

# The status code alone: 000 means nothing came back inside the limit.
code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$URL" 2>/dev/null)
[ -z "$code" ] && code=000

if [ "$code" != "000" ]; then
  [ "$MODE" = "check" ] && echo "$(stamp) the API answered ($code); misses in a row were $misses; nothing to do"
  [ "$MODE" = "check" ] || echo "0 $last_restart" >"$STATE"
  exit 0
fi

misses=$((misses + 1))
since=$((now - last_restart))

if [ "$misses" -lt "$MISSES_BEFORE_RESTART" ]; then
  [ "$MODE" = "check" ] && echo "$(stamp) no answer; that would be miss $misses of $MISSES_BEFORE_RESTART"
  [ "$MODE" = "check" ] || echo "$misses $last_restart" >"$STATE"
  exit 0
fi

if [ "$since" -lt "$QUIET_AFTER_RESTART_S" ]; then
  [ "$MODE" = "check" ] && echo "$(stamp) no answer, but it was restarted ${since}s ago; would wait"
  [ "$MODE" = "check" ] || echo "$misses $last_restart" >"$STATE"
  exit 0
fi

if [ "$MODE" = "check" ]; then
  echo "$(stamp) no answer $misses times in a row; would restart weered-api now"
  exit 0
fi

echo "$(stamp) the API has not answered $misses checks in a row: restarting weered-api"
pm2 restart weered-api >/dev/null 2>&1 && echo "$(stamp) restarted" || echo "$(stamp) pm2 restart FAILED"
echo "0 $now" >"$STATE"

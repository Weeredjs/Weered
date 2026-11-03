#!/usr/bin/env bash
# Weered and Fathom share this droplet. In a Weered flood, Fathom has to keep
# working (flood readiness 2026-11-02):
#   - Weered's two processes, and everything they start, run at nice 5, so
#     under contention Fathom (nice 0) gets the CPU first.
#   - Weered's own containers get ceilings: LiveKit one core and 768 MB,
#     Redis half a core and 256 MB (only LiveKit uses Redis).
#   - Postgres is NOT capped: the same container holds Fathom's database
#     (ubep) beside Weered's. Weered's share is bounded by its small Prisma
#     connection pool instead.
#   - The heap ceilings are set where the processes start (scripts/deploy.sh).
# Safe to run any time; scripts/deploy.sh runs it after every restart.
set -uo pipefail

tree() {
  echo "$1"
  for c in $(pgrep -P "$1"); do tree "$c"; done
}

for app in weered-api weered-web; do
  pid=$(pm2 pid "$app" 2>/dev/null | tail -1)
  if [ -z "$pid" ] || [ "$pid" = "0" ]; then continue; fi
  for p in $(tree "$pid"); do renice -n 5 -p "$p" >/dev/null 2>&1 || true; done
done

docker update --cpus 1.0 --memory 768m --memory-swap 768m weered_livekit >/dev/null 2>&1 || true
docker update --cpus 0.5 --memory 256m --memory-swap 256m weered_redis >/dev/null 2>&1 || true

echo ">>> Fathom fence: Weered at nice 5; LiveKit and Redis capped; Postgres shared, uncapped"

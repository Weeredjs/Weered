# Weered deploy script (Windows -> Droplet)
# - Pushes your current branch to GitHub
# - Server pulls into /opt/weered_repo
# - Syncs code into /opt/weered while preserving server-only config
# - Rebuilds containers and waits for /health

$ErrorActionPreference = "Stop"

# --- Config ---
$server = "root@weered.ca"
$key    = "$env:USERPROFILE\.ssh\weered_do"
$branch = (git branch --show-current).Trim()

Write-Host "== Local repo ==" -ForegroundColor Cyan
git status

Write-Host "== Pushing branch '$branch' to origin ==" -ForegroundColor Cyan
git push origin $branch

Write-Host "== Deploying on server ($server) ==" -ForegroundColor Cyan

ssh -i $key -o IdentitiesOnly=yes $server @"
set -euo pipefail

echo "== Server: pulling code =="
cd /opt/weered_repo
git fetch origin --prune
git switch $branch || git switch -c $branch --track origin/$branch
git pull --ff-only

echo "== Server: syncing code -> runtime (preserving server config) =="
rsync -a --delete \
  --exclude '.git' \
  --exclude '.env' --exclude '.env.*' \
  --exclude 'apps/web/.env.local' \
  --exclude 'docker-compose*.yml' --exclude 'docker-compose*.yaml' \
  --exclude 'weered-compose' \
  --exclude 'releases/' \
  --exclude 'uploads/' \
  /opt/weered_repo/ /opt/weered/

echo "== Server: rebuild/up =="
cd /opt/weered
weered-compose up -d --build

echo "== Server: healthcheck =="
for i in \$(seq 1 40); do
  if curl -fsS http://127.0.0.1:4000/health >/dev/null; then
    echo "OK: healthcheck"
    exit 0
  fi
  sleep 2
done

echo "ERROR: healthcheck never went green"
docker compose ps || true
docker logs --tail 120 weered-api-1 || true
exit 1
"@

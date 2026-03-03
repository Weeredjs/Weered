# deploy.ps1 (safe: sends a bash script to server over stdin)
$ErrorActionPreference = "Stop"

$server = "root@weered.ca"
$key    = "$env:USERPROFILE\.ssh\weered_do"
$branch = (git branch --show-current).Trim()

Write-Host "== Local repo ==" -ForegroundColor Cyan
git status

Write-Host "== Pushing branch '$branch' to origin ==" -ForegroundColor Cyan
git push origin $branch

Write-Host "== Deploying on server ($server) ==" -ForegroundColor Cyan

# Create a bash script as a literal string (no interpolation surprises)
$bash = @'
set -euo pipefail

BRANCH="__BRANCH__"

echo "== Server: pulling code =="
cd /opt/weered_repo
git fetch origin --prune
git switch "$BRANCH" || git switch -c "$BRANCH" --track "origin/$BRANCH"
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
i=0
while [ "$i" -lt 40 ]; do
  if curl -fsS http://127.0.0.1:4000/health >/dev/null; then
    echo "OK: healthcheck"
    exit 0
  fi
  i=$((i+1))
  sleep 2
done

echo "ERROR: healthcheck never went green"
docker compose ps || true
docker logs --tail 120 weered-api-1 || true
exit 1
'@

# Inject branch safely
$bash = $bash.Replace("__BRANCH__", $branch)

# Send script via stdin; run on server with bash
$bash | ssh -i $key -o IdentitiesOnly=yes $server "bash -s"
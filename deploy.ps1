$ErrorActionPreference = "Stop"

$server = "root@weered.ca"
$key    = "$env:USERPROFILE\.ssh\weered_do"
$branch = (git branch --show-current).Trim()

Write-Host "== Local repo ==" -ForegroundColor Cyan
git status

Write-Host "== Pushing branch '$branch' to origin ==" -ForegroundColor Cyan
git push origin $branch

Write-Host "== Deploying on server ($server) ==" -ForegroundColor Cyan

# --- the real deploy script (bash) ---
$bash = @"
set -euo pipefail

BRANCH='$branch'
echo "Deploying branch: \$BRANCH"

cd /opt/weered_repo
git fetch origin --prune
git switch "\$BRANCH" || git switch -c "\$BRANCH" --track "origin/\$BRANCH"
git pull --ff-only

rsync -a --delete \
  --exclude '.git' \
  --exclude '.env' --exclude '.env.*' \
  --exclude 'apps/web/.env.local' \
  --exclude 'docker-compose*.yml' --exclude 'docker-compose*.yaml' \
  --exclude 'weered-compose' \
  --exclude 'releases/' \
  --exclude 'uploads/' \
  /opt/weered_repo/ /opt/weered/

cd /opt/weered
weered-compose up -d --build

tries=40
while [ "\$tries" -gt 0 ]; do
  if curl -fsS http://127.0.0.1:4000/health >/dev/null; then
    echo "OK: healthcheck"
    exit 0
  fi
  $tries = $tries - 1
  sleep 2
done

echo "ERROR: healthcheck never went green"
docker compose ps || true
docker logs --tail 120 weered-api-1 || true
exit 1
"@

# base64 encode the bash script so PowerShell never tries to interpret bash syntax
$b64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($bash))

# wrapper that runs on the droplet: decode -> bash
$wrapper = @"
python3 - <<'PY' | bash
import base64
print(base64.b64decode('''$b64''').decode('utf-8'))
PY
"@

$sshArgs = @("-i", $key, "-o", "IdentitiesOnly=yes", $server, "bash -s")
$wrapper | & ssh @sshArgs

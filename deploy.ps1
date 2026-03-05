# ─────────────────────────────────────────────────────────────
#  weered deploy — Windows / PowerShell
#
#  Usage:
#    .\deploy.ps1              # deploys current branch
#    .\deploy.ps1 -Branch main # deploys specific branch
#
#  One-time setup:
#    Set $SERVER and $KEY below to match your droplet.
#    Make sure server-deploy.sh is at /opt/weered/server-deploy.sh
# ─────────────────────────────────────────────────────────────
param(
  [string]$Branch = (git branch --show-current).Trim()
)

$ErrorActionPreference = "Stop"

# ── Config (edit these) ───────────────────────────────────────
$SERVER = "root@weered.ca"
$KEY    = "$env:USERPROFILE\.ssh\weered_do"
# ─────────────────────────────────────────────────────────────

Write-Host "`n== Deploying branch '$Branch' to $SERVER ==" -ForegroundColor Cyan

# Push local branch to origin
git push origin $Branch

# Run server-deploy.sh on the droplet
$sshArgs = @("-i", $KEY, "-o", "IdentitiesOnly=yes", "-o", "StrictHostKeyChecking=accept-new", $SERVER)
& ssh @sshArgs "bash /opt/weered/server-deploy.sh '$Branch'"

if ($LASTEXITCODE -eq 0) {
  Write-Host "`n== Done. https://weered.ca is live. ==" -ForegroundColor Green
} else {
  Write-Host "`n== Deploy failed. Run: ssh -i $KEY $SERVER pm2 logs weered-api ==" -ForegroundColor Red
  exit 1
}

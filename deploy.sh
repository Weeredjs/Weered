#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
#  weered deploy — Mac / Linux
#
#  Usage:
#    ./deploy.sh              # deploys current branch
#    ./deploy.sh main         # deploys specific branch
# ─────────────────────────────────────────────────────────────

SERVER="root@weered.ca"
KEY="$HOME/.ssh/weered_do"
BRANCH="${1:-$(git branch --show-current)}"

echo -e "\033[36m\n== Deploying branch '$BRANCH' to $SERVER ==\033[0m"

git push origin "$BRANCH"
ssh -i "$KEY" -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new \
    "$SERVER" "bash /opt/weered/server-deploy.sh '$BRANCH'"

if [ $? -eq 0 ]; then
  echo -e "\033[32m\n== Done. https://weered.ca is live. ==\033[0m"
else
  echo -e "\033[31m\n== Deploy failed. Run: ssh -i $KEY $SERVER pm2 logs weered-api ==\033[0m"
  exit 1
fi

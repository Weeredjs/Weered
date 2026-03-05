@echo off
setlocal

set KEY=%USERPROFILE%\.ssh\weered_do
set HOST=root@weered.ca

ssh -i "%KEY%" %HOST% bash -lc "set -e; \
cp -a /root/weered-deploy.sh /root/weered-deploy.sh.bak_$(date +%Y%m%d_%H%M%S); \
cat > /root/weered-deploy.sh <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

REPO_DIR=/opt/weered_repo
RUNTIME_DIR=/opt/weered
BRANCH=main

echo '== Weered deploy =='
date -u

echo '== Repo: '"$REPO_DIR"' (pull) =='
cd "$REPO_DIR"
git fetch --all
git checkout "$BRANCH"
git reset --hard "origin/$BRANCH"

echo '== Sync repo -> runtime =='
rsync -a --delete \
  --exclude .git \
  --exclude node_modules \
  --exclude .next \
  --exclude dist \
  --exclude coverage \
  "$REPO_DIR/" "$RUNTIME_DIR/"

echo '== Runtime: '"$RUNTIME_DIR"' (compose) =='
cd "$RUNTIME_DIR"
weered-compose up -d --build
weered-compose ps

echo '== Health =='
curl -fsS http://127.0.0.1:4000/health
echo
EOF
chmod +x /root/weered-deploy.sh
echo patched
sed -n '1,200p' /root/weered-deploy.sh"

endlocal

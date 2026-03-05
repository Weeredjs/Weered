#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
#  weered — one-time server setup
#  Run this ONCE on a fresh droplet before your first deploy.
#
#  ssh -i ~/.ssh/weered_do root@weered.ca
#  bash <(curl -s https://raw.githubusercontent.com/.../server-setup.sh)
#  -- OR -- copy-paste the whole thing
# ─────────────────────────────────────────────────────────────
set -euo pipefail

log()  { echo -e "\033[36m[setup]\033[0m $*"; }
ok()   { echo -e "\033[32m[  ok  ]\033[0m $*"; }

# ── Node 20 ──────────────────────────────────────────────────
if ! command -v node &>/dev/null; then
  log "Installing Node 20..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
ok "node $(node -v)"

# ── pnpm ─────────────────────────────────────────────────────
if ! command -v pnpm &>/dev/null; then
  log "Installing pnpm..."
  npm install -g pnpm
fi
ok "pnpm $(pnpm -v)"

# ── PM2 ──────────────────────────────────────────────────────
if ! command -v pm2 &>/dev/null; then
  log "Installing PM2..."
  npm install -g pm2
  pm2 startup systemd -u root --hp /root | tail -1 | bash
fi
ok "pm2 $(pm2 -v)"

# ── Caddy ────────────────────────────────────────────────────
if ! command -v caddy &>/dev/null; then
  log "Installing Caddy..."
  apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
  apt-get update && apt-get install -y caddy
fi
ok "caddy $(caddy version)"

# ── Docker (for postgres/redis/livekit) ──────────────────────
if ! command -v docker &>/dev/null; then
  log "Installing Docker..."
  curl -fsSL https://get.docker.com | bash
fi
ok "docker $(docker -v)"

# ── Clone repo ───────────────────────────────────────────────
REPO_DIR="/opt/weered"
if [ ! -d "$REPO_DIR/.git" ]; then
  log "Cloning repo..."
  # Replace with your actual repo URL
  git clone https://github.com/YOUR_ORG/weered.git "$REPO_DIR"
fi
ok "repo at $REPO_DIR"

# ── server-deploy.sh must be executable ──────────────────────
chmod +x "$REPO_DIR/server-deploy.sh"

# ── Caddy config ─────────────────────────────────────────────
log "Installing Caddyfile..."
cp "$REPO_DIR/Caddyfile.weered" /etc/caddy/Caddyfile
systemctl enable caddy
systemctl restart caddy
ok "caddy running"

# ── .env files ───────────────────────────────────────────────
log ""
log "─────────────────────────────────────────────────────"
log "MANUAL STEP: Create your .env files before first deploy"
log ""
log "  $REPO_DIR/apps/api/.env"
log "  → copy from apps/api/.env.example and fill in secrets"
log ""
log "  $REPO_DIR/apps/web/.env.local"
log "  → copy from apps/web/.env.local.example and set API URLs"
log ""
log "Then run: bash $REPO_DIR/server-deploy.sh main"
log "─────────────────────────────────────────────────────"

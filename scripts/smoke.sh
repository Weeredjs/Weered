#!/bin/bash
# Read-only smoke test across the core platform. No deploys, no mutations,
# no restarts. Just probes the surfaces that matter.

set -uo pipefail

API=http://127.0.0.1:4000
PUB=https://weered.ca
PASS=0; FAIL=0; WARN=0
RED=$'\e[31m'; GRN=$'\e[32m'; YEL=$'\e[33m'; CLR=$'\e[0m'

ok()   { echo -e "${GRN}✓${CLR}  $*"; PASS=$((PASS+1)); }
fail() { echo -e "${RED}✗${CLR}  $*"; FAIL=$((FAIL+1)); }
warn() { echo -e "${YEL}!${CLR}  $*"; WARN=$((WARN+1)); }
hdr()  { echo; echo "── $* ──"; }

# Helper: HTTP probe expecting 200
probe200() {
  local url="$1" label="${2:-$1}"
  local code=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 10 "$url")
  if [ "$code" = "200" ]; then ok "$label  →  $code"
  else fail "$label  →  $code"; fi
}

# Helper: HTTP probe with JSON validation
probeJson() {
  local url="$1" jqExpr="$2" label="${3:-$1}"
  local body=$(curl -sS --max-time 10 "$url")
  if [ -z "$body" ]; then fail "$label  → empty body"; return; fi
  if echo "$body" | jq -e "$jqExpr" >/dev/null 2>&1; then ok "$label  → $(echo "$body" | jq -c "$jqExpr" 2>/dev/null | head -c 80)"
  else fail "$label  → JSON mismatch ($(echo "$body" | head -c 80))"; fi
}

# ════════════════════════════════════════════════════════════════════════
hdr "TIER 1 — PUBLIC SURFACES"
probe200 "$PUB"                              "weered.ca homepage"
probe200 "$PUB/home"                         "/home"
probe200 "$PUB/lobby/windrose"               "/lobby/windrose"
probe200 "$PUB/lobby/helldivers2"            "/lobby/helldivers2"
probe200 "$PUB/lobby/dnd"                    "/lobby/dnd"
probe200 "$PUB/lobby/fakeout"                "/lobby/fakeout"
probe200 "$PUB/lobby/destiny2"               "/lobby/destiny2"
probe200 "$PUB/lobby/poker"                  "/lobby/poker"
probe200 "$PUB/why-not-discord"              "/why-not-discord"

hdr "TIER 1b — SHELL ROUTING (bare vs app-shell)"
# Bare pages (legal + auth flows) must NOT render the app shell, or they get
# trapped in the viewport-locked .weered-shell and never scroll (the /terms
# regression, fixed 2026-05-31 via NO_SHELL_ROUTES). App pages MUST render it.
_shell_marker="weered-center"
check_bare() {
  local body=$(curl -sS --max-time 10 "$PUB$1")
  if echo "$body" | grep -q "$_shell_marker"; then fail "$1 renders app shell (would NOT scroll) — should be bare"
  else ok "$1 is bare (scrolls)"; fi
}
check_shell() {
  local body=$(curl -sS --max-time 10 "$PUB$1")
  if echo "$body" | grep -q "$_shell_marker"; then ok "$1 renders app shell (expected)"
  else fail "$1 missing app shell"; fi
}
for p in /terms /privacy /guidelines /forgot-password /reset-password /verify-email; do check_bare "$p"; done
check_shell /home

hdr "TIER 1 — API ENDPOINTS"
probeJson "$API/lobbies"                     '.ok and (.lobbies | length) > 0'                "GET /lobbies (full list)"
probeJson "$API/lobbies/windrose"            '.ok and .lobby.id == "windrose"'                 "GET /lobbies/windrose"
probeJson "$API/lobbies/helldivers2"         '.ok and .lobby.moduleType == "HELLDIVERS2"'      "GET /lobbies/helldivers2"
probeJson "$API/public/activity"             '.ok and (.events | type == "array")'             "GET /public/activity"
probeJson "$API/windrose/builds"             '.ok and (.builds | type == "array")'             "GET /windrose/builds"
probeJson "$API/windrose/builds/featured"    '.ok and (.builds | type == "array")'             "GET /windrose/builds/featured"
probeJson "$API/helldivers/war"              '.ok'                                              "GET /helldivers/war"
probeJson "$API/helldivers/major-orders"     '.ok'                                              "GET /helldivers/major-orders"
probeJson "$API/helldivers/dispatches"       '.ok'                                              "GET /helldivers/dispatches"
probeJson "$API/helldivers/campaigns"        '.ok'                                              "GET /helldivers/campaigns"
probeJson "$API/helldivers/stratagems"       '.ok and (.stratagems | length) >= 50'             "GET /helldivers/stratagems"
probeJson "$API/helldivers/loadouts"         '.ok'                                              "GET /helldivers/loadouts"
probeJson "$API/steam/players/553850"        '.ok and (.count | type == "number")'              "Steam HD2 player count"
probeJson "$API/steam/players/3041230"       '.ok and (.count | type == "number")'              "Steam Windrose player count"
probeJson "$API/steam/playing/553850"        '.ok and (.items | type == "array")'               "Steam playing/553850"

# ════════════════════════════════════════════════════════════════════════
hdr "TIER 2 — PROCESS HEALTH"
PM2_API_UP=$(pm2 jlist 2>/dev/null | jq -r '.[] | select(.name=="weered-api") | .pm2_env.status' 2>/dev/null)
PM2_WEB_UP=$(pm2 jlist 2>/dev/null | jq -r '.[] | select(.name=="weered-web") | .pm2_env.status' 2>/dev/null)
PM2_API_RESTARTS=$(pm2 jlist 2>/dev/null | jq -r '.[] | select(.name=="weered-api") | .pm2_env.restart_time' 2>/dev/null)
PM2_WEB_RESTARTS=$(pm2 jlist 2>/dev/null | jq -r '.[] | select(.name=="weered-web") | .pm2_env.restart_time' 2>/dev/null)
PM2_API_MEM=$(pm2 jlist 2>/dev/null | jq -r '.[] | select(.name=="weered-api") | .monit.memory' 2>/dev/null)
PM2_WEB_MEM=$(pm2 jlist 2>/dev/null | jq -r '.[] | select(.name=="weered-web") | .monit.memory' 2>/dev/null)
PM2_API_UPTIME=$(pm2 jlist 2>/dev/null | jq -r '.[] | select(.name=="weered-api") | .pm2_env.pm_uptime' 2>/dev/null)
PM2_WEB_UPTIME=$(pm2 jlist 2>/dev/null | jq -r '.[] | select(.name=="weered-web") | .pm2_env.pm_uptime' 2>/dev/null)
NOW=$(date +%s%3N)

if [ "$PM2_API_UP" = "online" ]; then
  age_s=$(( (NOW - PM2_API_UPTIME) / 1000 ))
  mem_mb=$(( PM2_API_MEM / 1024 / 1024 ))
  ok "weered-api online · ${mem_mb}MB · uptime ${age_s}s · $PM2_API_RESTARTS restarts"
else fail "weered-api status: $PM2_API_UP"; fi

if [ "$PM2_WEB_UP" = "online" ]; then
  age_s=$(( (NOW - PM2_WEB_UPTIME) / 1000 ))
  mem_mb=$(( PM2_WEB_MEM / 1024 / 1024 ))
  ok "weered-web online · ${mem_mb}MB · uptime ${age_s}s · $PM2_WEB_RESTARTS restarts"
else fail "weered-web status: $PM2_WEB_UP"; fi

# Recent error volume (last 5 min, excluding known noisy upstream failures)
ERR_COUNT=$(pm2 logs weered-api --nostream --lines 500 --err 2>&1 | \
  grep -ciE 'error|throw|uncaught|unhandled' | head -1)
ERR_NOISE=$(pm2 logs weered-api --nostream --lines 500 --err 2>&1 | \
  grep -ciE '\[news\]|reuters|cbc|ENOTFOUND|ETIMEDOUT' | head -1)
REAL_ERRS=$((ERR_COUNT - ERR_NOISE))
if [ "$REAL_ERRS" -lt 10 ]; then ok "api error log clean ($REAL_ERRS non-noise errors in last 500 lines, $ERR_NOISE upstream-fetch noise filtered)"
elif [ "$REAL_ERRS" -lt 30 ]; then warn "api error log: $REAL_ERRS non-noise errors in last 500 lines"
else fail "api error log: $REAL_ERRS non-noise errors — investigate"; fi

# Disk usage on /opt
DISK_PCT=$(df /opt 2>/dev/null | awk 'NR==2 {gsub("%",""); print $5}')
if [ -n "$DISK_PCT" ] && [ "$DISK_PCT" -lt 80 ]; then ok "/opt disk usage ${DISK_PCT}%"
elif [ -n "$DISK_PCT" ] && [ "$DISK_PCT" -lt 90 ]; then warn "/opt disk usage ${DISK_PCT}%"
else fail "/opt disk usage ${DISK_PCT:-unknown}%"; fi

# ════════════════════════════════════════════════════════════════════════
hdr "TIER 3 — AUTH + WS ROUND TRIP"
DEV_USER="smoke-$(date +%s)"
TOKEN_RES=$(curl -sS --max-time 10 -X POST "$API/auth/dev-login" \
  -H "Content-Type: application/json" -d "{\"username\":\"$DEV_USER\"}")
TOKEN=$(echo "$TOKEN_RES" | jq -r '.token // empty')
USER_ID=$(echo "$TOKEN_RES" | jq -r '.user.id // empty')
if [ -n "$TOKEN" ] && [ "$TOKEN" != "null" ]; then ok "dev-login → token issued for $DEV_USER ($USER_ID)"
elif echo "$TOKEN_RES" | grep -q "not_found"; then warn "dev-login disabled in prod (expected since 2026-05-29 hardening) — auth round-trip skipped"
else fail "dev-login failed: $TOKEN_RES"; fi

# Auth-gated /notoriety/me with token (validates token is accepted)
if [ -n "$TOKEN" ]; then
  ME_RES=$(curl -sS --max-time 10 "$API/notoriety/me" -H "Authorization: Bearer $TOKEN")
  ME_OK=$(echo "$ME_RES" | jq -r '.ok // empty')
  if [ "$ME_OK" = "true" ]; then ok "/notoriety/me round-trip (token valid)"
  else fail "/notoriety/me round-trip: $(echo "$ME_RES" | head -c 100)"; fi
fi

# Auth-gated endpoints respond appropriately to no-auth
for ep in /notoriety/me /steam/owned/553850 /steam/achievements/553850; do
  code=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 10 "$API$ep")
  if [ "$code" = "401" ]; then ok "$ep returns 401 without auth (expected)"
  elif [ "$code" = "200" ]; then warn "$ep returns 200 without auth (may be intentional for some, double-check)"
  else fail "$ep returns $code without auth"; fi
done

# WebSocket on port 4001, authed via { type: "auth:hello", token } message.
if command -v node >/dev/null 2>&1 && [ -n "$TOKEN" ]; then
  WS_PORT=$(grep ^WS_PORT /opt/weered/apps/api/.env 2>/dev/null | cut -d'=' -f2- | tr -d ' "')
  WS_PORT=${WS_PORT:-4001}
  WS_RESULT=$(cd /opt/weered/apps/api && WSTOK="$TOKEN" WS_PORT="$WS_PORT" node -e '
    const WebSocket = require("ws");
    const ws = new WebSocket("ws://127.0.0.1:" + (process.env.WS_PORT || "4001"));
    const timer = setTimeout(() => { console.log("WS_TIMEOUT"); try{ws.terminate();}catch(e){}; process.exit(); }, 6000);
    ws.on("open", () => {
      console.log("WS_OPEN");
      ws.send(JSON.stringify({ type: "auth:hello", token: process.env.WSTOK }));
    });
    ws.on("message", (data) => {
      console.log("WS_MSG:" + data.toString().slice(0, 200));
      clearTimeout(timer);
      ws.close();
      process.exit();
    });
    ws.on("error", e => { console.log("WS_ERR:" + (e.message || e)); clearTimeout(timer); process.exit(); });
  ' 2>&1)
  if echo "$WS_RESULT" | grep -q "WS_MSG:"; then ok "WebSocket: opened, auth:hello acknowledged"
  elif echo "$WS_RESULT" | grep -q "WS_OPEN"; then ok "WebSocket: opened (no message in 6s — likely fine, server is silent on auth success)"
  elif echo "$WS_RESULT" | grep -q "WS_TIMEOUT"; then warn "WebSocket: connect timeout"
  else fail "WebSocket: $(echo "$WS_RESULT" | tail -3 | tr '\n' ' ')"; fi
fi

# ════════════════════════════════════════════════════════════════════════
hdr "TIER 4 — BACKGROUND WORKERS"
LOG=$(pm2 logs weered-api --nostream --lines 1500 2>&1)
check_worker() {
  local label="$1" pattern="$2"
  if echo "$LOG" | grep -iE "$pattern" | tail -1 | grep -q .; then ok "worker: $label"
  else warn "no recent log signal for: $label"; fi
}
check_worker "Steam Rich Presence poller"      "Steam Rich Presence|presence.*polled|pollSteamPresence"
check_worker "Helldivers worker (10-min poll)" "helldivers.*worker|hd2.*worker|active campaigns|campaign:room"
check_worker "Lobby seeder (boot)"              "lobbies seeded"
check_worker "Feed worker (RSS)"                "feed.*worker.*done|\\[feed\\]"
check_worker "News worker (RSS)"                "newsWorker|\\[news\\].*upserted"
check_worker "Challenge worker"                 "challenge.*worker|\\[challenge\\]"

# Activity ticker buffer — should have entries (synthetic seeder primes 5)
ACT_COUNT=$(curl -sS --max-time 10 "$API/public/activity" | jq -r '.events | length' 2>/dev/null)
if [ "${ACT_COUNT:-0}" -gt 0 ]; then ok "activity ticker has $ACT_COUNT events"
else warn "activity ticker is empty (synthetic seeder should re-fill within 32s)"; fi

# ════════════════════════════════════════════════════════════════════════
hdr "TIER 5 — LIVEKIT"
# Env vars present
LK_URL=$(grep -E '^LIVEKIT_(URL|HOST)=' /opt/weered/apps/api/.env | head -1 | cut -d'=' -f2-)
LK_KEY=$(grep -E '^LIVEKIT_API_KEY=' /opt/weered/apps/api/.env | head -1)
LK_SEC=$(grep -E '^LIVEKIT_API_SECRET=' /opt/weered/apps/api/.env | head -1)
if [ -n "$LK_KEY" ] && [ -n "$LK_SEC" ] && [ -n "$LK_URL" ]; then
  ok "LiveKit env: URL=${LK_URL}, API_KEY+SECRET set"
else
  fail "LiveKit env missing — KEY=${LK_KEY:+present} SECRET=${LK_SEC:+present} URL=${LK_URL:-MISSING}"
fi

# Token endpoint (auth-gated)
if [ -n "$TOKEN" ]; then
  LK_TOK_RES=$(curl -sS --max-time 10 -X POST "$API/voice/token" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"roomId":"smoke-test-room"}')
  if echo "$LK_TOK_RES" | jq -e '.token | type == "string" and length > 50' >/dev/null 2>&1; then
    ok "LiveKit token issued for test room"
  elif echo "$LK_TOK_RES" | jq -e '.url' >/dev/null 2>&1; then
    ok "LiveKit token endpoint responded with config"
  else
    warn "LiveKit /voice/token: $(echo "$LK_TOK_RES" | head -c 200)"
  fi
fi

# LiveKit signal reachability (the wss:// host should be HTTPS-reachable
# for the HTTP info endpoint, even though client traffic is wss)
if [ -n "$LK_URL" ]; then
  LK_HOST=$(echo "$LK_URL" | sed -E 's,^wss?://,,;s,/.*,,')
  LK_HEALTH=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 10 "https://$LK_HOST" 2>/dev/null || echo "000")
  if [ "$LK_HEALTH" != "000" ]; then ok "LiveKit signal host reachable ($LK_HOST → $LK_HEALTH)"
  else warn "LiveKit signal host unreachable ($LK_HOST)"; fi
fi

# ════════════════════════════════════════════════════════════════════════
hdr "TIER 6 — THIRD-PARTY INTEGRATIONS"
# Steam (no key required for player count)
probeJson "https://api.steampowered.com/ISteamUserStats/GetNumberOfCurrentPlayers/v1/?appid=553850" \
  '.response.player_count | type == "number"' "Steam HD2 (live, no-key)"

# Helldivers community API (requires X-Super-Client + Contact headers)
HD2_TEST=$(curl -sS --max-time 10 -H "X-Super-Client: Weered" -H "X-Super-Contact: james@weered.ca" \
  "https://api.helldivers2.dev/api/v1/war")
if echo "$HD2_TEST" | jq -e '.statistics' >/dev/null 2>&1; then ok "Helldivers community API /war (live)"
else warn "Helldivers community API: $(echo "$HD2_TEST" | head -c 100)"; fi

# Twitch Helix (token-only check via env presence — actual call needs OAuth flow)
TW_ID=$(grep -E '^TWITCH_CLIENT_ID=' /opt/weered/apps/api/.env | head -1 | cut -d'=' -f2-)
TW_SEC=$(grep -E '^TWITCH_CLIENT_SECRET=' /opt/weered/apps/api/.env | head -1 | cut -d'=' -f2-)
if [ -n "$TW_ID" ] && [ -n "$TW_SEC" ]; then ok "Twitch Helix: env credentials present"
else warn "Twitch Helix: env credentials missing"; fi

# Bungie (env)
BG_KEY=$(grep -E '^BUNGIE_API_KEY=' /opt/weered/apps/api/.env | head -1 | cut -d'=' -f2-)
if [ -n "$BG_KEY" ]; then ok "Bungie API: env key present"
else warn "Bungie API: env key missing"; fi

# Resend (env)
RS_KEY=$(grep -E '^RESEND_API_KEY=' /opt/weered/apps/api/.env | head -1 | cut -d'=' -f2-)
if [ -n "$RS_KEY" ]; then ok "Resend (email): env key present"
else fail "Resend: env key MISSING — email is broken"; fi

# Anthropic (Operator + AI features)
AN_KEY=$(grep -E '^ANTHROPIC_API_KEY=' /opt/weered/apps/api/.env | head -1 | cut -d'=' -f2-)
if [ -n "$AN_KEY" ]; then ok "Anthropic (Operator AI): env key present"
else warn "Anthropic env key missing — Operator commentary will silently fail"; fi

# ════════════════════════════════════════════════════════════════════════
hdr "TIER 7 — DATABASE"
# Use the actual DATABASE_URL the API uses, since the connection string
# encodes the database name (which is literally "=public" — see Tier 8 finding).
DBURL=$(grep ^DATABASE_URL /opt/weered/apps/api/.env | cut -d'=' -f2-)

USER_COUNT=$(psql "$DBURL" -tAc 'SELECT count(*) FROM "User";' 2>/dev/null)
LOBBY_COUNT=$(psql "$DBURL" -tAc 'SELECT count(*) FROM "Lobby";' 2>/dev/null)
ROOM_COUNT=$(psql "$DBURL" -tAc 'SELECT count(*) FROM "Room";' 2>/dev/null)
BUILD_COUNT=$(psql "$DBURL" -tAc 'SELECT count(*) FROM "WindroseBuild";' 2>/dev/null)
DM_COUNT=$(psql "$DBURL" -tAc 'SELECT count(*) FROM "DirectMessage";' 2>/dev/null)
CREW_COUNT=$(psql "$DBURL" -tAc 'SELECT count(*) FROM "Crew";' 2>/dev/null)
ACTIVE_USERS=$(psql "$DBURL" -tAc "SELECT count(*) FROM \"User\" WHERE \"updatedAt\" > NOW() - INTERVAL '7 days';" 2>/dev/null)
NEW_USERS_24H=$(psql "$DBURL" -tAc "SELECT count(*) FROM \"User\" WHERE \"createdAt\" > NOW() - INTERVAL '24 hours';" 2>/dev/null)
ACTIVE_DB=$(psql "$DBURL" -tAc 'SELECT current_database();' 2>/dev/null)

ok "active database: $ACTIVE_DB"
[ -n "$USER_COUNT" ] && ok "users: $USER_COUNT total ($ACTIVE_USERS active 7d, +$NEW_USERS_24H new 24h)" || fail "DB: User count failed"
[ -n "$LOBBY_COUNT" ] && ok "lobbies: $LOBBY_COUNT" || fail "DB: Lobby count failed"
[ -n "$ROOM_COUNT" ] && ok "rooms: $ROOM_COUNT" || fail "DB: Room count failed"
[ -n "$BUILD_COUNT" ] && ok "windrose builds: $BUILD_COUNT" || fail "DB: WindroseBuild count failed"
[ -n "$DM_COUNT" ] && ok "DMs: $DM_COUNT" || fail "DB: DM count failed"
[ -n "$CREW_COUNT" ] && ok "crews: $CREW_COUNT" || fail "DB: Crew count failed"

hdr "TIER 8 — HOUSEKEEPING FINDINGS"
# Detect the dual-DB situation
OTHER_DB_USERS=$(PGPASSWORD=$(echo "$DBURL" | sed -E 's,.*://[^:]+:([^@]+)@.*,\1,') \
  psql -h 127.0.0.1 -U weered -d weered -tAc 'SELECT count(*) FROM "User";' 2>/dev/null)
if [ -n "$OTHER_DB_USERS" ] && [ "$OTHER_DB_USERS" != "0" ]; then
  warn "Stale 'weered' DB also populated ($OTHER_DB_USERS users). Active DB is '$ACTIVE_DB'. Worth dropping the unused 'weered' database when convenient."
fi

# ════════════════════════════════════════════════════════════════════════
echo
echo "═══════════════════════════════════════════════════════════════════"
echo " SMOKE COMPLETE  ·  ${GRN}${PASS} pass${CLR}  ·  ${YEL}${WARN} warn${CLR}  ·  ${RED}${FAIL} fail${CLR}"
echo "═══════════════════════════════════════════════════════════════════"
[ "$FAIL" -eq 0 ]

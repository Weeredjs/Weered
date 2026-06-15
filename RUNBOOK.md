# Weered — Operations Runbook ("Go Bag")

The manual for keeping Weered alive **without any developer or AI assistance.** Everything here is verified against the live system as of 2026-06-14. If you can SSH to the droplet and read this file, you can run, park, or rebuild the platform.

> **The most important fact:** Weered's core does **not** depend on any LLM. If access to AI is lost (banned, unaffordable, or you just pull the key), the platform keeps running — only "The Operator" features go quiet. See [Park Mode](#park-mode) and [LLM independence](#llm-independence).

---

## 0. Control points — accounts you MUST keep access to

Losing any of these is the only thing that can truly take Weered away from you. Keep recovery/2FA for each:

| Account | Controls | If lost |
|---|---|---|
| **DigitalOcean** | The droplet (the whole server) **and** the DNS zone for weered.ca | Total loss of the live box + DNS. The #1 account. |
| **GoDaddy** ("Go Daddy Domains Canada") | Domain registration `weered.ca` (expires **2027-02-16**) | Domain lapses → site unreachable. Renew before expiry. |
| **GitHub** (`Weeredjs/Weered`, private) | All source code (the off-droplet code backup) | Lose code history; droplet copy still works. |
| **Stripe** | Live payments (paid tiers) | Billing stops; platform still runs. |
| **Provider dashboards** | Each API key (see [Key rotation](#key-rotation)) | Individual integrations break; core runs. |

---

## 1. At a glance

- **One server:** DigitalOcean droplet, **142.93.148.29**, Ubuntu 24.04, Node 20, pnpm 10.
- **SSH:** `ssh -i ~/.ssh/weered_do root@142.93.148.29`
- **Code:** `/opt/weered` (pnpm monorepo, git branch `main`, remote `git@github.com:Weeredjs/Weered.git`)
- **App tier (PM2):** `weered-web` (Next.js, :3000) + `weered-api` (Fastify :4000 HTTP + :4001 WebSocket)
- **Data tier (Docker):** `weered_postgres` (:5432), `weered_redis` (:6379), `weered_livekit` (:7880/7881 + UDP 50000-50100)
- **Edge:** Caddy (systemd) — TLS + reverse proxy + CORS, on :80/:443
- **Deploy:** `cd /opt/weered && bash scripts/deploy.sh`
- **Domain/DNS:** registered at GoDaddy; DNS hosted at DigitalOcean (nameservers ns1/2/3.digitalocean.com)

---

## 2. Architecture — what runs where

```
Internet → Caddy (:443/:80, systemd, /etc/caddy/Caddyfile)
   ├─ weered.ca          → 127.0.0.1:3000   weered-web   (PM2, Next.js)
   ├─ www.weered.ca      → 301 → weered.ca
   ├─ api.weered.ca      → 127.0.0.1:4000   weered-api   (PM2, Fastify; CORS handled here at the edge)
   ├─ ws.weered.ca       → 127.0.0.1:4001   weered-api   (WebSocket; HTTP/1.1 only)
   └─ livekit.weered.ca  → 127.0.0.1:7880   weered_livekit (Docker, voice/video)

Docker (cd /opt/weered && docker compose ...):
   weered_postgres  postgres:15-alpine   127.0.0.1:5432   volume weered_pg_data
   weered_redis     redis:7-alpine       127.0.0.1:6379   volume weered_redis_data
   weered_livekit   livekit-server:v1.9  7880/7881 + UDP 50000-50100
```

- **PM2 survives reboot** via systemd unit `pm2-root.service` (`pm2 resurrect` from `/root/.pm2/dump.pm2`). After changing the process list, run `pm2 save`.
- **Docker survives reboot** via `restart: unless-stopped`.
- **Secrets:** `/opt/weered/apps/api/.env` (46 keys, gitignored — NOT in the repo). Web public config: `/opt/weered/apps/web/.env.local` (3 `NEXT_PUBLIC_*` values, baked at build time).

---

## 3. Day-to-day operations

**Deploy a change** (run on the droplet; it does guardrails → web build → restart both → smoke test):
```bash
cd /opt/weered
git pull origin main          # scripts/deploy.sh does NOT pull — do it first
bash scripts/deploy.sh        # full (web + api).   API-only: bash scripts/deploy.sh api
```
Guardrails (`scripts/check.sh`) abort the deploy if the API `tsc --noEmit` has any error or a source file exceeds 1500 lines.

**Restart a stuck service:**
```bash
pm2 restart weered-web --update-env       # or weered-api, or: pm2 restart all
cd /opt/weered && docker compose restart postgres   # or redis / livekit
systemctl reload caddy                    # after Caddyfile edits
```

**Logs / health:**
```bash
pm2 list                                  # process health (use this, not systemctl)
pm2 logs weered-api --lines 50            # or weered-web
curl -s http://127.0.0.1:4000/health      # API health (200 = up)
cd /opt/weered && bash scripts/smoke.sh   # full read-only health check
```

**Gotchas (these will bite you):**
- The API runs the **esbuild bundle** (`node dist/index.js`), not tsx. A `pm2 restart weered-api` rebuilds it automatically (its start script is `pnpm build && node dist/index.js`).
- The web app **must** be rebuilt after any web code change: `cd apps/web && pnpm next build` then restart. `deploy.sh` does this.
- **CORS lives only in Caddy.** Never add `@fastify/cors` or `Access-Control-Allow-Origin` headers in routes — duplicates silently break the browser.
- **Prisma:** use `pnpm prisma db push` (never `migrate deploy` — the migrations dir is empty). Never `prisma generate --no-engine`.
- After `.env` edits, restart with `--update-env` (PM2 reads env at fork time).
- The live `/etc/caddy/Caddyfile` differs from the repo `Caddyfile.weered` (live has the CORS block + www redirect + ws HTTP/1.1). The **live** file is authoritative.

---

## 4. Park Mode

The worst-case plan: registration off, AI dependency cut, server up cheap, indefinitely.

### 4a. Turn off new registrations — ONE CLICK
1. Sign in as a **GOD**-role account, go to **`/staff` → Config tab**.
2. Toggle **Registration Open** → off.

That now closes **both** signup paths (local username/password **and** Google OAuth). Existing users keep logging in normally. (Backup method, no UI: on the droplet, `psql "postgresql://weered:$PGPASSWORD@127.0.0.1:5432/=public" -c "UPDATE \"SiteConfig\" SET value='false' WHERE key='registrationOpen';"` — takes effect immediately, no restart.)

### 4b. <a name="llm-independence"></a>Cut the LLM / AI dependency
**One click, no SSH:** `/staff` → Config → **Operator AI Enabled** → off. Within ~15s the Operator goes silent and **zero LLM calls are made.** Belt-and-suspenders (also stops paying for the key): remove `ANTHROPIC_API_KEY` from `/opt/weered/apps/api/.env` and `pm2 restart weered-api --update-env`.

**Full site-down** (heavier than parking — for emergencies): `/staff` → Config → **Maintenance Mode** → on. Non-staff get a 503 from the API; staff and the login flow still work, so you can always get back in to turn it off.
**What breaks (all fail-soft — they degrade, they don't crash):** The Operator chat (`@operator`/`/ask`), AI lobby search, AI quiz generator, D&D NPC chat, FakeOut trade commentary, Helldivers war commentary, Windrose weekly recap. The "Operator" pseudo-user simply stops appearing.

**What keeps working (everything else):** lobbies, rooms, voice/video (LiveKit), text chat, presence, all game integrations (Destiny/EVE/PoE/League/etc.), payments, auth, notifications, the forum, tournaments. **The AI is a garnish, not a load-bearing wall.**

### 4c. Minimal-cost sustain
- Recurring cost is just the **droplet** + the **domain** (~yearly). No per-use cost in the core.
- With the LLM key removed, there is **zero** AI spend.
- To shed more cost/load, you can stop non-essential background workers, but the default running state is already cheap and stable — it can sit parked indefinitely.

### 4d. Emergency hard stops (if the UI is unreachable)
- Block signups at the edge: add a `respond /auth/register 403` and `respond /auth/google* 403` block to `/etc/caddy/Caddyfile`, `systemctl reload caddy`.
- Take the whole site down: `pm2 stop weered-web weered-api` (blocks everyone, including existing users).

---

## 5. Backups

Three nightly cron jobs on the droplet (`crontab -l`):
| Time | Script | What | Where | Retention |
|---|---|---|---|---|
| 03:15 | `/root/backup-weered-env.sh` | `apps/api/.env` snapshot | `/root/weered-env-backups/` | 14 days |
| 03:30 | `/root/backup-weered-pg.sh` | DB dump + uploads tarball | `/root/weered-pg-backups/` (`*-LATEST` symlinks) | 14 days |
| 03:45 | `/root/weered-checkpoint.sh` | git commit + push any uncommitted working tree | GitHub | — |

Plus a weekly **Claude context** backup (the memory/transcripts) to `/root/claude-context-backups/` via a Windows scheduled task.

**Off-site copy (added 2026-06-14):** a daily Windows scheduled task (**"Weered Offsite Backup Pull"**) pulls the latest DB dump + uploads + both `.env` snapshots + `livekit.yaml` to `~/weered-offsite-backups` on James's machine (keeps last 8). Run manually anytime: `bash "/c/Users/jstir/.claude/backups/pull-weered-backups.sh"`. So a droplet loss no longer takes the only copy with it.

> ⚠️ **Still do:** enable **DigitalOcean droplet snapshots** (DO control panel) as a second, independent copy — the off-site pull lands on one PC; DO snapshots cover the whole box on DO's own infra.

---

## 6. Disaster recovery

### 6a. Restore the database
> ⚠️ **The live database is literally named `=public`** (`DATABASE_URL=...:5432/=public`). A second DB named `weered` exists but is **stale/legacy** — do not use it. `psql -d "=public"` fails; always use the URI form.
```bash
# create it if the box is fresh:
docker exec weered_postgres psql "postgresql://weered@127.0.0.1:5432/postgres" -c 'CREATE DATABASE "=public";'
# restore latest dump:
zcat /root/weered-pg-backups/weered-LATEST.sql.gz | docker exec -i weered_postgres psql "postgresql://weered@127.0.0.1:5432/=public"
# restore uploads:
tar -xzf /root/weered-pg-backups/uploads-LATEST.tar.gz -C /opt/weered/apps/api
```

### 6b. Rebuild on a fresh droplet (whole box lost)
1. Provision Ubuntu 24.04 droplet; add the `weered_do` public key to `/root/.ssh/authorized_keys`.
2. Install Node 20, pnpm, pm2 (+ `pm2 startup systemd`), Caddy, Docker. (`/opt/weered/server-setup.sh` automates most — fix its clone URL to `git@github.com:Weeredjs/Weered.git`.)
3. Clone the repo to `/opt/weered`. Needs a GitHub deploy key / PAT for the SSH remote.
4. Restore `apps/api/.env` (from `/root/weered-env-backups/` or a known copy) and recreate `apps/web/.env.local` (3 `NEXT_PUBLIC_*` values).
5. `cd /opt/weered && docker compose up -d postgres redis livekit` (use `docker-compose.yml`, **not** `compose.resolved.yml` — that one has a Windows path).
6. `CREATE DATABASE "=public";` then restore the SQL dump + uploads (6a).
7. `pnpm install --frozen-lockfile`; `cd apps/api && pnpm prisma generate && pnpm prisma db push`; `cd apps/web && pnpm next build`.
8. `pm2 start "pnpm start" --name weered-api --cwd /opt/weered/apps/api`; `pm2 start "pnpm next start -p 3000" --name weered-web --cwd /opt/weered/apps/web`; `pm2 save`.
9. Install the **live** Caddyfile to `/etc/caddy/Caddyfile`; `systemctl restart caddy`.
10. In **DigitalOcean → Networking → Domains → weered.ca**, point the A records (`@`, `www`, `api`, `ws`, `livekit`) at the new IP. TLS auto-issues via Caddy/Let's Encrypt on first request.
11. Verify: `curl http://127.0.0.1:4000/health` and `https://weered.ca`.

---

## 7. Key rotation

Every secret is in `/opt/weered/apps/api/.env`. Re-issue from the provider, paste in, `pm2 restart weered-api --update-env`:

| Key(s) | Provider |
|---|---|
| `ANTHROPIC_API_KEY` | console.anthropic.com (removable — see Park Mode) |
| `STRIPE_*` (sk_live/pk_live/webhook) | dashboard.stripe.com |
| `GOOGLE_CLIENT_ID/SECRET`, `YOUTUBE_API_KEY` | Google Cloud Console |
| `BUNGIE_*` | bungie.net/en/Application |
| `RIOT_API_KEY` | developer.riotgames.com (prod key needed; dev keys expire daily) |
| `STEAM_API_KEY` | steamcommunity.com/dev/apikey |
| `TWITCH_CLIENT_ID/SECRET` | dev.twitch.tv/console |
| `EVE_*`, `POE_*`, `PUBG_API_KEY`, `OPENXBL_API_KEY`, `NEXUSMODS_API_KEY` | each game's dev portal |
| `RESEND_API_KEY` / `SMTP_*` | resend.com / mail host (mail.weered.ca, Plesk) |
| `LIVEKIT_API_KEY/SECRET` | **self-hosted** — must match `keys:` in `/opt/weered/services/livekit/livekit.yaml`, then restart the livekit container (not a dashboard) |
| `VAPID_*` | self-generated (`npx web-push generate-vapid-keys`); rotating invalidates push subs |
| `JWT_SECRET` | self-chosen; rotating logs out all users |

---

## 8. Known gaps / hardening TODO

- **Off-site backups** (section 5) — partially closed: a daily off-site pull now copies the DB + secrets to James's machine. Remaining: enable DigitalOcean droplet snapshots for a second independent copy.
- **`weered-web` has a very high PM2 restart count** — possible crash-loop; check `/root/.pm2/logs/weered-web-error.log`.
- **LiveKit `livekit.yaml`** has `node_ip: 192.168.0.106` + `use_external_ip: false` (a stale LAN value) — may break voice for some clients; set to the droplet's public IP / `use_external_ip: true` and confirm voice works.
- **`maintenanceMode`** is now wired (API-level: non-staff get 503 when on; `/staff`, `/auth/*`, `/health` always pass). It gates the **API**, so the Next.js page shell still renders for non-staff but can't load data — a dedicated web maintenance page would be a further nicety.
- **Stale `weered` database** alongside the live `=public` — drop it when convenient to avoid confusion.
- **Helldivers war endpoints** depend on an external community API that intermittently times out (the 4 smoke fails) — cosmetic, self-heals.
- `ufw` is inactive — inbound filtering relies on the DigitalOcean cloud firewall; confirm 4000/4001/3000/5432/6379 aren't publicly reachable.

---

*Verified 2026-06-14. Live ops facts (IP, ports, paths, the `=public` DB name, the Caddy live-vs-repo difference) confirmed against the running droplet.*

# Deploying Weered

## Every deploy (one line)

```powershell
.\deploy.ps1
```

That's it. It pushes your current branch and the server pulls, builds, and restarts. Walk away.

---

## What happens automatically

1. `git push` your branch to origin
2. SSH into the droplet, run `server-deploy.sh`
3. `pnpm install` (frozen lockfile, no surprises)
4. `prisma migrate deploy` (safe — skips already-run migrations)
5. `next build`
6. `pm2 reload` (zero-downtime restart)
7. Healthcheck on `http://127.0.0.1:4000/health` — exits with error if it never goes green

---

## One-time setup (fresh droplet only)

```bash
# On the droplet
bash /opt/weered/server-setup.sh
```

Then manually create your `.env` files — see the script output for exact paths.

---

## Files

| File | Purpose |
|------|---------|
| `deploy.ps1` | Run locally on Windows to deploy |
| `deploy.sh` | Run locally on Mac/Linux to deploy |
| `server-deploy.sh` | Lives on the droplet at `/opt/weered/server-deploy.sh` |
| `server-setup.sh` | Run once on a fresh droplet |

---

## If a deploy fails

```powershell
# Check logs
ssh -i $env:USERPROFILE\.ssh\weered_do root@weered.ca pm2 logs weered-api

# Rollback to last good commit
ssh -i $env:USERPROFILE\.ssh\weered_do root@weered.ca "cd /opt/weered && git revert HEAD && bash server-deploy.sh"
```

---

## PM2 cheat sheet (run on the droplet)

```bash
pm2 list                  # see all processes
pm2 logs weered-api       # tail api logs
pm2 logs weered-web       # tail next.js logs
pm2 restart weered-api    # hard restart
pm2 reload weered-api     # zero-downtime reload
```

---

## Infra (postgres / redis / livekit)

These run in Docker and are **not** restarted on deploy — they're persistent.

```bash
# Start infra (only needed once, they auto-restart via docker)
cd /opt/weered && docker compose up -d postgres redis livekit

# Check infra
docker compose ps
```

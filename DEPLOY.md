# Deploying Weered

## Every deploy

From your local machine (Mac / Linux / Windows git-bash):

```bash
./deploy.sh            # deploys the current branch
./deploy.sh main       # deploys a specific branch
```

This pushes your branch, SSHes into the droplet, and runs the canonical
guardrailed deploy. Or, straight on the droplet:

```bash
cd /opt/weered && git pull && bash scripts/deploy.sh
```

`scripts/deploy.sh` is the single source of truth for how we ship.

---

## What happens automatically

`scripts/deploy.sh` runs, in order, and aborts on any failure:

1. **Guardrails** (`scripts/check.sh`) — API `tsc --noEmit` gate (must be 0) + the
   file-size tripwire. A type error or a new god-file can't reach production.
2. **Web build** (`next build`) — also the web type gate.
3. **pm2 restart** `weered-web` then `weered-api`. The API's `pnpm start` rebuilds
   the esbuild bundle (`dist/`) on restart, so no separate API build step.
4. **Smoke test** (`scripts/smoke.sh`) — health, auth + WS round-trip, key
   endpoints. Surfaces a bad deploy immediately.

`api`-only variant (skip the web build): `bash scripts/deploy.sh api`.

---

## Schema changes

This project deploys schema with **`prisma db push`**, not migrations (there is
no migrations directory — `prisma migrate deploy` is not used). When the Prisma
schema changes:

```bash
cd /opt/weered/apps/api && pnpm prisma db push && pnpm prisma generate
```

Then run a normal deploy. (Never use `prisma generate --no-engine` — local
Postgres needs the Rust engine.)

---

## One-time setup (fresh droplet only)

```bash
bash /opt/weered/server-setup.sh
```

Then create the `.env` files manually — see the script output for exact paths.

---

## Files

| File | Purpose |
|------|---------|
| `scripts/deploy.sh` | **The deploy engine.** Guardrails → web build → pm2 restart → smoke. Run on the droplet. |
| `scripts/check.sh` | Guardrails (tsc gate + file-size tripwire), run by deploy.sh. |
| `scripts/smoke.sh` | Post-deploy smoke test, run by deploy.sh. |
| `deploy.sh` | Local convenience: push branch + SSH + run `server-deploy.sh`. |
| `server-deploy.sh` | On the droplet: git pull, then hand off to `scripts/deploy.sh`. |
| `server-setup.sh` | Run once on a fresh droplet. |

---

## If a deploy fails

```bash
# Check logs
ssh -i ~/.ssh/weered_do root@weered.ca pm2 logs weered-api

# Rollback to the last good commit
ssh -i ~/.ssh/weered_do root@weered.ca "cd /opt/weered && git revert --no-edit HEAD && bash scripts/deploy.sh"
```

---

## PM2 cheat sheet (run on the droplet)

```bash
pm2 list                  # all processes
pm2 logs weered-api       # tail api logs
pm2 logs weered-web       # tail next.js logs
pm2 restart weered-api    # restart (rebuilds the esbuild bundle)
```

---

## Infra (postgres / livekit)

These run in Docker and are **not** restarted on deploy — they're persistent.
(There is no Redis — Weered is single-node by design; see SCALING.md.)

```bash
cd /opt/weered && docker compose up -d postgres livekit   # only needed once
docker compose ps
```

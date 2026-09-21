# Weered — repo guide

Four clients, one API, one shared types package.

## Layout

```
apps/
  api/        Fastify 5 + Prisma. Single source of truth for data + business rules.
  web/        Next.js 15. Primary client, deployed at weered.ca.
  mobile/     React Native 0.83 + Expo SDK 55. Loads via Expo Go in dev.
  desktop/    Tauri 2 + Rust shell. Loads weered.ca in a native webview.
  mod/        Weered Connect — Fabric mod (Minecraft 1.21.x), shipped via Modrinth.
packages/
  shared/     TypeScript types/constants imported by all clients.
scripts/
  check.sh    Guardrails: API type gate + file-size tripwire.
  deploy.sh   The canonical deploy.
  smoke.sh    Post-deploy smoke suite (~60 checks across 8 tiers).
  local/      Self-contained local stack — see scripts/local/README.md.
```

## The architectural rule

- **Business logic lives in the API.** Permissions, scoring, the paper economy, friend logic, lobby joining, notoriety — every rule is server-side, across `apps/api/src/routes/*` (top-level setup + WebSocket still live in `src/index.ts`). Clients render and submit; they never decide.
- **Shared types live in `packages/shared`.** If a type appears in two or more clients, move it there. The API stays the source of truth; `packages/shared` mirrors its response shapes.
- **Keep the API backwards-compatible.** Never break old clients — add `field_v2` next to `field` and deprecate slowly. Mobile and older desktop shells update on their own schedule.

## Quickstart

Requires Node and pnpm (`pnpm@10.29.3`, pinned via `packageManager`) plus Docker for the backing services.

```bash
pnpm install
pnpm infra:up          # postgres + redis + livekit in Docker
cd apps/api && pnpm prisma generate && pnpm prisma db push --skip-generate
```

Then, from the repo root:

| Command          | What it runs                               |
| ---------------- | ------------------------------------------ |
| `pnpm web`       | Next.js dev server on :3000                |
| `pnpm mobile`    | Expo Go                                    |
| `pnpm desktop`   | Tauri dev shell                            |
| `pnpm typecheck` | `scripts/check.sh` — the same gate CI runs |
| `pnpm lint`      | ESLint                                     |
| `pnpm format`    | Prettier across the repo                   |

The API runs from `apps/api` with `pnpm dev` (tsx watch).

**Testing against realistic data without touching production** — a separate Postgres on its own port, the API and web running natively, and a same-origin proxy so session cookies work: see [`scripts/local/README.md`](./scripts/local/README.md). Browse it at `http://bar.localhost:8080`, never `localhost:3000`; the auth cookie is why.

## Testing

| Scope           | Command                    | Notes                                        |
| --------------- | -------------------------- | -------------------------------------------- |
| API unit        | `cd apps/api && pnpm test` | Vitest, `test/unit`                          |
| API integration | `pnpm test:integration`    | Vitest against a real Postgres               |
| API smoke       | `pnpm test:smoke`          | Hits a running API; `:local` targets :4000   |
| Web unit        | `cd apps/web && pnpm test` | Vitest + Testing Library                     |
| Web E2E         | `pnpm test:e2e`            | Playwright (`apps/web/playwright.config.ts`) |
| Coverage        | `pnpm test:coverage`       | Either app                                   |

Coverage is deliberately not a merge gate — see the note in the README's _Code quality_ section.

## CI

Three workflows in `.github/workflows/`:

- **`ci.yml`** — `check` (Prisma generate → guardrails → Next.js build as the web type gate → unit tests → non-blocking lint) and `integration` (schema pushed to a throwaway Postgres, then the integration suite).
- **`e2e.yml`** — builds the API and web against a CI database and runs Playwright.
- **`desktop-release.yml`** — cross-platform Tauri installer builds.

## Release cadence

| Surface           | What ships when                                                     | Notes                                     |
| ----------------- | ------------------------------------------------------------------- | ----------------------------------------- |
| **API**           | Every push → deploy on droplet                                      | Instant. Affects all clients.             |
| **Web**           | Every push → deploy on droplet                                      | Instant.                                  |
| **Desktop shell** | Same URL → instant. New installer only when the Rust shell changes. | Rare (1–2× / quarter).                    |
| **Mobile JS**     | Push → Expo EAS Update (when wired)                                 | Same-day, no store review.                |
| **Mobile binary** | Only when native modules change                                     | Store review (~24h iOS, instant Android). |

## Ship-a-feature workflow

1. **API first** — add the endpoint/field, push, deploy. All clients now have it available.
2. **Update `packages/shared`** if the response shape changed; TypeScript flags which clients need updating.
3. **Web UI** in `apps/web`. Push, deploy. Desktop gets it for free (it loads the URL).
4. **Mobile UI catch-up** in `apps/mobile`. EAS update or restart Metro for dev.

## Deploy

One command (guardrails → web build → restart both → smoke test):

```bash
bash scripts/deploy.sh        # full
bash scripts/deploy.sh api    # API only
```

`server-deploy.sh` is the droplet-side entry point — it pulls the branch, then delegates to `scripts/deploy.sh`, which stays canonical. On the box: `bash server-deploy.sh main`.

Guardrails (`scripts/check.sh`) gate every deploy: the API `tsc --noEmit` must be clean, and **no new source file may exceed 1500 lines** (existing offenders are baselined, so the tripwire only catches growth). Runtime: the API is esbuild-bundled to `dist/` and run with Node (`pnpm start` = build + `node dist/index.js`); the web app is `next build` + `next start`; both run under PM2. `scripts/smoke.sh` runs afterwards — around 60 checks over eight tiers, and it is worth more than the deploy script's own exit code.

Desktop installer (from a VS Developer PowerShell, MSVC required):

```powershell
cd apps/desktop && pnpm tauri build
# → src-tauri/target/release/bundle/{nsis,msi}/Weered_*.{exe,msi}
```

Mobile (Expo Go dev): `cd apps/mobile && pnpm start:go`.

## Common gotchas

- **NativeWind on mobile**: classNames silently drop layout properties when an element also has a `style` prop. For layout-critical props (flex-row, bg, padding) use inline `style={{ ... }}`.
- **Web build is `pnpm next build`**, not `pnpm build` (there is no `build` script). PM2 runs it as `pnpm next start -p 3000 -H 127.0.0.1` — the loopback bind is deliberate, because Caddy should be the only thing reachable from outside.
- **Tauri desktop** loads the live site by default (`devUrl: "https://weered.ca"`). To dev against local web, point it at `http://localhost:3000` in `apps/desktop/src-tauri/tauri.conf.json`.
- **News worker** runs every 15 min; first fetch is on boot, cached articles age out at 72h. Restart after adding feeds.
- **Prisma**: use `db push`, never `migrate deploy`. There is no migrations directory, so a schema change must reach the droplet's database _before_ the code that reads it is deployed.
- **Dependency changes need an install on the box.** Neither `scripts/deploy.sh` nor `server-deploy.sh` runs `pnpm install` — they pull, gate, build and restart. A commit that only moves `pnpm-lock.yaml` will therefore deploy green while the old packages keep running. After any dependency change, run `pnpm install --frozen-lockfile` on the droplet _first_, then deploy so the web app rebuilds against the new tree. Check the installed version in `node_modules`, not the lockfile.
- **Smoke-suite worker warnings are a log-window artifact.** Tier 4 looks for worker heartbeats in the last ~500 API log lines; under live traffic those lines span only a couple of minutes, so healthy workers can report "no recent log signal". Check a worker's last real log timestamp before believing it.

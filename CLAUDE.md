# Weered — repo guide for Claude

Three clients, one API, one shared types package.

## Layout

```
apps/
  api/        Fastify + Prisma. Single source of truth for data + business rules.
  web/        Next.js 14. Primary client. Deployed at weered.ca.
  mobile/     React Native + Expo SDK 55. Loads via Expo Go in dev.
  desktop/    Tauri 2 + Rust shell. Loads weered.ca in a native webview.
packages/
  shared/     TypeScript types/constants imported by all clients.
```

## The architectural rule

- **Business logic lives in the API.** Permissions, scoring, paper economy, friend logic, lobby joining, notoriety — every rule is in `apps/api/src/index.ts`. Clients render and submit; they never decide.
- **Shared types live in `packages/shared`.** If a type appears in two or more clients, move it there. The API stays the source of truth — `packages/shared` mirrors its response shapes.
- **Backwards-compatible API.** Never break old clients. Add `field_v2` next to `field`, deprecate slowly. Mobile users update slowly; old desktop shells may be running.

## Release cadence

| Surface | What ships when | Cost |
|---|---|---|
| **API** | Every push → manual deploy on droplet | Free, instant. Affects all clients. |
| **Web** | Every push → manual deploy on droplet | Free, instant. |
| **Desktop shell** | Same URL → instant. New installer only when Rust shell changes. | Rare (1–2× / quarter). |
| **Mobile JS** | Push → Expo EAS Update (when wired) | Same-day, no store review. |
| **Mobile binary** | Only when native modules change | Store review (~24h iOS, instant Android). |

## Standard "ship a feature" workflow

1. **API change first** — add the endpoint or field, push, deploy. All clients now have new behavior available.
2. **Update `packages/shared`** if the response shape changed. TypeScript will tell you which clients need updating.
3. **Web UI** — implement in `apps/web`. Push, deploy. Desktop gets it for free (it loads the URL).
4. **Mobile UI catch-up** — implement in `apps/mobile`. Push, EAS update or restart Metro for dev.
5. Done.

## Deploy commands

**API (Fastify, tsx — no build step):**
```bash
ssh -i ~/.ssh/weered_do root@142.93.148.29 'cd /opt/weered && git pull origin main && pm2 restart weered-api'
```

**Web (Next.js — needs build step):**
```bash
ssh -i ~/.ssh/weered_do root@142.93.148.29 'cd /opt/weered && git pull origin main && cd apps/web && pnpm next build && pm2 restart weered-web'
```

**Desktop installer (release build, ~10-15 min, MSVC required):**
```powershell
# from a VS Developer PowerShell (or use Launch-VsDevShell.ps1):
cd C:\Weered\apps\desktop
pnpm tauri build
# → src-tauri/target/release/bundle/{nsis,msi}/Weered_*.{exe,msi}
```

**Mobile (Expo Go dev):**
```bash
cd apps/mobile
pnpm start:go        # scan QR or hit IP from Expo Go
```

## Common gotchas

- **NativeWind on mobile**: classNames silently drop layout properties when an element ALSO has a `style` prop. For layout-critical things (flex-row, bg, padding), use inline `style={{ ... }}`. Solved cluster of bugs documented across the codebase.
- **Web Next.js needs `pnpm next build`**, not `pnpm build` (no `build` script defined). PM2 runs `pnpm next start -p 3000` directly.
- **API runs `tsx` directly** — no compilation, just restart pm2 after `git pull`.
- **Tauri desktop** loads the LIVE site by default (`devUrl: "https://weered.ca"`). To dev against local web, change to `http://localhost:3000` in `apps/desktop/src-tauri/tauri.conf.json`.
- **News worker** runs every 15 min. After adding new RSS feeds, deploy + restart pm2 — first fetch happens on boot. Cached articles age out at 72 hours.
- **Prisma**: always use `db push`, never `migrate deploy` (per user preference).

## Key memory pointers

- `~/.claude/projects/.../memory/` — auto-memory across sessions. Roadmap, deploy procedures, secrets, etc.
- API handlers all in one file (`apps/api/src/index.ts`, ~13K lines). Use `Grep` to find endpoints.
- Mobile app rewrote almost everything to inline styles — be careful applying className-based patterns; verify they work first.

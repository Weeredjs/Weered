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
```

## The architectural rule

- **Business logic lives in the API.** Permissions, scoring, the paper economy, friend logic, lobby joining, notoriety — every rule is server-side, across `apps/api/src/routes/*` (top-level setup + WebSocket still live in `src/index.ts`). Clients render and submit; they never decide.
- **Shared types live in `packages/shared`.** If a type appears in two or more clients, move it there. The API stays the source of truth; `packages/shared` mirrors its response shapes.
- **Keep the API backwards-compatible.** Never break old clients — add `field_v2` next to `field` and deprecate slowly. Mobile and older desktop shells update on their own schedule.

## Release cadence

| Surface | What ships when | Notes |
|---|---|---|
| **API** | Every push → deploy on droplet | Instant. Affects all clients. |
| **Web** | Every push → deploy on droplet | Instant. |
| **Desktop shell** | Same URL → instant. New installer only when the Rust shell changes. | Rare (1–2× / quarter). |
| **Mobile JS** | Push → Expo EAS Update (when wired) | Same-day, no store review. |
| **Mobile binary** | Only when native modules change | Store review (~24h iOS, instant Android). |

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

Guardrails (`scripts/check.sh`) gate every deploy: the API `tsc --noEmit` must be clean, and no source file may exceed the size tripwire. Runtime: the API is esbuild-bundled to `dist/` and run with Node (`pnpm start` = build + `node dist/index.js`); the web app is `next build` + `next start`; both run under PM2.

Desktop installer (from a VS Developer PowerShell, MSVC required):

```powershell
cd apps/desktop && pnpm tauri build
# → src-tauri/target/release/bundle/{nsis,msi}/Weered_*.{exe,msi}
```

Mobile (Expo Go dev): `cd apps/mobile && pnpm start:go`.

## Common gotchas

- **NativeWind on mobile**: classNames silently drop layout properties when an element also has a `style` prop. For layout-critical props (flex-row, bg, padding) use inline `style={{ ... }}`.
- **Web build is `pnpm next build`**, not `pnpm build` (there is no `build` script). PM2 runs `pnpm next start -p 3000`.
- **Tauri desktop** loads the live site by default (`devUrl: "https://weered.ca"`). To dev against local web, point it at `http://localhost:3000` in `apps/desktop/src-tauri/tauri.conf.json`.
- **News worker** runs every 15 min; first fetch is on boot, cached articles age out at 72h. Restart after adding feeds.
- **Prisma**: use `db push`, never `migrate deploy`.

# Weered

Real-time community platform for gaming — lobbies, rooms, crews, presence, and game-aware modules. A modern take on the MPlayer-era game lobby (1996), rebuilt for 2026.

[weered.ca](https://weered.ca) · [About](https://weered.ca/about) · [Desktop](https://weered.ca/desktop)

## What it is

Weered organizes communities around what people are actually doing. Open it and you land in a lobby or a room with other people present — you can see who's on Steam, Xbox, PlayStation, or Twitch, co-watch a stream, run a Destiny 2 raid LFG, hold a poker night, paper-trade against your crew on FakeOut, or track the Helldivers 2 galactic war together. Each game gets a lobby wired to that game's own live data.

The look is deliberately dark and cinematic. The model is the MPlayer lobby: show up, see who's around, play together.

## Architecture

```
apps/
  web/       Next.js 15 — primary client at weered.ca
  api/       Fastify 5 + Prisma + WebSocket — single source of truth
  mobile/    React Native 0.83 + Expo SDK 55 — iOS + Android
  desktop/   Tauri 2 + Rust — native shell around the web client
  mod/       Weered Connect — Fabric mod (Minecraft 1.21.x), shipped via Modrinth
packages/
  shared/    TypeScript types + constants shared across clients
.github/
  workflows/ CI — cross-platform desktop release builds
```

**The architectural rule:** business logic lives in the API. Permissions, scoring, the paper economy, friend logic, lobby joining, notoriety — every rule is server-side, decomposed across `apps/api/src/routes/*`. Clients render and submit; they never decide.

See [`DEVELOPMENT.md`](./DEVELOPMENT.md) for the full repo guide — per-client release cadence, deploy procedures, and gotchas.

For the deliberate single-node scaling posture (and why horizontal WS scaling is intentionally deferred), see [`SCALING.md`](./SCALING.md). Ops and disaster recovery: [`RUNBOOK.md`](./RUNBOOK.md).

## Stack

- **Backend:** Fastify 5, Prisma + PostgreSQL, WebSockets, LiveKit (voice/video). Type-gated (`tsc --noEmit` clean) and esbuild-compiled to `dist/` for production. Single-node by design (see SCALING.md); Redis pub/sub is deliberately deferred, not in use.
- **Web:** Next.js 15.5, React 19, TypeScript.
- **Mobile:** React Native 0.83, Expo SDK 55, expo-router, NativeWind, TanStack Query, Zustand.
- **Desktop:** Tauri 2, Rust, native OS webview (~5 MB installer).
- **Auth:** httpOnly-cookie sessions; Google OAuth, Bungie.net OAuth, and local username/password.
- **Presence:** Steam Web API, Twitch Helix, Xbox / PlayStation.
- **Payments:** Stripe (paid tiers — Indicted, Felon, Kingpin).
- **Observability:** Sentry (web + api), PM2 (process management).
- **Hosting:** DigitalOcean droplet behind Caddy (edge TLS + CORS).

## Modules

Each lobby can opt into a module that wires it to a specific game or activity:

| Module                     | What it adds                                                                             |
| -------------------------- | ---------------------------------------------------------------------------------------- |
| `BUNGIE` (Destiny 2)       | Bungie OAuth, Guardian/loadout lookup, raid LFG, API-verified tournaments (PGCR scoring) |
| `RIOT` (League of Legends) | Summoner lookup, ranked leaderboards, rotation tracker                                   |
| `EVE` (EVE Online)         | Capsuleer sheet, killboard, sovereignty, market, new-pilot tools                         |
| `POE` (Path of Exile)      | Live Currency Exchange economy, ladder, rendered passive tree, build inspector           |
| `HELLDIVERS2`              | Galactic-war tracker, Major Orders, war map, stratagem + loadout tools, squad finder     |
| `CHESS`                    | Lichess + Chess.com account linking, API-credited challenges, co-watch board             |
| `TRADING` (FakeOut)        | Paper trading on a live Binance feed, TradingView charts, leaderboards                   |
| `WINDROSE`                 | Bounty board (PvE objectives), hunter dossiers, crew tools                               |
| `POKER`                    | LiveKit table, Texas Hold'em with paper buy-ins                                          |
| `MINECRAFT`                | Weered Connect Fabric mod links in-game state to the lobby                               |
| `FORTNITE`                 | Item shop, stats, news                                                                   |

Plus lighter topic/content modules: `CS2`, `DOTA2`, `PUBG`, `MLB`, `PGA`, `MTG`, `MARATHON`, `DND`, `STUDY`, `NEWS`, `REDDIT`, `TWITCH`, `YOUTUBE`, `HEADQUARTERS`, and `CUSTOM`.

## Paper economy

Closed-loop virtual economy:

- **Notoriety** — reputation/XP, accrued via activity (chat, room joins, hosting, daily login). Drives a rank ladder and gates what you can do (posting media, hosting lobbies, moderation).
- **Paper** — spendable currency for store items, bounties, tournament buy-ins, and tips. Earned via activity, never purchasable for cash.

Sits alongside a Stripe-backed tier system (Innocent / Indicted / Felon / Kingpin) for paid features.

## Deploying

Guardrails gate every deploy: the API type gate (`tsc --noEmit`) must be clean and no source file may exceed the size tripwire (`scripts/check.sh`). One command:

```bash
bash scripts/deploy.sh        # guardrails -> web build -> restart both -> smoke test
bash scripts/deploy.sh api    # API only: guardrails -> restart api -> smoke test
```

Runtime: the API is esbuild-bundled to `dist/` and run with Node; the web app is `next build` + `next start`; both run under PM2 on the droplet. Full procedures in [`DEVELOPMENT.md`](./DEVELOPMENT.md).

## Status

Public beta, live at [weered.ca](https://weered.ca). In active development — ships most days. Closed-source for now.

## Contact

- support@weered.ca
- [github.com/Weeredjs/Weered](https://github.com/Weeredjs/Weered)

# Weered

Real-time community platform — lobbies, crews, presence, modules. Spiritual successor to MPlayer (1996), rebuilt for 2026.

> **Lobbies, not servers. Rooms, not channels. Presence, not status dots.**

[weered.ca](https://weered.ca) · [weered.ca/about](https://weered.ca/about) · [weered.ca/desktop](https://weered.ca/desktop)

---

## What it is

Weered is a place. Not a tool. Open the app and you're somewhere — a lobby, a room, a crew. Other people are there. You can see what they're doing on Steam, Twitch, Xbox. You can co-watch a stream, run a Destiny 2 raid LFG, hold a poker night, paper-trade against your crew on FakeOut, place bounties in Windrose, drop into chaos chat in The Streets.

The aesthetic is dark, cinematic, GTA-tinged. The feel is MPlayer's "let's hang out and play games together" energy, scaled to 2026.

## Architecture

```
apps/
  web/       Next.js 14 — primary client at weered.ca
  api/       Fastify + Prisma + WebSocket — single source of truth
  mobile/    React Native + Expo SDK 55 — iOS + Android
  desktop/   Tauri 2 + Rust — native shell wrapping the web app
packages/
  shared/    TypeScript types + constants used by all clients
.github/
  workflows/ CI/CD (currently: cross-platform desktop builds)
```

**The architectural rule:** business logic lives in the API. Permissions, scoring, paper economy, friend logic, lobby joining, notoriety — every rule is in `apps/api/src/index.ts`. Clients render and submit; they never decide.

See [`CLAUDE.md`](./CLAUDE.md) for the full repo guide — three-client release cadence, deploy commands, common gotchas.

## Stack

- **Backend:** Fastify, Prisma + PostgreSQL, WebSockets, LiveKit (voice/video), Redis (presence)
- **Web:** Next.js 14, React 18, TypeScript
- **Mobile:** React Native 0.83, Expo SDK 55, expo-router, NativeWind, TanStack Query, Zustand
- **Desktop:** Tauri 2, Rust, native OS webview (~5 MB installer)
- **Auth:** Google OAuth, Bungie.net OAuth, local username/password
- **Presence:** Steam Web API, Twitch Helix, Xbox (Microsoft Graph)
- **Game integrations:** Destiny 2 (Bungie API), League of Legends (Riot), Fortnite, COD Warzone, FakeOut paper trading, Poker, Windrose (Age of Piracy bounty board)
- **Payments:** Stripe (paid tiers — Indicted, Felon, Kingpin)
- **Observability:** Sentry (web + api), PM2 (process management)
- **Hosting:** DigitalOcean droplet, Caddy reverse proxy

## Modules

Every lobby can opt into a module that gives it game-specific superpowers:

| Module | What it adds |
|---|---|
| `BUNGIE` (Destiny 2) | Bungie OAuth, Guardian/loadout viewer, raid LFG, Trials Hall, weekly reset board |
| `RIOT` (League of Legends) | Summoner lookup, ranked leaderboard, rotation tracker |
| `FORTNITE` | Item shop, news, cosmetics, stats |
| `WINDROSE` (Age of Piracy) | Bounty board (PvE objectives), hunter dossiers, Captain's Log, Hall of Crews |
| `TRADING` (FakeOut) | Paper trading w/ Binance WS feed, TradingView charts, leaderboards |
| `POKER` | LiveKit voice + Texas Hold'em w/ paper buy-ins |
| `MLB`, `PGA`, `PUBG`, `CS2`, `DOTA2`, `POE`, `MARATHON`, `DND`, `STUDY`, `HEADQUARTERS`, `CUSTOM` | More flavors |

## Paper economy

Closed-loop virtual currency:
- **Notoriety** — XP, accrued via daily activity / chat / room joins / first-room-hosted / etc. Cosmetic rank ladder (Street Rat → Kingpin).
- **Paper** — currency, used to buy items, place bounties, enter tournaments, tip in lobbies. Earned via daily login + activity.

Tied into a real Stripe-backed tier system (Innocent / Indicted / Felon / Kingpin) for paid features.

## Status

**Live.** Daily-shipping indie product. AI-assisted development (Claude Opus); commit history is openly co-authored. The fact that the codebase is large and rapidly-evolving is the point — Weered is being built in public, fast.

Closed-source for now. Public beta open at [weered.ca](https://weered.ca).

## Deploying

See [`CLAUDE.md`](./CLAUDE.md) for the full deploy procedures. TL;DR:

```bash
# API (no build step — runs via tsx)
ssh root@142.93.148.29 'cd /opt/weered && git pull && pm2 restart weered-api'

# Web (Next.js — needs build)
ssh root@142.93.148.29 'cd /opt/weered && git pull && cd apps/web && pnpm next build && pm2 restart weered-web'

# Desktop release (cross-platform via GitHub Actions)
git tag desktop-v0.2.0 && git push origin desktop-v0.2.0
```

## Contact

- james@weered.ca
- [github.com/Weeredjs/Weered](https://github.com/Weeredjs/Weered)

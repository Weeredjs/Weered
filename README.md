# Weered

[![Security](https://sonarcloud.io/api/project_badges/measure?project=Weeredjs_Weered&metric=security_rating)](https://sonarcloud.io/summary/overall?id=Weeredjs_Weered)
[![Reliability](https://sonarcloud.io/api/project_badges/measure?project=Weeredjs_Weered&metric=reliability_rating)](https://sonarcloud.io/summary/overall?id=Weeredjs_Weered)
[![Maintainability](https://sonarcloud.io/api/project_badges/measure?project=Weeredjs_Weered&metric=sqale_rating)](https://sonarcloud.io/summary/overall?id=Weeredjs_Weered)
[![CI](https://github.com/Weeredjs/Weered/actions/workflows/ci.yml/badge.svg)](https://github.com/Weeredjs/Weered/actions/workflows/ci.yml)
[![License: Elastic 2.0](https://img.shields.io/badge/license-Elastic%202.0-2f6df6.svg)](./LICENSE)

> **State of the project (November 2026): public beta, source-available.**
> The whole platform is on GitHub under the Elastic License 2.0. The Minecraft
> mod and the shared types package are MIT. Read it, build it, self-host it,
> send patches. The one thing you cannot do is resell it as a hosted service.
> See [LICENSING.md](./LICENSING.md).
>
> Run it through SonarCloud, CodeRabbit, or whatever you trust. The architecture
> is opinionated, the business logic is server-side only, and it ships most days.
> Constructive teardowns are welcome. See [Code quality](#code-quality) below.

A place for anything: voice, video, rooms and live integrations for your team, your club or your game, on your own domain if you want it. A modern take on the MPlayer-era game lobby (1996), rebuilt for 2026.

[weered.ca](https://weered.ca) · [About](https://weered.ca/about) · [Desktop](https://weered.ca/desktop)

## What it is

Weered organizes communities around what people are actually doing. Open it and you land in a lobby or a room with other people present. You can see who's on Steam, Xbox, PlayStation, or Twitch, co-watch a stream, run a Destiny 2 raid LFG, hold a poker night, paper-trade against your crew on FakeOut, or track the Helldivers 2 galactic war together. Each game gets a lobby wired to that game's own live data.

A lobby doesn't have to be about a game. It can be a bridge club, a virtual airline, a study group, or a small firm's front office. Describe the one you want in a sentence and Weered drafts it. Arrange it block by block in Design mode, then give it a front door, its own sign-in page and its own domain.

The look is deliberately dark and cinematic, with a light colourway for anyone who wants one. The model is the MPlayer lobby: show up, see who's around, play together.

## Features

The game modules further down sit on top of a full community platform. The core surface:

**Build your own**

- **Describe it**: a sentence becomes a lobby, or a change to one. Rooms, events, roles, chat rules, the front door, a crew's look, a stream overlay, scheduled posts, pages, even small custom games. Every answer is a proposal you see before anything is saved, and it is saved through the same checks as the hand-built version.
- A step-by-step composer for a new lobby, which Describe it can fill in from one sentence
- **Design mode**: lay out a lobby's Home with blocks (a welcome, a front desk, a live webpage, who lives here), start from templates such as the digital office, and carry the lobby's look across its rooms
- **Custom blocks**: code a lobby writes runs in a sandboxed frame with no access to Weered's cookies, storage or pages, and reaches Weered only through a small bridge for shared data and live messages. Saving code is for paid accounts and staff, and every block is labelled as the lobby's own work, not Weered's
- **Change your drip**: rearrange your own sidebars and Home, add blocks to it, and pick a colourway or one colour of your own, plus your own symbol, corners and lines
- **Your place**: every member can have a free lobby of their own at `<name>.weered.ca`

**Doors, domains and guests**

- A front door for any lobby: rules, questions, an 18+ check, and an optional join password (stored hashed, like any other password)
- A lobby can run on its own domain. The owner proves it with a DNS TXT record, and certificates are issued automatically
- Branded sign-in: a lobby's invite links, its own domain and a member's place show that lobby's sign-in page instead of Weered's
- Guest links: a lobby owner can invite clients or visitors who give only a name. A guest gets that one lobby, with no account and no direct messages, for 12 hours at most

**Presence and social**

- Cross-platform presence: see who is live on Steam, Xbox, PlayStation, and Twitch
- Friends, profiles, and an activity feed
- Crews: persistent groups with their own chat, roster, roles, and moderation tools. Each crew can claim a unique tag, and its page lives at `weered.ca/crew/<TAG>`
- **Rap sheets**: a shareable player card at `weered.ca/rap/<name>` (playstyles, hours, mic, platforms, crew, street rank, and "priors" earned on Weered), with its own link-preview image
- For the GTA VI launch on November 19, 2026, the GTA 6 lobby carries a countdown, rap sheets, crew tag claims, and a roll call of the crews already there

**Real-time rooms**

- Voice rooms on LiveKit, with a join queue and a listen-only mode
- Push to talk, per-person volume, and voice effects
- Camera video and screen sharing in any room
- A shared real-time canvas, used for the built-in tabletop: map tokens, fog of war, and NPC encounters

**Messaging**

- Lobby, room, crew, and direct messages, plus group DMs
- Reactions, mentions, and a flair cosmetic system
- Spoiler tags (`||like this||` or `/spoiler`): hidden until tapped, and never shown in a notification or a message preview
- Image and file attachments (perceptual-hash blocked and blur-tiered for safety), plus GIFs via Tenor

**Moderation and safety**

- Per-lobby roles and moderator tiers; every permission is checked server-side
- Lobby staff run their own rooms: ten-minute kicks, chat locks, and mutes and blocks that hold in every room, group thread and invite
- Automod rules, member reports, a ban-appeal court, and full audit logs
- Notoriety-gated abilities: new accounts earn trust before they can post media or host lobbies

**Notifications**

- In-app notifications and web push (VAPID)

**Communities and events**

- Lobbies (optionally wired to a game module), rooms, crews, and forums with their own moderation
- Forums with threaded replies, images, emoji and link previews in every composer
- Scheduled events and API-verified tournaments (for example, Destiny 2 PGCR scoring)
- Automations: scheduled posts, feed hookups (YouTube uploads, Twitch going live, any RSS or Atom feed) and room alerts, plus an optional AI host who greets new members in the lobby chat
- A Pages tab for a lobby's wiki, build guides or merch
- **start.gg integration**: a lobby follows an organizer, tournament or league; brackets,
  entrant lists, venue and the stream queue land in the lobby. Members link their own
  start.gg accounts so a lobby can see who is entered, and TOs can connect via organiser OAuth
- **Station board**: which setup a match is on and what is queued next. It is the venue floor
  rather than the bracket, because that is the part running events actually lack

**Game servers**

- Our own server aggregate built on Steam's master list and the A2S query protocol, kept with
  polling history, because a live snapshot cannot answer the question a community actually has
- Hell Let Loose and HLL: Vietnam units link their **own** box over RCON (second-generation
  wire protocol, implemented from the published spec rather than wrapped) for live match state
  and a live roster
- **Muster**: drill attendance read straight off the unit's server. A roll of in-game names,
  no accounts to create
- Seeding rally board, for the 0-to-40-players problem that decides whether a server lives

**Economy**

- Two earned currencies, Notoriety (reputation) and Paper (spendable), drive a closed loop: store items, bounties, tournament buy-ins, and tips. See [Paper economy](#paper-economy).

**Clients**

- Web at weered.ca, a Tauri desktop app (~5 MB, Windows and Linux), and a mobile app in progress on Expo.

## Architecture

```
apps/
  web/       Next.js 15 - primary client at weered.ca
  api/       Fastify 5 + Prisma + WebSocket - single source of truth
  mobile/    React Native 0.83 + Expo SDK 55 - iOS + Android
  desktop/   Tauri 2 + Rust - native shell around the web client
  mod/       Weered Connect - Fabric mod (Minecraft 1.21.x), shipped via Modrinth
packages/
  shared/    TypeScript types + constants shared across clients
.github/
  workflows/ CI - cross-platform desktop release builds
```

```
                          ┌──────────────────────────────┐
   Steam / Xbox / PSN     │            CLIENTS           │
   Twitch / Bungie / Riot │  web   mobile   desktop  mod │
   EVE / PoE / Helldivers │   │       │        │      │  │
          presence +      └───┼───────┼────────┼──────┼──┘
          game data           │  HTTPS (REST) + WebSocket  (cookie auth)
                              ▼       ▼        ▼      ▼
                       ┌────────────────────────────────────┐
                       │     apps/api  (Fastify 5)           │
                       │  ALL business logic lives here:     │
                       │  permissions · scoring · paper      │
                       │  economy · lobby state · notoriety  │
                       │  routes/*  ·  sockets/*  ·  lib/*    │
                       └───────┬───────────────────┬─────────┘
                               │                   │
                      Prisma   ▼                   ▼  LiveKit
                       ┌──────────────┐     ┌──────────────┐
                       │  PostgreSQL  │     │ voice / video│
                       └──────────────┘     └──────────────┘

   Edge: Caddy (TLS for weered.ca, *.weered.ca and lobbies' own domains · CORS allowlist)
   Process mgmt: PM2 · Errors: Sentry · AI: Anthropic API (proposals only)
```

**The architectural rule:** business logic lives in the API. Permissions, scoring, the paper economy, friend logic, lobby joining, notoriety. Every rule is server-side, decomposed across `apps/api/src/routes/*`. Clients render and submit; they never decide.

The AI is held to the same rule. Describe it returns a proposal, the API checks it against the catalog (known values only, lengths clipped, and links, channels and dates kept only when the person typed them), and it is saved through the feature's ordinary route. Nothing a model says is trusted.

See [`DEVELOPMENT.md`](./DEVELOPMENT.md) for the full repo guide: per-client release cadence, deploy procedures, and gotchas.

For the deliberate single-node scaling posture (and why horizontal WS scaling is intentionally deferred), see [`SCALING.md`](./SCALING.md). Ops and disaster recovery: [`RUNBOOK.md`](./RUNBOOK.md).

## Stack

- **Backend:** Fastify 5, Prisma + PostgreSQL, WebSockets, LiveKit (voice/video). Type-gated (`tsc --noEmit` clean) and esbuild-compiled to `dist/` for production. Single-node by design (see SCALING.md); Redis pub/sub is deliberately deferred, not in use.
- **Web:** Next.js 15.5, React 19, TypeScript.
- **Mobile:** React Native 0.83, Expo SDK 55, expo-router, NativeWind, TanStack Query, Zustand.
- **Desktop:** Tauri 2, Rust, native OS webview (~5 MB installer).
- **Auth:** httpOnly-cookie sessions; Google, Discord and Bungie.net OAuth, and local username/password. A guest link issues a session scoped to one lobby that ends within 12 hours.
- **Presence:** Steam Web API, Twitch Helix, Xbox / PlayStation.
- **AI:** Anthropic's Claude API, for Describe it, lobby hosts, the @operator help account, and short in-character broadcasts in the Helldivers 2 and Division 2 lobbies.
- **Payments:** Stripe (paid tiers: Indicted, Felon, Kingpin).
- **Observability:** Sentry (web + api), PM2 (process management).
- **Hosting:** DigitalOcean droplet behind Caddy (edge TLS + CORS). One wildcard certificate covers `*.weered.ca` through a DNS challenge; a lobby's own domain gets its certificate on demand once it is verified.

## Modules

Each lobby can opt into a module that wires it to a specific game or activity:

| Module                                     | What it adds                                                                                                    |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| `BUNGIE` (Destiny 2)                       | Bungie OAuth, Guardian/loadout lookup, raid LFG, API-verified tournaments (PGCR scoring)                        |
| `RIOT` (League of Legends)                 | Summoner lookup, ranked leaderboards, rotation tracker                                                          |
| `EVE` (EVE Online)                         | Capsuleer sheet, killboard, sovereignty, market, new-pilot tools                                                |
| `POE` / `POE2` (Path of Exile)             | Live Currency Exchange economy, ladder, rendered passive tree, build inspector; poe2scout prices for PoE2       |
| `HELLDIVERS2`                              | Galactic-war tracker, Major Orders, war map, stratagem + loadout tools, squad finder                            |
| `CHESS`                                    | Lichess + Chess.com account linking, API-credited challenges, co-watch board                                    |
| `TRADING` (FakeOut)                        | Paper trading on a live Binance feed, TradingView charts, leaderboards                                          |
| `WINDROSE`                                 | Bounty board (PvE objectives), hunter dossiers, crew tools                                                      |
| `POKER`                                    | LiveKit table, Texas Hold'em with paper buy-ins                                                                 |
| `MINECRAFT`                                | Weered Connect Fabric mod links in-game state to the lobby                                                      |
| `FORTNITE`                                 | Item shop, stats, news                                                                                          |
| `HLL` / `HLLV` (Hell Let Loose, + Vietnam) | A unit links its own server over RCON: live match state, roster, Muster drill attendance, seeding rally board   |
| `BAR` (Beyond All Reason)                  | Linked BAR accounts, live battles board, and a match launcher inside the room                                   |
| `DIVISION2`                                | Ubisoft server status, Ops Board intel feed, operator sit-reps, field resources                                 |
| `ASSETTOCORSA`                             | Live grid and session board read from each AC server's own public API                                           |
| `COWORK`                                   | The lobby for solo operators: one worldwide 50/10 focus clock, plus a public day board                          |
| `VIRTUAL_AIRLINE`                          | Crew hub: dispatch, crew notices, live map, rank-gated rooms. Sample data until an airline links its vAMSYS API |

Plus lighter topic/content modules: `CS2`, `DOTA2`, `PUBG`, `MLB`, `PGA`, `MTG`, `MARATHON`, `DND`, `STUDY`, `NEWS`, `REDDIT`, `TWITCH`, `YOUTUBE`, `HEADQUARTERS`, and `CUSTOM`.

## Paper economy

Closed-loop virtual economy:

- **Notoriety**: reputation/XP, accrued via activity (chat, room joins, hosting, daily login). Drives a rank ladder and gates what you can do (posting media, hosting lobbies, moderation).
- **Paper**: spendable currency for store items, bounties, tournament buy-ins, and tips. Earned via activity, never purchasable for cash.

Sits alongside a Stripe-backed tier system (Innocent / Indicted / Felon / Kingpin) for paid features.

## Code quality

Continuous analysis runs in CI on every push; the badges above are live.

**Security A · Reliability A · Maintainability A · Security Review A**: 0 bugs,
0 vulnerabilities, 0 open security hotspots, technical-debt ratio about 0.5%.

A note for anyone running their own scanner, because you should: suppressions
made in the repo carry their reasons in
[`sonar-project.properties`](./sonar-project.properties) for you to read. The
"hardcoded credentials" are test-fixture and CI test-database passwords (not
real secrets), a 32-bit hash truncation produces ids other clients match on, two
vendor scripts update in place so an integrity hash can't be pinned, and the
custom-block frame posts to a sandboxed page whose origin is opaque, so `*` is
the only target origin there is. A further 16 code-smell findings (15
regex-backtracking warnings and one hash truncation) were marked false positive
in SonarCloud itself, where anyone can see them. Test coverage is modest and we
don't gate on it; we hold the line on the ratings and zero defects instead.

If you find something real, open an issue. That is the point of going public.

## Deploying

Guardrails gate every deploy: the API type gate (`tsc --noEmit`) must be clean and no source file may exceed the size tripwire (`scripts/check.sh`). One command:

```bash
bash scripts/deploy.sh        # guardrails -> web build -> restart both -> smoke test
bash scripts/deploy.sh api    # API only: guardrails -> restart api -> smoke test
```

Runtime: the API is esbuild-bundled to `dist/` and run with Node; the web app is `next build` + `next start`; both run under PM2 on the droplet. Full procedures in [`DEVELOPMENT.md`](./DEVELOPMENT.md).

Local setup, prerequisites, and the dev loop are in [`DEVELOPMENT.md`](./DEVELOPMENT.md). Contribution conventions are in [`CONTRIBUTING.md`](./CONTRIBUTING.md).

## License

Source-available. The core platform is under the **Elastic License 2.0**
([`LICENSE`](./LICENSE)); `apps/mod` and `packages/shared` are **MIT**. The
short version: read it, build it, self-host it for yourself, send patches. You
may not offer it to third parties as a hosted or managed service. Full
directory-by-directory mapping in [`LICENSING.md`](./LICENSING.md).

Security reports: see [`SECURITY.md`](./SECURITY.md). Licensing questions:
**legal@weered.ca**.

## Status

Public beta, live at [weered.ca](https://weered.ca). In active development, ships most days. Source-available since June 2026.

## Contact

- support@weered.ca
- [github.com/Weeredjs/Weered](https://github.com/Weeredjs/Weered)

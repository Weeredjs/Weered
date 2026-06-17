# Launch copy — "Weered is source-available"

Draft copy for the public flip. Nothing here posts itself. Pick what you want,
edit freely, post in your own order. Keep it anonymous (no real names on public
Weered surfaces). All of it is written to be blunt and to pre-empt the obvious
"why was it secret / is the code any good" questions.

Posting order that works: create the SonarCloud project and confirm the README
badges render, flip the repo public, then post the blog piece, then the X thread
linking the blog, then the subreddit and HN posts. See GO_PUBLIC_CHECKLIST.md.

---

## 1. Blog post (weered.ca)

**Title: Weered is now source-available**

We kept Weered private while we built it. Not because there was anything to hide,
but because half-built things invite noise, and we wanted the thing to be real
before anyone read it. It is real now. So the code is public.

Weered is a real-time community platform for gaming. Lobbies, rooms, crews, live
presence across Steam, Xbox, PlayStation and Twitch, and per-game modules that
wire a lobby to that game's own live data: Destiny 2 raid LFG with
API-verified tournament scoring, EVE killboards and sovereignty, a live Path of
Exile currency economy, the Helldivers 2 galactic war, poker with paper buy-ins,
paper trading on a live market feed. The model is the old MPlayer lobby from
1996: show up, see who is around, play together.

The whole platform is on GitHub now under the Elastic License 2.0. The Minecraft
mod and the shared types package are MIT. You can read all of it, build it, run
your own copy, and send patches. The one thing the license stops you doing is
reselling it as a hosted service. That line is deliberate. The hard part of
Weered is the server-side business logic, and that is the product.

A word on the code, because people will run scanners on it the second it is
public, and they should. Continuous analysis runs in CI on every push.
Reliability A, Security A, Maintainability A. Zero bugs, zero vulnerabilities,
zero open security hotspots. Technical-debt ratio under half a percent. There is
a backlog of low-severity style findings, and we say so in the README, including
why a big chunk of the "redundant cast" warnings are false positives against a
strict TypeScript codebase that talks to a dozen game APIs. We clear the real
ones in supervised batches. We do not chase a number at the cost of breaking a
live platform that runs an economy and real-time state.

Run it through SonarCloud, CodeRabbit, or whatever you trust. If you find
something real, open an issue. That is the point of doing this in the open.

It is live at weered.ca. It ships most days.

Repo: https://github.com/Weeredjs/Weered

---

## 2. X / Twitter (thread)

**1/**
Weered is now source-available. The whole platform is on GitHub.

A real-time community platform for gaming. Lobbies, live presence, and per-game
modules wired to each game's own data. Built like the old MPlayer lobby.

https://github.com/Weeredjs/Weered

**2/**
We kept it private while we built it. Not to hide anything. Because half-built
things invite noise and we wanted it to be real first.

It is live at weered.ca and ships most days.

**3/**
The code is under the Elastic License 2.0 (the Minecraft mod and shared types
are MIT). Read it, build it, self-host it, send patches. You just cannot resell
it as a hosted service.

**4/**
It is going public clean. CI runs continuous analysis on every push:
Reliability A, Security A, Maintainability A. 0 bugs, 0 vulns, 0 hotspots.

Run your own scanners on it. We left a note in the README about the false
positives you will see, and why.

**5/**
If you find something real, open an issue. That is the point.

https://github.com/Weeredjs/Weered

---

## 3. Reddit — general post (r/indiehackers, r/SaaS, r/programming if it fits)

**Title: I went source-available with my gaming platform instead of staying a black box. Here is the repo.**

Weered is a real-time community platform for gaming: lobbies, live cross-platform
presence, and per-game modules (Destiny 2 LFG with verified tournament scoring,
EVE killboards, a live Path of Exile economy, Helldivers 2 war tracking, poker,
paper trading). It is live at weered.ca and ships most days.

I kept it private while building it and just made the whole monorepo public under
the Elastic License 2.0 (mod and shared types are MIT). You can read it, run it,
and patch it. You cannot resell it as a service.

It is going out clean: CI runs SonarQube-style analysis on every push, sitting at
A reliability / A security / A maintainability, 0 bugs, 0 vulns, 0 hotspots, debt
ratio under 0.5%. The README is honest about the leftover style findings and why
a lot of the "redundant cast" flags are false positives against strict TS.

Tear it apart. Constructive feedback welcome. If you find something real, the
issue tracker is open.

Repo: https://github.com/Weeredjs/Weered

### Per-community angle (lead with the module, link the repo at the end)

- **r/DestinyTheGame / r/raidsecrets:** lead with raid LFG and API-verified
  tournament scoring off the PGCR. These are tools, not self-promo, so frame it
  as "built a thing for raids, it is open now."
- **r/Helldivers:** lead with the galactic-war tracker, Major Orders, war map,
  stratagem and loadout tools, squad finder.
- **r/pathofexile:** lead with the live Currency Exchange economy, ladder, and
  rendered passive tree. You actually play PoE — say so. (Check each subreddit's
  self-promo rules first; tournaments/tools posts are usually the safe lane.)
- **r/Minecraft / Modrinth:** lead with the Weered Connect mod, and that it is
  MIT and forkable.

---

## 4. Show HN

**Title: Show HN: Weered, a source-available real-time gaming community platform**

Weered is a real-time community platform for gaming, built around the old
MPlayer lobby model: you land in a lobby with other people present, see who is on
Steam/Xbox/PSN/Twitch, and each game gets a lobby wired to its own live data.

Stack: Fastify 5 + Prisma + Postgres + WebSockets on the API (all business logic
is server-side), Next.js 15 / React 19 web, a Tauri 2 desktop shell, a React
Native + Expo mobile app, and a Fabric mod for Minecraft. Single-node by design;
the README explains why horizontal WS scaling is deferred on purpose.

I built it private and just made it source-available (Elastic License 2.0 core,
MIT for the mod and shared types). CI runs continuous static analysis: A/A/A on
reliability/security/maintainability, 0 bugs/vulns/hotspots. The README is candid
about the leftover style findings and the scanner false positives you will hit.

Live at weered.ca. Happy to answer anything about the architecture.

Repo: https://github.com/Weeredjs/Weered

---

## 5. Pinned GitHub Discussion (or pinned Issue)

**Title: Why Weered is public, and what to expect**

This repo was private through the whole build. It is source-available now because
the platform is real and we would rather be read than guessed about.

A few things up front:

- **License.** Elastic License 2.0 for the core, MIT for `apps/mod` and
  `packages/shared`. Read it, build it, self-host it for yourself, patch it. You
  cannot offer it to others as a hosted service. Details in LICENSING.md.
- **Business logic is server-side.** The API is the single source of truth.
  Clients render and submit. So reading the client code tells you how it looks,
  not how the economy or permissions actually work.
- **It is a live platform.** It runs an economy, permissions, and real-time
  state for real users. We do not merge large speculative changes without
  discussion, and we will not break a working platform to satisfy a linter.
- **Scrutiny is welcome.** Run your scanners. If you find a real bug or a real
  security issue, that is genuinely useful. See SECURITY.md for disclosure.
- **Response is batched.** Small team. Issues and PRs are triaged in waves, not
  in real time.

CI standing, for the record: A reliability / A security / A maintainability,
0 bugs, 0 vulnerabilities, 0 open hotspots, debt ratio under 0.5%. The README
covers the leftover style findings and why many "redundant cast" flags are false
positives here.

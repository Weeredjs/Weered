# Scaling

This document records the deliberate scaling posture of the Weered backend: what
the architecture assumes, why it is single-node on purpose, and the order in
which to react when load rises. It exists so that "single instance" reads as a
decision, not an accident.

## The target sets the architecture

Weered's planned ceiling is roughly **1M monthly active users on a single box**,
on a salary/lifestyle model. It is explicitly **not** trying to be Discord-scale.
That target is the single most important input to every decision below. A design
that is correct for 100M concurrent users would be the wrong design here: it buys
headroom the business has decided it will never need, and pays for it in
permanent operational complexity.

## Current architecture (single-node, in-process)

- **One API process.** `weered-api` runs as a single PM2 process (fork mode, not
  cluster) on one DigitalOcean droplet. HTTP on `:4000`, WebSocket on `:4001`.
- **In-process WebSocket state.** Connections, lobby membership, poker tables,
  voice rooms, and presence all live in memory in that one process. Broadcasts
  iterate `wss.clients` (or per-lobby/table subsets) directly. There is no
  cross-process message bus.
- **Postgres** (single instance, Docker) is the source of truth. Prisma, no
  read replicas. Indexing is already strong (186+ `@@index`, composites matched
  to query shapes).
- **No Redis dependency in the API.** A Redis container exists in the compose
  stack for ancillary use, but the API does **not** import a Redis client and
  does **not** use Redis for pub/sub, sessions, or caching. Auth is stateless
  (JWT in an httpOnly cookie), so there is no session store to share.

Because all WebSocket state is in one process, the platform **cannot currently
run more than one API instance** without users on different instances failing to
see each other's real-time events. That is the binding constraint, and it is an
accepted one at the current target.

## Redis pub/sub for horizontal WS scaling: deliberately NOT built

The obvious "scale the realtime layer" move is: put a userId→sockets map behind
Redis pub/sub so N API instances can fan events out to each other. **We are
choosing not to build this.**

- It solves a problem the business has decided not to have (multi-node WS).
- It adds a hard runtime dependency and a new class of failure modes (Redis
  outage, split-brain fanout, at-least-once delivery semantics, reconnection
  storms) to the most latency-sensitive layer in the system.
- A single modern box vertically scales a very long way for this workload before
  any of that complexity pays for itself.

This is a YAGNI call, not an oversight. If the target ever changes, the path is
documented at the bottom of this file.

## What to do FIRST when load rises (in order)

1. **Scale the box up (vertical).** Bigger droplet (more vCPU + RAM). This is the
   cheapest lever by far and the right first move every time. The single-process
   model uses one core for the event loop, so favor higher per-core clock and
   enough RAM to hold connection state + Postgres working set.
2. **Fix the known O(n) fanouts.** Two broadcast paths currently iterate *all*
   connections rather than a targeted set: `createNotification` and the
   `lobby:activity` broadcast. Convert these to a `userId → Set<socket>` /
   `lobbyId → Set<socket>` index so a broadcast touches only the relevant
   sockets. This is pure in-process work, no new infrastructure, and removes the
   main per-connection CPU cost as connection count grows.
3. **Move Postgres to its own box / managed instance** if the DB becomes the
   bottleneck before the app does. Add read replicas for read-heavy endpoints
   (leaderboards, history) only if measured.
4. **Offload heavy periodic work.** The trading fill/SL-TP workers and any other
   `setInterval` loops run in the API process. If they start competing with
   request handling, move them to a separate worker process (they already talk to
   Postgres, so this is straightforward and does NOT require shared WS state).

Exhaust 1–2 (and usually 3) before even considering horizontal scaling.

## The signal that would justify revisiting horizontal scaling

Reconsider only when, on an already-vertically-maxed box with the O(n) fanouts
fixed, the **single event loop is saturated at peak** (sustained high CPU on the
API process, rising WS broadcast latency) AND that peak is driven by realtime
fanout rather than by Postgres or a hot endpoint. Until all of those are true,
horizontal WS scaling is the wrong tool.

## If the target ever changes: the horizontal path (NOT built)

Recorded so the decision is reversible, not so it is pre-built:

1. Introduce a `userId → Set<socketId>` registry and make every broadcast go
   through a single `publish(target, event)` seam (most code already routes
   through `broadcastToLobby` / `notifyUser`, so the seam mostly exists).
2. Back that seam with Redis pub/sub (or NATS): each instance subscribes and
   re-emits to its locally-connected sockets.
3. Run the API in cluster/multi-instance mode behind a sticky-session LB for the
   initial WS upgrade.
4. Make the periodic workers leader-elected or move them to a dedicated worker so
   they don't run N times.
5. Load-test the fanout path specifically; realtime is where multi-node breaks
   first.

Do not start this without an explicit decision to raise the scale target.

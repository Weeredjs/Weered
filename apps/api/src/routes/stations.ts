import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";
import { canManageLobby } from "../lib/lobbyAccess";
import { fetchWithTimeout } from "../lib/fetchWithTimeout";
import { log, swallow } from "../lib/logger";
import { parseStartggRef } from "./startgg";

/**
 * The station board — the venue floor, not the bracket.
 *
 * start.gg has its own station feature and the community does not use it. On
 * 2026-09-12, fifteen events were running live across every game on the
 * platform; TOs had configured 14-16 stations each and NOT ONE set was
 * assigned to any station. The loop never closes: assigning in start.gg's
 * admin is several clicks per set and the players never see the result, so it
 * buys the TO nothing. Matches get called on a mic instead.
 *
 * So Weered owns the assignment and start.gg keeps the bracket. We read the
 * callable sets read-only (works today, no organizer OAuth), the TO taps a set
 * onto a setup, and the board becomes the thing the room looks at. That is the
 * payoff start.gg's version is missing.
 *
 * Player names are snapshotted onto the assignment, so the board still reads
 * correctly if start.gg is slow, rate-limited or down mid-event — which is
 * exactly when a venue can least afford a blank screen.
 */

type Opts = { authFromHeader?: (h?: string) => { id: string; name?: string } | null };

const GQL = "https://api.start.gg/gql/alpha";
const CALLABLE_TTL_MS = 30_000;

const STATES = new Set(["OPEN", "PLAYING", "DOWN"]);

/** start.gg set states: 1 created, 2 in progress, 3 complete. */
const SET_CREATED = 1;
const SET_ACTIVE = 2;

type Callable = {
  setId: string;
  identifier: string;
  roundText: string;
  eventName: string;
  players: string[];
  state: number;
};

const callableCache = new Map<string, { at: number; rows: Callable[] }>();

async function startggCallable(slug: string): Promise<Callable[]> {
  const hit = callableCache.get(slug);
  if (hit && Date.now() - hit.at < CALLABLE_TTL_MS) return hit.rows;

  const token = process.env.STARTGG_TOKEN || "";
  if (!token) throw new Error("startgg_not_configured");

  // sortType CALL_ORDER is start.gg's own "what should go out next" ordering,
  // which is the same judgement a TO makes at the front of the room.
  const query = `{
    tournament(slug: "${slug}") {
      events {
        name
        sets(page: 1, perPage: 40, sortType: CALL_ORDER) {
          nodes {
            id
            identifier
            fullRoundText
            state
            slots { entrant { name } }
          }
        }
      }
    }
  }`;

  const r = await fetchWithTimeout(
    GQL,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ query }),
    },
    12_000,
  );
  const j: any = await r.json().catch(() => null);
  if (r.status === 429) throw new Error("startgg_rate_limited");
  if (!r.ok) throw new Error(`startgg_http_${r.status}`);
  if (Array.isArray(j?.errors) && j.errors.length) throw new Error("startgg_gql");

  const rows: Callable[] = [];
  for (const ev of j?.data?.tournament?.events || []) {
    for (const s of ev?.sets?.nodes || []) {
      const state = Number(s?.state);
      if (state !== SET_CREATED && state !== SET_ACTIVE) continue;
      const players = (s?.slots || [])
        .map((sl: any) => sl?.entrant?.name)
        .filter((n: any) => typeof n === "string" && n.trim());
      // A set whose entrants are not decided yet cannot be called to a setup.
      if (players.length < 2) continue;
      rows.push({
        setId: String(s.id),
        identifier: String(s.identifier || ""),
        roundText: String(s.fullRoundText || ""),
        eventName: String(ev?.name || ""),
        players,
        state,
      });
    }
  }
  callableCache.set(slug, { at: Date.now(), rows });
  return rows;
}

function shapeStation(st: any) {
  const rows = [...(st.assignments || [])].sort((a: any, b: any) => a.position - b.position);
  const now = rows.find((a: any) => a.position === 0) || null;
  const deck = rows.filter((a: any) => a.position > 0);
  const one = (a: any) =>
    a && {
      id: a.id,
      setId: a.setId,
      identifier: a.identifier,
      roundText: a.roundText,
      eventName: a.eventName,
      players: a.players,
      calledAt: a.calledAt ? new Date(a.calledAt).getTime() : null,
      startedAt: a.startedAt ? new Date(a.startedAt).getTime() : null,
    };
  return {
    id: st.id,
    number: st.number,
    label: st.label,
    kind: st.kind,
    state: st.state,
    note: st.note,
    now: one(now),
    deck: deck.map(one),
  };
}

export default async function stationRoutes(app: FastifyInstance, opts: Opts = {}) {
  const authFromHeader = opts.authFromHeader;

  /** Whoever is reading, plus whether they may drive the board. */
  async function ctx(req: any, lobbyId: string) {
    const u = authFromHeader?.(req.headers?.authorization) || null;
    const canManage = u ? await canManageLobby(u.id, lobbyId) : false;
    return { user: u, canManage };
  }

  // The board. Public on purpose: a venue display should need no login.
  app.get("/lobbies/:id/stations", async (req, reply) => {
    const lobbyId = String((req.params as any)?.id || "");
    const lobby = await prisma.lobby.findUnique({
      where: { id: lobbyId },
      select: { id: true, moduleConfig: true },
    });
    if (!lobby) return reply.code(404).send({ ok: false, error: "lobby_not_found" });

    const stations = await prisma.station.findMany({
      where: { lobbyId },
      orderBy: { number: "asc" },
      include: { assignments: true },
    });
    const { canManage } = await ctx(req, lobbyId);
    const ref = parseStartggRef((lobby.moduleConfig as any)?.startgg?.ref);

    reply.header("Cache-Control", "no-store");
    return reply.send({
      ok: true,
      canManage,
      startgg: ref ? `${ref.kind}/${ref.slug}` : null,
      stations: stations.map(shapeStation),
    });
  });

  // Sets that could be called. Read-only start.gg; already-queued ones drop out.
  app.get("/lobbies/:id/stations/callable", async (req, reply) => {
    const lobbyId = String((req.params as any)?.id || "");
    const { canManage } = await ctx(req, lobbyId);
    if (!canManage) return reply.code(403).send({ ok: false, error: "forbidden" });

    const lobby = await prisma.lobby.findUnique({
      where: { id: lobbyId },
      select: { moduleConfig: true },
    });
    const ref = parseStartggRef((lobby?.moduleConfig as any)?.startgg?.ref);
    if (!ref || ref.kind !== "tournament") {
      return reply.send({ ok: true, sets: [], reason: "no_tournament_linked" });
    }

    let rows: Callable[] = [];
    try {
      rows = await startggCallable(`${ref.kind}/${ref.slug}`);
    } catch (e: any) {
      log.error(`[stations] callable: ${e?.message || e}`);
      return reply.code(502).send({ ok: false, error: "startgg_unavailable" });
    }
    const taken = new Set(
      (
        await prisma.stationAssignment.findMany({ where: { lobbyId }, select: { setId: true } })
      ).map((a) => a.setId),
    );
    return reply.send({ ok: true, sets: rows.filter((s) => !taken.has(s.setId)) });
  });

  // The setup list itself. Sent whole: a TO edits a list, not rows.
  app.put("/lobbies/:id/stations", async (req, reply) => {
    const lobbyId = String((req.params as any)?.id || "");
    const { user, canManage } = await ctx(req, lobbyId);
    if (!user) return reply.code(401).send({ ok: false, error: "unauthorized" });
    if (!canManage) return reply.code(403).send({ ok: false, error: "forbidden" });

    const body: any = (req as any).body || {};
    if (!Array.isArray(body.stations))
      return reply.code(400).send({ ok: false, error: "stations_array_required" });
    if (body.stations.length > 64)
      return reply
        .code(400)
        .send({ ok: false, error: "too_many", message: "64 setups is the cap." });

    const wanted = body.stations
      .map((s: any) => ({
        number: Number.parseInt(String(s?.number), 10),
        label: String(s?.label || "").slice(0, 40),
        kind: String(s?.kind || "").slice(0, 60),
        note: String(s?.note || "").slice(0, 120),
        state: STATES.has(String(s?.state)) ? String(s.state) : "OPEN",
      }))
      .filter((s: any) => Number.isFinite(s.number) && s.number > 0 && s.number < 1000);

    const seen = new Set<number>();
    const rows = wanted.filter((s: any) => (seen.has(s.number) ? false : seen.add(s.number)));

    for (const s of rows) {
      await prisma.station.upsert({
        where: { lobbyId_number: { lobbyId, number: s.number } },
        update: { label: s.label, kind: s.kind, note: s.note, state: s.state },
        create: {
          lobbyId,
          number: s.number,
          label: s.label,
          kind: s.kind,
          note: s.note,
          state: s.state,
        },
      });
    }
    // Dropping a setup drops its queue with it: the relation cascades.
    await prisma.station
      .deleteMany({ where: { lobbyId, number: { notIn: rows.map((s: any) => s.number) } } })
      .catch(swallow);

    const after = await prisma.station.findMany({
      where: { lobbyId },
      orderBy: { number: "asc" },
      include: { assignments: true },
    });
    return reply.send({ ok: true, stations: after.map(shapeStation) });
  });

  // Queue a set onto a setup. An empty setup takes it straight away.
  app.post("/lobbies/:id/stations/:stationId/assign", async (req, reply) => {
    const lobbyId = String((req.params as any)?.id || "");
    const stationId = String((req.params as any)?.stationId || "");
    const { user, canManage } = await ctx(req, lobbyId);
    if (!user) return reply.code(401).send({ ok: false, error: "unauthorized" });
    if (!canManage) return reply.code(403).send({ ok: false, error: "forbidden" });

    const station = await prisma.station.findFirst({ where: { id: stationId, lobbyId } });
    if (!station) return reply.code(404).send({ ok: false, error: "station_not_found" });

    const b: any = (req as any).body || {};
    const setId = String(b.setId || "").slice(0, 60);
    if (!setId) return reply.code(400).send({ ok: false, error: "setId_required" });

    const players = Array.isArray(b.players)
      ? b.players.map((p: any) => String(p).slice(0, 80)).slice(0, 8)
      : [];

    const existing = await prisma.stationAssignment.findUnique({
      where: { lobbyId_setId: { lobbyId, setId } },
      select: { id: true, stationId: true },
    });
    if (existing && existing.stationId !== stationId) {
      return reply
        .code(409)
        .send({ ok: false, error: "already_queued", message: "That set is on another setup." });
    }

    const occupied = await prisma.stationAssignment.findFirst({
      where: { stationId, position: 0 },
      select: { id: true },
    });
    const depth = await prisma.stationAssignment.count({ where: { stationId } });
    const position = occupied ? Math.max(1, depth) : 0;

    const data = {
      stationId,
      lobbyId,
      setId,
      identifier: String(b.identifier || "").slice(0, 12),
      roundText: String(b.roundText || "").slice(0, 60),
      eventName: String(b.eventName || "").slice(0, 60),
      players,
      position,
      calledAt: position === 0 ? new Date() : null,
    };
    if (existing) await prisma.stationAssignment.update({ where: { id: existing.id }, data });
    else await prisma.stationAssignment.create({ data });

    if (position === 0 && station.state === "OPEN") {
      await prisma.station.update({ where: { id: stationId }, data: { state: "PLAYING" } });
    }
    const after = await prisma.station.findFirst({
      where: { id: stationId },
      include: { assignments: true },
    });
    return reply.send({ ok: true, station: after ? shapeStation(after) : null });
  });

  // The set on the setup is done: drop it and pull the next one on.
  app.post("/lobbies/:id/stations/:stationId/advance", async (req, reply) => {
    const lobbyId = String((req.params as any)?.id || "");
    const stationId = String((req.params as any)?.stationId || "");
    const { user, canManage } = await ctx(req, lobbyId);
    if (!user) return reply.code(401).send({ ok: false, error: "unauthorized" });
    if (!canManage) return reply.code(403).send({ ok: false, error: "forbidden" });

    const station = await prisma.station.findFirst({ where: { id: stationId, lobbyId } });
    if (!station) return reply.code(404).send({ ok: false, error: "station_not_found" });

    await prisma.stationAssignment.deleteMany({ where: { stationId, position: 0 } });
    const queue = await prisma.stationAssignment.findMany({
      where: { stationId },
      orderBy: { position: "asc" },
    });
    // Close the gap: whatever was next becomes position 0 and is called now.
    for (let i = 0; i < queue.length; i++) {
      await prisma.stationAssignment.update({
        where: { id: queue[i].id },
        data: { position: i, calledAt: i === 0 ? queue[i].calledAt || new Date() : null },
      });
    }
    await prisma.station.update({
      where: { id: stationId },
      data: { state: queue.length ? "PLAYING" : station.state === "DOWN" ? "DOWN" : "OPEN" },
    });
    const after = await prisma.station.findFirst({
      where: { id: stationId },
      include: { assignments: true },
    });
    return reply.send({ ok: true, station: after ? shapeStation(after) : null });
  });

  // Take one set back off the board.
  app.delete("/lobbies/:id/stations/assignments/:assignmentId", async (req, reply) => {
    const lobbyId = String((req.params as any)?.id || "");
    const assignmentId = String((req.params as any)?.assignmentId || "");
    const { user, canManage } = await ctx(req, lobbyId);
    if (!user) return reply.code(401).send({ ok: false, error: "unauthorized" });
    if (!canManage) return reply.code(403).send({ ok: false, error: "forbidden" });

    const row = await prisma.stationAssignment.findFirst({
      where: { id: assignmentId, lobbyId },
      select: { id: true, stationId: true },
    });
    if (!row) return reply.code(404).send({ ok: false, error: "not_found" });
    await prisma.stationAssignment.delete({ where: { id: row.id } });

    const queue = await prisma.stationAssignment.findMany({
      where: { stationId: row.stationId },
      orderBy: { position: "asc" },
    });
    for (let i = 0; i < queue.length; i++) {
      if (queue[i].position !== i)
        await prisma.stationAssignment.update({
          where: { id: queue[i].id },
          data: { position: i },
        });
    }
    if (!queue.length) {
      await prisma.station
        .updateMany({ where: { id: row.stationId, state: "PLAYING" }, data: { state: "OPEN" } })
        .catch(swallow);
    }
    const after = await prisma.station.findFirst({
      where: { id: row.stationId },
      include: { assignments: true },
    });
    return reply.send({ ok: true, station: after ? shapeStation(after) : null });
  });
}

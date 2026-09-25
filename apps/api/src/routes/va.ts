import type { FastifyInstance } from "fastify";
import { swallow } from "../lib/logger";
import { prisma } from "../lib/prisma";
import { isStaffUser } from "../lib/isStaffUser";
import { lobbyLevelOf } from "../lib/lobbyAccess";
import { vaConfigOf, vaSnapshot, type VaConfig } from "../lib/va/source";
import type { VaPilot, VaPirep, VaRank, VaSnapshot } from "../lib/va/types";

/**
 * Virtual-airline crew hub (moduleType VIRTUAL_AIRLINE). First client: vOCN.
 *
 * Three audiences, enforced here rather than hidden in the UI:
 *   public  (level 0-1)     — the recruitment face: airline stats, the live
 *                             traffic picture WITHOUT pilot names, events.
 *                             Level 1 is a Weered member who pressed Join: that
 *                             is a visitor, not crew, or the open lobby that the
 *                             public face needs would hand anyone the crew area.
 *   crew    (level >= 2)    — roster, pilot profiles, the PIREP log, booking a
 *                             group-flight slot. Level 2 means "a verified pilot
 *                             of this airline": granted by staff for the demo,
 *                             by vAMSYS sign-in in stage two.
 *   staff   (level >= 4)    — the staff desk: review queue, applications,
 *                             inactivity, event fill.
 *
 * The airline's data comes from a VaSource (lib/va/source.ts): the sample
 * generator today, the airline's vAMSYS Operations API in stage two. The only
 * thing stored here is a member's claim on a group-flight slot (VaSlotClaim).
 */

type Opts = {
  authFromHeader?: (h?: string) => { id: string; name?: string; guest?: boolean } | null;
};

const CREW = 2;
const STAFF = 4;

type Access = {
  user: { id: string; name?: string } | null;
  level: number; // 0 = public, 1..5 = lobby level, staff count as 5
  isStaff: boolean;
};

function rankOf(snap: VaSnapshot, key: string | null): VaRank | null {
  return key ? snap.ranks.find((r) => r.key === key) || null : null;
}

/** The public never sees who is flying — only that the airline is. */
function anonymise(p: VaPirep) {
  const { pilotId: _i, pilotName: _n, ...rest } = p;
  return rest;
}

export default async function vaRoutes(app: FastifyInstance, opts: Opts) {
  const userOf = (req: any) => opts.authFromHeader?.(req.headers?.authorization) || null;

  async function load(lobbyId: string): Promise<{ cfg: VaConfig; lobbyName: string } | null> {
    const lobby = await prisma.lobby.findUnique({
      where: { id: lobbyId },
      select: { name: true, moduleType: true, moduleConfig: true },
    });
    if (!lobby || lobby.moduleType !== ("VIRTUAL_AIRLINE" as any)) return null;
    const cfg = vaConfigOf(lobby.moduleConfig);
    return cfg ? { cfg, lobbyName: lobby.name } : null;
  }

  async function accessOf(req: any, lobbyId: string): Promise<Access> {
    const u = userOf(req);
    if (!u || u.guest) return { user: null, level: 0, isStaff: false };
    try {
      if (await isStaffUser(u.id)) return { user: u, level: 5, isStaff: true };
      return { user: u, level: await lobbyLevelOf(u.id, lobbyId), isStaff: false };
    } catch (e) {
      swallow(e);
      return { user: u, level: 0, isStaff: false }; // fail closed: treat as public
    }
  }

  /** Resolve lobby + access, and refuse anyone below `min`. */
  async function gate(req: any, reply: any, min: number) {
    const lobbyId = String(req.params?.lobbyId || "");
    const l = await load(lobbyId);
    if (!l) {
      reply.code(404).send({ ok: false, error: "not_a_virtual_airline" });
      return null;
    }
    const access = await accessOf(req, lobbyId);
    if (access.level < min) {
      reply
        .code(access.user ? 403 : 401)
        .send({ ok: false, error: min >= STAFF ? "staff_only" : "crew_only" });
      return null;
    }
    const snap = await vaSnapshot(lobbyId, l.cfg);
    const myPilotId = access.user ? l.cfg.pilotLinks[access.user.id] || null : null;
    return { lobbyId, ...l, access, snap, myPilotId };
  }

  // ---------------------------------------------------------------- the hub
  app.get("/va/:lobbyId/hub", async (req: any, reply) => {
    const g = await gate(req, reply, 0);
    if (!g) return;
    const { snap, cfg, access } = g;
    const crew = access.level >= CREW;
    const gf = snap.groupFlights[0] || null;
    let groupFlight = null;
    if (gf) {
      const slots = gf.waves.flatMap((w) => w.slots);
      const claims = await prisma.vaSlotClaim
        .count({ where: { lobbyId: g.lobbyId, flightKey: gf.key } })
        .catch(() => 0);
      groupFlight = {
        key: gf.key,
        title: gf.title,
        subtitle: gf.subtitle,
        startsAt: gf.startsAt,
        eventId: gf.eventId,
        slots: slots.length,
        booked: slots.filter((s) => s.presetPilotId).length + claims,
        waves: gf.waves.map((w) => ({
          key: w.key,
          name: w.name,
          base: w.base,
          slots: w.slots.length,
        })),
      };
    }
    const byId = new Map(snap.pilots.map((p) => [p.id, p]));
    const d30 = Date.now() - 30 * 86_400_000;
    const d7 = Date.now() - 7 * 86_400_000;
    // Leaderboards: most hours this month, softest landings this week.
    const hours = new Map<string, number>();
    const soft: VaPirep[] = [];
    for (const p of snap.pireps) {
      const t = Date.parse(p.filedAt);
      if (t >= d30 && p.status !== "INVALIDATED")
        hours.set(p.pilotId, (hours.get(p.pilotId) || 0) + p.blockMinutes);
      if (t >= d7 && p.status === "ACCEPTED") soft.push(p);
    }
    soft.sort((a, b) => b.landingRateFpm - a.landingRateFpm);
    const leaderHours = [...hours.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id, min]) => ({
        pilotId: id,
        name: byId.get(id)?.name || id,
        rankKey: byId.get(id)?.rankKey,
        minutes: min,
      }));
    return {
      ok: true,
      sample: snap.source === "sample",
      generatedAt: snap.generatedAt,
      airline: cfg.airline,
      me: {
        level: access.level,
        isStaff: access.isStaff || access.level >= STAFF,
        signedIn: !!access.user,
        pilotId: g.myPilotId,
      },
      stats: snap.stats,
      ranks: snap.ranks,
      airports: snap.airports,
      // The public sees the traffic, not the people.
      live: crew ? snap.live : snap.live.map(({ pilotId: _i, pilotName: _n, ...f }) => f),
      departures: crew ? snap.departures.slice(0, 8) : [],
      pireps: crew ? snap.pireps.slice(0, 14) : snap.pireps.slice(0, 6).map(anonymise),
      leaders: crew
        ? {
            hours: leaderHours,
            landings: soft.slice(0, 5).map((p) => ({
              pilotId: p.pilotId,
              name: p.pilotName,
              rankKey: byId.get(p.pilotId)?.rankKey,
              landingRateFpm: p.landingRateFpm,
              route: `${p.dep}-${p.arr}`,
              fleet: p.fleet,
            })),
          }
        : null,
      groupFlight,
      links: cfg.links.filter((l) =>
        (l.audience || "crew") === "public"
          ? true
          : l.audience === "staff"
            ? access.level >= STAFF
            : crew,
      ),
    };
  });

  // ------------------------------------------------------------- the roster
  app.get("/va/:lobbyId/pilots", async (req: any, reply) => {
    const g = await gate(req, reply, CREW);
    if (!g) return;
    const d30 = Date.now() - 30 * 86_400_000;
    const pilots = g.snap.pilots
      .filter((p) => Date.parse(p.joinedAt) <= Date.now())
      .map((p) => ({
        ...p,
        active: !!p.lastFlightAt && Date.parse(p.lastFlightAt) >= d30,
        isMe: p.id === g.myPilotId,
      }))
      .sort((a, b) => b.minutes - a.minutes);
    return { ok: true, sample: g.snap.source === "sample", ranks: g.snap.ranks, pilots };
  });

  app.get("/va/:lobbyId/pilots/:pilotId", async (req: any, reply) => {
    const g = await gate(req, reply, CREW);
    if (!g) return;
    const id = String(req.params.pilotId || "").toUpperCase();
    const pilot: VaPilot | undefined = g.snap.pilots.find((p) => p.id === id);
    if (!pilot) return reply.code(404).send({ ok: false, error: "no_such_pilot" });
    const mine = g.snap.pireps.filter((p) => p.pilotId === id);
    const live = g.snap.live.find((f) => f.pilotId === id) || null;
    const booked = g.snap.departures.find((d) => d.pilotId === id) || null;

    // Where they stand, and what the next rank needs (vAMSYS: ALL thresholds).
    const ladder = g.snap.ranks.filter((r) => !r.honorary);
    const rank = rankOf(g.snap, pilot.rankKey);
    const next = ladder[ladder.findIndex((r) => r.key === pilot.rankKey) + 1] || null;
    const hours = pilot.minutes / 60;
    const progress = next
      ? {
          rank: next,
          hours: { have: Math.floor(hours), need: next.hours },
          points: { have: pilot.points, need: next.points },
          pireps: { have: pilot.pireps, need: next.pireps },
          // Bounded by the furthest-behind requirement, since all must be met.
          fraction: Math.min(
            1,
            next.hours ? hours / next.hours : 1,
            next.points ? pilot.points / next.points : 1,
            next.pireps ? pilot.pireps / next.pireps : 1,
          ),
        }
      : null;

    const byFleet: Record<string, number> = {};
    const routes = new Map<string, number>();
    const dests = new Set<string>();
    for (const p of mine) {
      byFleet[p.fleet] = (byFleet[p.fleet] || 0) + p.blockMinutes;
      const k = `${p.dep}-${p.arr}`;
      routes.set(k, (routes.get(k) || 0) + 1);
      dests.add(p.arr);
    }
    const accepted = mine.filter((p) => p.status === "ACCEPTED");
    const best = accepted.reduce<VaPirep | null>(
      (b, p) => (!b || p.landingRateFpm > b.landingRateFpm ? p : b),
      null,
    );
    return {
      ok: true,
      sample: g.snap.source === "sample",
      pilot: { ...pilot, isMe: pilot.id === g.myPilotId },
      rank,
      honorary: rankOf(g.snap, pilot.honoraryKey),
      progress,
      live,
      booked,
      stats: {
        windowPireps: mine.length,
        byFleetMinutes: byFleet,
        topRoutes: [...routes.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 4)
          .map(([r, n]) => ({ route: r, flights: n })),
        airportsVisited: dests.size,
        bestLanding: best
          ? { fpm: best.landingRateFpm, route: `${best.dep}-${best.arr}`, at: best.filedAt }
          : null,
      },
      pireps: mine.slice(0, 25),
    };
  });

  // ----------------------------------------------------------- the PIREP log
  app.get("/va/:lobbyId/pireps", async (req: any, reply) => {
    const g = await gate(req, reply, CREW);
    if (!g) return;
    const q = req.query || {};
    const status = typeof q.status === "string" ? q.status.toUpperCase() : "";
    const limit = Math.min(200, Math.max(1, Number(q.limit) || 60));
    let list = g.snap.pireps;
    if (status) list = list.filter((p) => p.status === status);
    if (typeof q.fleet === "string" && q.fleet) list = list.filter((p) => p.fleet === q.fleet);
    return {
      ok: true,
      sample: g.snap.source === "sample",
      pireps: list.slice(0, limit),
      total: list.length,
    };
  });

  // --------------------------------------------------------- the group flight
  async function boardOf(g: NonNullable<Awaited<ReturnType<typeof gate>>>, key: string) {
    const gf = g.snap.groupFlights.find((f) => f.key === key);
    if (!gf) return null;
    const claims = await prisma.vaSlotClaim.findMany({
      where: { lobbyId: g.lobbyId, flightKey: key },
    });
    const bySlot = new Map(claims.map((c) => [c.slotKey, c]));
    const pilots = new Map(g.snap.pilots.map((p) => [p.id, p]));
    const me = g.access.user?.id || null;
    let mySlot: string | null = null;
    const waves = gf.waves.map((w) => ({
      ...w,
      slots: w.slots.map((s) => {
        const c = bySlot.get(s.key);
        if (c && c.userId === me) mySlot = s.key;
        const preset = s.presetPilotId ? pilots.get(s.presetPilotId) : null;
        const holder = c
          ? {
              kind: "member" as const,
              name: c.userName,
              pilotId: c.pilotId,
              rankKey: c.pilotId ? (pilots.get(c.pilotId)?.rankKey ?? null) : null,
              mine: c.userId === me,
            }
          : preset
            ? {
                kind: "sample" as const,
                name: preset.name,
                pilotId: preset.id,
                rankKey: preset.rankKey,
                mine: false,
              }
            : null;
        const { presetPilotId: _p, ...slot } = s;
        return { ...slot, holder };
      }),
    }));
    const all = waves.flatMap((w) => w.slots);
    return {
      ...gf,
      waves,
      open: Date.parse(gf.startsAt) > Date.now(),
      totals: { slots: all.length, booked: all.filter((s) => s.holder).length },
      mySlot,
    };
  }

  app.get("/va/:lobbyId/groupflights/:key", async (req: any, reply) => {
    const g = await gate(req, reply, CREW);
    if (!g) return;
    const board = await boardOf(g, String(req.params.key || ""));
    if (!board) return reply.code(404).send({ ok: false, error: "no_such_flight" });
    return {
      ok: true,
      sample: g.snap.source === "sample",
      flight: board,
      me: { level: g.access.level, pilotId: g.myPilotId },
    };
  });

  // Claims are cheap to spam and they write rows; one per 3 s per member is plenty.
  const lastAct = new Map<string, number>();
  function throttled(userId: string): boolean {
    const now = Date.now();
    if (now - (lastAct.get(userId) || 0) < 3_000) return true;
    lastAct.set(userId, now);
    if (lastAct.size > 5000) lastAct.clear();
    return false;
  }

  app.post("/va/:lobbyId/groupflights/:key/slots/:slotKey/claim", async (req: any, reply) => {
    const g = await gate(req, reply, CREW);
    if (!g) return;
    const user = g.access.user!;
    if (throttled(user.id)) return reply.code(429).send({ ok: false, error: "slow_down" });
    const key = String(req.params.key || "");
    const slotKey = String(req.params.slotKey || "");
    const gf = g.snap.groupFlights.find((f) => f.key === key);
    const slot = gf?.waves.flatMap((w) => w.slots).find((s) => s.key === slotKey);
    if (!gf || !slot) return reply.code(404).send({ ok: false, error: "no_such_slot" });
    if (Date.parse(gf.startsAt) <= Date.now())
      return reply.code(409).send({ ok: false, error: "booking_closed" });
    if (slot.presetPilotId) return reply.code(409).send({ ok: false, error: "slot_taken" });
    try {
      // The two unique constraints on VaSlotClaim are the whole booking rule;
      // the database decides a race, not this handler.
      await prisma.vaSlotClaim.create({
        data: {
          lobbyId: g.lobbyId,
          flightKey: key,
          slotKey,
          userId: user.id,
          userName: String(user.name || "Crew member").slice(0, 60),
          pilotId: g.myPilotId,
        },
      });
    } catch (e: any) {
      if (e?.code === "P2002") {
        const already = await prisma.vaSlotClaim.findUnique({
          where: {
            lobbyId_flightKey_userId: { lobbyId: g.lobbyId, flightKey: key, userId: user.id },
          },
        });
        return reply
          .code(409)
          .send({
            ok: false,
            error: already ? "already_booked" : "slot_taken",
            slot: already?.slotKey,
          });
      }
      throw e;
    }
    const board = await boardOf(g, key);
    return { ok: true, flight: board };
  });

  app.post("/va/:lobbyId/groupflights/:key/release", async (req: any, reply) => {
    const g = await gate(req, reply, CREW);
    if (!g) return;
    const user = g.access.user!;
    if (throttled(user.id)) return reply.code(429).send({ ok: false, error: "slow_down" });
    const key = String(req.params.key || "");
    await prisma.vaSlotClaim.deleteMany({
      where: { lobbyId: g.lobbyId, flightKey: key, userId: user.id },
    });
    const board = await boardOf(g, key);
    if (!board) return reply.code(404).send({ ok: false, error: "no_such_flight" });
    return { ok: true, flight: board };
  });

  // --------------------------------------------------------------- staff desk
  app.get("/va/:lobbyId/staff", async (req: any, reply) => {
    const g = await gate(req, reply, STAFF);
    if (!g) return;
    const { snap } = g;
    const now = Date.now();
    const d30 = now - 30 * 86_400_000;
    const inactive = snap.pilots
      .filter(
        (p) =>
          Date.parse(p.joinedAt) < d30 && (!p.lastFlightAt || Date.parse(p.lastFlightAt) < d30),
      )
      .map((p) => ({
        id: p.id,
        name: p.name,
        rankKey: p.rankKey,
        hub: p.hub,
        lastFlightAt: p.lastFlightAt,
      }));
    const byRank: Record<string, number> = {};
    for (const p of snap.pilots) byRank[p.rankKey] = (byRank[p.rankKey] || 0) + 1;
    const board = snap.groupFlights[0] ? await boardOf(g, snap.groupFlights[0].key) : null;
    const recentClaims = await prisma.vaSlotClaim.findMany({
      where: { lobbyId: g.lobbyId },
      orderBy: { claimedAt: "desc" },
      take: 8,
    });
    return {
      ok: true,
      sample: snap.source === "sample",
      review: snap.pireps.filter(
        (p) => p.status === "AWAITING_REVIEW" || p.status === "PROCESSING",
      ),
      recentlyRejected: snap.pireps
        .filter((p) => p.status === "REJECTED" || p.status === "INVALIDATED")
        .slice(0, 6),
      applications: snap.applications,
      inactive,
      byRank,
      ranks: snap.ranks,
      event: board
        ? {
            key: board.key,
            title: board.title,
            startsAt: board.startsAt,
            totals: board.totals,
            waves: board.waves.map((w) => ({
              key: w.key,
              name: w.name,
              base: w.base,
              slots: w.slots.length,
              booked: w.slots.filter((s) => s.holder).length,
            })),
          }
        : null,
      recentClaims: recentClaims.map((c) => ({
        slotKey: c.slotKey,
        name: c.userName,
        at: c.claimedAt,
      })),
    };
  });
}

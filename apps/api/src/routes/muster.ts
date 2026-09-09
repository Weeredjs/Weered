import type { FastifyInstance } from "fastify";
import { log, swallow } from "../lib/logger";
import { prisma } from "../lib/prisma";
import { canManageLobby } from "../lib/lobbyAccess";
import { rconRead } from "../lib/hllvRcon";

// Muster — drill attendance read off the unit's own server.
//
// The unit keeps a roll of in-game names. An officer schedules a drill: a
// title, a window, and which of the lobby's RCON-linked servers to watch.
// Through the window a poller reads each server's roster every two minutes
// and records every name it sees. Afterwards each name on the roll is
// PRESENT, PARTIAL or ABSENT by the numbers; officers overwrite with LOA,
// ELOA, AWOL or EXCUSED; names that showed up but are not on the roll are
// listed so they can be added in one click. A date range gives the quarter.
//
// Attendance is by NAME, deliberately. A realism unit's roster is already a
// list of handles, and this has to work before the platoon has accounts.

type Opts = {
  authFromHeader?: (h?: string) => { id: string; name?: string } | null;
};

const POLL_MS = 2 * 60_000;
const PAD_MS = 10 * 60_000; // watch starts a little early and ends a little late
const DEFAULT_LEN_MS = 2 * 3_600_000;
const MAX_ROLL = 400;
const RCON_TIMEOUT = 8000;
const RCON_FRAMEWORKS = ["hll-rcon", "hllv-rcon"];

const MANUAL = new Set(["PRESENT", "ABSENT", "LOA", "ELOA", "AWOL", "EXCUSED"]);
const ROLL_STATUS = new Set(["ACTIVE", "RESERVE", "INACTIVE"]);

export function nameKey(name: string): string {
  return String(name || "")
    .normalize("NFKC")
    .replace(/^\[[^\]]{1,12}\]\s*/, "") // a leading clan tag is not the name
    .trim()
    .toLowerCase()
    .slice(0, 40);
}

/** Present when seen in at least two polls and at least a quarter of them;
 *  one sighting in a long window is someone who dropped in, not attendance. */
function autoStatus(seen: number, polls: number): "PRESENT" | "PARTIAL" | "ABSENT" {
  if (!seen) return "ABSENT";
  const need = Math.max(2, Math.ceil(polls * 0.25));
  return seen >= need ? "PRESENT" : "PARTIAL";
}

function splitHost(stored: string): { host: string; port: number } {
  const m = /^(.*):(\d+)$/.exec(stored || "");
  return m ? { host: m[1], port: Number(m[2]) } : { host: stored, port: 0 };
}

function csvCell(v: any): string {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export default async function musterRoutes(app: FastifyInstance, opts: Opts = {}) {
  const authFromHeader = opts.authFromHeader;

  async function gate(req: any, reply: any, lobbyId: string) {
    const u = authFromHeader?.(req.headers?.authorization);
    if (!u) {
      reply.code(401).send({ ok: false, error: "unauthorized" });
      return null;
    }
    if (!(await canManageLobby(u.id, lobbyId))) {
      reply.code(403).send({ ok: false, error: "mods_only" });
      return null;
    }
    return u;
  }

  // ---- the poller ------------------------------------------------------------

  async function readNames(serverId: string, lobbyId: string) {
    const row = await prisma.communityServer.findFirst({
      where: { id: serverId, lobbyId, framework: { in: RCON_FRAMEWORKS } },
    });
    if (!row) return null;
    const { host, port } = splitHost(String(row.host || ""));
    const players = await rconRead(
      host,
      port,
      String((row as any).apiKey || ""),
      (c) => c.info<any>("players"),
      RCON_TIMEOUT,
    );
    const rows: any[] = Array.isArray(players?.players) ? players.players : [];
    return rows
      .map((p) => ({
        name: String(p?.name || "").slice(0, 40),
        clan: p?.clanTag ? String(p.clanTag).slice(0, 12) : "",
      }))
      .filter((p) => p.name);
  }

  let polling = false;
  async function pollDrills() {
    if (polling) return;
    polling = true;
    const now = new Date();
    try {
      const due = await prisma.drill.findMany({
        where: { status: { not: "DONE" }, windowStart: { lte: now } },
        take: 50,
      });
      for (const d of due) {
        if (d.windowEnd < now) {
          await prisma.drill.update({ where: { id: d.id }, data: { status: "DONE" } });
          continue;
        }
        const seen = new Map<string, { name: string; clan: string }>();
        let reachable = 0;
        for (const sid of d.serverIds) {
          try {
            const names = await readNames(sid, d.lobbyId);
            if (!names) continue;
            reachable++;
            for (const p of names) {
              const k = nameKey(p.name);
              if (k && !seen.has(k)) seen.set(k, p);
            }
          } catch (e) {
            swallow(e);
          }
        }
        // An unreachable server is not an empty server: no poll is counted,
        // so nobody is marked absent for our failure to read.
        if (!reachable && d.serverIds.length) continue;
        await prisma.drill.update({
          where: { id: d.id },
          data: { polls: { increment: 1 }, status: "RUNNING" },
        });
        for (const [k, p] of seen) {
          await prisma.drillSighting.upsert({
            where: { drillId_nameKey: { drillId: d.id, nameKey: k } },
            create: { drillId: d.id, nameKey: k, name: p.name, clan: p.clan, seenPolls: 1 },
            update: { seenPolls: { increment: 1 }, lastSeenAt: now, name: p.name, clan: p.clan },
          });
        }
      }
    } catch (e) {
      swallow(e);
    } finally {
      polling = false;
    }
  }
  setTimeout(() => void pollDrills(), 60_000);
  setInterval(() => void pollDrills(), POLL_MS);

  // ---- attendance view ----------------------------------------------------------

  async function attendanceFor(drillId: string) {
    const d = await prisma.drill.findUnique({
      where: { id: drillId },
      include: { sightings: true, marks: true },
    });
    if (!d) return null;
    const roll = await prisma.musterMember.findMany({
      where: { lobbyId: d.lobbyId },
      orderBy: [{ squad: "asc" }, { name: "asc" }],
    });
    const sight = new Map(d.sightings.map((s) => [s.nameKey, s]));
    const mark = new Map(d.marks.map((m) => [m.nameKey, m]));
    const rows = roll.map((m) => {
      const s = sight.get(m.nameKey);
      const mk = mark.get(m.nameKey);
      const auto = autoStatus(s?.seenPolls || 0, d.polls);
      return {
        name: m.name,
        nameKey: m.nameKey,
        squad: m.squad,
        rollStatus: m.status,
        auto,
        status: mk?.status || auto,
        manual: !!mk,
        note: mk?.note || "",
        seenPolls: s?.seenPolls || 0,
        firstSeenAt: s?.firstSeenAt || null,
        lastSeenAt: s?.lastSeenAt || null,
        clan: s?.clan || "",
      };
    });
    const onRoll = new Set(roll.map((m) => m.nameKey));
    const unlisted = d.sightings
      .filter((s) => !onRoll.has(s.nameKey))
      .map((s) => ({
        name: s.name,
        nameKey: s.nameKey,
        clan: s.clan,
        seenPolls: s.seenPolls,
        auto: autoStatus(s.seenPolls, d.polls),
      }))
      .sort((a, b) => b.seenPolls - a.seenPolls);
    return {
      drill: {
        id: d.id,
        lobbyId: d.lobbyId,
        eventId: d.eventId,
        title: d.title,
        serverIds: d.serverIds,
        windowStart: d.windowStart,
        windowEnd: d.windowEnd,
        polls: d.polls,
        status: d.status,
      },
      rows,
      unlisted,
      counts: {
        present: rows.filter((r) => r.status === "PRESENT").length,
        partial: rows.filter((r) => r.status === "PARTIAL").length,
        absent: rows.filter((r) => r.status === "ABSENT" || r.status === "AWOL").length,
        leave: rows.filter((r) => r.status === "LOA" || r.status === "ELOA").length,
        excused: rows.filter((r) => r.status === "EXCUSED").length,
        roll: rows.length,
      },
    };
  }

  // ---- roll ---------------------------------------------------------------------

  app.get("/muster/:lobbyId/roll", { schema: { tags: ["muster"] } }, async (req, reply) => {
    const lobbyId = String((req as any).params?.lobbyId || "").slice(0, 64);
    const u = authFromHeader?.((req as any).headers?.authorization);
    const canManage = u ? await canManageLobby(u.id, lobbyId) : false;
    const members = await prisma.musterMember.findMany({
      where: { lobbyId },
      orderBy: [{ status: "asc" }, { squad: "asc" }, { name: "asc" }],
    });
    return reply.send({ ok: true, canManage, members });
  });

  app.post(
    "/muster/:lobbyId/roll",
    { schema: { tags: ["muster"] }, config: { rateLimit: { max: 60, timeWindow: "1 minute" } } },
    async (req, reply) => {
      const lobbyId = String((req as any).params?.lobbyId || "").slice(0, 64);
      if (!(await gate(req, reply, lobbyId))) return;
      const body: any = (req as any).body || {};
      // One name, or a pasted list: one per line, optional ", squad".
      const lines: string[] = Array.isArray(body.names)
        ? body.names
        : body.text
          ? String(body.text).split(/\r?\n/)
          : [String(body.name || "")];
      const squadDefault = String(body.squad || "").slice(0, 40);
      const status = ROLL_STATUS.has(String(body.status)) ? String(body.status) : "ACTIVE";
      const count = await prisma.musterMember.count({ where: { lobbyId } });
      let added = 0;
      let updated = 0;
      for (const raw of lines.slice(0, 200)) {
        const line = String(raw || "").trim();
        if (!line) continue;
        const [n, sq] = line.split(/\s*[,\t|]\s*/);
        const name = String(n || "")
          .replace(/^\[[^\]]{1,12}\]\s*/, "")
          .trim()
          .slice(0, 40);
        const key = nameKey(name);
        if (!key) continue;
        const squad = String(sq || squadDefault).slice(0, 40);
        const existing = await prisma.musterMember.findUnique({
          where: { lobbyId_nameKey: { lobbyId, nameKey: key } },
        });
        if (existing) {
          await prisma.musterMember.update({
            where: { id: existing.id },
            data: { name, ...(squad ? { squad } : {}), ...(body.status ? { status } : {}) },
          });
          updated++;
        } else {
          if (count + added >= MAX_ROLL) break;
          await prisma.musterMember.create({
            data: { lobbyId, name, nameKey: key, squad, status },
          });
          added++;
        }
      }
      return reply.send({ ok: true, added, updated });
    },
  );

  app.patch(
    "/muster/:lobbyId/roll/:id",
    { schema: { tags: ["muster"] }, config: { rateLimit: { max: 60, timeWindow: "1 minute" } } },
    async (req, reply) => {
      const lobbyId = String((req as any).params?.lobbyId || "").slice(0, 64);
      if (!(await gate(req, reply, lobbyId))) return;
      const id = String((req as any).params?.id || "");
      const body: any = (req as any).body || {};
      const data: any = {};
      if (typeof body.squad === "string") data.squad = body.squad.slice(0, 40);
      if (ROLL_STATUS.has(String(body.status))) data.status = String(body.status);
      if (typeof body.note === "string") data.note = body.note.slice(0, 200);
      if (typeof body.name === "string" && body.name.trim()) {
        data.name = body.name.trim().slice(0, 40);
        data.nameKey = nameKey(data.name);
      }
      await prisma.musterMember.updateMany({ where: { id, lobbyId }, data }).catch(swallow);
      return reply.send({ ok: true });
    },
  );

  app.delete(
    "/muster/:lobbyId/roll/:id",
    { schema: { tags: ["muster"] }, config: { rateLimit: { max: 60, timeWindow: "1 minute" } } },
    async (req, reply) => {
      const lobbyId = String((req as any).params?.lobbyId || "").slice(0, 64);
      if (!(await gate(req, reply, lobbyId))) return;
      const id = String((req as any).params?.id || "");
      await prisma.musterMember.deleteMany({ where: { id, lobbyId } }).catch(swallow);
      return reply.send({ ok: true });
    },
  );

  // ---- drills -------------------------------------------------------------------

  app.get("/muster/:lobbyId/drills", { schema: { tags: ["muster"] } }, async (req, reply) => {
    const lobbyId = String((req as any).params?.lobbyId || "").slice(0, 64);
    const u = authFromHeader?.((req as any).headers?.authorization);
    const canManage = u ? await canManageLobby(u.id, lobbyId) : false;
    const drills = await prisma.drill.findMany({
      where: { lobbyId },
      orderBy: { windowStart: "desc" },
      take: 40,
      include: { _count: { select: { sightings: true } } },
    });
    const servers = await prisma.communityServer.findMany({
      where: { lobbyId, framework: { in: RCON_FRAMEWORKS } },
      select: { id: true, name: true, framework: true },
      orderBy: { createdAt: "asc" },
    });
    return reply.send({
      ok: true,
      canManage,
      servers,
      drills: drills.map((d) => ({
        id: d.id,
        eventId: d.eventId,
        title: d.title,
        serverIds: d.serverIds,
        windowStart: d.windowStart,
        windowEnd: d.windowEnd,
        polls: d.polls,
        status: d.status,
        seen: d._count.sightings,
      })),
    });
  });

  app.post(
    "/muster/:lobbyId/drills",
    { schema: { tags: ["muster"] }, config: { rateLimit: { max: 30, timeWindow: "1 minute" } } },
    async (req, reply) => {
      const lobbyId = String((req as any).params?.lobbyId || "").slice(0, 64);
      const u = await gate(req, reply, lobbyId);
      if (!u) return;
      const body: any = (req as any).body || {};
      let title = String(body.title || "")
        .trim()
        .slice(0, 80);
      let startsAt = body.startsAt ? new Date(body.startsAt) : null;
      let endsAt = body.endsAt ? new Date(body.endsAt) : null;
      const eventId = body.eventId ? String(body.eventId).slice(0, 64) : null;
      if (eventId) {
        const ev = await prisma.event.findFirst({ where: { id: eventId, lobbyId } });
        if (!ev) return reply.code(404).send({ ok: false, error: "event_not_found" });
        title = title || ev.title.slice(0, 80);
        startsAt = startsAt || ev.startsAt;
        endsAt = endsAt || ev.endsAt || null;
      }
      if (!title || !startsAt || Number.isNaN(startsAt.getTime()))
        return reply.code(400).send({ ok: false, error: "missing_fields" });
      if (!endsAt || Number.isNaN(endsAt.getTime()) || endsAt <= startsAt)
        endsAt = new Date(startsAt.getTime() + DEFAULT_LEN_MS);
      if (endsAt.getTime() - startsAt.getTime() > 8 * 3_600_000)
        return reply.code(400).send({ ok: false, error: "too_long" });

      const wanted: string[] = Array.isArray(body.serverIds)
        ? body.serverIds.map((x: any) => String(x)).slice(0, 6)
        : [];
      const owned = await prisma.communityServer.findMany({
        where: { lobbyId, framework: { in: RCON_FRAMEWORKS }, id: { in: wanted } },
        select: { id: true },
      });
      const serverIds = owned.map((s) => s.id);
      if (!serverIds.length) return reply.code(400).send({ ok: false, error: "no_server" });

      const drill = await prisma.drill.create({
        data: {
          lobbyId,
          eventId,
          title,
          serverIds,
          windowStart: new Date(startsAt.getTime() - PAD_MS),
          windowEnd: new Date(endsAt.getTime() + PAD_MS),
          createdById: u.id,
        },
      });
      return reply.send({ ok: true, id: drill.id });
    },
  );

  app.delete(
    "/muster/:lobbyId/drills/:id",
    { schema: { tags: ["muster"] }, config: { rateLimit: { max: 30, timeWindow: "1 minute" } } },
    async (req, reply) => {
      const lobbyId = String((req as any).params?.lobbyId || "").slice(0, 64);
      if (!(await gate(req, reply, lobbyId))) return;
      const id = String((req as any).params?.id || "");
      await prisma.drill.deleteMany({ where: { id, lobbyId } }).catch(swallow);
      return reply.send({ ok: true });
    },
  );

  app.get("/muster/:lobbyId/drills/:id", { schema: { tags: ["muster"] } }, async (req, reply) => {
    const lobbyId = String((req as any).params?.lobbyId || "").slice(0, 64);
    const id = String((req as any).params?.id || "");
    const view = await attendanceFor(id);
    if (!view || view.drill.lobbyId !== lobbyId)
      return reply.code(404).send({ ok: false, error: "not_found" });
    return reply.send({ ok: true, ...view });
  });

  app.post(
    "/muster/:lobbyId/drills/:id/mark",
    { schema: { tags: ["muster"] }, config: { rateLimit: { max: 120, timeWindow: "1 minute" } } },
    async (req, reply) => {
      const lobbyId = String((req as any).params?.lobbyId || "").slice(0, 64);
      const u = await gate(req, reply, lobbyId);
      if (!u) return;
      const id = String((req as any).params?.id || "");
      const body: any = (req as any).body || {};
      const key = nameKey(String(body.name || body.nameKey || ""));
      if (!key) return reply.code(400).send({ ok: false, error: "missing_name" });
      const d = await prisma.drill.findFirst({ where: { id, lobbyId }, select: { id: true } });
      if (!d) return reply.code(404).send({ ok: false, error: "not_found" });
      const status = String(body.status || "").toUpperCase();
      if (status === "AUTO" || status === "") {
        await prisma.drillMark
          .delete({ where: { drillId_nameKey: { drillId: id, nameKey: key } } })
          .catch(swallow);
        return reply.send({ ok: true, cleared: true });
      }
      if (!MANUAL.has(status)) return reply.code(400).send({ ok: false, error: "bad_status" });
      const note = String(body.note || "").slice(0, 200);
      const byName = String(u.name || "").slice(0, 40);
      await prisma.drillMark.upsert({
        where: { drillId_nameKey: { drillId: id, nameKey: key } },
        create: { drillId: id, nameKey: key, status, note, byUserId: u.id, byName },
        update: { status, note, byUserId: u.id, byName },
      });
      return reply.send({ ok: true });
    },
  );

  // ---- the quarter --------------------------------------------------------------

  app.get("/muster/:lobbyId/summary", { schema: { tags: ["muster"] } }, async (req, reply) => {
    const lobbyId = String((req as any).params?.lobbyId || "").slice(0, 64);
    const q: any = (req as any).query || {};
    const now = new Date();
    const qStart = new Date(
      Date.UTC(now.getUTCFullYear(), Math.floor(now.getUTCMonth() / 3) * 3, 1),
    );
    const from = q.from ? new Date(q.from) : qStart;
    const to = q.to ? new Date(q.to) : now;
    const drills = await prisma.drill.findMany({
      where: { lobbyId, windowStart: { gte: from, lte: to }, status: "DONE" },
      orderBy: { windowStart: "asc" },
      include: { sightings: true, marks: true },
    });
    const roll = await prisma.musterMember.findMany({
      where: { lobbyId },
      orderBy: [{ status: "asc" }, { squad: "asc" }, { name: "asc" }],
    });
    const per = roll.map((m) => {
      const cells = drills.map((d) => {
        const s = d.sightings.find((x) => x.nameKey === m.nameKey);
        const mk = d.marks.find((x) => x.nameKey === m.nameKey);
        return mk?.status || autoStatus(s?.seenPolls || 0, d.polls);
      });
      const attended = cells.filter((c) => c === "PRESENT" || c === "PARTIAL").length;
      const leave = cells.filter((c) => c === "LOA" || c === "ELOA" || c === "EXCUSED").length;
      const held = drills.length - leave; // leave does not count against you
      return {
        name: m.name,
        squad: m.squad,
        rollStatus: m.status,
        attended,
        leave,
        held: drills.length,
        pct: held > 0 ? Math.round((attended / held) * 100) : null,
        cells,
      };
    });
    const header = {
      from,
      to,
      drills: drills.map((d) => ({ id: d.id, title: d.title, at: d.windowStart })),
    };
    if (String(q.format) === "csv") {
      const lines = [
        [
          "Name",
          "Squad",
          "Status",
          "Drills attended",
          "Drills held",
          "%",
          ...header.drills.map((d) => `${d.title} ${new Date(d.at).toISOString().slice(0, 10)}`),
        ]
          .map(csvCell)
          .join(","),
        ...per.map((p) =>
          [p.name, p.squad, p.rollStatus, p.attended, p.held, p.pct ?? "", ...p.cells]
            .map(csvCell)
            .join(","),
        ),
      ];
      reply.header("content-type", "text/csv; charset=utf-8");
      reply.header(
        "content-disposition",
        `attachment; filename="attendance-${lobbyId}-${from.toISOString().slice(0, 10)}.csv"`,
      );
      return reply.send(lines.join("\n") + "\n");
    }
    return reply.send({ ok: true, ...header, members: per });
  });

  log.info("[muster] routes up");
}

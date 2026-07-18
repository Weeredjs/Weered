import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";
import { swallow } from "../lib/logger";

// Co-Work: the lobby for solo operators. Two mechanics, both deliberately
// simple. THE SPRINT is one synchronized clock — 50 minutes of focus from the
// top of every hour, then 10 of break, same phase for everyone on the planet.
// The schedule is pure wall-clock arithmetic (nothing to configure, nothing to
// drift); the only server state is who joined which hour, and what they said
// they're working on. THE DAY BOARD is a public intentions list that resets
// daily. Both are in-memory and ephemeral by design — a co-working floor has
// no history, it has a today.

type Opts = {
  authFromHeader?: (h?: string) => { id: string; name?: string } | null;
};

const HOUR_MS = 3_600_000;
const FOCUS_MS = 50 * 60_000; // :00–:50 focus, :50–:00 break

type SprintEntry = { name: string; goal: string; at: number };
type DayEntry = {
  id: string;
  userId: string;
  name: string;
  text: string;
  done: boolean;
  at: number;
};

export default async function coworkRoutes(app: FastifyInstance, opts: Opts = {}) {
  const authFromHeader = opts.authFromHeader;

  // ---- the sprint --------------------------------------------------------
  const sprints = new Map<number, Map<string, SprintEntry>>();

  const sprintIdNow = () => Math.floor(Date.now() / HOUR_MS);
  const phaseNow = () => (Date.now() % HOUR_MS < FOCUS_MS ? "FOCUS" : "BREAK");

  function sweepSprints() {
    const cur = sprintIdNow();
    for (const k of sprints.keys()) if (k < cur) sprints.delete(k);
  }

  function rosterOf(id: number) {
    const m = sprints.get(id);
    if (!m) return [];
    return Array.from(m.entries()).map(([uid, e]) => ({ id: uid, name: e.name, goal: e.goal }));
  }

  async function displayName(userId: string): Promise<string> {
    try {
      const u = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
      return u?.name || "Someone";
    } catch (e) {
      swallow(e);
      return "Someone";
    }
  }

  app.get("/cowork/sprint", { schema: { tags: ["cowork"] } }, async (req, reply) => {
    sweepSprints();
    const u = authFromHeader?.((req as any).headers?.authorization);
    const now = Date.now();
    const id = sprintIdNow();
    const phase = phaseNow();
    const intoMs = now % HOUR_MS;
    const phaseEndsInSec =
      phase === "FOCUS"
        ? Math.ceil((FOCUS_MS - intoMs) / 1000)
        : Math.ceil((HOUR_MS - intoMs) / 1000);
    const joinedCurrent = !!(u && sprints.get(id)?.has(u.id));
    const joinedNext = !!(u && sprints.get(id + 1)?.has(u.id));
    return reply.send({
      ok: true,
      sprintId: id,
      phase,
      phaseEndsInSec,
      roster: rosterOf(id),
      nextRoster: rosterOf(id + 1),
      joined: phase === "FOCUS" ? joinedCurrent : joinedNext,
    });
  });

  // Join the sprint you can still act on: the running one during FOCUS, the
  // upcoming one during BREAK (the break is for deciding to show up).
  app.post("/cowork/sprint/join", { schema: { tags: ["cowork"] } }, async (req, reply) => {
    const u = authFromHeader?.((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    sweepSprints();
    const goal = String(((req as any).body || {}).goal || "")
      .trim()
      .slice(0, 140);
    const target = phaseNow() === "FOCUS" ? sprintIdNow() : sprintIdNow() + 1;
    let m = sprints.get(target);
    if (!m) {
      m = new Map();
      sprints.set(target, m);
    }
    if (m.size >= 200 && !m.has(u.id))
      return reply.code(429).send({ ok: false, error: "sprint_full" });
    m.set(u.id, { name: await displayName(u.id), goal, at: Date.now() });
    return reply.send({ ok: true, sprintId: target });
  });

  app.post("/cowork/sprint/leave", { schema: { tags: ["cowork"] } }, async (req, reply) => {
    const u = authFromHeader?.((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const id = sprintIdNow();
    sprints.get(id)?.delete(u.id);
    sprints.get(id + 1)?.delete(u.id);
    return reply.send({ ok: true });
  });

  // ---- the day board -----------------------------------------------------
  const days = new Map<string, Map<string, DayEntry>>();
  let _deSeq = 0;

  const dayKey = () => new Date().toISOString().slice(0, 10); // UTC day; a floor, not a timezone debate

  function sweepDays() {
    const today = dayKey();
    for (const k of days.keys()) if (k !== today) days.delete(k);
  }

  app.get("/cowork/today", { schema: { tags: ["cowork"] } }, async (req, reply) => {
    sweepDays();
    const u = authFromHeader?.((req as any).headers?.authorization);
    const m = days.get(dayKey());
    const entries = m
      ? Array.from(m.values())
          .sort((a, b) => a.at - b.at)
          .map((e) => ({
            id: e.id,
            name: e.name,
            text: e.text,
            done: e.done,
            mine: !!(u && e.userId === u.id),
          }))
      : [];
    return reply.send({ ok: true, day: dayKey(), entries });
  });

  app.post("/cowork/today", { schema: { tags: ["cowork"] } }, async (req, reply) => {
    const u = authFromHeader?.((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    sweepDays();
    const text = String(((req as any).body || {}).text || "")
      .trim()
      .slice(0, 120);
    if (!text) return reply.code(400).send({ ok: false, error: "empty" });
    let m = days.get(dayKey());
    if (!m) {
      m = new Map();
      days.set(dayKey(), m);
    }
    const mine = Array.from(m.values()).filter((e) => e.userId === u.id);
    if (mine.length >= 5) return reply.code(429).send({ ok: false, error: "board_full" });
    const id = `d${Date.now().toString(36)}${++_deSeq}`;
    m.set(id, {
      id,
      userId: u.id,
      name: await displayName(u.id),
      text,
      done: false,
      at: Date.now(),
    });
    return reply.send({ ok: true, id });
  });

  app.post("/cowork/today/:id/toggle", { schema: { tags: ["cowork"] } }, async (req, reply) => {
    const u = authFromHeader?.((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const e = days.get(dayKey())?.get(String((req as any).params?.id || ""));
    if (!e) return reply.code(404).send({ ok: false, error: "not_found" });
    if (e.userId !== u.id) return reply.code(403).send({ ok: false, error: "not_yours" });
    e.done = !e.done;
    return reply.send({ ok: true, done: e.done });
  });

  app.post("/cowork/today/:id/delete", { schema: { tags: ["cowork"] } }, async (req, reply) => {
    const u = authFromHeader?.((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const m = days.get(dayKey());
    const e = m?.get(String((req as any).params?.id || ""));
    if (!e) return reply.code(404).send({ ok: false, error: "not_found" });
    if (e.userId !== u.id) return reply.code(403).send({ ok: false, error: "not_yours" });
    m!.delete(e.id);
    return reply.send({ ok: true });
  });
}

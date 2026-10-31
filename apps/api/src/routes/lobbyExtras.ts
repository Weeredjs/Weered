import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";
import { swallow } from "../lib/logger";
import { hasLobbyPerm } from "../lib/lobbyPerms";
import { logLobbyAudit } from "../lib/lobbyAudit";
import { forgetHost } from "../lib/lobbyHost";
import { nextRunOf } from "../lib/lobbyAutomations";
import { HOST_OFF, cleanHost, cleanPost, type FeedSpec } from "../lib/build/jobs/people";
import { cleanCode } from "../lib/build/jobs/code";
import { clip, clipText, int } from "../lib/build/common";
import { canEnterPlace, isPlaceId } from "./places";

// What a lobby's staff build into it (James 2026-10-31, "Do everything"), and
// the routes that save it. The describe-it jobs (routes/aiDescribe.ts) only
// propose; these save.
//
//   Automations  GET/POST /lobbies/:id/admin/automations, PATCH/DELETE …/:aid
//                scheduled posts and feeds (lib/lobbyAutomations.ts runs them)
//   Alerts       GET/POST /lobbies/:id/alerts, DELETE …/:aid   a member's own
//   Host         GET/PATCH /lobbies/:id/admin/host              lib/lobbyHost.ts
//   Blocks       GET /lobbies/:id/blocks/:bid (anyone who can see the lobby)
//                GET/POST /lobbies/:id/admin/blocks, PATCH/DELETE …/:bid
//   Block data   GET /blocks/:bid/data?prefix=, GET/PUT /blocks/:bid/data/:key
//   Pages        GET /lobbies/:id/pages, GET /lobbies/:id/pages/:slug
//                POST /lobbies/:id/admin/pages, PATCH/DELETE …/:pid

type Opts = {
  authFromHeader: (
    h?: string,
  ) => { id: string; name: string; guest?: boolean; globalRole?: string } | null;
  lobbyAdminAccess: (req: any, reply: any, minLevel?: number) => Promise<any>;
  getGlobalRole: (userId: string) => Promise<string>;
  canAccessStaff: (role: string) => boolean;
};

const POSTS_MAX = 12;
const FEEDS_MAX = 8;
const ALERTS_MAX = 10;
const BLOCKS_MAX = 24;
const PAGES_MAX = 40;
const PAGE_BODY_MAX = 20_000;
const DATA_ROWS_MAX = 2_000;
const DATA_VALUE_MAX = 2_048;
const KEY_RE = /^[A-Za-z0-9_\-:.]{1,60}$/;

const TWITCH_RE = /^[a-z0-9_]{3,25}$/;
const YT_HANDLE_RE = /^@[A-Za-z0-9._-]{3,30}$/;

/** A feed someone confirmed in the Automations tab, made safe. */
export function cleanFeed(raw: unknown): FeedSpec | null {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const source = ["youtube", "twitch", "rss"].includes(String(r.source))
    ? (String(r.source) as FeedSpec["source"])
    : null;
  if (!source) return null;
  const t = String(r.target ?? "")
    .trim()
    .slice(0, 300);
  let target = "";
  if (source === "twitch") {
    const login = t
      .replace(/^@/, "")
      .replace(/^https?:\/\/(www\.)?twitch\.tv\//i, "")
      .replace(/[/?#].*$/, "")
      .toLowerCase();
    if (TWITCH_RE.test(login)) target = login;
  } else if (source === "youtube" && YT_HANDLE_RE.test(t)) {
    target = t;
  } else {
    try {
      const u = new URL(t);
      const yt = /^(www\.|m\.)?youtube\.com$/i.test(u.hostname);
      if ((u.protocol === "https:" || u.protocol === "http:") && (source === "rss" || yt))
        target = u.toString();
    } catch {
      /* not a link */
    }
  }
  if (!target) return null;
  const message =
    clip(r.message, 200) ||
    (source === "twitch" ? "{name} is live: {link}" : "New: {title} {link}");
  return { source, target, message };
}

const slugOf = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "page";

const view = (a: any) => ({
  id: a.id,
  kind: a.kind,
  spec: a.spec,
  active: a.active,
  nextRunAt: a.nextRunAt,
  lastRunAt: a.lastRunAt,
  lastResult: a.lastResult,
  createdAt: a.createdAt,
});

export default async function lobbyExtrasRoutes(app: FastifyInstance, opts: Opts) {
  const { authFromHeader, lobbyAdminAccess, getGlobalRole, canAccessStaff } = opts;

  /** The lobby's staff with this power, or null (the reply is sent). */
  async function staff(req: any, reply: any, perm = "edit_branding", minLevel = 4) {
    const ctx = await lobbyAdminAccess(req, reply, minLevel);
    if (!ctx) return null;
    const level = ctx.member?.roleLevel ?? (ctx.overrideRole ? 5 : 1);
    if (!hasLobbyPerm(level, perm, ctx.overrideRole)) {
      reply.code(403).send({ ok: false, error: "no_permission" });
      return null;
    }
    return { ...ctx, level } as {
      user: any;
      lobby: any;
      member: any;
      overrideRole: string | null;
      level: number;
    };
  }

  /** Can this visitor see the lobby's content? Places keep their owner's gate. */
  async function canSee(req: any, lobbyId: string) {
    if (!isPlaceId(lobbyId)) return true;
    const u = authFromHeader(req.headers?.authorization);
    const globalRole = u?.id ? await getGlobalRole(u.id).catch(() => "USER") : "USER";
    return canEnterPlace(u ? { ...u, globalRole } : null, lobbyId);
  }

  const audit = (ctx: any, type: string, note: string, targetId?: string) =>
    logLobbyAudit({
      lobbyId: ctx.lobby.id,
      type,
      actorId: ctx.user.id,
      actorName: ctx.user.name || "",
      note: note.slice(0, 200),
      targetId,
    }).catch(swallow);

  // ── Automations: scheduled posts and feeds ────────────────────────────────

  app.get("/lobbies/:id/admin/automations", async (req, reply) => {
    const ctx = await staff(req, reply);
    if (!ctx) return;
    const rows = await prisma.lobbyAutomation.findMany({
      where: { lobbyId: ctx.lobby.id, kind: { in: ["post", "feed"] } },
      orderBy: { createdAt: "asc" },
    });
    return reply.send({ ok: true, automations: rows.map(view) });
  });

  app.post("/lobbies/:id/admin/automations", async (req, reply) => {
    const ctx = await staff(req, reply);
    if (!ctx) return;
    const body: any = (req as any).body || {};
    const kind = String(body.kind || "");
    if (kind !== "post" && kind !== "feed")
      return reply.code(400).send({ ok: false, error: "bad_kind" });
    const count = await prisma.lobbyAutomation.count({ where: { lobbyId: ctx.lobby.id, kind } });
    if (count >= (kind === "post" ? POSTS_MAX : FEEDS_MAX))
      return reply
        .code(400)
        .send({ ok: false, error: "too_many", max: kind === "post" ? POSTS_MAX : FEEDS_MAX });
    let spec: any;
    let nextRunAt: Date | null;
    if (kind === "post") {
      spec = cleanPost(body.spec, body.tz);
      nextRunAt = nextRunOf(spec, Date.now());
      if (!nextRunAt) return reply.code(400).send({ ok: false, error: "in_the_past" });
    } else {
      spec = cleanFeed(body.spec);
      if (!spec) return reply.code(400).send({ ok: false, error: "bad_feed" });
      nextRunAt = new Date();
    }
    const row = await prisma.lobbyAutomation.create({
      data: { lobbyId: ctx.lobby.id, kind, spec, createdById: ctx.user.id, nextRunAt },
    });
    void audit(
      ctx,
      `automation_add`,
      `${kind}: ${kind === "post" ? spec.message : spec.target}`,
      row.id,
    );
    return reply.send({ ok: true, automation: view(row) });
  });

  app.patch("/lobbies/:id/admin/automations/:aid", async (req, reply) => {
    const ctx = await staff(req, reply);
    if (!ctx) return;
    const body: any = (req as any).body || {};
    const row = await prisma.lobbyAutomation.findFirst({
      where: {
        id: String((req.params as any).aid),
        lobbyId: ctx.lobby.id,
        kind: { in: ["post", "feed"] },
      },
    });
    if (!row) return reply.code(404).send({ ok: false, error: "not_found" });
    const data: any = {};
    let spec: any = row.spec;
    if (body.spec !== undefined) {
      spec = row.kind === "post" ? cleanPost(body.spec, body.tz) : cleanFeed(body.spec);
      if (!spec) return reply.code(400).send({ ok: false, error: "bad_feed" });
      data.spec = spec;
      if (row.kind === "feed") data.state = null; // a new target starts fresh
    }
    if (typeof body.active === "boolean") data.active = body.active;
    const active = data.active ?? row.active;
    if (row.kind === "post" && (data.spec || data.active === true)) {
      data.nextRunAt = nextRunOf(cleanPost(spec, "UTC"), Date.now());
      if (!data.nextRunAt && active)
        return reply.code(400).send({ ok: false, error: "in_the_past" });
    }
    if (row.kind === "feed" && (data.spec || data.active === true)) data.nextRunAt = new Date();
    const out = await prisma.lobbyAutomation.update({ where: { id: row.id }, data });
    return reply.send({ ok: true, automation: view(out) });
  });

  app.delete("/lobbies/:id/admin/automations/:aid", async (req, reply) => {
    const ctx = await staff(req, reply);
    if (!ctx) return;
    const n = await prisma.lobbyAutomation.deleteMany({
      where: {
        id: String((req.params as any).aid),
        lobbyId: ctx.lobby.id,
        kind: { in: ["post", "feed"] },
      },
    });
    if (n.count) void audit(ctx, "automation_remove", "", String((req.params as any).aid));
    return reply.send({ ok: true, removed: n.count });
  });

  // ── Alerts: a member's own ────────────────────────────────────────────────

  app.get("/lobbies/:id/alerts", async (req, reply) => {
    const ctx = await lobbyAdminAccess(req, reply, 1);
    if (!ctx) return;
    const rows = await prisma.lobbyAutomation.findMany({
      where: { lobbyId: ctx.lobby.id, kind: "alert", createdById: ctx.user.id },
      orderBy: { createdAt: "asc" },
    });
    return reply.send({ ok: true, alerts: rows.map(view) });
  });

  app.post("/lobbies/:id/alerts", async (req, reply) => {
    const ctx = await lobbyAdminAccess(req, reply, 1);
    if (!ctx) return;
    const body: any = (req as any).body || {};
    const roomId = String(body.roomId || "").slice(0, 128);
    const threshold = int(body.threshold, 2, 50);
    if (!roomId || threshold == null)
      return reply.code(400).send({ ok: false, error: "bad_alert" });
    let roomName = "";
    if (roomId === ctx.lobby.id) roomName = String(ctx.lobby.name || "Lobby chat");
    else {
      const room = await prisma.room.findFirst({
        where: { id: roomId, lobbyId: ctx.lobby.id },
        select: { name: true, minLevel: true },
      });
      const level = ctx.member?.roleLevel ?? (ctx.overrideRole ? 5 : 1);
      if (!room || (room.minLevel || 0) > level)
        return reply.code(404).send({ ok: false, error: "no_such_room" });
      roomName = room.name || "a room";
    }
    const mine = await prisma.lobbyAutomation.count({
      where: { lobbyId: ctx.lobby.id, kind: "alert", createdById: ctx.user.id },
    });
    if (mine >= ALERTS_MAX)
      return reply.code(400).send({ ok: false, error: "too_many", max: ALERTS_MAX });
    const row = await prisma.lobbyAutomation.create({
      data: {
        lobbyId: ctx.lobby.id,
        kind: "alert",
        spec: { roomId, roomName: clip(roomName, 80), threshold },
        createdById: ctx.user.id,
      },
    });
    return reply.send({ ok: true, alert: view(row) });
  });

  app.delete("/lobbies/:id/alerts/:aid", async (req, reply) => {
    const ctx = await lobbyAdminAccess(req, reply, 1);
    if (!ctx) return;
    const n = await prisma.lobbyAutomation.deleteMany({
      where: {
        id: String((req.params as any).aid),
        lobbyId: ctx.lobby.id,
        kind: "alert",
        createdById: ctx.user.id,
      },
    });
    return reply.send({ ok: true, removed: n.count });
  });

  // ── The lobby's host ──────────────────────────────────────────────────────

  app.get("/lobbies/:id/admin/host", async (req, reply) => {
    const ctx = await staff(req, reply);
    if (!ctx) return;
    const raw = (ctx.lobby as any).hostConfig;
    return reply.send({ ok: true, host: raw ? cleanHost(raw) : HOST_OFF });
  });

  app.patch("/lobbies/:id/admin/host", async (req, reply) => {
    const ctx = await staff(req, reply);
    if (!ctx) return;
    const host = cleanHost(((req as any).body || {}).host);
    if (host.on && !host.persona)
      return reply.code(400).send({ ok: false, error: "persona_required" });
    await prisma.lobby.update({
      where: { id: ctx.lobby.id },
      data: { hostConfig: host as any } as any,
    });
    forgetHost(ctx.lobby.id);
    void audit(ctx, "host_update", host.on ? `host: ${host.name}` : "host off");
    return reply.send({ ok: true, host });
  });

  // ── Custom blocks and games ───────────────────────────────────────────────

  /** Code that runs for visitors is saved by paid accounts and staff: someone
   *  accountable stands behind it. CUSTOM_BLOCKS_OPEN=1 opens it to everyone. */
  async function mayWriteCode(userId: string) {
    if (process.env.CUSTOM_BLOCKS_OPEN === "1") return true;
    const gr = await getGlobalRole(userId).catch(() => "USER");
    if (canAccessStaff(gr)) return true;
    const u = await prisma.user
      .findUnique({ where: { id: userId }, select: { tier: true } })
      .catch(() => null);
    return !!u?.tier && u.tier !== "INNOCENT";
  }

  app.get("/lobbies/:id/blocks/:bid", async (req, reply) => {
    const lobbyId = String((req.params as any).id);
    if (!(await canSee(req, lobbyId)))
      return reply.code(403).send({ ok: false, error: "place_gated" });
    const b = await prisma.customBlock.findFirst({
      where: { id: String((req.params as any).bid), lobbyId },
      select: { id: true, kind: true, title: true, height: true, code: true, updatedAt: true },
    });
    if (!b) return reply.code(404).send({ ok: false, error: "not_found" });
    reply.header("Cache-Control", "no-store");
    return reply.send({ ok: true, block: b });
  });

  app.get("/lobbies/:id/admin/blocks", async (req, reply) => {
    const ctx = await staff(req, reply);
    if (!ctx) return;
    const rows = await prisma.customBlock.findMany({
      where: { lobbyId: ctx.lobby.id },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        kind: true,
        title: true,
        height: true,
        prompt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return reply.send({ ok: true, blocks: rows, canWrite: await mayWriteCode(ctx.user.id) });
  });

  app.post("/lobbies/:id/admin/blocks", async (req, reply) => {
    const ctx = await staff(req, reply);
    if (!ctx) return;
    if (!(await mayWriteCode(ctx.user.id)))
      return reply.code(402).send({ ok: false, error: "paid_feature" });
    const body: any = (req as any).body || {};
    const kind = body.kind === "game" ? "game" : "block";
    const code = cleanCode(body, kind === "game" ? "l" : "m");
    if (!code.ok)
      return reply.code(400).send({ ok: false, error: "bad_code", message: code.reason });
    let count = await prisma.customBlock.count({ where: { lobbyId: ctx.lobby.id } });
    if (count >= BLOCKS_MAX) {
      // Full: clear out blocks the published Home doesn't use (built and left,
      // or taken off) that nobody has touched for a day, then count again.
      const used = Array.from(
        JSON.stringify((ctx.lobby as any).layout || {}).matchAll(/"customId":"([A-Za-z0-9_-]+)"/g),
        (m) => m[1],
      );
      await prisma.customBlock
        .deleteMany({
          where: {
            lobbyId: ctx.lobby.id,
            id: { notIn: used },
            updatedAt: { lt: new Date(Date.now() - 86_400_000) },
          },
        })
        .catch(swallow);
      count = await prisma.customBlock.count({ where: { lobbyId: ctx.lobby.id } });
    }
    if (count >= BLOCKS_MAX)
      return reply.code(400).send({ ok: false, error: "too_many", max: BLOCKS_MAX });
    const row = await prisma.customBlock.create({
      data: {
        lobbyId: ctx.lobby.id,
        kind,
        title: code.title,
        height: code.height,
        code: code.code,
        prompt: clipText(body.prompt, 600),
        createdById: ctx.user.id,
      },
      select: { id: true, kind: true, title: true, height: true, code: true, updatedAt: true },
    });
    void audit(ctx, "block_add", `${kind}: ${code.title}`, row.id);
    return reply.send({ ok: true, block: row });
  });

  app.patch("/lobbies/:id/admin/blocks/:bid", async (req, reply) => {
    const ctx = await staff(req, reply);
    if (!ctx) return;
    if (!(await mayWriteCode(ctx.user.id)))
      return reply.code(402).send({ ok: false, error: "paid_feature" });
    const row = await prisma.customBlock.findFirst({
      where: { id: String((req.params as any).bid), lobbyId: ctx.lobby.id },
    });
    if (!row) return reply.code(404).send({ ok: false, error: "not_found" });
    const body: any = (req as any).body || {};
    const code = cleanCode(
      {
        title: body.title ?? row.title,
        height: body.height ?? row.height,
        code: body.code ?? row.code,
      },
      row.height as any,
    );
    if (!code.ok)
      return reply.code(400).send({ ok: false, error: "bad_code", message: code.reason });
    const out = await prisma.customBlock.update({
      where: { id: row.id },
      data: {
        title: code.title,
        height: code.height,
        code: code.code,
        ...(typeof body.prompt === "string" ? { prompt: clipText(body.prompt, 600) } : {}),
      },
      select: { id: true, kind: true, title: true, height: true, code: true, updatedAt: true },
    });
    void audit(ctx, "block_update", code.title, row.id);
    return reply.send({ ok: true, block: out });
  });

  app.delete("/lobbies/:id/admin/blocks/:bid", async (req, reply) => {
    const ctx = await staff(req, reply);
    if (!ctx) return;
    const n = await prisma.customBlock.deleteMany({
      where: { id: String((req.params as any).bid), lobbyId: ctx.lobby.id },
    });
    if (n.count) void audit(ctx, "block_remove", "", String((req.params as any).bid));
    return reply.send({ ok: true, removed: n.count });
  });

  // ── What custom blocks keep ───────────────────────────────────────────────
  // Three kinds of key (lib/build/jobs/code.ts tells the builder):
  //   mine:…   each person's own (a vote, an entry): stored as "mine:…@<userId>",
  //            listed for everyone with who wrote it, changed only by its owner
  //   staff:…  changed only by the lobby's staff (an official scoreboard)
  //   others   anyone signed in

  async function blockFor(req: any, reply: any) {
    const b = await prisma.customBlock
      .findUnique({ where: { id: String(req.params.bid) }, select: { id: true, lobbyId: true } })
      .catch(() => null);
    if (!b) {
      reply.code(404).send({ ok: false, error: "not_found" });
      return null;
    }
    if (!(await canSee(req, b.lobbyId))) {
      reply.code(403).send({ ok: false, error: "place_gated" });
      return null;
    }
    return b;
  }

  const shown = (key: string) => (key.startsWith("mine:") ? key.replace(/@[^@]*$/, "") : key);
  const rowView = (r: any) => ({
    key: shown(r.key),
    value: r.value,
    by: r.updatedById ? { id: r.updatedById, name: r.updatedBy } : null,
    at: r.updatedAt,
  });

  app.get("/blocks/:bid/data", async (req, reply) => {
    const b = await blockFor(req, reply);
    if (!b) return;
    const prefix = String((req.query as any)?.prefix || "").slice(0, 60);
    const rows = await prisma.blockData.findMany({
      where: { blockId: b.id, ...(prefix ? { key: { startsWith: prefix } } : {}) },
      orderBy: { createdAt: "asc" },
      take: 500,
    });
    reply.header("Cache-Control", "no-store");
    return reply.send({ ok: true, items: rows.map(rowView) });
  });

  app.get("/blocks/:bid/data/:key", async (req, reply) => {
    const b = await blockFor(req, reply);
    if (!b) return;
    let key = String((req.params as any).key || "");
    if (!KEY_RE.test(key)) return reply.code(400).send({ ok: false, error: "bad_key" });
    if (key.startsWith("mine:")) {
      const u = authFromHeader(req.headers?.authorization);
      if (!u?.id || u.guest) return reply.send({ ok: true, item: null });
      key = `${key}@${u.id}`;
    }
    const row = await prisma.blockData.findUnique({
      where: { blockId_key: { blockId: b.id, key } },
    });
    reply.header("Cache-Control", "no-store");
    return reply.send({ ok: true, item: row ? rowView(row) : null });
  });

  app.put(
    "/blocks/:bid/data/:key",
    { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } },
    async (req, reply) => {
      const u = authFromHeader(req.headers?.authorization);
      if (!u?.id || u.guest) return reply.code(401).send({ ok: false, error: "sign_in" });
      const b = await blockFor(req, reply);
      if (!b) return;
      let key = String((req.params as any).key || "");
      if (!KEY_RE.test(key)) return reply.code(400).send({ ok: false, error: "bad_key" });
      if (key.startsWith("staff:")) {
        const gr = await getGlobalRole(u.id).catch(() => "USER");
        const m = canAccessStaff(gr)
          ? { roleLevel: 5 }
          : await prisma.lobbyMember.findUnique({
              where: { lobbyId_userId: { lobbyId: b.lobbyId, userId: u.id } },
              select: { roleLevel: true },
            });
        if (!m || (m.roleLevel ?? 1) < 3)
          return reply.code(403).send({ ok: false, error: "staff_only" });
      }
      if (key.startsWith("mine:")) key = `${key}@${u.id}`;
      const raw = ((req as any).body || {}).value;
      if (raw === null || raw === undefined) {
        await prisma.blockData.deleteMany({ where: { blockId: b.id, key } });
        return reply.send({ ok: true, item: null });
      }
      let json: string;
      try {
        json = JSON.stringify(raw);
      } catch {
        return reply.code(400).send({ ok: false, error: "bad_value" });
      }
      if (json.length > DATA_VALUE_MAX)
        return reply.code(400).send({ ok: false, error: "too_big", max: DATA_VALUE_MAX });
      const exists = await prisma.blockData.findUnique({
        where: { blockId_key: { blockId: b.id, key } },
        select: { id: true },
      });
      if (!exists && (await prisma.blockData.count({ where: { blockId: b.id } })) >= DATA_ROWS_MAX)
        return reply.code(400).send({ ok: false, error: "full", max: DATA_ROWS_MAX });
      const value = JSON.parse(json);
      const who = { updatedById: u.id, updatedBy: String(u.name || "").slice(0, 40) };
      const row = await prisma.blockData.upsert({
        where: { blockId_key: { blockId: b.id, key } },
        create: { blockId: b.id, key, value, ...who },
        update: { value, ...who },
      });
      return reply.send({ ok: true, item: rowView(row) });
    },
  );

  // ── Pages ─────────────────────────────────────────────────────────────────

  app.get("/lobbies/:id/pages", async (req, reply) => {
    const lobbyId = String((req.params as any).id);
    if (!(await canSee(req, lobbyId)))
      return reply.code(403).send({ ok: false, error: "place_gated" });
    const pages = await prisma.lobbyPage.findMany({
      where: { lobbyId },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      select: { id: true, slug: true, title: true, order: true, updatedAt: true },
    });
    return reply.send({ ok: true, pages });
  });

  app.get("/lobbies/:id/pages/:slug", async (req, reply) => {
    const lobbyId = String((req.params as any).id);
    if (!(await canSee(req, lobbyId)))
      return reply.code(403).send({ ok: false, error: "place_gated" });
    const page = await prisma.lobbyPage.findUnique({
      where: {
        lobbyId_slug: { lobbyId, slug: String((req.params as any).slug || "").slice(0, 60) },
      },
      select: { id: true, slug: true, title: true, body: true, order: true, updatedAt: true },
    });
    if (!page) return reply.code(404).send({ ok: false, error: "not_found" });
    return reply.send({ ok: true, page });
  });

  async function freeSlug(lobbyId: string, want: string, exceptId?: string) {
    const base = slugOf(want);
    for (let i = 0; i < 50; i++) {
      const slug = i ? `${base}-${i + 1}` : base;
      const hit = await prisma.lobbyPage.findUnique({
        where: { lobbyId_slug: { lobbyId, slug } },
        select: { id: true },
      });
      if (!hit || hit.id === exceptId) return slug;
    }
    return `${base}-${Date.now().toString(36)}`;
  }

  app.post("/lobbies/:id/admin/pages", async (req, reply) => {
    const ctx = await staff(req, reply);
    if (!ctx) return;
    const body: any = (req as any).body || {};
    const title = clip(body.title, 80);
    if (!title) return reply.code(400).send({ ok: false, error: "title_required" });
    const count = await prisma.lobbyPage.count({ where: { lobbyId: ctx.lobby.id } });
    if (count >= PAGES_MAX)
      return reply.code(400).send({ ok: false, error: "too_many", max: PAGES_MAX });
    const page = await prisma.lobbyPage.create({
      data: {
        lobbyId: ctx.lobby.id,
        slug: await freeSlug(ctx.lobby.id, String(body.slug || title)),
        title,
        body: clipText(body.body, PAGE_BODY_MAX),
        order: count,
        createdById: ctx.user.id,
      },
      select: { id: true, slug: true, title: true, body: true, order: true, updatedAt: true },
    });
    void audit(ctx, "page_add", title, page.id);
    return reply.send({ ok: true, page });
  });

  app.patch("/lobbies/:id/admin/pages/:pid", async (req, reply) => {
    const ctx = await staff(req, reply);
    if (!ctx) return;
    const row = await prisma.lobbyPage.findFirst({
      where: { id: String((req.params as any).pid), lobbyId: ctx.lobby.id },
    });
    if (!row) return reply.code(404).send({ ok: false, error: "not_found" });
    const body: any = (req as any).body || {};
    const data: any = {};
    if (typeof body.title === "string") data.title = clip(body.title, 80) || row.title;
    if (typeof body.body === "string") data.body = clipText(body.body, PAGE_BODY_MAX);
    if (typeof body.order === "number") data.order = int(body.order, 0, 1000) ?? row.order;
    if (typeof body.slug === "string" && body.slug.trim())
      data.slug = await freeSlug(ctx.lobby.id, body.slug, row.id);
    const page = await prisma.lobbyPage.update({
      where: { id: row.id },
      data,
      select: { id: true, slug: true, title: true, body: true, order: true, updatedAt: true },
    });
    void audit(ctx, "page_update", page.title, row.id);
    return reply.send({ ok: true, page });
  });

  app.delete("/lobbies/:id/admin/pages/:pid", async (req, reply) => {
    const ctx = await staff(req, reply);
    if (!ctx) return;
    const n = await prisma.lobbyPage.deleteMany({
      where: { id: String((req.params as any).pid), lobbyId: ctx.lobby.id },
    });
    if (n.count) void audit(ctx, "page_remove", "", String((req.params as any).pid));
    return reply.send({ ok: true, removed: n.count });
  });
}

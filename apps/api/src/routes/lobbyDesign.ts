import type { FastifyInstance } from "fastify";
import { promises as dns } from "dns";
import { prisma } from "../lib/prisma";
import { hasLobbyPerm } from "../lib/lobbyPerms";

// Design mode, custom domains and the request board (2026-10-29).
//
//   PATCH  /lobbies/:id/admin/design        save the lobby's layout (+ accent, modules)
//   PUT    /lobbies/:id/admin/domain        register the lobby's own domain
//   POST   /lobbies/:id/admin/domain/verify check the DNS points here; marks it live
//   DELETE /lobbies/:id/admin/domain        release it
//   GET    /domains/check?domain=           Caddy's on-demand TLS "ask": 200 only for registered hosts
//   GET    /domains/resolve?host=           host -> lobby id, for the web middleware
//   GET    /requests  POST /requests  POST /requests/:id/vote  PATCH /requests/:id (staff)

type Opts = {
  authFromHeader: (h?: string) => { id: string; name: string } | null;
  getGlobalRole: (userId: string) => Promise<any>;
  canAccessStaff: (role: any) => boolean;
  lobbyAdminAccess: (req: any, reply: any, minLevel?: number) => Promise<any>;
};

const LAYOUT_MAX_BYTES = 48_000;
const MODULE_KEYS = new Set([
  "voice",
  "video",
  "screen",
  "youtube",
  "reddit",
  "twitch",
  "news",
  "music",
]);
// Hosts that are ours or another tenant's, never a lobby's custom domain.
const RESERVED_HOST =
  /(^|\.)(weered\.ca|eastcoastemployeebenefits\.com|scotiablue\.com|localhost)$/i;
const HOSTNAME = /^(?=.{4,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
// The droplet. A custom domain is live when it resolves here (A record, or a
// CNAME to weered.ca, which ends at the same address).
const ORIGIN_HOST = "weered.ca";

export function normalizeHost(raw: unknown): string | null {
  let h = String(raw || "")
    .trim()
    .toLowerCase();
  h = h
    .replace(/^https?:\/\//, "")
    .replace(/[/?#].*$/, "")
    .replace(/:\d+$/, "")
    .replace(/\.$/, "");
  if (!HOSTNAME.test(h)) return null;
  if (RESERVED_HOST.test(h)) return null;
  return h;
}

async function addressesOf(host: string): Promise<string[]> {
  try {
    return await dns.resolve4(host);
  } catch {
    return [];
  }
}

// Small in-process cache so Caddy's ask and the middleware don't hit the
// database on every request. Busted on any domain write.
const hostCache = new Map<string, { lobbyId: string | null; at: number }>();
const HOST_TTL_MS = 60_000;
async function lobbyForHost(host: string): Promise<string | null> {
  const hit = hostCache.get(host);
  if (hit && Date.now() - hit.at < HOST_TTL_MS) return hit.lobbyId;
  const row = await prisma.lobby.findUnique({
    where: { customDomain: host },
    select: { id: true },
  });
  hostCache.set(host, { lobbyId: row?.id ?? null, at: Date.now() });
  return row?.id ?? null;
}

export default async function lobbyDesignRoutes(app: FastifyInstance, opts: Opts) {
  const { authFromHeader, getGlobalRole, canAccessStaff, lobbyAdminAccess } = opts;

  async function designer(req: any, reply: any) {
    const ctx = await lobbyAdminAccess(req, reply, 4);
    if (!ctx) return null;
    const level = ctx.member?.roleLevel ?? (ctx.overrideRole ? 5 : 1);
    if (!hasLobbyPerm(level, "edit_branding", ctx.overrideRole)) {
      reply.code(403).send({ ok: false, error: "no_permission" });
      return null;
    }
    return ctx;
  }

  // ── Design ────────────────────────────────────────────────────────────────
  app.patch("/lobbies/:id/admin/design", async (req, reply) => {
    const ctx = await designer(req, reply);
    if (!ctx) return;
    const body: any = (req as any).body || {};
    const data: any = {};
    if (body.layout === null) data.layout = null;
    else if (body.layout !== undefined) {
      if (typeof body.layout !== "object" || Array.isArray(body.layout))
        return reply.code(400).send({ ok: false, error: "layout_must_be_object" });
      const raw = JSON.stringify(body.layout);
      if (raw.length > LAYOUT_MAX_BYTES)
        return reply.code(413).send({ ok: false, error: "layout_too_large" });
      data.layout = JSON.parse(raw);
    }
    if (typeof body.accentColor === "string" && /^#[0-9a-f]{6}$/i.test(body.accentColor))
      data.accentColor = body.accentColor;
    if (typeof body.name === "string" && body.name.trim())
      data.name = body.name.trim().slice(0, 100);
    if (typeof body.description === "string") data.description = body.description.slice(0, 500);
    if (Array.isArray(body.enabledModules))
      data.enabledModules = body.enabledModules
        .map(String)
        .filter((m: string) => MODULE_KEYS.has(m));
    if (Object.keys(data).length === 0)
      return reply.code(400).send({ ok: false, error: "nothing_to_update" });
    await prisma.lobby.update({ where: { id: ctx.lobby.id }, data });
    await prisma.lobbyAudit
      .create({
        data: {
          lobbyId: ctx.lobby.id,
          type: "design_publish",
          actorId: ctx.user.id,
          actorName: ctx.user.name || "",
          note: Object.keys(data).join(", "),
        } as any,
      })
      .catch(() => {});
    return reply.send({ ok: true, updated: Object.keys(data) });
  });

  // ── Custom domain ─────────────────────────────────────────────────────────
  app.put("/lobbies/:id/admin/domain", async (req, reply) => {
    const ctx = await designer(req, reply);
    if (!ctx) return;
    const host = normalizeHost(((req as any).body || {}).domain);
    if (!host)
      return reply.code(400).send({
        ok: false,
        error: "bad_domain",
        message: "Enter a domain you own, like club.example.com.",
      });
    const taken = await prisma.lobby.findUnique({
      where: { customDomain: host },
      select: { id: true },
    });
    if (taken && taken.id !== ctx.lobby.id)
      return reply
        .code(409)
        .send({ ok: false, error: "domain_taken", message: "Another lobby uses that domain." });
    await prisma.lobby.update({
      where: { id: ctx.lobby.id },
      data: { customDomain: host, domainStatus: "pending", domainVerifiedAt: null },
    });
    hostCache.delete(host);
    if (ctx.lobby.customDomain) hostCache.delete(ctx.lobby.customDomain);
    const origin = await addressesOf(ORIGIN_HOST);
    return reply.send({
      ok: true,
      domain: host,
      status: "pending",
      dns: dnsInstructions(host, origin[0] || ""),
    });
  });

  app.post("/lobbies/:id/admin/domain/verify", async (req, reply) => {
    const ctx = await designer(req, reply);
    if (!ctx) return;
    const host = ctx.lobby.customDomain as string | null;
    if (!host) return reply.code(400).send({ ok: false, error: "no_domain" });
    const [mine, theirs] = await Promise.all([addressesOf(ORIGIN_HOST), addressesOf(host)]);
    const live = theirs.length > 0 && theirs.every((a) => mine.includes(a));
    await prisma.lobby.update({
      where: { id: ctx.lobby.id },
      data: live
        ? { domainStatus: "live", domainVerifiedAt: new Date() }
        : { domainStatus: "pending" },
    });
    hostCache.delete(host);
    return reply.send({
      ok: true,
      domain: host,
      status: live ? "live" : "pending",
      resolvesTo: theirs,
      expected: mine,
      dns: dnsInstructions(host, mine[0] || ""),
    });
  });

  app.delete("/lobbies/:id/admin/domain", async (req, reply) => {
    const ctx = await designer(req, reply);
    if (!ctx) return;
    if (ctx.lobby.customDomain) hostCache.delete(ctx.lobby.customDomain);
    await prisma.lobby.update({
      where: { id: ctx.lobby.id },
      data: { customDomain: null, domainStatus: null, domainVerifiedAt: null },
    });
    return reply.send({ ok: true });
  });

  // Caddy asks before issuing a certificate for an unknown host. Registered
  // domains only, so nobody can point a random name at us and burn our
  // Let's Encrypt rate limit.
  app.get("/domains/check", async (req, reply) => {
    const host = normalizeHost((req.query as any)?.domain);
    if (!host) return reply.code(404).send("no");
    const id = await lobbyForHost(host);
    return id ? reply.send("ok") : reply.code(404).send("no");
  });

  app.get("/domains/resolve", async (req, reply) => {
    const host = normalizeHost((req.query as any)?.host);
    if (!host) return reply.code(404).send({ ok: false });
    const id = await lobbyForHost(host);
    reply.header("Cache-Control", "public, max-age=60");
    return id ? reply.send({ ok: true, lobbyId: id }) : reply.code(404).send({ ok: false });
  });

  // ── Request board ─────────────────────────────────────────────────────────
  const STATUSES = new Set(["open", "planned", "building", "shipped", "declined"]);

  function view(r: any, userId: string | null) {
    const { voterIds, ...rest } = r;
    return { ...rest, voted: !!userId && Array.isArray(voterIds) && voterIds.includes(userId) };
  }

  app.get("/requests", async (req, reply) => {
    const q: any = req.query || {};
    const u = authFromHeader((req as any).headers?.authorization);
    const sort = q.sort === "new" ? "new" : "top";
    const where: any = {};
    if (q.kind === "game" || q.kind === "feature") where.kind = q.kind;
    if (typeof q.status === "string" && STATUSES.has(q.status)) where.status = q.status;
    else where.status = { not: "declined" };
    const rows = await prisma.featureRequest.findMany({
      where,
      orderBy:
        sort === "new" ? [{ createdAt: "desc" }] : [{ voteCount: "desc" }, { createdAt: "asc" }],
      take: 200,
    });
    return reply.send({ ok: true, requests: rows.map((r) => view(r, u?.id ?? null)) });
  });

  app.post("/requests", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "sign_in_to_request" });
    const b: any = (req as any).body || {};
    const title = String(b.title || "")
      .trim()
      .slice(0, 80);
    if (title.length < 2) return reply.code(400).send({ ok: false, error: "title_required" });
    const kind = b.kind === "feature" ? "feature" : "game";
    const since = new Date(Date.now() - 24 * 3600_000);
    const recent = await prisma.featureRequest.count({
      where: { userId: u.id, createdAt: { gt: since } },
    });
    if (recent >= 5)
      return reply
        .code(429)
        .send({ ok: false, error: "slow_down", message: "Five requests a day. Vote on the rest." });
    // Same title already on the board: vote for it instead of duplicating.
    const dupe = await prisma.featureRequest.findFirst({
      where: { kind, title: { equals: title, mode: "insensitive" }, status: { not: "declined" } },
    });
    if (dupe) {
      if (!dupe.voterIds.includes(u.id)) {
        const r = await prisma.featureRequest.update({
          where: { id: dupe.id },
          data: { voterIds: { push: u.id }, voteCount: { increment: 1 } },
        });
        return reply.send({ ok: true, merged: true, request: view(r, u.id) });
      }
      return reply.send({ ok: true, merged: true, request: view(dupe, u.id) });
    }
    const r = await prisma.featureRequest.create({
      data: {
        kind,
        title,
        note: String(b.note || "")
          .trim()
          .slice(0, 600),
        userId: u.id,
        userName: u.name || "",
        lobbyId: typeof b.lobbyId === "string" ? b.lobbyId.slice(0, 100) : null,
        voterIds: [u.id],
        voteCount: 1,
      },
    });
    return reply.send({ ok: true, request: view(r, u.id) });
  });

  app.post("/requests/:id/vote", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "sign_in_to_vote" });
    const id = String((req.params as any).id);
    const r = await prisma.featureRequest.findUnique({ where: { id } });
    if (!r) return reply.code(404).send({ ok: false });
    const has = r.voterIds.includes(u.id);
    const next = await prisma.featureRequest.update({
      where: { id },
      data: has
        ? { voterIds: r.voterIds.filter((v) => v !== u.id), voteCount: { decrement: 1 } }
        : { voterIds: { push: u.id }, voteCount: { increment: 1 } },
    });
    return reply.send({ ok: true, request: view(next, u.id) });
  });

  app.patch("/requests/:id", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false });
    if (!canAccessStaff(await getGlobalRole(u.id))) return reply.code(403).send({ ok: false });
    const b: any = (req as any).body || {};
    const data: any = {};
    if (typeof b.status === "string" && STATUSES.has(b.status)) data.status = b.status;
    if (typeof b.staffNote === "string") data.staffNote = b.staffNote.slice(0, 400);
    if (!Object.keys(data).length) return reply.code(400).send({ ok: false });
    const r = await prisma.featureRequest.update({
      where: { id: String((req.params as any).id) },
      data,
    });
    return reply.send({ ok: true, request: view(r, u.id) });
  });
}

function dnsInstructions(host: string, ip: string) {
  const labels = host.split(".");
  const apex = labels.length === 2;
  return apex
    ? { type: "A", name: "@", value: ip, note: `Point ${host} at ${ip}.` }
    : {
        type: "CNAME",
        name: labels[0],
        value: ORIGIN_HOST,
        note: `Point ${host} at ${ORIGIN_HOST}.`,
      };
}

import { isStaffRole } from "../lib/lobbyAuth";
import type { FastifyInstance } from "fastify";
import { promises as dns } from "dns";
import { createHmac } from "crypto";
import { prisma } from "../lib/prisma";
import { canOwnDomain } from "../lib/tiers";
import {
  addressAllowance,
  addressProblem,
  forgetWeeredHosts,
  weeredHostLobby,
} from "../lib/weeredHosts";
import { hasLobbyPerm } from "../lib/lobbyPerms";
import { logLobbyAudit } from "../lib/lobbyAudit";
import { sendMail } from "../lib/email";
import { isPlaceId } from "./places";

// Custom-build meeting requests go here, not on the public board.
const MEETING_NOTIFY_TO = process.env.MEETING_NOTIFY_TO || "james@weered.ca";

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

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
  // A name is 253 characters at most, so nothing longer is ever read. The
  // pattern that cut the path off took time that grew with the square of the
  // input: a megabyte of "?" in the domain box held the whole API for minutes,
  // and anyone with a lobby could send it (found 2026-11-12). The path is now
  // cut with a plain split, on a short string.
  let h = String(raw || "")
    .slice(0, 400)
    .trim()
    .toLowerCase();
  h = h
    .replace(/^https?:\/\//, "")
    .split(/[/?#]/, 1)[0]
    .replace(/:\d{1,5}$/, "")
    .replace(/\.$/, "");
  if (!HOSTNAME.test(h)) return null;
  if (RESERVED_HOST.test(h)) return null;
  return h;
}

/** The design fields POST /lobbies accepts from the create-lobby composer. */
export function designCreateExtras(layout: unknown, enabledModules: unknown): Record<string, any> {
  const out: Record<string, any> = {};
  if (layout && typeof layout === "object" && !Array.isArray(layout)) {
    const raw = JSON.stringify(layout);
    if (raw.length <= LAYOUT_MAX_BYTES) out.layout = JSON.parse(raw);
  }
  if (Array.isArray(enabledModules))
    out.enabledModules = enabledModules.map(String).filter((m) => MODULE_KEYS.has(m));
  return out;
}

/**
 * The TXT record that proves a lobby's admin runs a domain. Its value is tied to
 * the lobby and the name, so nobody can claim a domain they don't control, or
 * one that already points here for someone else. Pointing a name here was the
 * only check before, and a pending name already passed Caddy's gate and the
 * middleware (red team 2026-11-01, finding 18).
 */
export function domainProof(lobbyId: string, host: string): string {
  const key = process.env.JWT_SECRET || "weered-domain-proof";
  const mac = createHmac("sha256", key).update(`domain:${lobbyId}:${host}`).digest("hex");
  return `weered-verify=${mac.slice(0, 32)}`;
}

function proofRecord(lobbyId: string, host: string) {
  const labels = host.split(".");
  return {
    type: "TXT",
    name: labels.length === 2 ? "_weered" : `_weered.${labels[0]}`,
    value: domainProof(lobbyId, host),
    note: `Proves ${host} is yours.`,
  };
}

async function owns(lobbyId: string, host: string): Promise<boolean> {
  try {
    const want = domainProof(lobbyId, host);
    return (await dns.resolveTxt(`_weered.${host}`)).some((r) => r.join("") === want);
  } catch {
    return false;
  }
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
  // Live domains only: a pending one has proved nothing yet.
  const row = await prisma.lobby.findFirst({
    where: { customDomain: host, domainStatus: "live" },
    select: { id: true },
  });
  hostCache.set(host, { lobbyId: row?.id ?? null, at: Date.now() });
  return row?.id ?? null;
}

export default async function lobbyDesignRoutes(app: FastifyInstance, opts: Opts) {
  const { authFromHeader, getGlobalRole, lobbyAdminAccess } = opts;

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
      data.enabledModules = isPlaceId(ctx.lobby.id)
        ? [] // members' places are text only (routes/places.ts)
        : body.enabledModules.map(String).filter((m: string) => MODULE_KEYS.has(m));
    if (Object.keys(data).length === 0)
      return reply.code(400).send({ ok: false, error: "nothing_to_update" });
    await prisma.lobby.update({ where: { id: ctx.lobby.id }, data });
    await logLobbyAudit({
      lobbyId: ctx.lobby.id,
      type: "design_publish",
      actorId: ctx.user.id,
      actorName: ctx.user.name || "",
      note: Object.keys(data).join(", "),
    }).catch(() => {});
    return reply.send({ ok: true, updated: Object.keys(data) });
  });

  /** The lobby owner's plan, which is what pays for its addresses. */
  async function ownerPlan(lobby: { ownerId?: string | null }) {
    if (!lobby.ownerId) return null;
    return prisma.user
      .findUnique({ where: { id: lobby.ownerId }, select: { tier: true, globalRole: true } })
      .catch(() => null);
  }

  // ── <id>.weered.ca ────────────────────────────────────────────────────────
  // A lobby's own weered.ca address (2026-11-02 pricing): Felon covers one of
  // the owner's lobbies, Condemned three, Kingpin and staff any number. It
  // answers only while the owner's plan covers it (lib/weeredHosts.ts).
  const ADDRESS_PROBLEMS: Record<string, string> = {
    bad_label: "This lobby's name can't be a web address.",
    taken: "That address belongs to someone's place.",
    official: "Addresses with Weered in them are kept for Weered's own pages.",
  };
  async function addressState(lobby: any) {
    const allowance = addressAllowance(await ownerPlan(lobby));
    const used = lobby.ownerId
      ? await prisma.lobby.count({ where: { ownerId: lobby.ownerId, subdomain: true } })
      : 0;
    const host = `${lobby.id}.weered.ca`;
    return {
      host,
      on: !!lobby.subdomain,
      live: !!lobby.subdomain && (await weeredHostLobby(host)) === lobby.id,
      allowance: allowance === Infinity ? null : allowance,
      used,
      problem: await addressProblem(lobby.id, lobby.ownerId ?? null),
    };
  }

  app.get("/lobbies/:id/admin/subdomain", async (req, reply) => {
    const ctx = await designer(req, reply);
    if (!ctx) return;
    return reply.send({ ok: true, ...(await addressState(ctx.lobby)) });
  });

  app.put("/lobbies/:id/admin/subdomain", async (req, reply) => {
    const ctx = await designer(req, reply);
    if (!ctx) return;
    const on = ((req as any).body || {}).on === true;
    if (on && !ctx.lobby.subdomain) {
      const state = await addressState(ctx.lobby);
      if (state.problem)
        return reply
          .code(400)
          .send({ ok: false, error: state.problem, message: ADDRESS_PROBLEMS[state.problem] });
      if (state.allowance !== null && state.used >= state.allowance)
        return reply.code(402).send({
          ok: false,
          error: "plan_required",
          message:
            state.allowance === 0
              ? "A weered.ca address comes with Felon ($14 a month) for one lobby, or Condemned ($25) for three."
              : "Your plan's weered.ca addresses are all in use. Turn one off, or move up a plan.",
        });
    }
    await prisma.lobby.update({ where: { id: ctx.lobby.id }, data: { subdomain: on } });
    forgetWeeredHosts();
    await logLobbyAudit({
      lobbyId: ctx.lobby.id,
      type: on ? "address_on" : "address_off",
      actorId: ctx.user.id,
      actorName: ctx.user.name || "",
      note: `${ctx.lobby.id}.weered.ca`,
    }).catch(() => {});
    return reply.send({ ok: true, ...(await addressState({ ...ctx.lobby, subdomain: on })) });
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
    // A domain of your own is the Condemned plan's (lib/tiers.ts). A lobby that
    // already has one keeps it; staff can set one for anyone.
    const owner = await ownerPlan(ctx.lobby);
    const allowed =
      canOwnDomain(owner?.tier) ||
      isStaffRole(owner?.globalRole) ||
      isStaffRole(await getGlobalRole(ctx.user.id).catch(() => null)) ||
      ctx.lobby.customDomain === host;
    if (!allowed)
      return reply.code(402).send({
        ok: false,
        error: "plan_required",
        message: "A domain of your own comes with the Condemned plan ($25 a month).",
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
      txt: proofRecord(ctx.lobby.id, host),
    });
  });

  // The domain as it stands, with both records to add (the panel shows them).
  app.get("/lobbies/:id/admin/domain", async (req, reply) => {
    const ctx = await designer(req, reply);
    if (!ctx) return;
    const host = ctx.lobby.customDomain as string | null;
    if (!host) return reply.send({ ok: true, domain: null, status: null });
    const origin = await addressesOf(ORIGIN_HOST);
    return reply.send({
      ok: true,
      domain: host,
      status: ctx.lobby.domainStatus || "pending",
      dns: dnsInstructions(host, origin[0] || ""),
      txt: proofRecord(ctx.lobby.id, host),
    });
  });

  app.post("/lobbies/:id/admin/domain/verify", async (req, reply) => {
    const ctx = await designer(req, reply);
    if (!ctx) return;
    const host = ctx.lobby.customDomain as string | null;
    if (!host) return reply.code(400).send({ ok: false, error: "no_domain" });
    const [mine, theirs, owned] = await Promise.all([
      addressesOf(ORIGIN_HOST),
      addressesOf(host),
      owns(ctx.lobby.id, host),
    ]);
    // Live takes both: the name points here, and the TXT record proves it's theirs.
    const pointing = theirs.length > 0 && theirs.every((a) => mine.includes(a));
    const live = pointing && owned;
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
      pointing,
      owned,
      resolvesTo: theirs,
      expected: mine,
      dns: dnsInstructions(host, mine[0] || ""),
      txt: proofRecord(ctx.lobby.id, host),
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
    // <label>.weered.ca: a place, a lobby's address or a member's name (lib/weeredHosts.ts).
    const place = await weeredHostLobby(String((req.query as any)?.domain || ""));
    if (place) return reply.send("ok");
    const host = normalizeHost((req.query as any)?.domain);
    if (!host) return reply.code(404).send("no");
    const id = await lobbyForHost(host);
    return id ? reply.send("ok") : reply.code(404).send("no");
  });

  app.get("/domains/resolve", async (req, reply) => {
    const place = await weeredHostLobby(String((req.query as any)?.host || ""));
    if (place) {
      reply.header("Cache-Control", "public, max-age=60");
      return reply.send({ ok: true, lobbyId: place });
    }
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
    // Meeting requests are private: staff only, never on the public board.
    const staff = !!u && isStaffRole(await getGlobalRole(u.id));
    if (q.kind === "game" || q.kind === "feature") where.kind = q.kind;
    else if (q.kind === "meeting" && staff) where.kind = "meeting";
    else where.kind = { not: "meeting" };
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
    const kind = b.kind === "feature" ? "feature" : b.kind === "meeting" ? "meeting" : "game";
    const since = new Date(Date.now() - 24 * 3600_000);
    const recent = await prisma.featureRequest.count({
      where: { userId: u.id, createdAt: { gt: since } },
    });
    if (recent >= 5)
      return reply
        .code(429)
        .send({ ok: false, error: "slow_down", message: "Five requests a day. Vote on the rest." });
    if (kind === "meeting") {
      const company = String(b.company || "")
        .trim()
        .slice(0, 120);
      const contact = String(b.contact || "")
        .trim()
        .slice(0, 200);
      const size = String(b.size || "")
        .trim()
        .slice(0, 40);
      const details = String(b.note || "")
        .trim()
        .slice(0, 1500);
      if (!contact) return reply.code(400).send({ ok: false, error: "contact_required" });
      const note = [
        company && `Company: ${company}`,
        `Contact: ${contact}`,
        size && `Size: ${size}`,
        details,
      ]
        .filter(Boolean)
        .join("\n");
      const r = await prisma.featureRequest.create({
        data: {
          kind,
          title,
          note: note.slice(0, 2000),
          userId: u.id,
          userName: u.name || "",
          lobbyId: typeof b.lobbyId === "string" ? b.lobbyId.slice(0, 100) : null,
          voterIds: [u.id],
          voteCount: 1,
        },
      });
      sendMail({
        to: MEETING_NOTIFY_TO,
        subject: `[weered] Meeting request: ${title}${company ? ` (${company})` : ""}`,
        html:
          `<p><b>${esc(title)}</b></p>` +
          `<p>From @${esc(u.name || u.id)}</p>` +
          `<pre style="font:14px/1.5 sans-serif;white-space:pre-wrap">${esc(note)}</pre>`,
      }).catch(() => {});
      return reply.send({ ok: true, request: view(r, u.id) });
    }
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
    if (!isStaffRole(await getGlobalRole(u.id))) return reply.code(403).send({ ok: false });
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

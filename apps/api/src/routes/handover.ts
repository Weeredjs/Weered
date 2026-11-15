import type { FastifyInstance } from "fastify";
import { randomBytes } from "node:crypto";
import { LobbyRole } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { log, swallow } from "../lib/logger";
import { isStaffRole } from "../lib/lobbyAuth";
import { sendMail } from "../lib/email";

// Handing a lobby to its person (James 2026-11-15, the streamer campaign). We build
// a streamer's lobby before asking; it stays hidden (unlisted, link only) until they
// open a one-time link, signed in, and take it. Then it is theirs: owner, level 5,
// every room, and it joins the town. The builder steps out.
//   POST /staff/lobbies/:id/handover   staff: make the link (any older one dies); hides the lobby
//   GET  /handover/:token              public: which lobby, and is the link still good
//   POST /handover/:token/accept       signed in: take it
// Tokens live in SiteConfig ("handover:<token>"), so no schema change.

const DAYS = 30;
const PREFIX = "handover:";
const WEB = process.env.WEB_URL || "https://weered.ca";
const esc = (x: string) =>
  x.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );
const NOTIFY_TO =
  process.env.BUILDER_NOTIFY_TO || process.env.CONTACT_NOTIFY_TO || "james@weered.ca";

type Ticket = { lobbyId: string; by: string; byName: string; expiresAt: string };

async function readTicket(token: string): Promise<Ticket | null> {
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) return null;
  const row = await prisma.siteConfig.findUnique({ where: { key: PREFIX + token } });
  if (!row) return null;
  try {
    const t = JSON.parse(row.value);
    return t && typeof t.lobbyId === "string" ? (t as Ticket) : null;
  } catch {
    return null;
  }
}

export default async function handoverRoutes(
  app: FastifyInstance,
  opts: {
    authFromHeader: (h?: string) => { id: string; name: string } | null;
    getGlobalRole: (userId: string) => Promise<any>;
    rooms: Map<string, any>;
  },
) {
  const { authFromHeader, getGlobalRole, rooms } = opts;
  const audit = (actor: { id: string; name: string }, action: string, id: string, meta?: any) =>
    prisma.globalAudit
      .create({
        data: {
          actorId: actor.id,
          actorName: actor.name,
          action,
          targetId: id,
          targetName: id,
          meta,
        },
      })
      .catch(swallow);

  app.post("/staff/lobbies/:id/handover", async (req, reply) => {
    const u = authFromHeader((req.headers as any).authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    if (!isStaffRole(await getGlobalRole(u.id)))
      return reply.code(403).send({ ok: false, error: "staff_only" });
    const id = String((req.params as any).id || "");
    const lobby = await prisma.lobby.findUnique({
      where: { id },
      select: { id: true, name: true, deletedAt: true, pinned: true },
    });
    if (!lobby || lobby.deletedAt) return reply.code(404).send({ ok: false, error: "not_found" });
    // A game's built-in lobby belongs to the town, not to one person.
    if (lobby.pinned) return reply.code(400).send({ ok: false, error: "pinned_lobby" });
    // One live link per lobby: an older one stops working.
    const old = await prisma.siteConfig.findMany({ where: { key: { startsWith: PREFIX } } });
    for (const row of old) {
      try {
        if (JSON.parse(row.value)?.lobbyId === id)
          await prisma.siteConfig.delete({ where: { key: row.key } });
      } catch {
        /* a bad row is someone else's */
      }
    }
    const token = randomBytes(18).toString("base64url");
    const t: Ticket = {
      lobbyId: id,
      by: u.id,
      byName: u.name,
      expiresAt: new Date(Date.now() + DAYS * 86400000).toISOString(),
    };
    await prisma.siteConfig.create({ data: { key: PREFIX + token, value: JSON.stringify(t) } });
    // Hidden until it's taken: off Downtown, search and the map; the link still opens it.
    await prisma.lobby.update({ where: { id }, data: { unlisted: true } });
    void audit(u, "lobby.handover.link", id, { expiresAt: t.expiresAt });
    return reply.send({ ok: true, url: `${WEB}/handover/${token}`, expiresAt: t.expiresAt });
  });

  app.get("/handover/:token", async (req, reply) => {
    const t = await readTicket(String((req.params as any).token || ""));
    if (!t) return reply.code(404).send({ ok: false, error: "not_found" });
    const lobby = await prisma.lobby.findUnique({
      where: { id: t.lobbyId },
      select: {
        id: true,
        name: true,
        description: true,
        accentColor: true,
        logoUrl: true,
        bannerUrl: true,
        deletedAt: true,
      },
    });
    if (!lobby || lobby.deletedAt) return reply.code(404).send({ ok: false, error: "not_found" });
    if (Date.parse(t.expiresAt) < Date.now())
      return reply.code(410).send({ ok: false, error: "expired" });
    const { deletedAt: _d, ...shown } = lobby;
    return reply.send({ ok: true, lobby: shown, expiresAt: t.expiresAt });
  });

  app.post("/handover/:token/accept", async (req, reply) => {
    const u = authFromHeader((req.headers as any).authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const token = String((req.params as any).token || "");
    const t = await readTicket(token);
    if (!t) return reply.code(404).send({ ok: false, error: "not_found" });
    if (Date.parse(t.expiresAt) < Date.now())
      return reply.code(410).send({ ok: false, error: "expired" });
    const lobby = await prisma.lobby.findUnique({
      where: { id: t.lobbyId },
      select: { id: true, name: true, ownerId: true, deletedAt: true },
    });
    if (!lobby || lobby.deletedAt) return reply.code(404).send({ ok: false, error: "not_found" });
    const me = await prisma.user.findUnique({
      where: { id: u.id },
      select: { name: true, usernameKey: true, isGuest: true, email: true },
    });
    if (!me || me.isGuest) return reply.code(403).send({ ok: false, error: "account_needed" });
    const prev = lobby.ownerId;

    try {
      await prisma.$transaction(async (tx) => {
        // The link is spent the moment it works, so two clicks can't both win.
        const gone = await tx.siteConfig.deleteMany({ where: { key: PREFIX + token } });
        if (!gone.count) throw new Error("spent");
        await tx.lobby.update({
          where: { id: lobby.id },
          data: { ownerId: u.id, unlisted: false },
        });
        if (prev && prev !== u.id)
          await tx.room.updateMany({
            where: { lobbyId: lobby.id, ownerId: prev },
            data: { ownerId: u.id },
          });
        await tx.lobbyMember.upsert({
          where: { lobbyId_userId: { lobbyId: lobby.id, userId: u.id } },
          update: { role: LobbyRole.OWNER, roleLevel: 5 },
          create: {
            lobbyId: lobby.id,
            userId: u.id,
            name: me.name,
            role: LobbyRole.OWNER,
            roleLevel: 5,
          },
        });
        // The builder steps out.
        if (prev && prev !== u.id)
          await tx.lobbyMember.deleteMany({ where: { lobbyId: lobby.id, userId: prev } });
      });
    } catch (e: any) {
      if (String(e?.message) === "spent")
        return reply.code(410).send({ ok: false, error: "spent" });
      throw e;
    }

    // Rooms held in memory carry their owner too.
    if (prev && prev !== u.id)
      for (const r of rooms.values())
        if (r?.lobbyId === lobby.id && r.ownerId === prev) r.ownerId = u.id;

    void audit({ id: u.id, name: me.name || u.name }, "lobby.handover.taken", lobby.id, {
      from: prev,
      builtBy: t.by,
    });
    const who = `${me.name || me.usernameKey}${me.usernameKey && me.usernameKey !== me.name ? ` (@${me.usernameKey})` : ""}`;
    const link = `${WEB}/lobby/${encodeURIComponent(lobby.id)}`;
    void sendMail({
      to: NOTIFY_TO,
      ...(me.email ? { replyTo: me.email } : {}),
      subject: `[weered.ca] ${lobby.name} was taken by ${me.name || me.usernameKey}`,
      text: `${who} took ${lobby.name}: ${link}\n\nIt's theirs now and in the town.${me.email ? ` Their email: ${me.email}.` : ""}`,
      html: `<p>${esc(who)} took ${esc(lobby.name)}: <a href="${link}">${link}</a></p><p>It's theirs now and in the town.${me.email ? ` Their email: ${esc(me.email)}.` : ""}</p>`,
    }).catch((e: any) => log.warn("[handover mail]", e?.message || e));
    return reply.send({ ok: true, lobbyId: lobby.id });
  });
}

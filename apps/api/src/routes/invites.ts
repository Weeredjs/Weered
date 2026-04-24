import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";

// /invites/* — invite link lifecycle. Types: PLATFORM (no target),
// ROOM, LOBBY, CREW (each gates on a targetId). Accept performs the
// matching membership upsert. /invites/send creates a single-use
// invite + delivers it via DM in one shot.
type Opts = {
  authFromHeader: (h?: string) => { id: string; name: string } | null;
  awardNotoriety: (userId: string, action: string) => Promise<number | null>;
  getGlobalRole: (userId: string) => Promise<string | null>;
  canAssignRoles: (role: string | null) => boolean;
  WEB_URL: string;
};

export default async function invitesRoutes(app: FastifyInstance, opts: Opts) {
  const { authFromHeader, awardNotoriety, getGlobalRole, canAssignRoles, WEB_URL } = opts;

  app.post("/invites", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const body: any = (req.body as any) || {};
    const type     = String(body.type || "PLATFORM").toUpperCase();
    const targetId = body.targetId ? String(body.targetId) : null;
    const maxUses  = Math.min(Math.max(Number(body.maxUses) || 1, 1), 100);
    const note     = body.note ? String(body.note).slice(0, 200) : null;
    const ttlHours = Number(body.ttlHours) || 0;
    const expiresAt = ttlHours > 0 ? new Date(Date.now() + ttlHours * 3600 * 1000) : null;
    const validTypes = ["PLATFORM", "ROOM", "LOBBY", "CREW"];
    if (!validTypes.includes(type)) return reply.code(400).send({ ok: false, error: "invalid_type" });
    const invite = await prisma.invite.create({
      data: { type: type as any, targetId, createdBy: u.id, note, maxUses, expiresAt },
    });
    return reply.send({ ok: true, invite: { token: invite.token, type: invite.type, targetId: invite.targetId, maxUses, expiresAt, url: `${WEB_URL}/invite/${invite.token}` } });
  });

  app.get("/invites/mine", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const invites = await prisma.invite.findMany({
      where: { createdBy: u.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return reply.send({ ok: true, invites: invites.map((i: { token: any; }) => ({ ...i, url: `${WEB_URL}/invite/${i.token}` })) });
  });

  app.get("/invites/:token", async (req, reply) => {
    const token = String((req as any).params?.token || "");
    const invite = await prisma.invite.findUnique({ where: { token } });
    if (!invite) return reply.code(404).send({ ok: false, error: "not_found" });
    if (invite.expiresAt && invite.expiresAt < new Date()) return reply.code(410).send({ ok: false, error: "expired" });
    if (invite.uses >= invite.maxUses) return reply.code(410).send({ ok: false, error: "exhausted" });
    let targetName = "";
    if (invite.targetId) {
      if (invite.type === "ROOM") {
        const r = await prisma.room.findUnique({ where: { id: invite.targetId }, select: { name: true } }).catch(() => null);
        targetName = r?.name || invite.targetId;
      } else if (invite.type === "LOBBY") {
        const l = await prisma.lobby.findUnique({ where: { id: invite.targetId }, select: { name: true } }).catch(() => null);
        targetName = l?.name || invite.targetId;
      } else if (invite.type === "CREW") {
        const c = await prisma.crew.findUnique({ where: { id: invite.targetId }, select: { name: true, tag: true } }).catch(() => null);
        targetName = c ? `${c.name} [${c.tag}]` : invite.targetId;
      }
    }
    const creator = await prisma.user.findUnique({ where: { id: invite.createdBy }, select: { name: true, usernameKey: true } }).catch(() => null);
    return reply.send({ ok: true, invite: { ...invite, targetName, creatorName: creator?.name || creator?.usernameKey || "unknown" } });
  });

  app.post("/invites/:token/accept", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const token = String((req as any).params?.token || "");
    const invite = await prisma.invite.findUnique({ where: { token } });
    if (!invite) return reply.code(404).send({ ok: false, error: "not_found" });
    if (invite.expiresAt && invite.expiresAt < new Date()) return reply.code(410).send({ ok: false, error: "expired" });
    if (invite.uses >= invite.maxUses) return reply.code(410).send({ ok: false, error: "exhausted" });

    await prisma.invite.update({ where: { token }, data: { uses: { increment: 1 } } });

    let redirect = "/lobby";
    if (invite.type === "ROOM" && invite.targetId) {
      await prisma.roomMember.upsert({
        where: { roomId_userId: { roomId: invite.targetId, userId: u.id } },
        create: { roomId: invite.targetId, userId: u.id, name: u.name, role: "MEMBER" },
        update: {},
      }).catch(() => {});
      redirect = `/room/${encodeURIComponent(invite.targetId)}`;
    } else if (invite.type === "LOBBY" && invite.targetId) {
      await prisma.lobbyMember.upsert({
        where: { lobbyId_userId: { lobbyId: invite.targetId, userId: u.id } },
        create: { lobbyId: invite.targetId, userId: u.id, name: u.name, role: "MEMBER" },
        update: {},
      }).catch(() => {});
      redirect = `/lobby/${encodeURIComponent(invite.targetId)}`;
    } else if (invite.type === "CREW" && invite.targetId) {
      await prisma.crewMember.upsert({
        where: { crewId_userId: { crewId: invite.targetId, userId: u.id } },
        create: { crewId: invite.targetId, userId: u.id, name: u.name, role: "MEMBER" },
        update: {},
      }).catch(() => {});
      awardNotoriety(u.id, "CREW_JOINED").catch(() => {});
      redirect = "/lobby";
    }

    if (invite.createdBy !== u.id) {
      const msg = invite.type === "PLATFORM"
        ? `${u.name} joined Weered using your invite!`
        : `${u.name} joined via your ${invite.type.toLowerCase()} invite${invite.targetId ? ` (${invite.targetId})` : ""}.`;
      await prisma.directMessage.create({
        data: { fromId: u.id, toId: invite.createdBy, body: msg },
      }).catch(() => {});
    }

    return reply.send({ ok: true, redirect, type: invite.type, targetId: invite.targetId });
  });

  app.post("/invites/send", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const body: any = (req.body as any) || {};
    const username = String(body.username || "").toLowerCase().trim();
    const type     = String(body.type || "PLATFORM").toUpperCase();
    const targetId = body.targetId ? String(body.targetId) : null;
    if (!username) return reply.code(400).send({ ok: false, error: "username_required" });
    const target = await prisma.user.findFirst({ where: { OR: [{ usernameKey: username }, { name: { equals: username, mode: "insensitive" } }] }, select: { id: true, name: true } });
    if (!target) return reply.code(404).send({ ok: false, error: "user_not_found" });
    if (target.id === u.id) return reply.code(400).send({ ok: false, error: "cannot_invite_self" });
    const invite = await prisma.invite.create({
      data: { type: type as any, targetId, createdBy: u.id, maxUses: 1, expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000) },
    });
    const inviteUrl = `${WEB_URL}/invite/${invite.token}`;
    const msg = type === "PLATFORM"
      ? `${u.name} invited you to join Weered! ${inviteUrl}`
      : `${u.name} invited you to join a ${type.toLowerCase()}. ${inviteUrl}`;
    await prisma.directMessage.create({ data: { fromId: u.id, toId: target.id, body: msg } });
    return reply.send({ ok: true, token: invite.token, url: inviteUrl, sentTo: target.name });
  });

  app.delete("/invites/:token", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const token = String((req as any).params?.token || "");
    const invite = await prisma.invite.findUnique({ where: { token } });
    if (!invite) return reply.code(404).send({ ok: false, error: "not_found" });
    const role = await getGlobalRole(u.id);
    if (invite.createdBy !== u.id && !canAssignRoles(role)) return reply.code(403).send({ ok: false, error: "forbidden" });
    await prisma.invite.delete({ where: { token } });
    return reply.send({ ok: true });
  });
}

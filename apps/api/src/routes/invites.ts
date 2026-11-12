import { swallow } from "../lib/logger";
import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";
import { z } from "zod";
import { canInvite } from "../lib/invitePower";
import { readDoor } from "../lib/lobbyDoor";
import { blockedEitherWay } from "../lib/blocks";

type Opts = {
  authFromHeader: (h?: string) => { id: string; name: string } | null;
  awardNotoriety: (userId: string, action: string) => Promise<number | null>;
  getGlobalRole: (userId: string) => Promise<string | null>;
  canAssignRoles: (role: string | null) => boolean;
  WEB_URL: string;
};

export default async function invitesRoutes(app: FastifyInstance, opts: Opts) {
  const { authFromHeader, awardNotoriety, getGlobalRole, canAssignRoles, WEB_URL } = opts;

  app.post(
    "/invites",
    {
      schema: { tags: ["invites"] },
    },
    async (req, reply) => {
      const u = authFromHeader((req as any).headers?.authorization);
      if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
      const body: any = (req.body as any) || {};
      const type = String(body.type || "PLATFORM").toUpperCase();
      const targetId = body.targetId ? String(body.targetId) : null;
      const requested = Number(body.maxUses);
      const maxUses =
        Number.isFinite(requested) && requested === 0
          ? 0
          : Math.min(Math.max(Number(body.maxUses) || 1, 1), 100);
      const note = body.note ? String(body.note).slice(0, 200) : null;
      const ttlHours = Number(body.ttlHours) || 0;
      const expiresAt = ttlHours > 0 ? new Date(Date.now() + ttlHours * 3600 * 1000) : null;
      const validTypes = ["PLATFORM", "ROOM", "LOBBY", "CREW", "GUEST"];
      if (!validTypes.includes(type))
        return reply.code(400).send({ ok: false, error: "invalid_type" });
      if (type === "GUEST") {
        if (!targetId) return reply.code(400).send({ ok: false, error: "missing_target" });
        const lob = await prisma.lobby.findUnique({
          where: { id: targetId },
          select: { ownerId: true },
        });
        if (!lob || lob.ownerId !== u.id) {
          return reply.code(403).send({
            ok: false,
            error: "not_lobby_owner",
            message: "Only the lobby's owner can make a guest link.",
          });
        }
      }
      // Making a lobby, room or crew invite takes the power to let people in
      // (lib/invitePower.ts).
      if (["LOBBY", "ROOM", "CREW"].includes(type) && !(await canInvite(type, targetId, u.id)))
        return reply.code(403).send({
          ok: false,
          error: "not_allowed",
          message: "Only someone who can let people in can invite them.",
        });
      const invite = await prisma.invite.create({
        data: { type: type as any, targetId, createdBy: u.id, note, maxUses, expiresAt },
      });
      return reply.send({
        ok: true,
        invite: {
          token: invite.token,
          type: invite.type,
          targetId: invite.targetId,
          maxUses,
          expiresAt,
          url: `${WEB_URL}/invite/${invite.token}`,
        },
      });
    },
  );

  app.get("/invites/mine", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const invites = await prisma.invite.findMany({
      where: { createdBy: u.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return reply.send({
      ok: true,
      invites: invites.map((i: { token: any }) => ({ ...i, url: `${WEB_URL}/invite/${i.token}` })),
    });
  });

  app.get("/invites/:token", async (req, reply) => {
    const token = String((req as any).params?.token || "");
    const invite = await prisma.invite.findUnique({ where: { token } });
    if (!invite) return reply.code(404).send({ ok: false, error: "not_found" });
    // A lobby's link that has run out still says which lobby it was for, so the
    // page can point there instead of at a dead end. Whoever holds the link was
    // handed that lobby; its own door still decides who gets in.
    const spent =
      invite.expiresAt && invite.expiresAt < new Date()
        ? "expired"
        : invite.maxUses > 0 && invite.uses >= invite.maxUses
          ? "exhausted"
          : "";
    if (spent) {
      const lob =
        (invite.type === "LOBBY" || invite.type === "GUEST") && invite.targetId
          ? await prisma.lobby
              .findFirst({
                where: { id: invite.targetId, deletedAt: null },
                select: { id: true, name: true },
              })
              .catch(() => null)
          : null;
      return reply.code(410).send({
        ok: false,
        error: spent,
        ...(lob ? { lobbyId: lob.id, lobbyName: lob.name || lob.id } : {}),
      });
    }
    let targetName = "";
    if (invite.targetId) {
      if (invite.type === "ROOM") {
        const r = await prisma.room
          .findUnique({ where: { id: invite.targetId }, select: { name: true } })
          .catch(() => null);
        targetName = r?.name || invite.targetId;
      } else if (invite.type === "LOBBY" || invite.type === "GUEST") {
        const l = await prisma.lobby
          .findUnique({ where: { id: invite.targetId }, select: { name: true } })
          .catch(() => null);
        targetName = l?.name || invite.targetId;
      } else if (invite.type === "CREW") {
        const c = await prisma.crew
          .findUnique({ where: { id: invite.targetId }, select: { name: true, tag: true } })
          .catch(() => null);
        targetName = c ? `${c.name} [${c.tag}]` : invite.targetId;
      }
    }
    const creator = await prisma.user
      .findUnique({ where: { id: invite.createdBy }, select: { name: true, usernameKey: true } })
      .catch(() => null);
    return reply.send({
      ok: true,
      invite: {
        ...invite,
        targetName,
        creatorName: creator?.name || creator?.usernameKey || "unknown",
      },
    });
  });

  app.post(
    "/invites/:token/accept",
    {
      schema: { tags: ["invites"], params: z.object({ token: z.string().min(1) }) },
    },
    async (req, reply) => {
      const u = authFromHeader((req as any).headers?.authorization);
      if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
      const token = String((req as any).params?.token || "");
      const invite = await prisma.invite.findUnique({ where: { token } });
      if (!invite) return reply.code(404).send({ ok: false, error: "not_found" });
      if (invite.expiresAt && invite.expiresAt < new Date())
        return reply.code(410).send({ ok: false, error: "expired" });
      if (invite.maxUses > 0 && invite.uses >= invite.maxUses)
        return reply.code(410).send({ ok: false, error: "exhausted" });

      // An invite works only while its maker may still make it, and never gets
      // a banned person back in or past a lobby's front door.
      if (
        ["LOBBY", "ROOM", "CREW"].includes(invite.type) &&
        !(await canInvite(invite.type, invite.targetId, invite.createdBy))
      )
        return reply
          .code(403)
          .send({ ok: false, error: "invite_revoked", message: "This invite no longer works." });
      const banned = (message: string) =>
        reply.code(403).send({ ok: false, error: "banned", message });

      let redirect = "/lobby";
      if (invite.type === "ROOM" && invite.targetId) {
        const room = await prisma.room.findUnique({
          where: { id: invite.targetId },
          select: { lobbyId: true },
        });
        const roomBan = await prisma.roomBan
          .findUnique({ where: { roomId_userId: { roomId: invite.targetId, userId: u.id } } })
          .catch(() => null);
        const lobbyBan = room?.lobbyId
          ? await prisma.lobbyBan
              .findUnique({ where: { lobbyId_userId: { lobbyId: room.lobbyId, userId: u.id } } })
              .catch(() => null)
          : null;
        if (roomBan || lobbyBan) return banned("You are banned from this room.");
        await prisma.roomMember
          .upsert({
            where: { roomId_userId: { roomId: invite.targetId, userId: u.id } },
            create: { roomId: invite.targetId, userId: u.id, name: u.name, role: "MEMBER" },
            update: {},
          })
          .catch(swallow);
        redirect = `/room/${encodeURIComponent(invite.targetId)}`;
      } else if (invite.type === "LOBBY" && invite.targetId) {
        const lobbyId = invite.targetId;
        if (
          await prisma.lobbyBan.findUnique({
            where: { lobbyId_userId: { lobbyId, userId: u.id } },
          })
        )
          return banned("You are banned from this lobby.");
        const lobby = await prisma.lobby.findUnique({
          where: { id: lobbyId },
          select: { layout: true },
        });
        if (!lobby) return reply.code(404).send({ ok: false, error: "not_found" });
        const already = await prisma.lobbyMember.findUnique({
          where: { lobbyId_userId: { lobbyId, userId: u.id } },
        });
        // The front door still asks its questions: the lobby's own join takes
        // the invite from there and skips only the lock (routes/lobbyJoin.ts).
        if (!already && readDoor(lobby.layout))
          return reply.code(409).send({
            ok: false,
            error: "door_required",
            redirect: `/lobby/${encodeURIComponent(lobbyId)}?invite=${encodeURIComponent(token)}`,
          });
        await prisma.lobbyMember
          .upsert({
            where: { lobbyId_userId: { lobbyId: invite.targetId, userId: u.id } },
            create: { lobbyId: invite.targetId, userId: u.id, name: u.name, role: "MEMBER" },
            update: {},
          })
          .catch(swallow);
        redirect = `/lobby/${encodeURIComponent(invite.targetId)}`;
      } else if (invite.type === "CREW" && invite.targetId) {
        await prisma.crewMember
          .upsert({
            where: { crewId_userId: { crewId: invite.targetId, userId: u.id } },
            create: { crewId: invite.targetId, userId: u.id, name: u.name, role: "MEMBER" },
            update: {},
          })
          .catch(swallow);
        awardNotoriety(u.id, "CREW_JOINED").catch(swallow);
        redirect = "/lobby";
      }
      await prisma.invite.update({ where: { token }, data: { uses: { increment: 1 } } });

      if (invite.createdBy !== u.id && !(await blockedEitherWay(u.id, invite.createdBy))) {
        const msg =
          invite.type === "PLATFORM"
            ? `${u.name} joined Weered using your invite!`
            : `${u.name} joined via your ${invite.type.toLowerCase()} invite${invite.targetId ? ` (${invite.targetId})` : ""}.`;
        await prisma.directMessage
          .create({
            data: { fromId: u.id, toId: invite.createdBy, body: msg },
          })
          .catch(swallow);
      }

      return reply.send({ ok: true, redirect, type: invite.type, targetId: invite.targetId });
    },
  );

  app.post(
    "/invites/send",
    {
      schema: { tags: ["invites"] },
    },
    async (req, reply) => {
      const u = authFromHeader((req as any).headers?.authorization);
      if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
      const body: any = (req.body as any) || {};
      const username = String(body.username || "")
        .toLowerCase()
        .trim();
      const type = String(body.type || "PLATFORM").toUpperCase();
      const targetId = body.targetId ? String(body.targetId) : null;
      if (!username) return reply.code(400).send({ ok: false, error: "username_required" });
      const validTypes = ["PLATFORM", "ROOM", "LOBBY", "CREW", "GUEST"];
      if (!validTypes.includes(type))
        return reply.code(400).send({ ok: false, error: "invalid_type" });
      if (type === "GUEST") {
        if (!targetId) return reply.code(400).send({ ok: false, error: "missing_target" });
        const lob = await prisma.lobby.findUnique({
          where: { id: targetId },
          select: { ownerId: true },
        });
        if (!lob || lob.ownerId !== u.id) {
          return reply.code(403).send({
            ok: false,
            error: "not_lobby_owner",
            message: "Only the lobby's owner can make a guest link.",
          });
        }
      }
      // Making a lobby, room or crew invite takes the power to let people in
      // (lib/invitePower.ts).
      if (["LOBBY", "ROOM", "CREW"].includes(type) && !(await canInvite(type, targetId, u.id)))
        return reply.code(403).send({
          ok: false,
          error: "not_allowed",
          message: "Only someone who can let people in can invite them.",
        });
      const target = await prisma.user.findFirst({
        where: {
          OR: [{ usernameKey: username }, { name: { equals: username, mode: "insensitive" } }],
        },
        select: { id: true, name: true },
      });
      if (!target) return reply.code(404).send({ ok: false, error: "user_not_found" });
      if (target.id === u.id)
        return reply.code(400).send({ ok: false, error: "cannot_invite_self" });
      // A block either way: no invite, and no message (lib/blocks.ts).
      if (await blockedEitherWay(u.id, target.id))
        return reply
          .code(403)
          .send({ ok: false, error: "not_delivered", message: "Invite not delivered." });
      const invite = await prisma.invite.create({
        data: {
          type: type as any,
          targetId,
          createdBy: u.id,
          maxUses: 1,
          expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
        },
      });
      const inviteUrl = `${WEB_URL}/invite/${invite.token}`;
      const msg =
        type === "PLATFORM"
          ? `${u.name} invited you to join Weered! ${inviteUrl}`
          : `${u.name} invited you to join a ${type.toLowerCase()}. ${inviteUrl}`;
      await prisma.directMessage.create({ data: { fromId: u.id, toId: target.id, body: msg } });
      return reply.send({ ok: true, token: invite.token, url: inviteUrl, sentTo: target.name });
    },
  );

  app.delete(
    "/invites/:token",
    {
      schema: { tags: ["invites"], params: z.object({ token: z.string().min(1) }) },
    },
    async (req, reply) => {
      const u = authFromHeader((req as any).headers?.authorization);
      if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
      const token = String((req as any).params?.token || "");
      const invite = await prisma.invite.findUnique({ where: { token } });
      if (!invite) return reply.code(404).send({ ok: false, error: "not_found" });
      const role = await getGlobalRole(u.id);
      if (invite.createdBy !== u.id && !canAssignRoles(role))
        return reply.code(403).send({ ok: false, error: "forbidden" });
      await prisma.invite.delete({ where: { token } });
      return reply.send({ ok: true });
    },
  );
}

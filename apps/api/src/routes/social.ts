import { ReportTargetType, ReportReason } from "@prisma/client";
import { log } from "../lib/logger";
import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";
import { z } from "zod";

type Opts = {
  authFromHeader: (h?: string) => { id: string; name: string } | null;
  verifyToken: (token: string) => { id: string; name: string } | null;
  awardNotoriety: (userId: string, action: string) => Promise<number | null>;
  createNotification: (opts: any) => Promise<any>;
  rooms: Map<string, { name?: string; users: Map<string, any> }>;
};

export default async function socialRoutes(app: FastifyInstance, opts: Opts) {
  const { authFromHeader, verifyToken, awardNotoriety, createNotification, rooms } = opts;

  app.get("/friends", async (req, reply) => {
    const token = String((req.headers.authorization || "").replace("Bearer ", "").trim());
    const u = verifyToken(token);
    if (!u) return reply.code(401).send({ error: "Unauthorized" });
    const db = prisma as any;
    const links = await db.friendRequest.findMany({
      where: { status: "ACCEPTED", OR: [{ fromId: u.id }, { toId: u.id }] },
    });
    const peerIds = (links as any[]).map((l: any) => (l.fromId === u.id ? l.toId : l.fromId));
    const profiles = peerIds.length
      ? await prisma.user.findMany({
          where: { id: { in: peerIds } },
          select: {
            id: true,
            name: true,
            avatarColor: true,
            avatar: true,
            livePresence: true,
            globalRole: true,
            tier: true,
            steamId: true,
            twitchLogin: true,
            xboxGamertag: true,
            lastSeenAt: true,
            lastSeenLocation: true,
            pillBgColor: true,
            pillAccentColor: true,
            statusText: true,
            statusEmoji: true,
            nameEffect: true,
            avatarFrame: true,
            joinPolicy: true,
          } as any,
        })
      : [];
    const presenceMap = new Map<string, { roomId: string; roomName: string; isAway: boolean }>();
    for (const p of profiles) {
      for (const [rid, rs] of rooms) {
        const entry = rs.users.get((p as any).id);
        if (entry) {
          presenceMap.set((p as any).id, {
            roomId: rid,
            roomName: rs.name || rid,
            isAway: Boolean((entry as any).isAway),
          });
          break;
        }
      }
    }
    const activeRoomIds = [...new Set([...presenceMap.values()].map((v) => v.roomId))];
    const lobbySet = activeRoomIds.length
      ? new Set(
          (
            await prisma.lobby.findMany({
              where: { id: { in: activeRoomIds } },
              select: { id: true },
            })
          ).map((l) => l.id),
        )
      : new Set<string>();
    const memberships = peerIds.length
      ? await prisma.crewMember.findMany({
          where: { userId: { in: peerIds } },
          orderBy: { joinedAt: "asc" },
          include: {
            crew: {
              select: { id: true, tag: true, name: true, accentColor: true, tagShape: true },
            },
          },
        })
      : [];
    const crewByUser = new Map<string, any>();
    for (const m of memberships) {
      if (!crewByUser.has(m.userId) && m.crew) crewByUser.set(m.userId, m.crew);
    }
    const out = profiles.map((p: any) => {
      const pres = presenceMap.get(p.id);
      const roomId = pres?.roomId ?? null;
      const roomName = pres?.roomName ?? null;
      const crew = crewByUser.get(p.id) || null;
      const joinOff = String((p as any).joinPolicy || "FRIENDS") === "OFF";
      return {
        ...p,
        joinPolicy: undefined,
        online: roomId !== null,
        roomId: joinOff ? null : roomId,
        roomName: joinOff ? null : roomName,
        roomIsLobby: roomId ? lobbySet.has(roomId) : false,
        isAway: Boolean(pres?.isAway),
        livePresence: p.livePresence || null,
        primaryCrew: crew
          ? {
              id: crew.id,
              tag: crew.tag,
              name: crew.name,
              accentColor: crew.accentColor,
              tagShape: crew.tagShape || "rounded",
            }
          : null,
      };
    });
    return reply.send({ friends: out });
  });

  app.get("/friends/requests", async (req, reply) => {
    const token = String((req.headers.authorization || "").replace("Bearer ", "").trim());
    const u = verifyToken(token);
    if (!u) return reply.code(401).send({ error: "Unauthorized" });
    const db = prisma as any;
    const reqs = await db.friendRequest.findMany({
      where: { toId: u.id, status: "PENDING" },
      orderBy: { createdAt: "desc" },
    });
    const fromIds = (reqs as any[]).map((r: any) => r.fromId);
    const senders = fromIds.length
      ? await prisma.user.findMany({
          where: { id: { in: fromIds } },
          select: { id: true, name: true },
        })
      : [];
    const senderMap = new Map(senders.map((s) => [s.id, s.name]));
    return reply.send({
      requests: (reqs as any[]).map((r: any) => ({
        ...r,
        fromName: senderMap.get(r.fromId) ?? r.fromId,
      })),
    });
  });

  app.post(
    "/friends/request/:userId",
    {
      schema: {
        tags: ["social"],
        summary: "Send a friend request",
        params: z.object({ userId: z.string().min(1) }),
      },
    },
    async (req, reply) => {
      const token = String((req.headers.authorization || "").replace("Bearer ", "").trim());
      const u = verifyToken(token);
      if (!u) return reply.code(401).send({ error: "Unauthorized" });
      const toId = String((req.params as any).userId || "").trim();
      if (!toId || toId === u.id) return reply.code(400).send({ error: "Invalid target" });
      const target = await prisma.user.findUnique({ where: { id: toId }, select: { id: true } });
      if (!target) return reply.code(404).send({ error: "User not found" });
      const db = prisma as any;
      const fr = await db.friendRequest.upsert({
        where: { fromId_toId: { fromId: u.id, toId } },
        update: { status: "PENDING", updatedAt: new Date() },
        create: { fromId: u.id, toId, status: "PENDING" },
      });
      createNotification({
        userId: toId,
        type: "FRIEND_REQUEST",
        title: `${u.name} sent you a friend request`,
        actorId: u.id,
        actorName: u.name,
        actionUrl: "/home",
      }).catch(() => {});
      return reply.send({ ok: true, request: fr });
    },
  );

  app.post(
    "/friends/accept/:requestId",
    {
      schema: {
        tags: ["social"],
        summary: "Accept a friend request",
        params: z.object({ requestId: z.string().min(1) }),
      },
    },
    async (req, reply) => {
      const token = String((req.headers.authorization || "").replace("Bearer ", "").trim());
      const u = verifyToken(token);
      if (!u) return reply.code(401).send({ error: "Unauthorized" });
      const id = String((req.params as any).requestId || "").trim();
      const db = prisma as any;
      const fr = await db.friendRequest.findUnique({ where: { id } });
      if (!fr || fr.toId !== u.id) return reply.code(403).send({ error: "Not your request" });
      await db.friendRequest.update({ where: { id }, data: { status: "ACCEPTED" } });
      await db.friendRequest.upsert({
        where: { fromId_toId: { fromId: u.id, toId: fr.fromId } },
        update: { status: "ACCEPTED" },
        create: { fromId: u.id, toId: fr.fromId, status: "ACCEPTED" },
      });
      awardNotoriety(u.id, "FRIEND_ADDED").catch(() => {});
      awardNotoriety(fr.fromId, "FRIEND_ADDED").catch(() => {});
      createNotification({
        userId: fr.fromId,
        type: "FRIEND_ACCEPTED",
        title: `${u.name} accepted your friend request`,
        actorId: u.id,
        actorName: u.name,
        actionUrl: "/home",
      }).catch(() => {});
      return reply.send({ ok: true });
    },
  );

  app.post(
    "/friends/decline/:requestId",
    {
      schema: {
        tags: ["social"],
        summary: "Decline a friend request",
        params: z.object({ requestId: z.string().min(1) }),
      },
    },
    async (req, reply) => {
      const token = String((req.headers.authorization || "").replace("Bearer ", "").trim());
      const u = verifyToken(token);
      if (!u) return reply.code(401).send({ error: "Unauthorized" });
      const id = String((req.params as any).requestId || "").trim();
      const db = prisma as any;
      const fr = await db.friendRequest.findUnique({ where: { id } });
      if (!fr || fr.toId !== u.id) return reply.code(403).send({ error: "Not your request" });
      await db.friendRequest.update({ where: { id }, data: { status: "DECLINED" } });
      return reply.send({ ok: true });
    },
  );

  // Direct room invite: "come hang where I am". Target's invitePolicy
  // gates it; 5-min dedupe per sender+target+room.
  const _inviteSentAt = new Map<string, number>();
  app.post(
    "/friends/:userId/invite",
    {
      schema: {
        tags: ["social"],
        summary: "Invite a friend to your room",
        params: z.object({ userId: z.string().min(1) }),
      },
    },
    async (req, reply) => {
      const u = authFromHeader((req.headers as any).authorization);
      if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
      const targetId = String((req.params as any).userId || "");
      if (!targetId || targetId === u.id)
        return reply.code(400).send({ ok: false, error: "bad_target" });

      let myRoomId: string | null = null;
      let myRoomName = "";
      for (const [rid, rs] of rooms) {
        if (rs.users.has(u.id)) {
          myRoomId = rid;
          myRoomName = rs.name || rid;
          break;
        }
      }
      if (!myRoomId) return reply.code(400).send({ ok: false, error: "not_in_room" });

      const target: any = await prisma.user.findUnique({
        where: { id: targetId },
        select: { id: true, invitePolicy: true } as any,
      });
      if (!target) return reply.code(404).send({ ok: false, error: "not_found" });
      const policy = String(target.invitePolicy || "FRIENDS");
      if (policy === "OFF") return reply.code(403).send({ ok: false, error: "invites_off" });
      if (policy === "FRIENDS") {
        const fr = await prisma.friendRequest.findFirst({
          where: {
            status: "ACCEPTED",
            OR: [
              { fromId: u.id, toId: targetId },
              { fromId: targetId, toId: u.id },
            ],
          },
        });
        if (!fr) return reply.code(403).send({ ok: false, error: "friends_only" });
      }

      const key = `${u.id}:${targetId}:${myRoomId}`;
      const last = _inviteSentAt.get(key) || 0;
      if (Date.now() - last < 5 * 60_000) return reply.send({ ok: true, deduped: true });
      _inviteSentAt.set(key, Date.now());

      const isLobby = !!(await prisma.lobby
        .findUnique({ where: { id: myRoomId }, select: { id: true } })
        .catch(() => null));
      const actionUrl = isLobby
        ? `/lobby/${encodeURIComponent(myRoomId)}`
        : `/room/${encodeURIComponent(myRoomId)}`;
      await createNotification({
        userId: targetId,
        type: "ROOM_INVITE",
        title: `${u.name} invited you to ${myRoomName}`,
        body: "Tap to join them.",
        actorId: u.id,
        actorName: u.name,
        actionUrl,
        meta: { roomId: myRoomId, isLobby },
      }).catch(() => {});
      return reply.send({ ok: true });
    },
  );

  app.delete(
    "/friends/:userId",
    {
      schema: {
        tags: ["social"],
        summary: "Remove a friend",
        params: z.object({ userId: z.string().min(1) }),
      },
    },
    async (req, reply) => {
      const token = String((req.headers.authorization || "").replace("Bearer ", "").trim());
      const u = verifyToken(token);
      if (!u) return reply.code(401).send({ error: "Unauthorized" });
      const peerId = String((req.params as any).userId || "").trim();
      const db = prisma as any;
      await db.friendRequest.deleteMany({
        where: {
          OR: [
            { fromId: u.id, toId: peerId },
            { fromId: peerId, toId: u.id },
          ],
        },
      });
      return reply.send({ ok: true });
    },
  );

  app.get("/recents", async (req, reply) => {
    const user = authFromHeader((req as any).headers?.authorization);
    if (!user) return reply.code(401).send({ error: "unauthorized" });

    const visits = await prisma.recentVisit.findMany({
      where: { userId: user.id },
      orderBy: { visitedAt: "desc" },
      take: 10,
    });

    const lobbyIds = visits.filter((v) => v.lobbyId).map((v) => v.lobbyId!);
    const lobbies = lobbyIds.length
      ? await prisma.lobby.findMany({
          where: { id: { in: lobbyIds } },
          select: {
            id: true,
            name: true,
            description: true,
            logoUrl: true,
            bannerUrl: true,
            accentColor: true,
            pinned: true,
          },
        })
      : [];
    const lobbyMap = new Map(lobbies.map((l) => [l.id, l]));

    const roomIds = visits.filter((v) => v.roomId && !v.lobbyId).map((v) => v.roomId!);
    const roomRows = roomIds.length
      ? await prisma.room.findMany({
          where: { id: { in: roomIds } },
          select: {
            id: true,
            name: true,
            lobbyId: true,
            lobby: { select: { id: true, name: true, logoUrl: true, accentColor: true } },
          },
        })
      : [];
    const roomMap = new Map(roomRows.map((r) => [r.id, r]));

    const recents = visits
      .map((v) => {
        if (v.lobbyId) {
          const lobby = lobbyMap.get(v.lobbyId);
          return {
            lobbyId: v.lobbyId,
            roomId: null,
            name: lobby?.name || v.name || v.lobbyId,
            logoUrl: lobby?.logoUrl || null,
            bannerUrl: lobby?.bannerUrl || null,
            accentColor: lobby?.accentColor || null,
            pinned: lobby?.pinned ?? true,
            visitedAt: v.visitedAt,
          };
        }
        if (v.roomId) {
          const room = roomMap.get(v.roomId);
          return {
            lobbyId: room?.lobbyId || null,
            lobbyName: room?.lobby?.name || null,
            roomId: v.roomId,
            name: room?.name || v.name || v.roomId,
            logoUrl: room?.lobby?.logoUrl || null,
            accentColor: room?.lobby?.accentColor || null,
            pinned: false,
            visitedAt: v.visitedAt,
          };
        }
        return null;
      })
      .filter(Boolean);

    return reply.send({ ok: true, recents });
  });

  app.post(
    "/recents",
    {
      schema: {
        tags: ["social"],
        summary: "Record a recent visit",
        body: z
          .object({ roomId: z.string().optional(), lobbyId: z.string().optional() })
          .passthrough(),
      },
    },
    async (req, reply) => {
      const user = authFromHeader((req as any).headers?.authorization);
      if (!user) return reply.code(401).send({ error: "unauthorized" });

      const { roomId, lobbyId } = req.body as any;
      if (!roomId && !lobbyId) return reply.code(400).send({ error: "roomId or lobbyId required" });

      try {
        if (lobbyId) {
          const lobby = await prisma.lobby.findUnique({
            where: { id: lobbyId },
            select: { name: true },
          });
          const existing = await prisma.recentVisit.findFirst({
            where: { userId: user.id, lobbyId },
          });
          if (existing) {
            await prisma.recentVisit.update({
              where: { id: existing.id },
              data: { visitedAt: new Date(), name: lobby?.name || lobbyId },
            });
          } else {
            await prisma.recentVisit.create({
              data: { userId: user.id, lobbyId, name: lobby?.name || lobbyId },
            });
          }
        } else if (roomId) {
          const room = await prisma.room.findUnique({
            where: { id: roomId },
            select: { name: true, lobbyId: true },
          });
          const existing = await prisma.recentVisit.findFirst({
            where: { userId: user.id, roomId },
          });
          if (existing) {
            await prisma.recentVisit.update({
              where: { id: existing.id },
              data: { visitedAt: new Date(), name: room?.name || roomId },
            });
          } else {
            await prisma.recentVisit.create({
              data: {
                userId: user.id,
                roomId,
                lobbyId: room?.lobbyId || null,
                name: room?.name || roomId,
              },
            });
          }
        }
        return reply.send({ ok: true });
      } catch (e: any) {
        log.error("[recents POST]", e.message);
        return reply.code(500).send({ error: e.message });
      }
    },
  );

  app.delete(
    "/recents/:id",
    {
      schema: {
        tags: ["social"],
        summary: "Delete a recent visit",
        params: z.object({ id: z.string().min(1) }),
      },
    },
    async (req, reply) => {
      const user = authFromHeader((req as any).headers?.authorization);
      if (!user) return reply.code(401).send({ error: "unauthorized" });

      const { id } = req.params as any;
      try {
        await prisma.recentVisit.deleteMany({ where: { id, userId: user.id } });
        return reply.send({ ok: true });
      } catch (e: any) {
        return reply.code(500).send({ error: e.message });
      }
    },
  );

  app.get("/me/favorites", async (req, reply) => {
    const user = authFromHeader((req as any).headers?.authorization);
    if (!user) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const me = await prisma.user.findUnique({
      where: { id: user.id },
      select: { favoriteLobbyIds: true },
    });
    const ids: string[] = me?.favoriteLobbyIds ?? [];
    const rows = ids.length
      ? await prisma.lobby.findMany({
          where: { id: { in: ids } },
          select: {
            id: true,
            name: true,
            description: true,
            logoUrl: true,
            bannerUrl: true,
            accentColor: true,
            pinned: true,
            verified: true,
            moduleType: true,
            _count: { select: { rooms: true, members: true } },
          },
        })
      : [];
    const map = new Map(rows.map((l) => [l.id, l]));
    const lobbies = ids.map((id) => map.get(id)).filter(Boolean);
    return reply.send({ ok: true, ids, lobbies });
  });

  app.post(
    "/me/favorites/:id",
    {
      schema: {
        tags: ["social"],
        summary: "Favorite a lobby",
        params: z.object({ id: z.string().min(1) }),
      },
    },
    async (req, reply) => {
      const user = authFromHeader((req as any).headers?.authorization);
      if (!user) return reply.code(401).send({ ok: false, error: "unauthorized" });
      const id = String((req.params as any).id || "").trim();
      if (!id) return reply.code(400).send({ ok: false, error: "missing_id" });
      const me = await prisma.user.findUnique({
        where: { id: user.id },
        select: { favoriteLobbyIds: true },
      });
      const cur: string[] = me?.favoriteLobbyIds ?? [];
      if (!cur.includes(id)) {
        await prisma.user.update({
          where: { id: user.id },
          data: { favoriteLobbyIds: [id, ...cur].slice(0, 200) },
        });
      }
      return reply.send({ ok: true });
    },
  );

  app.delete(
    "/me/favorites/:id",
    {
      schema: {
        tags: ["social"],
        summary: "Unfavorite a lobby",
        params: z.object({ id: z.string().min(1) }),
      },
    },
    async (req, reply) => {
      const user = authFromHeader((req as any).headers?.authorization);
      if (!user) return reply.code(401).send({ ok: false, error: "unauthorized" });
      const id = String((req.params as any).id || "").trim();
      const me = await prisma.user.findUnique({
        where: { id: user.id },
        select: { favoriteLobbyIds: true },
      });
      const cur: string[] = me?.favoriteLobbyIds ?? [];
      await prisma.user.update({
        where: { id: user.id },
        data: { favoriteLobbyIds: cur.filter((x: string) => x !== id) },
      });
      return reply.send({ ok: true });
    },
  );

  app.post(
    "/me/favorites/merge",
    {
      schema: { tags: ["social"], summary: "Merge favorite lobby ids" },
    },
    async (req, reply) => {
      const user = authFromHeader((req as any).headers?.authorization);
      if (!user) return reply.code(401).send({ ok: false, error: "unauthorized" });
      const body = (req as any).body || {};
      const incoming: string[] = Array.isArray(body.ids)
        ? body.ids.filter((x: any) => typeof x === "string")
        : [];
      const me = await prisma.user.findUnique({
        where: { id: user.id },
        select: { favoriteLobbyIds: true },
      });
      const cur: string[] = me?.favoriteLobbyIds ?? [];
      const union = Array.from(new Set([...incoming, ...cur])).slice(0, 200);
      await prisma.user.update({
        where: { id: user.id },
        data: { favoriteLobbyIds: union },
      });
      return reply.send({ ok: true, ids: union });
    },
  );

  app.get("/blocks", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const rows = await prisma.userBlock.findMany({
      where: { blockerId: u.id },
      orderBy: { createdAt: "desc" },
    });
    const ids = rows.map((r: any) => r.blockedId);
    const users = ids.length
      ? await prisma.user.findMany({
          where: { id: { in: ids } },
          select: { id: true, name: true, avatarColor: true } as any,
        })
      : [];
    const nameMap = new Map(users.map((x: any) => [x.id, x]));
    return reply.send({
      blocks: rows.map((r: any) => ({
        id: r.id,
        userId: r.blockedId,
        createdAt: r.createdAt.toISOString(),
        name: (nameMap.get(r.blockedId) as any)?.name || r.blockedId,
        avatarColor: (nameMap.get(r.blockedId) as any)?.avatarColor || null,
        reason: r.reason || null,
      })),
    });
  });

  app.post(
    "/users/:userId/block",
    {
      schema: {
        tags: ["social"],
        summary: "Block a user",
        params: z.object({ userId: z.string().min(1) }),
      },
    },
    async (req, reply) => {
      const u = authFromHeader((req as any).headers?.authorization);
      if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
      const targetId = String((req as any).params?.userId || "");
      if (!targetId || targetId === u.id)
        return reply.code(400).send({ ok: false, error: "invalid_target" });
      const body: any = (req as any).body || {};
      const reason = typeof body.reason === "string" ? body.reason.slice(0, 200) : null;
      try {
        await prisma.userBlock.upsert({
          where: { blockerId_blockedId: { blockerId: u.id, blockedId: targetId } },
          update: { reason },
          create: { blockerId: u.id, blockedId: targetId, reason },
        });
        return reply.send({ ok: true });
      } catch (e) {
        return reply.code(500).send({ ok: false, error: "block_failed" });
      }
    },
  );

  app.delete(
    "/users/:userId/block",
    {
      schema: {
        tags: ["social"],
        summary: "Unblock a user",
        params: z.object({ userId: z.string().min(1) }),
      },
    },
    async (req, reply) => {
      const u = authFromHeader((req as any).headers?.authorization);
      if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
      const targetId = String((req as any).params?.userId || "");
      if (!targetId) return reply.code(400).send({ ok: false, error: "invalid_target" });
      try {
        await prisma.userBlock.deleteMany({
          where: { blockerId: u.id, blockedId: targetId },
        });
        return reply.send({ ok: true });
      } catch (e) {
        return reply.code(500).send({ ok: false, error: "unblock_failed" });
      }
    },
  );

  const VALID_REPORT_REASONS = new Set([
    "SPAM",
    "HARASSMENT",
    "HATE_SPEECH",
    "THREATS",
    "NSFW",
    "MINOR_SAFETY",
    "IMPERSONATION",
    "SELF_HARM",
    "OTHER",
  ]);
  const VALID_TARGET_TYPES = new Set(["MESSAGE", "USER", "ROOM", "LOBBY"]);

  app.post(
    "/reports",
    {
      schema: {
        tags: ["social"],
        summary: "Report content/user",
        body: z
          .object({
            targetType: z.string(),
            targetId: z.string(),
            reason: z.string(),
            context: z.string().nullish(),
            note: z.string().nullish(),
          })
          .passthrough(),
      },
    },
    async (req, reply) => {
      const u = authFromHeader((req as any).headers?.authorization);
      if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
      const body: any = (req as any).body || {};
      const targetType = String(body.targetType || "").toUpperCase();
      const targetId = String(body.targetId || "").trim();
      const reason = String(body.reason || "").toUpperCase();
      const context = body.context ? String(body.context).trim().slice(0, 100) : null;
      const note = body.note ? String(body.note).slice(0, 500) : null;
      if (!VALID_TARGET_TYPES.has(targetType))
        return reply.code(400).send({ ok: false, error: "invalid_target_type" });
      if (!targetId) return reply.code(400).send({ ok: false, error: "missing_target_id" });
      if (!VALID_REPORT_REASONS.has(reason))
        return reply.code(400).send({ ok: false, error: "invalid_reason" });

      const recent = await prisma.report.count({
        where: { reporterId: u.id, createdAt: { gt: new Date(Date.now() - 10 * 60 * 1000) } },
      });
      if (recent >= 5) return reply.code(429).send({ ok: false, error: "report_rate_limit" });

      let bodySnapshot: string | null = null;
      if (targetType === "MESSAGE") {
        try {
          const m = await prisma.roomMessage.findUnique({
            where: { id: targetId },
            select: { body: true },
          });
          if (m?.body) bodySnapshot = String(m.body).slice(0, 500);
        } catch {}
        if (!bodySnapshot) {
          try {
            const dm = await prisma.directMessage.findUnique({
              where: { id: targetId },
              select: { body: true },
            });
            if (dm?.body) bodySnapshot = String(dm.body).slice(0, 500);
          } catch {}
        }
        if (!bodySnapshot) {
          try {
            const cm = await prisma.crewMessage.findUnique({
              where: { id: targetId },
              select: { body: true },
            });
            if (cm?.body) bodySnapshot = String(cm.body).slice(0, 500);
          } catch {}
        }
      }

      const row = await prisma.report.create({
        data: {
          reporterId: u.id,
          targetType: targetType as ReportTargetType,
          targetId,
          context,
          reason: reason as ReportReason,
          note,
          bodySnapshot,
        },
      });
      return reply.send({ ok: true, id: row.id });
    },
  );
}

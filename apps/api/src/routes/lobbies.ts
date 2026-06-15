import { log } from "../lib/logger";
import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import { prisma } from "../lib/prisma";
import { z } from "zod";
import { LobbyRole } from "@prisma/client";

type Opts = {
  authFromHeader: (h?: string) => { id: string; name: string } | null;
  verifyToken: (token: string) => { id: string; name: string } | null;
  getGlobalRole: (userId: string) => Promise<string | null>;
  canAccessStaff: (role: string | null) => boolean;
  getLobbyRole: (userId: string, lobbyId: string) => Promise<LobbyRole | null>;
  applyWindroseReel: <T>(lobby: T) => T;
  lobbyAdminAccess: (req: any, reply: any, requiredLevel: number) => Promise<any>;
  globalAudit: (
    actorId: string,
    actorName: string,
    type: string,
    targetId?: string,
    note?: string,
    meta?: any,
  ) => Promise<void>;
  rooms: Map<string, any>;
  isNameReserved: (name: string, scope: "LOBBY" | "USERNAME" | "BOTH") => Promise<boolean>;
  awardNotoriety: (userId: string, action: string) => Promise<number | null>;
  send: (ws: any, msg: any) => void;
};

export default async function lobbiesRoutes(app: FastifyInstance, opts: Opts) {
  const {
    authFromHeader,
    verifyToken,
    getGlobalRole,
    canAccessStaff,
    getLobbyRole,
    applyWindroseReel,
    lobbyAdminAccess,
    globalAudit,
    rooms,
    isNameReserved,
    awardNotoriety,
    send,
  } = opts;

  app.get("/lobbies/:lobbyId/rooms", async (req, reply) => {
    const lobbyId = String((req as any).params?.lobbyId || "");
    const lobby = await prisma.lobby.findUnique({ where: { id: lobbyId } });
    if (!lobby) return reply.code(404).send({ ok: false, error: "lobby_not_found" });
    const list = await prisma.room.findMany({
      where: { lobbyId },
      orderBy: [{ isEvent: "desc" }, { pinned: "desc" }, { updatedAt: "desc" }],
      select: {
        id: true,
        name: true,
        description: true,
        locked: true,
        pinned: true,
        isEvent: true,
        ownerId: true,
        iconUrl: true,
        bannerUrl: true,
        accentColor: true,
        _count: { select: { members: true } },
      },
    });
    const out = list.map((r) => {
      const wsRoom = rooms.get(r.id);
      const onlineUsers: { id: string; name: string; avatar?: string }[] = [];
      if (wsRoom?.users) {
        for (const [uid, u] of wsRoom.users) {
          if (onlineUsers.length >= 4) break;
          onlineUsers.push({ id: uid, name: u?.name || uid, avatar: u?.avatar || undefined });
        }
      }
      return {
        id: r.id,
        roomId: r.id,
        name: r.name || r.id,
        description: r.description || "",
        onlineCount: wsRoom?.users?.size ?? 0,
        onlineUsers,
        locked: Boolean(r.locked),
        pinned: Boolean((r as any).pinned),
        isEvent: Boolean((r as any).isEvent),
        iconUrl: (r as any).iconUrl || null,
        bannerUrl: (r as any).bannerUrl || null,
        accentColor: (r as any).accentColor || null,
        lobbyId,
        ownerId: r.ownerId,
        hasPassword: !!(wsRoom?.passwordHash || (r as any).passwordHash),
        _count: r._count,
      };
    });
    return { ok: true, rooms: out };
  });

  app.post(
    "/lobbies/:lobbyId/claim",
    {
      schema: { tags: ["lobbies"], params: z.object({ lobbyId: z.string().min(1) }) },
    },
    async (req, reply) => {
      const u = authFromHeader((req as any).headers?.authorization);
      if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
      const lobbyId = String((req as any).params?.lobbyId || "");
      const lobby = await prisma.lobby.findUnique({ where: { id: lobbyId } });
      if (!lobby) return reply.code(404).send({ ok: false, error: "lobby_not_found" });
      if (lobby.ownerId && lobby.ownerId !== u.id) {
        const actorRole = await getGlobalRole(u.id);
        if (!canAccessStaff(actorRole))
          return reply.code(403).send({ ok: false, error: "already_claimed" });
      }
      await prisma.lobby.update({
        where: { id: lobbyId },
        data: { ownerId: u.id, verified: true },
      });
      await prisma.lobbyMember.upsert({
        where: { lobbyId_userId: { lobbyId, userId: u.id } },
        update: { role: LobbyRole.OWNER },
        create: { lobbyId, userId: u.id, name: u.name, role: LobbyRole.OWNER },
      });
      return reply.send({ ok: true, lobbyId, claimed: true });
    },
  );

  app.get("/lobbies/search", async (req, reply) => {
    const q = String((req.query as any).q ?? "")
      .trim()
      .toLowerCase();
    if (!q || q.length < 2) return reply.send({ ok: true, pinned: [], rooms: [] });

    const [allPinned, matchingRooms] = await Promise.all([
      prisma.lobby.findMany({
        where: { pinned: true },
        select: {
          id: true,
          name: true,
          description: true,
          verified: true,
          moduleType: true,
          moduleConfig: true,
          keywords: true,
          accentColor: true,
          logoUrl: true,
          bannerUrl: true,
          websiteUrl: true,
          ownerId: true,
          _count: { select: { rooms: true, members: true } },
        },
        take: 100,
      }),
      prisma.room.findMany({
        where: { name: { contains: q, mode: "insensitive" } },
        select: {
          id: true,
          name: true,
          locked: true,
          lobbyId: true,
          lobby: { select: { id: true, name: true, accentColor: true, logoUrl: true } },
          _count: { select: { members: true } },
        },
        orderBy: { updatedAt: "desc" },
        take: 20,
      }),
    ]);

    const pinned = (allPinned as any[]).filter((l: any) => {
      const kws: string[] = Array.isArray(l.keywords) ? l.keywords : [];
      return (
        l.name.toLowerCase().includes(q) ||
        kws.some((kw: string) => kw.toLowerCase().includes(q) || q.includes(kw.toLowerCase()))
      );
    });

    return reply.send({ ok: true, pinned, rooms: matchingRooms });
  });

  app.get("/lobbies", async (_req, reply) => {
    const lobbies = await prisma.lobby.findMany({
      select: {
        id: true,
        name: true,
        description: true,
        verified: true,
        pinned: true,
        moduleType: true,
        accentColor: true,
        logoUrl: true,
        bannerUrl: true,
        _count: { select: { rooms: true, members: true } },
      },
      orderBy: [{ pinned: "desc" }, { name: "asc" }],
    });
    const enriched = lobbies.map((l: any) =>
      applyWindroseReel({
        ...l,
        onlineCount: rooms.get(l.id)?.users?.size ?? 0,
      }),
    );
    return reply.send({ ok: true, lobbies: enriched });
  });

  app.get("/me/lobbies", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.send({ ok: true, lobbies: [] });
    const memberships = await prisma.lobbyMember.findMany({
      where: { userId: u.id },
      select: { lobbyId: true, role: true, roleLevel: true },
    });
    if (memberships.length === 0) return reply.send({ ok: true, lobbies: [] });
    const lobbyIds = memberships.map((m: any) => m.lobbyId);
    const lobbies = await prisma.lobby.findMany({
      where: { id: { in: lobbyIds } },
      select: {
        id: true,
        name: true,
        description: true,
        verified: true,
        pinned: true,
        accentColor: true,
        logoUrl: true,
        bannerUrl: true,
        _count: { select: { rooms: true, members: true } },
      },
    });
    const memberMap = new Map<string, any>(memberships.map((m: any) => [m.lobbyId, m]));
    const enriched = lobbies.map((l: any) => ({
      ...l,
      onlineCount: rooms.get(l.id)?.users?.size ?? 0,
      role: memberMap.get(l.id)?.role || "MEMBER",
      roleLevel: memberMap.get(l.id)?.roleLevel ?? 1,
    }));
    return reply.send({ ok: true, lobbies: enriched });
  });

  app.get("/lobbies/:id", async (req, reply) => {
    const id = (req.params as any).id as string;
    const lobby = await prisma.lobby.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        description: true,
        verified: true,
        pinned: true,
        moduleType: true,
        moduleConfig: true,
        keywords: true,
        accentColor: true,
        logoUrl: true,
        bannerUrl: true,
        websiteUrl: true,
        joinMode: true,
        ownerId: true,
        enabledModules: true,
        memberPerks: true,
        rooms: {
          select: {
            id: true,
            name: true,
            description: true,
            locked: true,
            ownerId: true,
            isEvent: true,
            pinned: true,
            iconUrl: true,
            bannerUrl: true,
            accentColor: true,
            _count: { select: { members: true } },
          },
          orderBy: [{ isEvent: "desc" }, { name: "asc" }],
        },
        _count: { select: { rooms: true, members: true } },
        tiers: {
          where: { active: true },
          select: {
            id: true,
            name: true,
            priceMonthly: true,
            color: true,
            grantLevel: true,
            sortOrder: true,
          },
          orderBy: { sortOrder: "asc" },
        },
      },
    });
    if (!lobby) return reply.code(404).send({ ok: false, error: "not_found" });

    const enrichedRooms = lobby.rooms.map((r: any) => {
      const wsRoom = rooms.get(r.id);
      const onlineUsers: { id: string; name: string; avatar?: string }[] = [];
      if (wsRoom?.users) {
        for (const [uid, u] of wsRoom.users) {
          if (onlineUsers.length >= 4) break;
          onlineUsers.push({ id: uid, name: u?.name || uid, avatar: u?.avatar || undefined });
        }
      }
      return { ...r, onlineCount: wsRoom?.users?.size ?? 0, onlineUsers };
    });

    let membership: any = null;
    let joinRequest: any = null;
    const u = authFromHeader((req as any).headers?.authorization);
    if (u) {
      const member = await prisma.lobbyMember.findUnique({
        where: { lobbyId_userId: { lobbyId: id, userId: u.id } },
        select: { role: true, roleLevel: true },
      });
      if (member) {
        membership = { role: member.role, roleLevel: member.roleLevel };
      } else if (lobby.joinMode === "APPROVAL") {
        const req2 = await prisma.lobbyJoinRequest.findUnique({
          where: { lobbyId_userId: { lobbyId: id, userId: u.id } },
          select: { status: true, createdAt: true, denyReason: true },
        });
        if (req2) joinRequest = req2;
      }
    }

    return reply.send({
      ok: true,
      lobby: applyWindroseReel({ ...lobby, rooms: enrichedRooms }),
      membership,
      joinRequest,
    });
  });

  app.post(
    "/lobbies/:id/join",
    {
      schema: { tags: ["lobbies"], params: z.object({ id: z.string().min(1) }) },
    },
    async (req, reply) => {
      const lobbyId = (req.params as any).id as string;
      const u = authFromHeader((req as any).headers?.authorization);
      if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });

      const lobby = await prisma.lobby.findUnique({
        where: { id: lobbyId },
        select: { id: true, joinMode: true, joinPassword: true, name: true },
      });
      if (!lobby) return reply.code(404).send({ ok: false, error: "not_found" });

      const ban = await prisma.lobbyBan.findUnique({
        where: { lobbyId_userId: { lobbyId, userId: u.id } },
      });
      if (ban)
        return reply
          .code(403)
          .send({ ok: false, error: "banned", message: "You are banned from this lobby." });

      const existing = await prisma.lobbyMember.findUnique({
        where: { lobbyId_userId: { lobbyId, userId: u.id } },
      });
      if (existing)
        return reply.send({
          ok: true,
          already: true,
          role: existing.role,
          roleLevel: existing.roleLevel,
        });

      const body = (req.body || {}) as any;
      const mode = lobby.joinMode || "OPEN";

      if (mode === "PAID") {
        return reply.code(403).send({
          ok: false,
          error: "paid_required",
          message: "Subscribe to a lobby tier to join.",
        });
      }

      if (mode === "PASSWORD") {
        const pw = String(body.password || "").trim();
        if (!pw || pw !== lobby.joinPassword) {
          return reply
            .code(403)
            .send({ ok: false, error: "wrong_password", message: "Incorrect lobby password." });
        }
      }

      if (mode === "APPROVAL") {
        const existingReq = await prisma.lobbyJoinRequest.findUnique({
          where: { lobbyId_userId: { lobbyId, userId: u.id } },
        });
        if (existingReq) {
          if (existingReq.status === "PENDING") return reply.send({ ok: true, pending: true });
          if (existingReq.status === "DENIED") {
            await prisma.lobbyJoinRequest.update({
              where: { id: existingReq.id },
              data: {
                status: "PENDING",
                message: String(body.message || "").slice(0, 500),
                reviewedAt: null,
                reviewedById: null,
                reviewedByName: null,
                denyReason: null,
              },
            });
            return reply.send({ ok: true, pending: true, resubmitted: true });
          }
        }
        const user = await prisma.user.findUnique({ where: { id: u.id }, select: { name: true } });
        await prisma.lobbyJoinRequest.create({
          data: {
            lobbyId,
            userId: u.id,
            userName: user?.name || u.name || "Unknown",
            message: String(body.message || "").slice(0, 500),
          },
        });
        return reply.send({ ok: true, pending: true });
      }

      const user = await prisma.user.findUnique({ where: { id: u.id }, select: { name: true } });
      const member = await prisma.lobbyMember.create({
        data: {
          lobbyId,
          userId: u.id,
          name: user?.name || u.name || "Unknown",
          role: "MEMBER",
          roleLevel: 1,
        },
      });

      await prisma.lobbyAudit.create({
        data: {
          id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          lobbyId,
          type: "member_join",
          actorId: u.id,
          actorName: user?.name || "Unknown",
          note: `Joined lobby (${mode})`,
          ts: new Date(),
        },
      });

      return reply.send({ ok: true, role: member.role, roleLevel: member.roleLevel });
    },
  );

  app.post(
    "/lobbies/:id/leave",
    {
      schema: { tags: ["lobbies"], params: z.object({ id: z.string().min(1) }) },
    },
    async (req, reply) => {
      const lobbyId = (req.params as any).id as string;
      const u = authFromHeader((req as any).headers?.authorization);
      if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });

      const member = await prisma.lobbyMember.findUnique({
        where: { lobbyId_userId: { lobbyId, userId: u.id } },
        select: { id: true, role: true, roleLevel: true },
      });
      if (!member) return reply.code(404).send({ ok: false, error: "not_a_member" });

      if (member.roleLevel >= 5) {
        return reply.code(403).send({
          ok: false,
          error: "owner_cannot_leave",
          message: "Transfer ownership before leaving.",
        });
      }

      await prisma.lobbyMember.delete({ where: { id: member.id } });

      await prisma.lobbyTierSub.updateMany({
        where: { lobbyId, userId: u.id, status: "active" },
        data: { status: "canceled", cancelAtPeriodEnd: true },
      });

      const user = await prisma.user.findUnique({ where: { id: u.id }, select: { name: true } });
      await prisma.lobbyAudit.create({
        data: {
          id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          lobbyId,
          type: "member_leave",
          actorId: u.id,
          actorName: user?.name || "Unknown",
          note: "Left lobby",
          ts: new Date(),
        },
      });

      return reply.send({ ok: true });
    },
  );

  app.get("/lobbies/:id/admin/join-requests", async (req, reply) => {
    const ctx = await lobbyAdminAccess(req, reply, 3);
    if (!ctx) return;
    const requests = await prisma.lobbyJoinRequest.findMany({
      where: { lobbyId: ctx.lobby.id },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return reply.send({ ok: true, requests });
  });

  app.post(
    "/lobbies/:id/admin/join-requests/:reqId/approve",
    {
      schema: {
        tags: ["lobbies"],
        params: z.object({ id: z.string().min(1), reqId: z.string().min(1) }),
      },
    },
    async (req, reply) => {
      const ctx = await lobbyAdminAccess(req, reply, 3);
      if (!ctx) return;
      const reqId = (req.params as any).reqId as string;
      const jr = await prisma.lobbyJoinRequest.findUnique({ where: { id: reqId } });
      if (!jr || jr.lobbyId !== ctx.lobby.id)
        return reply.code(404).send({ ok: false, error: "not_found" });
      if (jr.status !== "PENDING")
        return reply.code(400).send({ ok: false, error: "already_reviewed" });

      await prisma.lobbyJoinRequest.update({
        where: { id: reqId },
        data: {
          status: "APPROVED",
          reviewedById: ctx.member.userId,
          reviewedByName: ctx.member.name,
          reviewedAt: new Date(),
        },
      });
      await prisma.lobbyMember.create({
        data: {
          lobbyId: ctx.lobby.id,
          userId: jr.userId,
          name: jr.userName,
          role: "MEMBER",
          roleLevel: 1,
        },
      });

      await prisma.lobbyAudit.create({
        data: {
          id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          lobbyId: ctx.lobby.id,
          type: "join_request_approved",
          actorId: ctx.member.userId,
          actorName: ctx.member.name,
          note: `Approved join request from ${jr.userName}`,
          ts: new Date(),
        },
      });

      return reply.send({ ok: true });
    },
  );

  app.post(
    "/lobbies/:id/admin/join-requests/:reqId/deny",
    {
      schema: {
        tags: ["lobbies"],
        params: z.object({ id: z.string().min(1), reqId: z.string().min(1) }),
      },
    },
    async (req, reply) => {
      const ctx = await lobbyAdminAccess(req, reply, 3);
      if (!ctx) return;
      const reqId = (req.params as any).reqId as string;
      const jr = await prisma.lobbyJoinRequest.findUnique({ where: { id: reqId } });
      if (!jr || jr.lobbyId !== ctx.lobby.id)
        return reply.code(404).send({ ok: false, error: "not_found" });
      if (jr.status !== "PENDING")
        return reply.code(400).send({ ok: false, error: "already_reviewed" });

      const body = (req.body || {}) as any;
      await prisma.lobbyJoinRequest.update({
        where: { id: reqId },
        data: {
          status: "DENIED",
          reviewedById: ctx.member.userId,
          reviewedByName: ctx.member.name,
          reviewedAt: new Date(),
          denyReason: String(body.reason || "").slice(0, 500) || null,
        },
      });

      await prisma.lobbyAudit.create({
        data: {
          id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          lobbyId: ctx.lobby.id,
          type: "join_request_denied",
          actorId: ctx.member.userId,
          actorName: ctx.member.name,
          note: `Denied join request from ${jr.userName}`,
          ts: new Date(),
        },
      });

      return reply.send({ ok: true });
    },
  );

  app.patch(
    "/lobbies/:id/admin/join-mode",
    {
      schema: { tags: ["lobbies"], params: z.object({ id: z.string().min(1) }) },
    },
    async (req, reply) => {
      const ctx = await lobbyAdminAccess(req, reply, 4);
      if (!ctx) return;
      const body = (req.body || {}) as any;
      const mode = String(body.joinMode || "OPEN");
      if (!["OPEN", "APPROVAL", "PASSWORD", "PAID"].includes(mode)) {
        return reply.code(400).send({ ok: false, error: "invalid_mode" });
      }
      const data: any = { joinMode: mode };
      if (mode === "PASSWORD") {
        const pw = String(body.password || "").trim();
        if (!pw) return reply.code(400).send({ ok: false, error: "password_required" });
        data.joinPassword = pw;
      } else {
        data.joinPassword = null;
      }
      await prisma.lobby.update({ where: { id: ctx.lobby.id }, data });

      await prisma.lobbyAudit.create({
        data: {
          id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          lobbyId: ctx.lobby.id,
          type: "join_mode_changed",
          actorId: ctx.member.userId,
          actorName: ctx.member.name,
          note: `Join mode set to ${mode}`,
          ts: new Date(),
        },
      });

      return reply.send({ ok: true, joinMode: mode });
    },
  );

  app.post(
    "/lobbies",
    {
      schema: {
        tags: ["lobbies"],
        body: z.object({ id: z.string().min(1), name: z.string().min(1) }).passthrough(),
      },
    },
    async (req, reply) => {
      const token = String((req.headers.authorization || "").replace("Bearer ", "").trim());
      const u = verifyToken(token);
      if (!u) return reply.code(401).send({ error: "Unauthorized" });
      const role = await getGlobalRole(u.id);
      const isStaff = canAccessStaff(role);

      if (!isStaff) {
        const dbUser = await prisma.user.findUnique({
          where: { id: u.id },
          select: { tier: true },
        });
        const tier = String(dbUser?.tier ?? "INNOCENT");
        if (tier === "INNOCENT") {
          return reply.code(403).send({
            ok: false,
            error: "tier_required",
            message: "Indicted tier or higher required to create lobbies.",
          });
        }
        const ownedCount = await prisma.lobby.count({ where: { ownerId: u.id } });
        const maxLobbies = tier === "KINGPIN" ? 999 : tier === "FELON" ? 3 : 1;
        if (ownedCount >= maxLobbies) {
          return reply.code(403).send({
            ok: false,
            error: "lobby_limit",
            message: `You can own up to ${maxLobbies} lobbies on the ${tier} tier.`,
          });
        }
      }

      const {
        id,
        name,
        description = "",
        pinned = false,
        moduleType = "NONE",
        moduleConfig,
        keywords = [],
        accentColor,
        logoUrl,
        bannerUrl,
        websiteUrl,
      } = req.body as any;
      if (!id || !name) return reply.code(400).send({ ok: false, error: "id and name required" });

      if (!isStaff) {
        const reserved = await isNameReserved(String(id), "LOBBY");
        if (reserved)
          return reply.code(403).send({
            ok: false,
            error: "name_reserved",
            message: "This lobby name is reserved and cannot be used.",
          });
      }

      const shouldPin = isStaff ? Boolean(pinned) : false;

      const lobby = await prisma.lobby.upsert({
        where: { id: String(id) },
        update: {
          name: String(name),
          description: String(description),
          pinned: shouldPin,
          moduleType,
          moduleConfig: moduleConfig ?? undefined,
          keywords: Array.isArray(keywords) ? keywords.map(String) : [],
          accentColor: accentColor ?? null,
          logoUrl: logoUrl ?? null,
          bannerUrl: bannerUrl ?? null,
          websiteUrl: websiteUrl ?? null,
        },
        create: {
          id: String(id),
          name: String(name),
          description: String(description),
          pinned: shouldPin,
          verified: true,
          ownerId: u.id,
          moduleType,
          moduleConfig: moduleConfig ?? undefined,
          keywords: Array.isArray(keywords) ? keywords.map(String) : [],
          accentColor: accentColor ?? null,
          logoUrl: logoUrl ?? null,
          bannerUrl: bannerUrl ?? null,
          websiteUrl: websiteUrl ?? null,
        },
      });
      awardNotoriety(u.id, "LOBBY_CREATED").catch(() => {});
      return reply.send({ ok: true, lobby });
    },
  );

  app.get("/lobbies/:lobbyId/presence", async (req, reply) => {
    const lobbyId = String((req as any).params?.lobbyId || "");
    if (!lobbyId) return reply.code(400).send({ ok: false, error: "missing lobbyId" });

    const seen = new Map<string, any>();
    for (const [, room] of rooms) {
      if (room.lobbyId !== lobbyId) continue;
      for (const [uid, u] of room.users) {
        if (!seen.has(uid)) {
          seen.set(uid, {
            id: uid,
            name: u.name,
            role: u.role,
            globalRole: u.globalRole,
            tier: u.tier,
            avatarColor: u.avatarColor,
            avatar: u.avatar,
            isAway: Boolean((u as any).isAway),
            steamId: (u as any).steamId,
            twitchLogin: (u as any).twitchLogin,
            xboxGamertag: (u as any).xboxGamertag,
            livePresence: (u as any).livePresence ?? null,
            pillBgColor: (u as any).pillBgColor ?? null,
            pillAccentColor: (u as any).pillAccentColor ?? null,
            statusText: (u as any).statusText ?? null,
            statusEmoji: (u as any).statusEmoji ?? null,
            nameEffect: (u as any).nameEffect ?? null,
            avatarFrame: (u as any).avatarFrame ?? null,
            roomId: room.roomId,
            roomName: room.name || room.roomId,
          });
        }
      }
    }

    return reply.send({ ok: true, users: Array.from(seen.values()) });
  });

  app.get("/lobbies/:lobbyId/presence/:userId/game-card", async (req, reply) => {
    const token = String((req.headers.authorization || "").replace("Bearer ", "").trim());
    const u = verifyToken(token);
    if (!u) return reply.code(401).send({ error: "Unauthorized" });

    const { lobbyId, userId: targetUserId } = req.params as any;
    const lobby = await prisma.lobby.findUnique({
      where: { id: lobbyId },
      select: { moduleType: true },
    });
    if (!lobby) return reply.code(404).send({ ok: false, error: "not_found" });
    if (lobby.moduleType === "NONE" || lobby.moduleType === "FEED") {
      return reply.send({ ok: true, hasCard: false });
    }

    const account = await prisma.userGameAccount.findUnique({
      where: { userId_gameType: { userId: targetUserId, gameType: lobby.moduleType } },
      select: { displayName: true, platform: true, cardData: true, cardCachedAt: true },
    });
    if (!account?.cardData) return reply.send({ ok: true, hasCard: false });

    const isStale =
      !account.cardCachedAt ||
      Date.now() - new Date(account.cardCachedAt).getTime() > 5 * 60 * 1000;

    return reply.send({
      ok: true,
      hasCard: true,
      gameType: lobby.moduleType,
      displayName: account.displayName,
      platform: account.platform,
      cardData: account.cardData,
      isStale,
    });
  });

  const LEVEL_PERMS: Record<number, string[]> = {
    5: ["kick", "ban", "manage_rooms", "edit_branding", "manage_roles", "pin_rooms", "admin_chat"],
    4: ["kick", "ban", "manage_rooms", "edit_branding", "pin_rooms", "admin_chat"],
    3: ["kick", "ban", "manage_rooms", "pin_rooms", "admin_chat"],
    2: ["kick", "admin_chat"],
    1: [],
  };

  const DEFAULT_ROLE_NAMES: Record<string, string> = {
    "5": "Owner",
    "4": "Admin",
    "3": "Moderator",
    "2": "Trusted",
    "1": "Member",
  };

  function hasLobbyPerm(level: number, perm: string, overrideRole: string | null): boolean {
    if (overrideRole && ["STAFF", "ADMIN", "GOD"].includes(overrideRole)) return true;
    return (LEVEL_PERMS[level] || []).includes(perm);
  }

  app.get("/lobbies/:id/admin", async (req, reply) => {
    const ctx = await lobbyAdminAccess(req, reply, 2);
    if (!ctx) return;
    const { lobby, member, overrideRole, globalRole } = ctx;
    const lobbyId = lobby.id;

    const [members, roomList, auditList, banList] = await Promise.all([
      prisma.lobbyMember.findMany({
        where: { lobbyId },
        orderBy: [{ roleLevel: "desc" }, { name: "asc" }],
        select: {
          id: true,
          userId: true,
          name: true,
          role: true,
          roleLevel: true,
          createdAt: true,
        },
      }),
      prisma.room.findMany({
        where: { lobbyId },
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          name: true,
          locked: true,
          ownerId: true,
          _count: { select: { members: true } },
        },
      }),
      prisma.lobbyAudit.findMany({
        where: { lobbyId },
        orderBy: { ts: "desc" },
        take: 100,
      }),
      prisma.lobbyBan.findMany({
        where: { lobbyId },
        select: { id: true, userId: true, reason: true, createdAt: true },
      }),
    ]);

    const roleNames = lobby.roleNames || DEFAULT_ROLE_NAMES;
    const myLevel = overrideRole ? 5 : (member?.roleLevel ?? 1);

    return reply.send({
      ok: true,
      lobby: {
        id: lobby.id,
        name: lobby.name,
        description: lobby.description,
        verified: lobby.verified,
        pinned: lobby.pinned,
        moduleType: lobby.moduleType,
        moduleConfig: lobby.moduleConfig,
        accentColor: lobby.accentColor,
        logoUrl: lobby.logoUrl,
        bannerUrl: lobby.bannerUrl,
        websiteUrl: lobby.websiteUrl,
        keywords: lobby.keywords,
        enabledModules: lobby.enabledModules,
        roleNames,
        joinMode: lobby.joinMode || "OPEN",
        joinPassword: lobby.joinPassword || null,
        blockedWords: (lobby as any).blockedWords || [],
        blockedDomains: (lobby as any).blockedDomains || [],
        newAccountChatHours: (lobby as any).newAccountChatHours ?? 0,
      },
      members,
      rooms: roomList.map((r: any) => ({
        id: r.id,
        name: r.name || r.id,
        locked: Boolean(r.locked),
        ownerId: r.ownerId,
        onlineCount: rooms.get(r.id)?.users.size ?? 0,
        memberCount: r._count?.members ?? 0,
      })),
      audit: auditList,
      bans: banList,
      myLevel,
      overrideRole,
      globalRole: String(globalRole),
      perms: LEVEL_PERMS[myLevel] || [],
    });
  });

  app.patch(
    "/lobbies/:id/admin/branding",
    {
      schema: { tags: ["lobbies"], params: z.object({ id: z.string().min(1) }) },
    },
    async (req, reply) => {
      const ctx = await lobbyAdminAccess(req, reply, 4);
      if (!ctx) return;
      if (
        !hasLobbyPerm(
          ctx.member?.roleLevel ?? (ctx.overrideRole ? 5 : 1),
          "edit_branding",
          ctx.overrideRole,
        )
      ) {
        return reply.code(403).send({ ok: false, error: "no_permission" });
      }
      const body: any = (req as any).body || {};
      const data: any = {};
      if (typeof body.name === "string") data.name = body.name.slice(0, 100);
      if (typeof body.description === "string") data.description = body.description.slice(0, 500);
      if (typeof body.accentColor === "string") data.accentColor = body.accentColor.slice(0, 20);
      if (typeof body.logoUrl === "string") data.logoUrl = body.logoUrl.slice(0, 500);
      if (typeof body.bannerUrl === "string") data.bannerUrl = body.bannerUrl.slice(0, 500);
      if (typeof body.websiteUrl === "string") data.websiteUrl = body.websiteUrl.slice(0, 500);
      if (Array.isArray(body.keywords)) data.keywords = body.keywords.map(String).slice(0, 20);

      if (Object.keys(data).length === 0)
        return reply.code(400).send({ ok: false, error: "nothing_to_update" });

      await prisma.lobby.update({ where: { id: ctx.lobby.id }, data });
      await prisma.lobbyAudit.create({
        data: {
          id: randomUUID(),
          lobbyId: ctx.lobby.id,
          type: "branding_update",
          actorId: ctx.user.id,
          actorName: ctx.user.name,
          note: Object.keys(data).join(", "),
        },
      });
      return reply.send({ ok: true, updated: Object.keys(data) });
    },
  );

  app.patch(
    "/lobbies/:id/admin/perks",
    {
      schema: { tags: ["lobbies"], params: z.object({ id: z.string().min(1) }) },
    },
    async (req, reply) => {
      const ctx = await lobbyAdminAccess(req, reply, 4);
      if (!ctx) return;
      if (
        !hasLobbyPerm(
          ctx.member?.roleLevel ?? (ctx.overrideRole ? 5 : 1),
          "edit_branding",
          ctx.overrideRole,
        )
      ) {
        return reply.code(403).send({ ok: false, error: "no_permission" });
      }
      const body: any = (req as any).body || {};
      if (!Array.isArray(body.memberPerks)) {
        return reply.code(400).send({ ok: false, error: "memberPerks_must_be_array" });
      }
      const perks: string[] = body.memberPerks
        .filter((p: any) => typeof p === "string")
        .map((p: string) => p.trim().slice(0, 80))
        .filter((p: string) => p.length > 0)
        .slice(0, 5);
      await prisma.lobby.update({
        where: { id: ctx.lobby.id },
        data: { memberPerks: perks },
      });
      await prisma.lobbyAudit.create({
        data: {
          id: randomUUID(),
          lobbyId: ctx.lobby.id,
          type: "perks_update",
          actorId: ctx.user.id,
          actorName: ctx.user.name,
          note: `${perks.length} perks`,
        },
      });
      return reply.send({ ok: true, memberPerks: perks });
    },
  );

  app.patch(
    "/lobbies/:id/admin/moderation",
    {
      schema: { tags: ["lobbies"], params: z.object({ id: z.string().min(1) }) },
    },
    async (req, reply) => {
      const ctx = await lobbyAdminAccess(req, reply, 4);
      if (!ctx) return;
      if (
        !hasLobbyPerm(
          ctx.member?.roleLevel ?? (ctx.overrideRole ? 5 : 1),
          "edit_branding",
          ctx.overrideRole,
        )
      ) {
        return reply.code(403).send({ ok: false, error: "no_permission" });
      }
      const body: any = (req as any).body || {};
      const cleanList = (arr: unknown, max = 100) =>
        Array.isArray(arr)
          ? Array.from(
              new Set(
                arr
                  .map((s) =>
                    String(s || "")
                      .trim()
                      .toLowerCase(),
                  )
                  .filter((s) => s.length > 0 && s.length <= 60),
              ),
            ).slice(0, max)
          : null;

      const data: any = {};
      if (body.blockedWords !== undefined) {
        const v = cleanList(body.blockedWords);
        if (v === null) return reply.code(400).send({ ok: false, error: "blockedWords_invalid" });
        data.blockedWords = v;
      }
      if (body.blockedDomains !== undefined) {
        const v = cleanList(body.blockedDomains);
        if (v === null) return reply.code(400).send({ ok: false, error: "blockedDomains_invalid" });
        data.blockedDomains = v;
      }
      if (body.newAccountChatHours !== undefined) {
        const n = Math.max(0, Math.min(720, Number(body.newAccountChatHours) || 0));
        data.newAccountChatHours = n;
      }
      if (Object.keys(data).length === 0)
        return reply.code(400).send({ ok: false, error: "no_changes" });

      await prisma.lobby.update({ where: { id: ctx.lobby.id }, data });
      await prisma.lobbyAudit.create({
        data: {
          id: randomUUID(),
          lobbyId: ctx.lobby.id,
          type: "moderation_update",
          actorId: ctx.user.id,
          actorName: ctx.user.name,
          note: JSON.stringify(data),
        },
      });
      return reply.send({ ok: true, ...data });
    },
  );

  app.patch(
    "/lobbies/:id/admin/modules",
    {
      schema: { tags: ["lobbies"], params: z.object({ id: z.string().min(1) }) },
    },
    async (req, reply) => {
      const ctx = await lobbyAdminAccess(req, reply, 4);
      if (!ctx) return;
      if (
        !hasLobbyPerm(
          ctx.member?.roleLevel ?? (ctx.overrideRole ? 5 : 1),
          "edit_branding",
          ctx.overrideRole,
        )
      ) {
        return reply.code(403).send({ ok: false, error: "no_permission" });
      }
      const body: any = (req as any).body || {};
      const valid = [
        "voice",
        "youtube",
        "video",
        "screen",
        "twitch",
        "browser",
        "article",
        "custom",
        "reddit",
        "fakeout",
        "hq",
      ];
      const enabledModules = Array.isArray(body.enabledModules)
        ? body.enabledModules.filter((m: string) => valid.includes(m))
        : null;
      if (!enabledModules)
        return reply.code(400).send({ ok: false, error: "enabledModules required" });

      await prisma.lobby.update({ where: { id: ctx.lobby.id }, data: { enabledModules } });
      await prisma.lobbyAudit.create({
        data: {
          id: randomUUID(),
          lobbyId: ctx.lobby.id,
          type: "modules_update",
          actorId: ctx.user.id,
          actorName: ctx.user.name,
          note: enabledModules.join(", "),
        },
      });
      return reply.send({ ok: true, enabledModules });
    },
  );

  app.patch(
    "/lobbies/:id/admin/roles",
    {
      schema: { tags: ["lobbies"], params: z.object({ id: z.string().min(1) }) },
    },
    async (req, reply) => {
      const ctx = await lobbyAdminAccess(req, reply, 5);
      if (!ctx) return;
      if (
        !hasLobbyPerm(
          ctx.member?.roleLevel ?? (ctx.overrideRole ? 5 : 1),
          "manage_roles",
          ctx.overrideRole,
        )
      ) {
        return reply.code(403).send({ ok: false, error: "no_permission" });
      }
      const body: any = (req as any).body || {};
      const roleNames = body.roleNames;
      if (!roleNames || typeof roleNames !== "object")
        return reply.code(400).send({ ok: false, error: "roleNames required" });
      const clean: Record<string, string> = {};
      for (const k of ["1", "2", "3", "4", "5"]) {
        clean[k] =
          typeof roleNames[k] === "string" ? roleNames[k].slice(0, 24) : DEFAULT_ROLE_NAMES[k];
      }

      await prisma.lobby.update({
        where: { id: ctx.lobby.id },
        data: { roleNames: clean },
      });
      await prisma.lobbyAudit.create({
        data: {
          id: randomUUID(),
          lobbyId: ctx.lobby.id,
          type: "roles_renamed",
          actorId: ctx.user.id,
          actorName: ctx.user.name,
          note: JSON.stringify(clean),
        },
      });
      return reply.send({ ok: true, roleNames: clean });
    },
  );

  app.get("/lobbies/:id/admin/members", async (req, reply) => {
    const ctx = await lobbyAdminAccess(req, reply, 2);
    if (!ctx) return;
    const members = await prisma.lobbyMember.findMany({
      where: { lobbyId: ctx.lobby.id },
      orderBy: [{ roleLevel: "desc" }, { name: "asc" }],
      select: { id: true, userId: true, name: true, role: true, roleLevel: true, createdAt: true },
    });
    return reply.send({ ok: true, members });
  });

  app.post(
    "/lobbies/:id/admin/members/:userId/role",
    {
      schema: {
        tags: ["lobbies"],
        params: z.object({ id: z.string().min(1), userId: z.string().min(1) }),
      },
    },
    async (req, reply) => {
      const ctx = await lobbyAdminAccess(req, reply, 4);
      if (!ctx) return;
      const myLevel = ctx.overrideRole ? 5 : (ctx.member?.roleLevel ?? 1);
      if (!hasLobbyPerm(myLevel, "manage_roles", ctx.overrideRole)) {
        return reply.code(403).send({ ok: false, error: "no_permission" });
      }
      const targetUserId = String((req as any).params?.userId || "");
      const body: any = (req as any).body || {};
      const newLevel = Math.min(Math.max(Number(body.roleLevel) || 1, 1), 5);
      if (newLevel >= myLevel && !ctx.overrideRole)
        return reply.code(403).send({ ok: false, error: "cannot_promote_to_own_level" });
      const target = await prisma.lobbyMember.findUnique({
        where: { lobbyId_userId: { lobbyId: ctx.lobby.id, userId: targetUserId } },
      });
      if (!target) return reply.code(404).send({ ok: false, error: "member_not_found" });
      if ((target.roleLevel ?? 1) >= myLevel && !ctx.overrideRole)
        return reply.code(403).send({ ok: false, error: "cannot_modify_peer_or_above" });

      const lobbyRole =
        newLevel >= 4 ? LobbyRole.OWNER : newLevel >= 3 ? LobbyRole.MOD : LobbyRole.MEMBER;
      await prisma.lobbyMember.update({
        where: { lobbyId_userId: { lobbyId: ctx.lobby.id, userId: targetUserId } },
        data: { roleLevel: newLevel, role: lobbyRole },
      });
      await prisma.lobbyAudit.create({
        data: {
          id: randomUUID(),
          lobbyId: ctx.lobby.id,
          type: "member_role_change",
          actorId: ctx.user.id,
          actorName: ctx.user.name,
          targetId: targetUserId,
          note: `level ${newLevel}`,
        },
      });
      return reply.send({ ok: true, userId: targetUserId, roleLevel: newLevel });
    },
  );

  app.post(
    "/lobbies/:id/admin/members/:userId/kick",
    {
      schema: {
        tags: ["lobbies"],
        params: z.object({ id: z.string().min(1), userId: z.string().min(1) }),
      },
    },
    async (req, reply) => {
      const ctx = await lobbyAdminAccess(req, reply, 2);
      if (!ctx) return;
      const myLevel = ctx.overrideRole ? 5 : (ctx.member?.roleLevel ?? 1);
      if (!hasLobbyPerm(myLevel, "kick", ctx.overrideRole))
        return reply.code(403).send({ ok: false, error: "no_permission" });
      const targetUserId = String((req as any).params?.userId || "");
      const target = await prisma.lobbyMember.findUnique({
        where: { lobbyId_userId: { lobbyId: ctx.lobby.id, userId: targetUserId } },
      });
      if (!target) return reply.code(404).send({ ok: false, error: "member_not_found" });
      if ((target.roleLevel ?? 1) >= myLevel && !ctx.overrideRole)
        return reply.code(403).send({ ok: false, error: "cannot_kick_peer_or_above" });
      await prisma.lobbyMember.delete({
        where: { lobbyId_userId: { lobbyId: ctx.lobby.id, userId: targetUserId } },
      });
      await prisma.lobbyAudit.create({
        data: {
          id: randomUUID(),
          lobbyId: ctx.lobby.id,
          type: "member_kicked",
          actorId: ctx.user.id,
          actorName: ctx.user.name,
          targetId: targetUserId,
          note: target.name,
        },
      });
      return reply.send({ ok: true });
    },
  );

  app.post(
    "/lobbies/:id/admin/members/:userId/ban",
    {
      schema: {
        tags: ["lobbies"],
        params: z.object({ id: z.string().min(1), userId: z.string().min(1) }),
      },
    },
    async (req, reply) => {
      const ctx = await lobbyAdminAccess(req, reply, 3);
      if (!ctx) return;
      const myLevel = ctx.overrideRole ? 5 : (ctx.member?.roleLevel ?? 1);
      if (!hasLobbyPerm(myLevel, "ban", ctx.overrideRole))
        return reply.code(403).send({ ok: false, error: "no_permission" });
      const targetUserId = String((req as any).params?.userId || "");
      const body: any = (req as any).body || {};
      const reason = typeof body.reason === "string" ? body.reason.slice(0, 200) : "";
      await prisma.lobbyMember.deleteMany({
        where: { lobbyId: ctx.lobby.id, userId: targetUserId },
      });
      await prisma.lobbyBan.upsert({
        where: { lobbyId_userId: { lobbyId: ctx.lobby.id, userId: targetUserId } },
        update: { reason },
        create: { lobbyId: ctx.lobby.id, userId: targetUserId, reason },
      });
      await prisma.lobbyAudit.create({
        data: {
          id: randomUUID(),
          lobbyId: ctx.lobby.id,
          type: "member_banned",
          actorId: ctx.user.id,
          actorName: ctx.user.name,
          targetId: targetUserId,
          note: reason || undefined,
        },
      });
      return reply.send({ ok: true });
    },
  );

  app.delete(
    "/lobbies/:id/admin/members/:userId/ban",
    {
      schema: {
        tags: ["lobbies"],
        params: z.object({ id: z.string().min(1), userId: z.string().min(1) }),
      },
    },
    async (req, reply) => {
      const ctx = await lobbyAdminAccess(req, reply, 3);
      if (!ctx) return;
      const myLevel = ctx.overrideRole ? 5 : (ctx.member?.roleLevel ?? 1);
      if (!hasLobbyPerm(myLevel, "ban", ctx.overrideRole))
        return reply.code(403).send({ ok: false, error: "no_permission" });
      const targetUserId = String((req as any).params?.userId || "");
      await prisma.lobbyBan.deleteMany({
        where: { lobbyId: ctx.lobby.id, userId: targetUserId },
      });
      await prisma.lobbyAudit.create({
        data: {
          id: randomUUID(),
          lobbyId: ctx.lobby.id,
          type: "member_unbanned",
          actorId: ctx.user.id,
          actorName: ctx.user.name,
          targetId: targetUserId,
        },
      });
      return reply.send({ ok: true });
    },
  );

  app.post(
    "/lobbies/:id/admin/rooms/:roomId/pin",
    {
      schema: {
        tags: ["lobbies"],
        params: z.object({ id: z.string().min(1), roomId: z.string().min(1) }),
      },
    },
    async (req, reply) => {
      const ctx = await lobbyAdminAccess(req, reply, 3);
      if (!ctx) return;
      const myLevel = ctx.overrideRole ? 5 : (ctx.member?.roleLevel ?? 1);
      if (!hasLobbyPerm(myLevel, "pin_rooms", ctx.overrideRole))
        return reply.code(403).send({ ok: false, error: "no_permission" });
      const roomId = String((req as any).params?.roomId || "");
      const body: any = (req as any).body || {};
      const pinned = body.pinned !== false;

      const roomRow = await prisma.room.findUnique({ where: { id: roomId } });
      if (!roomRow || roomRow.lobbyId !== ctx.lobby.id) {
        return reply.code(404).send({ ok: false, error: "room_not_in_lobby" });
      }

      const room = rooms.get(roomId);
      if (room) room.pinned = pinned;

      try {
        await prisma.room.update({ where: { id: roomId }, data: { pinned } });
      } catch (e) {
        log.error("[lobby pin] db update failed", e);
      }

      await prisma.lobbyAudit.create({
        data: {
          id: randomUUID(),
          lobbyId: ctx.lobby.id,
          type: pinned ? "room_pinned" : "room_unpinned",
          actorId: ctx.user.id,
          actorName: ctx.user.name,
          targetId: roomId,
        },
      });
      return reply.send({ ok: true, roomId, pinned });
    },
  );

  app.post(
    "/lobbies/:id/admin/rooms/:roomId/event",
    {
      schema: {
        tags: ["lobbies"],
        params: z.object({ id: z.string().min(1), roomId: z.string().min(1) }),
      },
    },
    async (req, reply) => {
      const ctx = await lobbyAdminAccess(req, reply, 3);
      if (!ctx) return;
      const myLevel = ctx.overrideRole ? 5 : (ctx.member?.roleLevel ?? 1);
      if (!hasLobbyPerm(myLevel, "pin_rooms", ctx.overrideRole))
        return reply.code(403).send({ ok: false, error: "no_permission" });
      const roomId = String((req as any).params?.roomId || "");
      const body: any = (req as any).body || {};
      const isEvent = body.isEvent !== false;

      const roomRow = await prisma.room.findUnique({ where: { id: roomId } });
      if (!roomRow || roomRow.lobbyId !== ctx.lobby.id) {
        return reply.code(404).send({ ok: false, error: "room_not_in_lobby" });
      }

      const room = rooms.get(roomId);
      if (room) room.isEvent = isEvent;

      try {
        await prisma.room.update({ where: { id: roomId }, data: { isEvent } });
      } catch (e) {
        log.error("[lobby event] db update failed", e);
      }

      await prisma.lobbyAudit.create({
        data: {
          id: randomUUID(),
          lobbyId: ctx.lobby.id,
          type: isEvent ? "room_event_on" : "room_event_off",
          actorId: ctx.user.id,
          actorName: ctx.user.name,
          targetId: roomId,
        },
      });
      return reply.send({ ok: true, roomId, isEvent });
    },
  );

  app.delete(
    "/lobbies/:id/admin/rooms/:roomId",
    {
      schema: {
        tags: ["lobbies"],
        params: z.object({ id: z.string().min(1), roomId: z.string().min(1) }),
      },
    },
    async (req, reply) => {
      const ctx = await lobbyAdminAccess(req, reply, 3);
      if (!ctx) return;
      const myLevel = ctx.overrideRole ? 5 : (ctx.member?.roleLevel ?? 1);
      if (!hasLobbyPerm(myLevel, "manage_rooms", ctx.overrideRole))
        return reply.code(403).send({ ok: false, error: "no_permission" });
      const roomId = String((req as any).params?.roomId || "");
      const room = await prisma.room.findUnique({
        where: { id: roomId },
        select: { lobbyId: true, name: true, pinned: true },
      });
      if (!room || room.lobbyId !== ctx.lobby.id)
        return reply.code(404).send({ ok: false, error: "room_not_found_in_lobby" });
      if (room.pinned && !ctx.overrideRole)
        return reply.code(409).send({
          ok: false,
          error: "cannot_delete_pinned",
          message: "Pinned house rooms can't be deleted. Unpin first if you really need to.",
        });
      const liveRoom = rooms.get(roomId);
      if (liveRoom) {
        for (const s of liveRoom.sockets) {
          send(s, { type: "room:deleted", roomId });
          try {
            (s as any).close(4000, "room:deleted");
          } catch {}
        }
        rooms.delete(roomId);
      }
      await prisma.room.delete({ where: { id: roomId } });
      await prisma.lobbyAudit.create({
        data: {
          id: randomUUID(),
          lobbyId: ctx.lobby.id,
          type: "room_deleted",
          actorId: ctx.user.id,
          actorName: ctx.user.name,
          targetId: roomId,
          note: room.name,
        },
      });
      return reply.send({ ok: true });
    },
  );

  app.get("/lobbies/:id/admin/audit", async (req, reply) => {
    const ctx = await lobbyAdminAccess(req, reply, 3);
    if (!ctx) return;
    const logs = await prisma.lobbyAudit.findMany({
      where: { lobbyId: ctx.lobby.id },
      orderBy: { ts: "desc" },
      take: 200,
    });
    return reply.send({ ok: true, logs });
  });
}

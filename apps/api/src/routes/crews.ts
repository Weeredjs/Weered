import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";

// /crews/* + /lobbies/:lobbyId/crews(+leaderboard) — crew lifecycle
// (create, invite, leave, delete), public profile + leader edit, lobby-
// scoped published-crew listings with bounty enrichment, and crew chat
// history. Crew chat WS broadcast lives in main() with the rest of WS.
type Opts = {
  authFromHeader: (h?: string) => { id: string; name: string } | null;
  verifyToken: (token: string) => { id: string; name: string } | null;
  awardNotoriety: (userId: string, action: string) => Promise<number | null>;
  createNotification: (opts: any) => Promise<any>;
  rooms: Map<string, { name?: string; users: Map<string, any> }>;
  fetchReactionsForTargets: (targetType: string, ids: string[]) => Promise<Record<string, any[]>>;
  getNotorietyRank: (score: number) => { title: string };
};

export default async function crewsRoutes(app: FastifyInstance, opts: Opts) {
  const { authFromHeader, verifyToken, awardNotoriety, createNotification, rooms, fetchReactionsForTargets, getNotorietyRank } = opts;

  // ── Crews leaderboard (global) ──────────────────────────────────────────

  app.get("/crews/leaderboard", async (req, reply) => {
    const limit = Math.min(Number((req as any).query?.limit || 25), 50);
    const db = prisma as any;
    const crews = await db.crew.findMany({
      include: { members: { select: { userId: true } } },
      take: 100,
    });
    const crewScores: { id: string; name: string; tag: string; memberCount: number; totalScore: number }[] = [];
    for (const crew of crews) {
      const userIds = crew.members.map((m: any) => m.userId);
      if (!userIds.length) continue;
      const agg = await prisma.user.aggregate({
        where: { id: { in: userIds } },
        _sum: { notoriety: true },
      });
      crewScores.push({
        id: crew.id,
        name: crew.name,
        tag: crew.tag,
        memberCount: userIds.length,
        totalScore: agg._sum.notoriety ?? 0,
      });
    }
    crewScores.sort((a, b) => b.totalScore - a.totalScore);
    const ranked = crewScores.slice(0, limit).map((c, i) => ({
      position: i + 1,
      ...c,
      rank: getNotorietyRank(Math.floor(c.totalScore / c.memberCount)).title,
    }));
    return reply.send({ ok: true, leaders: ranked });
  });

  // ── My crews / membership ───────────────────────────────────────────────

  app.get("/crews/mine", async (req, reply) => {
    const token = String((req.headers.authorization || "").replace("Bearer ", "").trim());
    const u = verifyToken(token);
    if (!u) return reply.code(401).send({ error: "Unauthorized" });
    const db = prisma as any;
    const memberships = await db.crewMember.findMany({
      where: { userId: u.id },
      include: { crew: { include: { members: { select: { userId: true, name: true, role: true } } } } },
    });
    const crews = await Promise.all((memberships as any[]).map(async (m: any) => {
      const memberIds = (m.crew.members || []).map((cm: any) => cm.userId);
      const userAvatars = memberIds.length
        ? await prisma.user.findMany({ where: { id: { in: memberIds } }, select: { id: true, avatar: true, avatarColor: true } as any })
        : [];
      const avatarMap = new Map(userAvatars.map((u: any) => [u.id, u]));

      const memberPresence = (m.crew.members || []).map((cm: any) => {
        let roomId: string | null = null; let roomName: string | null = null;
        for (const [rid, rs] of rooms) { if (rs.users.has(cm.userId)) { roomId = rid; roomName = rs.name || rid; break; } }
        const ua: any = avatarMap.get(cm.userId);
        return { userId: cm.userId, name: cm.name, role: cm.role, online: roomId !== null, roomId, roomName, avatar: ua?.avatar || null, avatarColor: ua?.avatarColor || null };
      });
      return { ...m.crew, myRole: m.role, members: memberPresence };
    }));
    return reply.send({ crews });
  });

  app.post("/crews", async (req, reply) => {
    const token = String((req.headers.authorization || "").replace("Bearer ", "").trim());
    const u = verifyToken(token);
    if (!u) return reply.code(401).send({ error: "Unauthorized" });
    const { name, tag, description } = req.body as any;
    if (!name?.trim()) return reply.code(400).send({ error: "Name required" });
    const db = prisma as any;
    const crew = await db.crew.create({
      data: {
        name: String(name).trim().slice(0, 40),
        tag: String(tag || "").trim().slice(0, 6).toUpperCase(),
        description: String(description || "").trim().slice(0, 200),
        ownerId: u.id,
        members: { create: { userId: u.id, name: u.name, role: "LEADER" } },
      },
      include: { members: true },
    });
    awardNotoriety(u.id, "CREW_CREATED").catch(() => {});
    return reply.send({ ok: true, crew });
  });

  app.post("/crews/:crewId/invite/:userId", async (req, reply) => {
    const token = String((req.headers.authorization || "").replace("Bearer ", "").trim());
    const u = verifyToken(token);
    if (!u) return reply.code(401).send({ error: "Unauthorized" });
    const { crewId, userId } = req.params as any;
    const db = prisma as any;
    const myMembership = await db.crewMember.findUnique({ where: { crewId_userId: { crewId, userId: u.id } } });
    if (!myMembership || myMembership.role === "MEMBER") return reply.code(403).send({ error: "Not an officer" });
    const target = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true } });
    if (!target) return reply.code(404).send({ error: "User not found" });
    await db.crewMember.upsert({
      where: { crewId_userId: { crewId, userId } },
      update: {},
      create: { crewId, userId, name: target.name, role: "MEMBER" },
    });
    awardNotoriety(userId, "CREW_JOINED").catch(() => {});
    const crew = await db.crew.findUnique({ where: { id: crewId }, select: { name: true, tag: true } });
    createNotification({ userId, type: "CREW_INVITE", title: `You were added to ${crew?.name || "a crew"}`, body: `${u.name} invited you`, actorId: u.id, actorName: u.name, actionUrl: "/home", meta: { crewId } }).catch(() => {});
    return reply.send({ ok: true });
  });

  app.delete("/crews/:crewId/members/:userId", async (req, reply) => {
    const token = String((req.headers.authorization || "").replace("Bearer ", "").trim());
    const u = verifyToken(token);
    if (!u) return reply.code(401).send({ error: "Unauthorized" });
    const { crewId, userId } = req.params as any;
    const db = prisma as any;
    const crew = await db.crew.findUnique({ where: { id: crewId } });
    if (!crew) return reply.code(404).send({ error: "Crew not found" });
    const myMembership = await db.crewMember.findUnique({ where: { crewId_userId: { crewId, userId: u.id } } });
    const isSelf = userId === u.id;
    const isLeader = myMembership?.role === "LEADER" || crew.ownerId === u.id;
    if (!isSelf && !isLeader) return reply.code(403).send({ error: "Forbidden" });
    await db.crewMember.deleteMany({ where: { crewId, userId } });
    return reply.send({ ok: true });
  });

  app.delete("/crews/:crewId", async (req, reply) => {
    const token = String((req.headers.authorization || "").replace("Bearer ", "").trim());
    const u = verifyToken(token);
    if (!u) return reply.code(401).send({ error: "Unauthorized" });
    const { crewId } = req.params as any;
    const db = prisma as any;
    const crew = await db.crew.findUnique({ where: { id: crewId } });
    if (!crew || crew.ownerId !== u.id) return reply.code(403).send({ error: "Leader only" });
    await db.crew.delete({ where: { id: crewId } });
    return reply.send({ ok: true });
  });

  // ── Crew published profile ──────────────────────────────────────────────

  app.get("/crews/:crewId", async (req, reply) => {
    const { crewId } = req.params as any;
    const db = prisma as any;
    const crew = await db.crew.findUnique({
      where: { id: crewId },
      include: {
        members: {
          select: { userId: true, name: true, role: true, joinedAt: true },
          orderBy: [{ role: "asc" }, { joinedAt: "asc" }],
          take: 100,
        },
      },
    });
    if (!crew) return reply.code(404).send({ ok: false, error: "not_found" });
    return reply.send({
      ok: true,
      crew: {
        id: crew.id,
        name: crew.name,
        tag: crew.tag,
        description: crew.description,
        logoUrl: crew.logoUrl,
        bannerUrl: crew.bannerUrl,
        accentColor: crew.accentColor,
        homePort: crew.homePort,
        recruiting: crew.recruiting,
        recruitingNote: crew.recruitingNote,
        publicInLobbies: crew.publicInLobbies,
        ownerId: crew.ownerId,
        createdAt: crew.createdAt,
        memberCount: crew.members.length,
        members: crew.members,
      },
    });
  });

  app.patch("/crews/:crewId", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const { crewId } = req.params as any;
    const db = prisma as any;
    const crew = await db.crew.findUnique({ where: { id: crewId } });
    if (!crew) return reply.code(404).send({ ok: false, error: "not_found" });
    if (crew.ownerId !== u.id) return reply.code(403).send({ ok: false, error: "leader_only" });
    const body: any = (req as any).body || {};
    const data: any = {};
    if (typeof body.name === "string")            data.name = body.name.trim().slice(0, 60);
    if (typeof body.tag === "string")             data.tag = body.tag.trim().slice(0, 8).toUpperCase();
    if (typeof body.description === "string")     data.description = body.description.trim().slice(0, 800);
    if (typeof body.logoUrl === "string")         data.logoUrl = body.logoUrl.trim().slice(0, 500) || null;
    if (typeof body.bannerUrl === "string")       data.bannerUrl = body.bannerUrl.trim().slice(0, 500) || null;
    if (typeof body.accentColor === "string")     data.accentColor = /^#[0-9a-f]{6}$/i.test(body.accentColor) ? body.accentColor : null;
    if (typeof body.homePort === "string")        data.homePort = body.homePort.trim().slice(0, 80) || null;
    if (typeof body.recruiting === "boolean")     data.recruiting = body.recruiting;
    if (typeof body.recruitingNote === "string")  data.recruitingNote = body.recruitingNote.trim().slice(0, 400);
    if (Array.isArray(body.publicInLobbies))      data.publicInLobbies = body.publicInLobbies.map((x: any) => String(x).trim()).filter(Boolean).slice(0, 20);
    try {
      const updated = await db.crew.update({ where: { id: crewId }, data });
      return reply.send({ ok: true, crew: updated });
    } catch (e) {
      console.error("[crews PATCH]", e);
      return reply.code(500).send({ ok: false, error: "update_failed" });
    }
  });

  // ── Lobby-scoped crew listings ──────────────────────────────────────────

  app.get("/lobbies/:lobbyId/crews", async (req, reply) => {
    const { lobbyId } = req.params as any;
    const db = prisma as any;
    try {
      const crews = await db.crew.findMany({
        where: { publicInLobbies: { has: String(lobbyId) } },
        orderBy: [{ recruiting: "desc" }, { updatedAt: "desc" }],
        take: 60,
        include: { members: { select: { userId: true, name: true, role: true }, take: 100 } },
      });

      const userToCrew = new Map<string, string>();
      for (const c of crews) {
        for (const m of (c.members || [])) {
          if (!userToCrew.has(m.userId)) userToCrew.set(m.userId, c.id);
        }
      }
      const memberIds = Array.from(userToCrew.keys());
      const bountyStats = new Map<string, { kills: number; earned: number }>();
      if (memberIds.length && String(lobbyId) === "windrose") {
        const settled: any[] = await db.windroseBounty.findMany({
          where: { lobbyId: "windrose", status: "SETTLED", claimantId: { in: memberIds } },
          select: { claimantId: true, amount: true },
          take: 5000,
        });
        for (const b of settled) {
          const crewId = userToCrew.get(b.claimantId);
          if (!crewId) continue;
          const slot = bountyStats.get(crewId) || { kills: 0, earned: 0 };
          slot.kills += 1;
          slot.earned += Number(b.amount) || 0;
          bountyStats.set(crewId, slot);
        }
      }

      const shaped = crews.map((c: any) => {
        const leader = (c.members || []).find((m: any) => m.userId === c.ownerId);
        return {
          id: c.id,
          name: c.name,
          tag: c.tag,
          description: c.description,
          logoUrl: c.logoUrl,
          bannerUrl: c.bannerUrl,
          accentColor: c.accentColor,
          homePort: c.homePort,
          recruiting: c.recruiting,
          recruitingNote: c.recruitingNote,
          memberCount: c.members.length,
          updatedAt: c.updatedAt,
          bountyKills:  (bountyStats.get(c.id)?.kills) ?? 0,
          bountyEarned: (bountyStats.get(c.id)?.earned) ?? 0,
          ownerId: c.ownerId,
          ownerName: leader?.name || "",
        };
      });
      return reply.send({ ok: true, crews: shaped });
    } catch (e) {
      console.error("[lobbies/:id/crews GET]", e);
      return reply.code(500).send({ ok: false, error: "fetch_failed" });
    }
  });

  app.get("/lobbies/:lobbyId/crews/leaderboard", async (req, reply) => {
    const { lobbyId } = req.params as any;
    const db = prisma as any;
    try {
      const crews: any[] = await db.crew.findMany({
        where: { publicInLobbies: { has: String(lobbyId) } },
        include: { members: { select: { userId: true }, take: 200 } },
        take: 200,
      });
      const userToCrew = new Map<string, string>();
      for (const c of crews) for (const m of (c.members || [])) if (!userToCrew.has(m.userId)) userToCrew.set(m.userId, c.id);
      const memberIds = Array.from(userToCrew.keys());

      const bountyStats = new Map<string, { kills: number; earned: number }>();
      if (memberIds.length && String(lobbyId) === "windrose") {
        const settled: any[] = await db.windroseBounty.findMany({
          where: { lobbyId: "windrose", status: "SETTLED", claimantId: { in: memberIds } },
          select: { claimantId: true, amount: true },
          take: 5000,
        });
        for (const b of settled) {
          const crewId = userToCrew.get(b.claimantId);
          if (!crewId) continue;
          const slot = bountyStats.get(crewId) || { kills: 0, earned: 0 };
          slot.kills += 1;
          slot.earned += Number(b.amount) || 0;
          bountyStats.set(crewId, slot);
        }
      }

      const base = crews.map(c => ({
        id: c.id,
        name: c.name,
        tag: c.tag,
        logoUrl: c.logoUrl,
        accentColor: c.accentColor,
        recruiting: c.recruiting,
        memberCount: (c.members || []).length,
        updatedAt: c.updatedAt,
        bountyKills:  (bountyStats.get(c.id)?.kills) ?? 0,
        bountyEarned: (bountyStats.get(c.id)?.earned) ?? 0,
      }));

      const largest = [...base]
        .filter(c => c.memberCount > 0)
        .sort((a, b) => b.memberCount - a.memberCount || a.name.localeCompare(b.name))
        .slice(0, 10);

      const mostDecorated = [...base]
        .filter(c => c.bountyEarned > 0 || c.bountyKills > 0)
        .sort((a, b) => b.bountyEarned - a.bountyEarned || b.bountyKills - a.bountyKills)
        .slice(0, 10);

      const recruitingNow = [...base]
        .filter(c => c.recruiting)
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .slice(0, 10);

      return reply.send({
        ok: true,
        stats: {
          crewCount: base.length,
          totalMembers: base.reduce((s, c) => s + c.memberCount, 0),
          recruitingCount: base.filter(c => c.recruiting).length,
          totalKills: base.reduce((s, c) => s + c.bountyKills, 0),
        },
        largest,
        mostDecorated,
        recruiting: recruitingNow,
      });
    } catch (e) {
      console.error("[lobbies/:id/crews/leaderboard]", e);
      return reply.code(500).send({ ok: false, error: "fetch_failed" });
    }
  });

  // ── Crew chat history ───────────────────────────────────────────────────

  app.get("/crews/:crewId/messages", async (req, reply) => {
    const u = authFromHeader(req.headers.authorization);
    if (!u) return reply.code(401).send({ ok: false });

    const crewId = (req.params as any).crewId;

    const membership = await (prisma as any).crewMember.findFirst({
      where: { crewId, userId: u.id },
    });
    if (!membership) return reply.code(403).send({ ok: false, error: "Not a crew member" });

    const messages = await (prisma as any).crewMessage.findMany({
      where: { crewId },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { id: true, userId: true, userName: true, body: true, createdAt: true, editedAt: true, deletedAt: true, replyToId: true, replyToUserId: true, replyToUserName: true, replyToBody: true },
    });
    const reactionsByMsg = await fetchReactionsForTargets("CREW_MESSAGE", messages.map((m: any) => m.id));
    const enriched = messages.map((m: any) => ({ ...m, reactions: reactionsByMsg[m.id] || [] }));

    return reply.send({ ok: true, messages: enriched.reverse() });
  });
}

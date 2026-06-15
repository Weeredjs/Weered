import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";
import { z } from "zod";
import { isStaffUser as sharedIsStaffUser } from "../lib/isStaffUser";

type Opts = {
  authFromHeader: (h?: string) => { id: string; globalRole?: string } | null;
  awardNotoriety: (userId: string, action: string) => Promise<number | null>;
  awardPaper?: (userId: string, type: string, amount: number, description: string, refId?: string) => Promise<{ balance: number } | null>;
  getGlobalRole?: (userId: string) => Promise<string>;
  canAccessStaff?: (role: string) => boolean;
  createNotification?: (opts: {
    userId: string; type: string; title: string;
    body?: string; actionUrl?: string;
    actorId?: string; actorName?: string; meta?: any;
  }) => Promise<any>;
};

export default async function tournamentsRoutes(app: FastifyInstance, opts: Opts) {
  const { authFromHeader, awardNotoriety, awardPaper, createNotification, getGlobalRole, canAccessStaff } = opts;

  const isStaffUser = (userId: string) => sharedIsStaffUser(userId, getGlobalRole, canAccessStaff);

  async function enrichRewards(rows: any[]): Promise<void> {
    const ids = new Set<string>();
    for (const t of rows) {
      const arr = Array.isArray(t?.rewards) ? t.rewards : [];
      for (const r of arr) if (r?.kind === "FLAIR" && r?.itemId) ids.add(r.itemId);
    }
    if (ids.size === 0) return;
    const items: any[] = await (prisma as any).storeItem.findMany({
      where: { id: { in: Array.from(ids) } },
      select: { id: true, name: true, imageUrl: true, category: true, rarity: true },
    });
    const byId = new Map(items.map(i => [i.id, i]));
    for (const t of rows) {
      const arr = Array.isArray(t?.rewards) ? t.rewards : [];
      t.rewards = arr.map((r: any) => {
        if (r?.kind === "FLAIR" && r?.itemId) {
          const it = byId.get(r.itemId);
          if (it) return { ...r, item: it };
        }
        return r;
      });
    }
  }

  app.get("/tournaments", async (req, reply) => {
    const { lobbyId, status } = req.query as any;
    const where: any = {};
    if (lobbyId) where.lobbyId = lobbyId;
    if (status === "all") { }
    else if (status) where.status = status;
    else where.status = { in: ["REGISTRATION", "ACTIVE"] };
    const tournaments = await prisma.tournament.findMany({
      where,
      include: { _count: { select: { entries: true } } },
      orderBy: { startsAt: "asc" },
      take: 50,
    });
    await enrichRewards(tournaments as any[]);
    return reply.send({ ok: true, tournaments });
  });

  app.get("/tournaments/:id", async (req, reply) => {
    const id = String((req as any).params?.id || "");
    const tournament = await prisma.tournament.findUnique({
      where: { id },
      include: {
        entries: { orderBy: { score: "desc" }, take: 100 },
        _count: { select: { entries: true } },
      },
    });
    if (!tournament) return reply.code(404).send({ ok: false, error: "not_found" });
    await enrichRewards([tournament] as any[]);
    return reply.send({ ok: true, tournament });
  });

  app.post("/tournaments", {
  schema: { tags: ["tournaments"] },
}, async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const body = req.body as any;
    const lobbyId = body.lobbyId || null;
    const staff = await isStaffUser(u.id);

    if (!staff) {
      if (!lobbyId) {
        return reply.code(403).send({ ok: false, error: "forbidden", message: "Create tournaments from inside a lobby." });
      }
      const lobby = await prisma.lobby.findUnique({ where: { id: lobbyId }, select: { name: true, ownerId: true } });
      if (lobby && lobby.ownerId !== u.id) {
        const member = await prisma.lobbyMember.findUnique({
          where: { lobbyId_userId: { lobbyId, userId: u.id } },
          select: { roleLevel: true },
        });
        if (!member) {
          return reply.code(403).send({ ok: false, error: "not_a_member", message: `Join the ${lobby?.name || "lobby"} to create a tournament here.` });
        }
      }
      const liveCount = await prisma.tournament.count({
        where: { createdById: u.id, status: { in: ["REGISTRATION", "ACTIVE"] } },
      });
      if (liveCount >= 1) {
        return reply.code(400).send({ ok: false, error: "active_limit", message: "You already have a live tournament. Finish or remove it before starting another." });
      }
    }

    const isRace = body.format === "CHALLENGE_RACE";
    const tournament = await prisma.tournament.create({
      data: {
        title: String(body.title || "").trim(),
        description: String(body.description || "").trim(),
        iconUrl: body.iconUrl || null,
        format: body.format || "LEADERBOARD",
        entryType: body.entryType || "SOLO",
        lobbyId,
        createdById: u.id,
        scoringRule: body.scoringRule || {},
        registrationOpensAt: new Date(body.registrationOpensAt || Date.now()),
        startsAt: new Date(body.startsAt),
        endsAt: new Date(body.endsAt),
        maxEntries: parseInt(body.maxEntries) || 100,
        minEntries: parseInt(body.minEntries) || 2,
        rewards: body.rewards || [],
        featuredMode: body.featuredMode || null,
        pointsPerCompletion: isRace ? (parseInt(body.pointsPerCompletion) || 100) : 100,
        pointsToWin: isRace && body.pointsToWin != null ? Number(body.pointsToWin) : null,
        raceWinCondition: isRace ? (body.raceWinCondition || "DEADLINE") : null,
        challengePoolIds: isRace && Array.isArray(body.challengePoolIds) ? body.challengePoolIds : [],
      } as any,
    });
    return reply.send({ ok: true, tournament });
  });

  app.post("/tournaments/:id/register", {
  schema: { tags: ["tournaments"], params: z.object({ id: z.string().min(1) }) },
}, async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const id = String((req as any).params?.id || "");
    const tournament = await prisma.tournament.findUnique({
      where: { id },
      include: { _count: { select: { entries: true } } },
    });
    if (!tournament) return reply.code(404).send({ ok: false, error: "not_found" });

    if (tournament.lobbyId) {
      const lobby = await prisma.lobby.findUnique({
        where: { id: tournament.lobbyId },
        select: { name: true, ownerId: true },
      });
      if (lobby && lobby.ownerId !== u.id) {
        const member = await prisma.lobbyMember.findUnique({
          where: { lobbyId_userId: { lobbyId: tournament.lobbyId, userId: u.id } },
          select: { roleLevel: true },
        });
        if (!member) {
          return reply.code(403).send({
            ok: false, error: "not_a_member",
            message: `Join the ${lobby.name} lobby to enter this tournament.`,
          });
        }
      }
    }
    if (tournament.status !== "REGISTRATION" && tournament.status !== "ACTIVE") {
      return reply.code(400).send({ ok: false, error: "registration_closed" });
    }
    if (tournament._count.entries >= tournament.maxEntries) {
      return reply.code(400).send({ ok: false, error: "tournament_full" });
    }

    if (tournament.lobbyId === "destiny2") {
      const acct = await prisma.userGameAccount.findFirst({ where: { userId: u.id, gameType: "BUNGIE" } });
      if (!acct) return reply.code(400).send({ ok: false, error: "bungie_not_linked", message: "Link your Bungie account in Settings before registering." });
    }

    const userName = (await prisma.user.findUnique({ where: { id: u.id }, select: { name: true } }))?.name || "Unknown";

    try {
      const entry = await prisma.tournamentEntry.create({
        data: {
          tournamentId: id,
          userId: u.id,
          displayName: userName,
        },
      });
      return reply.send({ ok: true, entry });
    } catch (e: any) {
      if (e.code === "P2002") return reply.send({ ok: true, error: "already_registered" });
      throw e;
    }
  });

  app.delete("/tournaments/:id/register", {
  schema: { tags: ["tournaments"], params: z.object({ id: z.string().min(1) }) },
}, async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const id = String((req as any).params?.id || "");
    await prisma.tournamentEntry.deleteMany({
      where: { tournamentId: id, userId: u.id },
    });
    return reply.send({ ok: true });
  });

  app.get("/tournaments/:id/leaderboard", async (req, reply) => {
    const id = String((req as any).params?.id || "");
    const entries = await prisma.tournamentEntry.findMany({
      where: { tournamentId: id },
      orderBy: { score: "desc" },
      take: 100,
    });
    const ranked = entries.map((e, i) => ({ ...e, rank: i + 1 }));
    return reply.send({ ok: true, leaderboard: ranked });
  });

  app.get("/tournaments/:id/race-leaderboard", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    const id = String((req as any).params?.id || "");
    const tournament: any = await prisma.tournament.findUnique({
      where: { id },
      include: { _count: { select: { entries: true } } },
    });
    if (!tournament) return reply.code(404).send({ ok: false, error: "not_found" });

    const poolIds: string[] = Array.isArray(tournament.challengePoolIds)
      ? (tournament.challengePoolIds as string[])
      : [];

    const poolDefs = poolIds.length
      ? await prisma.challengeDefinition.findMany({
          where: { id: { in: poolIds } },
          select: { id: true, title: true, iconUrl: true, category: true, difficulty: true },
        })
      : [];
    const defById: Record<string, any> = {};
    for (const d of poolDefs) defById[d.id] = d;
    const pool = poolIds.map((pid) => defById[pid]).filter(Boolean);

    const entries = await prisma.tournamentEntry.findMany({
      where: { tournamentId: id },
      orderBy: { score: "desc" },
      take: 100,
    });

    const userIds = entries.map((e) => e.userId).filter(Boolean) as string[];
    const lookupIds = u ? Array.from(new Set([...userIds, u.id])) : userIds;
    const completedByUser: Record<string, string[]> = {};
    if (lookupIds.length && poolIds.length) {
      const enrolls = await prisma.challengeEnrollment.findMany({
        where: {
          userId: { in: lookupIds },
          status: "COMPLETED",
          instance: { definitionId: { in: poolIds } },
        },
        select: { userId: true, instance: { select: { definitionId: true } } },
      });
      for (const en of enrolls) {
        const uid = en.userId;
        const did = (en as any).instance?.definitionId;
        if (!uid || !did) continue;
        const arr = completedByUser[uid] || (completedByUser[uid] = []);
        if (!arr.includes(did)) arr.push(did);
      }
    }

    const leaderboard = entries.map((e, i) => {
      const done = completedByUser[e.userId as string] || [];
      return {
        rank: i + 1,
        entryId: e.id,
        userId: e.userId,
        displayName: e.displayName || "Unknown",
        score: e.score,
        completions: done.length,
        completedDefinitionIds: done,
      };
    });

    let me: any = null;
    if (u) {
      const myEntry =
        entries.find((e) => e.userId === u.id) ||
        (await prisma.tournamentEntry.findFirst({ where: { tournamentId: id, userId: u.id } }));
      const myDone = completedByUser[u.id] || [];
      const statusOk = tournament.status === "REGISTRATION" || tournament.status === "ACTIVE";
      const full = tournament._count.entries >= tournament.maxEntries;
      me = {
        userId: u.id,
        isRegistered: !!myEntry,
        entryId: myEntry?.id || null,
        score: myEntry?.score ?? null,
        completions: myDone.length,
        completedDefinitionIds: myDone,
        canRegister: statusOk && !full,
      };
    }

    return reply.send({
      ok: true,
      tournament: {
        id: tournament.id,
        lobbyId: tournament.lobbyId,
        status: tournament.status,
        pointsPerCompletion: tournament.pointsPerCompletion,
        pointsToWin: tournament.pointsToWin ?? null,
        raceWinCondition: tournament.raceWinCondition ?? null,
        maxEntries: tournament.maxEntries,
        entryCount: tournament._count.entries,
      },
      pool,
      me,
      leaderboard,
    });
  });

  app.post("/tournaments/:id/activate", {
  schema: { tags: ["tournaments"], params: z.object({ id: z.string().min(1) }) },
}, async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    if (!(await isStaffUser(u.id))) {
      return reply.code(403).send({ ok: false, error: "forbidden" });
    }
    const id = String((req as any).params?.id || "");
    const tournament = await prisma.tournament.update({
      where: { id },
      data: { status: "ACTIVE" },
    });
    return reply.send({ ok: true, tournament });
  });

  app.post("/tournaments/:id/rewards", {
  schema: { tags: ["tournaments"], params: z.object({ id: z.string().min(1) }) },
}, async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    if (!(await isStaffUser(u.id))) return reply.code(403).send({ ok: false, error: "forbidden" });
    const id = String((req as any).params?.id || "");
    const body = req.body as any;
    const incoming = Array.isArray(body?.rewards) ? body.rewards : [];
    const sanitized: any[] = [];
    for (const r of incoming) {
      if (!r || typeof r !== "object") continue;
      if (r.kind === "FLAIR" && typeof r.itemId === "string" && r.itemId) {
        const exists = await (prisma as any).storeItem.findUnique({ where: { id: r.itemId } });
        if (!exists) continue;
        sanitized.push({ kind: "FLAIR", itemId: r.itemId, rank: Number(r.rank) || 1 });
      }
    }
    const tournament = await prisma.tournament.update({
      where: { id },
      data: { rewards: sanitized as any },
    });
    return reply.send({ ok: true, tournament });
  });

  app.post("/tournaments/:id/complete", {
  schema: { tags: ["tournaments"], params: z.object({ id: z.string().min(1) }) },
}, async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    if (!(await isStaffUser(u.id))) return reply.code(403).send({ ok: false, error: "forbidden" });
    const id = String((req as any).params?.id || "");

    const tournament = await (prisma as any).tournament.findUnique({ where: { id } });
    if (!tournament) return reply.code(404).send({ ok: false, error: "not_found" });
    if (tournament.status === "COMPLETED" || tournament.status === "CANCELED") {
      return reply.code(400).send({ ok: false, error: "already_finalized" });
    }

    let entries: any[];
    if (tournament.format === "LEADERBOARD") {
      entries = await prisma.tournamentEntry.findMany({
        where: { tournamentId: id },
        orderBy: { score: "desc" },
      });
    } else {
      const allEntries = await prisma.tournamentEntry.findMany({ where: { tournamentId: id } });
      const matches = await (prisma as any).tournamentMatch.findMany({
        where: { tournamentId: id, status: "CONFIRMED" },
      });
      const stats: Record<string, { wins: number; losses: number; diff: number }> = {};
      for (const e of allEntries) stats[e.id] = { wins: 0, losses: 0, diff: 0 };
      for (const m of matches) {
        if (!m.winnerEntryId) continue;
        const loserId = m.winnerEntryId === m.entryAId ? m.entryBId : m.entryAId;
        if (stats[m.winnerEntryId]) stats[m.winnerEntryId].wins++;
        if (loserId && stats[loserId]) stats[loserId].losses++;
        if (m.scoreA != null && m.scoreB != null) {
          if (stats[m.entryAId!]) stats[m.entryAId!].diff += (m.scoreA - m.scoreB);
          if (stats[m.entryBId!]) stats[m.entryBId!].diff += (m.scoreB - m.scoreA);
        }
      }
      entries = allEntries
        .map((e: any) => ({ ...e, _wins: stats[e.id].wins, _losses: stats[e.id].losses, _diff: stats[e.id].diff }))
        .sort((a: any, b: any) => {
          if (b._wins !== a._wins) return b._wins - a._wins;
          if (b._diff !== a._diff) return b._diff - a._diff;
          return a._losses - b._losses;
        });
    }

    for (let i = 0; i < entries.length; i++) {
      await prisma.tournamentEntry.update({
        where: { id: entries[i].id },
        data: { rank: i + 1 },
      });
    }

    const tier = (rank: number, total: number) => {
      if (rank === 1) return "CHAMPION";
      if (rank <= 3) return "PODIUM";
      if (rank <= 8 && total >= 8) return "TOP8";
      if (rank <= 16 && total >= 16) return "TOP16";
      return null;
    };
    const defaultPayout = (t: string, total: number) => {
      const scale = Math.min(1.0, Math.log2(Math.max(2, total)) / 4);
      switch (t) {
        case "CHAMPION": return { paper: Math.round(2000 * scale), notoriety: Math.round(500 * scale) };
        case "PODIUM":   return { paper: Math.round(1000 * scale), notoriety: Math.round(250 * scale) };
        case "TOP8":     return { paper: Math.round(500 * scale),  notoriety: Math.round(100 * scale) };
        case "TOP16":    return { paper: Math.round(200 * scale),  notoriety: Math.round(50 * scale) };
        default:         return { paper: 0, notoriety: 0 };
      }
    };

    const total = entries.length;
    const payouts: any[] = [];
    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];
      const t = tier(i + 1, total);
      if (!t || !e.userId) continue;
      const p = defaultPayout(t, total);
      payouts.push({ userId: e.userId, displayName: e.displayName, rank: i + 1, tier: t, ...p });
      if (awardPaper && p.paper > 0) {
        await awardPaper(e.userId, "TOURNAMENT_PRIZE", p.paper, `${tournament.title} · ${t}`, id).catch(() => {});
      }
      if (p.notoriety > 0) {
        try {
          await (prisma as any).notorietyEvent.create({
            data: { userId: e.userId, action: `TOURNAMENT_${t}`, points: p.notoriety, refId: id },
          });
          await (prisma as any).user.update({
            where: { id: e.userId },
            data: { notoriety: { increment: p.notoriety } },
          });
        } catch {}
      }

      if (t === "CHAMPION" || t === "PODIUM") {
        try {
          const rankLabel = i + 1 === 1 ? "Champion" : i + 1 === 2 ? "Runner-Up" : "3rd Place";
          const badgeName = `${tournament.title} · ${rankLabel}`;
          let badge = await (prisma as any).challengeBadge.findFirst({ where: { name: badgeName } });
          if (!badge) {
            badge = await (prisma as any).challengeBadge.create({
              data: {
                name: badgeName,
                description: `Top ${i + 1} finish · ${tournament.format}`,
                rarity: i + 1 === 1 ? 4 : 3,
              },
            });
          }
          await (prisma as any).userBadge.upsert({
            where: { userId_badgeId: { userId: e.userId, badgeId: badge.id } },
            update: {},
            create: { userId: e.userId, badgeId: badge.id },
          });
        } catch (err) {
          console.warn("[tournament] badge award failed:", err);
        }
      }

      if (createNotification) {
        await createNotification({
          userId: e.userId,
          type: "CHALLENGE_COMPLETED",
          title: t === "CHAMPION"
            ? `🏆 You won ${tournament.title}`
            : t === "PODIUM"
              ? `Top ${i + 1} in ${tournament.title}`
              : `Top ${i + 1} in ${tournament.title}`,
          body: p.paper > 0 || p.notoriety > 0
            ? `Awarded ${p.paper > 0 ? `${p.paper}P` : ""}${p.paper > 0 && p.notoriety > 0 ? " + " : ""}${p.notoriety > 0 ? `${p.notoriety} Notoriety` : ""}.`
            : "Honor only — no payout.",
          actionUrl: tournament.lobbyId ? `/lobby/${encodeURIComponent(tournament.lobbyId)}` : undefined,
          meta: { kind: "tournament_complete", tournamentId: id, rank: i + 1, tier: t },
        }).catch(() => {});
      }
    }

    const flairRewards = Array.isArray((tournament as any).rewards) ? (tournament as any).rewards as any[] : [];
    for (const r of flairRewards) {
      if (!r || r.kind !== "FLAIR" || !r.itemId) continue;
      const targetRank = Number(r.rank) || 1;
      const winner = entries[targetRank - 1];
      if (!winner || !winner.userId) continue;
      const tag = `tournament:${id}`;
      const already = await (prisma as any).userItem.findFirst({
        where: { userId: winner.userId, itemId: r.itemId, acquiredFrom: tag },
      });
      if (already) continue;
      try {
        await (prisma as any).userItem.create({
          data: { userId: winner.userId, itemId: r.itemId, acquiredFrom: tag, acquiredPrice: 0 },
        });
        await (prisma as any).storeItem.update({
          where: { id: r.itemId },
          data: { totalMinted: { increment: 1 } },
        });
      } catch {}
    }

    const updated = await prisma.tournament.update({
      where: { id },
      data: { status: "COMPLETED" },
    });

    return reply.send({ ok: true, tournament: updated, payouts });
  });

  app.get("/tournaments/archive", async (req, reply) => {
    const q = (req as any).query || {};
    const lobbyId = q.lobbyId ? String(q.lobbyId) : null;
    const limit = Math.max(1, Math.min(50, parseInt(q.limit) || 20));

    const where: any = { status: "COMPLETED" };
    if (lobbyId) where.lobbyId = lobbyId;

    const tournaments = await (prisma as any).tournament.findMany({
      where, orderBy: { updatedAt: "desc" }, take: limit,
      select: { id: true, title: true, description: true, format: true, lobbyId: true, startsAt: true, endsAt: true, updatedAt: true, _count: { select: { entries: true } } },
    });

    const archive = await Promise.all(tournaments.map(async (t: any) => {
      const top = await prisma.tournamentEntry.findMany({
        where: { tournamentId: t.id, rank: { lte: 3 } },
        orderBy: { rank: "asc" },
        select: { id: true, displayName: true, userId: true, rank: true, score: true },
      });
      return { ...t, top };
    }));

    return reply.send({ ok: true, archive });
  });

  function isStaff(role?: string | null) {
    return ["GOD", "ADMIN", "STAFF"].includes(String(role || ""));
  }

  function buildSeedPairs(numEntries: number): Array<[number | null, number | null]> {
    let size = 1; while (size < numEntries) size <<= 1;
    if (size < 2) size = 2;
    function order(n: number): number[] {
      if (n === 1) return [1];
      const prev = order(n / 2);
      const out: number[] = [];
      for (const seed of prev) {
        out.push(seed);
        out.push(n + 1 - seed);
      }
      return out;
    }
    const seeds = order(size);
    const pairs: Array<[number | null, number | null]> = [];
    for (let i = 0; i < seeds.length; i += 2) {
      const a = seeds[i] <= numEntries ? seeds[i] : null;
      const b = seeds[i + 1] <= numEntries ? seeds[i + 1] : null;
      pairs.push([a, b]);
    }
    return pairs;
  }

  app.post("/tournaments/:id/bracket/start", {
  schema: { tags: ["tournaments"], params: z.object({ id: z.string().min(1) }) },
}, async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    if (!(await isStaffUser(u.id))) return reply.code(403).send({ ok: false, error: "forbidden" });
    const id = String((req as any).params?.id || "");
    const body: any = (req as any).body || {};

    const tourney = await (prisma as any).tournament.findUnique({ where: { id } });
    if (!tourney) return reply.code(404).send({ ok: false, error: "not_found" });
    if (!["BRACKET", "BRACKET_DOUBLE", "ROUND_ROBIN"].includes(tourney.format)) {
      return reply.code(400).send({ ok: false, error: "wrong_format", message: "Format must be BRACKET, BRACKET_DOUBLE, or ROUND_ROBIN to start a draw." });
    }
    if (tourney.status === "COMPLETED" || tourney.status === "CANCELED") {
      return reply.code(400).send({ ok: false, error: "tournament_closed" });
    }

    const existing = await (prisma as any).tournamentMatch.count({ where: { tournamentId: id } });
    if (existing > 0) return reply.code(400).send({ ok: false, error: "bracket_exists", message: "Draw already generated." });

    let entries = await (prisma as any).tournamentEntry.findMany({ where: { tournamentId: id } });
    if (entries.length < (tourney.minEntries || 2)) {
      return reply.code(400).send({ ok: false, error: "not_enough_entries", count: entries.length, min: tourney.minEntries });
    }

    const seedingMode = String(body.seeding || "random");
    if (seedingMode === "random") {
      entries.sort(() => Math.random() - 0.5);
    } else if (seedingMode === "rank") {
      const userIds = entries.map((e: any) => e.userId).filter(Boolean);
      const users = userIds.length
        ? await (prisma as any).user.findMany({ where: { id: { in: userIds } }, select: { id: true, notoriety: true } })
        : [];
      const notMap = new Map<string, number>(users.map((u: any) => [u.id, u.notoriety || 0]));
      entries.sort((a: any, b: any) => (notMap.get(b.userId) || 0) - (notMap.get(a.userId) || 0));
    } else if (seedingMode === "manual" && Array.isArray(body.entryOrder)) {
      const idx = new Map<string, number>();
      body.entryOrder.forEach((eid: string, i: number) => idx.set(String(eid), i));
      entries.sort((a: any, b: any) => (idx.get(a.id) ?? 999) - (idx.get(b.id) ?? 999));
    }

    if (tourney.format === "ROUND_ROBIN") {
      const pairs: Array<[string, string]> = [];
      for (let i = 0; i < entries.length; i++) {
        for (let j = i + 1; j < entries.length; j++) {
          pairs.push([entries[i].id, entries[j].id]);
        }
      }
      let pos = 0;
      for (const [aId, bId] of pairs) {
        await (prisma as any).tournamentMatch.create({
          data: {
            tournamentId: id,
            round: 1,
            bracketPosition: pos++,
            entryAId: aId,
            entryBId: bId,
            status: "READY",
          },
        });
      }
      await (prisma as any).tournament.update({ where: { id }, data: { status: "ACTIVE" } });
      return reply.send({ ok: true, format: "ROUND_ROBIN", totalMatches: pairs.length });
    }

    const N = entries.length;
    let bracketSize = 1; while (bracketSize < N) bracketSize <<= 1;
    if (bracketSize < 2) bracketSize = 2;
    const numWinnerRounds = Math.log2(bracketSize);
    const seedPairs = buildSeedPairs(N);

    const wb: any[][] = [];
    for (let r = 1; r <= numWinnerRounds; r++) {
      const matchesInRound = bracketSize / Math.pow(2, r);
      wb.push(Array.from({ length: matchesInRound }, (_, pos) => ({
        tournamentId: id,
        round: r,
        bracketPosition: pos,
        status: "PENDING",
        bracketSide: tourney.format === "BRACKET_DOUBLE" ? "WINNERS" : null,
      })));
    }
    for (let pos = 0; pos < seedPairs.length; pos++) {
      const [aSeed, bSeed] = seedPairs[pos];
      const m = wb[0][pos];
      m.entryAId = aSeed != null ? entries[aSeed - 1].id : null;
      m.entryBId = bSeed != null ? entries[bSeed - 1].id : null;
      if (m.entryAId && m.entryBId) m.status = "READY";
      else if (m.entryAId || m.entryBId) {
        m.status = "CONFIRMED";
        m.winnerEntryId = m.entryAId || m.entryBId;
        m.confirmedAt = new Date();
      }
    }
    const wbCreated: any[][] = [];
    for (const round of wb) {
      const created: any[] = [];
      for (const m of round) created.push(await (prisma as any).tournamentMatch.create({ data: m }));
      wbCreated.push(created);
    }
    for (let r = 0; r < wbCreated.length - 1; r++) {
      for (let pos = 0; pos < wbCreated[r].length; pos++) {
        const next = wbCreated[r + 1][Math.floor(pos / 2)];
        await (prisma as any).tournamentMatch.update({
          where: { id: wbCreated[r][pos].id },
          data: { nextMatchId: next.id },
        });
      }
    }

    let lbCreated: any[][] = [];
    let grandFinal: any = null;

    if (tourney.format === "BRACKET_DOUBLE") {
      const numLoserRounds = 2 * (numWinnerRounds - 1);
      const lb: any[][] = [];
      for (let lr = 1; lr <= numLoserRounds; lr++) {
        const wbRoundContrib = Math.ceil(lr / 2);
        const matchesInRound = bracketSize / Math.pow(2, wbRoundContrib + 1);
        if (matchesInRound < 1) break;
        lb.push(Array.from({ length: matchesInRound }, (_, pos) => ({
          tournamentId: id,
          round: lr,
          bracketPosition: pos,
          status: "PENDING",
          bracketSide: "LOSERS",
        })));
      }
      for (const round of lb) {
        const created: any[] = [];
        for (const m of round) created.push(await (prisma as any).tournamentMatch.create({ data: m }));
        lbCreated.push(created);
      }
      for (let lr = 0; lr < lbCreated.length - 1; lr++) {
        const cur = lbCreated[lr];
        const next = lbCreated[lr + 1];
        for (let pos = 0; pos < cur.length; pos++) {
          const targetPos = Math.min(Math.floor(pos / (cur.length / next.length)), next.length - 1);
          await (prisma as any).tournamentMatch.update({
            where: { id: cur[pos].id },
            data: { nextMatchId: next[targetPos].id },
          });
        }
      }

      grandFinal = await (prisma as any).tournamentMatch.create({
        data: {
          tournamentId: id,
          round: numWinnerRounds + 1,
          bracketPosition: 0,
          status: "PENDING",
          bracketSide: "GRAND",
        },
      });
      const wbFinal = wbCreated[wbCreated.length - 1][0];
      await (prisma as any).tournamentMatch.update({
        where: { id: wbFinal.id },
        data: { nextMatchId: grandFinal.id },
      });
      if (lbCreated.length > 0) {
        const lbFinal = lbCreated[lbCreated.length - 1][0];
        await (prisma as any).tournamentMatch.update({
          where: { id: lbFinal.id },
          data: { nextMatchId: grandFinal.id },
        });
      }

      for (let wr = 0; wr < wbCreated.length - 1; wr++) {
        const wbRound = wbCreated[wr];
        const lbIdx = wr === 0 ? 0 : 2 * wr;
        const lbRound = lbCreated[lbIdx];
        if (!lbRound) continue;
        for (let pos = 0; pos < wbRound.length; pos++) {
          const targetPos = Math.min(Math.floor(pos / Math.max(1, wbRound.length / lbRound.length)), lbRound.length - 1);
          await (prisma as any).tournamentMatch.update({
            where: { id: wbRound[pos].id },
            data: { loserMatchId: lbRound[targetPos].id },
          });
        }
      }
    }

    for (let pos = 0; pos < wbCreated[0].length; pos++) {
      const m = wbCreated[0][pos];
      if (m.status === "CONFIRMED" && m.winnerEntryId && wbCreated.length > 1) {
        const next = wbCreated[1][Math.floor(pos / 2)];
        const slot = pos % 2 === 0 ? "entryAId" : "entryBId";
        await (prisma as any).tournamentMatch.update({
          where: { id: next.id },
          data: { [slot]: m.winnerEntryId },
        });
      }
    }
    if (wbCreated.length > 1) {
      for (const m of wbCreated[1]) {
        const fresh = await (prisma as any).tournamentMatch.findUnique({ where: { id: m.id } });
        if (fresh.entryAId && fresh.entryBId && fresh.status === "PENDING") {
          await (prisma as any).tournamentMatch.update({ where: { id: m.id }, data: { status: "READY" } });
        }
      }
    }

    await (prisma as any).tournament.update({ where: { id }, data: { status: "ACTIVE" } });

    const totalMatches = wbCreated.flat().length + lbCreated.flat().length + (grandFinal ? 1 : 0);
    return reply.send({ ok: true, format: tourney.format, bracketSize, numWinnerRounds, totalMatches });
  });

  app.get("/tournaments/:id/standings", async (req, reply) => {
    const id = String((req as any).params?.id || "");
    const tourney = await (prisma as any).tournament.findUnique({ where: { id } });
    if (!tourney) return reply.code(404).send({ ok: false, error: "not_found" });
    const entries = await (prisma as any).tournamentEntry.findMany({ where: { tournamentId: id } });
    const matches = await (prisma as any).tournamentMatch.findMany({
      where: { tournamentId: id, status: "CONFIRMED" },
    });
    const stats: Record<string, { wins: number; losses: number; pointsFor: number; pointsAgainst: number; alive: boolean }> = {};
    for (const e of entries) stats[e.id] = { wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0, alive: true };
    for (const m of matches) {
      if (!m.winnerEntryId) continue;
      const loserId = m.winnerEntryId === m.entryAId ? m.entryBId : m.entryAId;
      if (stats[m.winnerEntryId]) stats[m.winnerEntryId].wins++;
      if (loserId && stats[loserId]) {
        stats[loserId].losses++;
        if (tourney.format === "BRACKET") stats[loserId].alive = false;
      }
      if (m.scoreA != null && m.scoreB != null) {
        if (stats[m.entryAId!]) {
          stats[m.entryAId!].pointsFor += m.scoreA;
          stats[m.entryAId!].pointsAgainst += m.scoreB;
        }
        if (stats[m.entryBId!]) {
          stats[m.entryBId!].pointsFor += m.scoreB;
          stats[m.entryBId!].pointsAgainst += m.scoreA;
        }
      }
    }
    const ranked = entries
      .map((e: any) => ({
        ...e,
        wins: stats[e.id].wins,
        losses: stats[e.id].losses,
        pointsFor: stats[e.id].pointsFor,
        pointsAgainst: stats[e.id].pointsAgainst,
        diff: stats[e.id].pointsFor - stats[e.id].pointsAgainst,
        alive: stats[e.id].alive,
      }))
      .sort((a: any, b: any) => {
        if (b.wins !== a.wins) return b.wins - a.wins;
        if (b.diff !== a.diff) return b.diff - a.diff;
        return a.losses - b.losses;
      });
    ranked.forEach((e: any, i: number) => { e.rank = i + 1; });
    return reply.send({ ok: true, format: tourney.format, standings: ranked });
  });

  app.get("/tournaments/:id/matches", async (req, reply) => {
    const id = String((req as any).params?.id || "");
    const matches = await (prisma as any).tournamentMatch.findMany({
      where: { tournamentId: id },
      orderBy: [{ round: "asc" }, { bracketPosition: "asc" }],
    });
    const entryIds = new Set<string>();
    for (const m of matches) {
      if (m.entryAId) entryIds.add(m.entryAId);
      if (m.entryBId) entryIds.add(m.entryBId);
      if (m.winnerEntryId) entryIds.add(m.winnerEntryId);
    }
    const entries = entryIds.size
      ? await (prisma as any).tournamentEntry.findMany({ where: { id: { in: [...entryIds] } } })
      : [];
    const byId = new Map(entries.map((e: any) => [e.id, e]));
    const enriched = matches.map((m: any) => ({
      ...m,
      entryA: m.entryAId ? byId.get(m.entryAId) : null,
      entryB: m.entryBId ? byId.get(m.entryBId) : null,
    }));
    return reply.send({ ok: true, matches: enriched });
  });

  async function advanceWinner(matchId: string) {
    const m = await (prisma as any).tournamentMatch.findUnique({ where: { id: matchId } });
    if (!m || !m.winnerEntryId) return;
    const loserId = m.winnerEntryId === m.entryAId ? m.entryBId : m.entryAId;

    if (m.nextMatchId) {
      const next = await (prisma as any).tournamentMatch.findUnique({ where: { id: m.nextMatchId } });
      if (next) {
        const slot = m.bracketPosition % 2 === 0 ? "entryAId" : "entryBId";
        if (!next[slot]) {
          const update: any = { [slot]: m.winnerEntryId };
          const otherSlot = slot === "entryAId" ? "entryBId" : "entryAId";
          if (next[otherSlot]) update.status = "READY";
          await (prisma as any).tournamentMatch.update({ where: { id: next.id }, data: update });
          if (next[otherSlot]) await notifyMatchReady(next.id);
        }
      }
    }

    if (m.loserMatchId && loserId) {
      const lm = await (prisma as any).tournamentMatch.findUnique({ where: { id: m.loserMatchId } });
      if (lm) {
        const slot = !lm.entryAId ? "entryAId" : !lm.entryBId ? "entryBId" : null;
        if (slot) {
          const update: any = { [slot]: loserId };
          const otherSlot = slot === "entryAId" ? "entryBId" : "entryAId";
          if (lm[otherSlot]) update.status = "READY";
          await (prisma as any).tournamentMatch.update({ where: { id: lm.id }, data: update });
          if (lm[otherSlot]) await notifyMatchReady(lm.id);
        }
      }
    }
  }

  async function notifyMatchReady(matchId: string) {
    if (!createNotification) return;
    try {
      const m = await (prisma as any).tournamentMatch.findUnique({
        where: { id: matchId },
        include: { tournament: { select: { id: true, title: true, lobbyId: true } } },
      });
      if (!m) return;
      const entryIds = [m.entryAId, m.entryBId].filter(Boolean);
      const entries = await (prisma as any).tournamentEntry.findMany({
        where: { id: { in: entryIds } },
        select: { userId: true, displayName: true },
      });
      const titles: Record<string, string> = {};
      for (const e of entries) if (e.userId) titles[e.userId] = e.displayName;
      const opponentName = (uid: string) => {
        for (const e of entries) if (e.userId && e.userId !== uid) return e.displayName;
        return "your opponent";
      };
      for (const e of entries) {
        if (!e.userId) continue;
        await createNotification({
          userId: e.userId,
          type: "LOBBY_EVENT",
          title: `Your ${m.tournament.title} match is ready`,
          body: `vs. ${opponentName(e.userId)} — Round ${m.round}${m.bracketSide ? ` (${m.bracketSide})` : ""}.`,
          actionUrl: m.tournament.lobbyId ? `/lobby/${encodeURIComponent(m.tournament.lobbyId)}` : undefined,
          meta: { kind: "tournament_match_ready", tournamentId: m.tournament.id, matchId },
        });
      }
    } catch {}
  }

  app.post("/tournaments/:id/matches/:matchId/report", {
  schema: { tags: ["tournaments"], params: z.object({ id: z.string().min(1), matchId: z.string().min(1) }) },
}, async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const matchId = String((req as any).params?.matchId || "");
    const body: any = (req as any).body || {};

    const m = await (prisma as any).tournamentMatch.findUnique({ where: { id: matchId } });
    if (!m) return reply.code(404).send({ ok: false, error: "not_found" });
    if (m.status === "CONFIRMED" || m.status === "CANCELED") {
      return reply.code(400).send({ ok: false, error: "match_closed" });
    }
    const participantIds = await (prisma as any).tournamentEntry.findMany({
      where: { id: { in: [m.entryAId, m.entryBId].filter(Boolean) } },
      select: { userId: true },
    });
    const staffOk = await isStaffUser(u.id);
    const allowed = staffOk || participantIds.some((p: any) => p.userId === u.id);
    if (!allowed) return reply.code(403).send({ ok: false, error: "forbidden" });

    const winnerEntryId = String(body.winnerEntryId || "");
    if (![m.entryAId, m.entryBId].includes(winnerEntryId)) {
      return reply.code(400).send({ ok: false, error: "bad_winner" });
    }
    const scoreA = body.scoreA != null ? Math.max(0, Math.min(99, parseInt(body.scoreA))) : null;
    const scoreB = body.scoreB != null ? Math.max(0, Math.min(99, parseInt(body.scoreB))) : null;

    await (prisma as any).tournamentMatch.update({
      where: { id: matchId },
      data: {
        winnerEntryId, scoreA, scoreB,
        status: "REPORTED",
        reportedById: u.id,
        reportedAt: new Date(),
      },
    });

    if (staffOk) {
      await (prisma as any).tournamentMatch.update({
        where: { id: matchId },
        data: { status: "CONFIRMED", confirmedAt: new Date() },
      });
      await advanceWinner(matchId);
    }

    return reply.send({ ok: true, autoConfirmed: staffOk });
  });

  app.post("/tournaments/:id/matches/:matchId/confirm", {
  schema: { tags: ["tournaments"], params: z.object({ id: z.string().min(1), matchId: z.string().min(1) }) },
}, async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const matchId = String((req as any).params?.matchId || "");
    const m = await (prisma as any).tournamentMatch.findUnique({ where: { id: matchId } });
    if (!m) return reply.code(404).send({ ok: false, error: "not_found" });
    if (m.status !== "REPORTED") return reply.code(400).send({ ok: false, error: "not_reported" });

    if (!(await isStaffUser(u.id))) {
      if (u.id === m.reportedById) return reply.code(403).send({ ok: false, error: "self_confirm", message: "Opponent must confirm." });
      const participantIds = await (prisma as any).tournamentEntry.findMany({
        where: { id: { in: [m.entryAId, m.entryBId].filter(Boolean) } },
        select: { userId: true },
      });
      const isParticipant = participantIds.some((p: any) => p.userId === u.id);
      if (!isParticipant) return reply.code(403).send({ ok: false, error: "forbidden" });
    }

    await (prisma as any).tournamentMatch.update({
      where: { id: matchId },
      data: { status: "CONFIRMED", confirmedAt: new Date() },
    });
    await advanceWinner(matchId);
    return reply.send({ ok: true });
  });

  app.post("/tournaments/:id/matches/:matchId/dispute", {
  schema: { tags: ["tournaments"], params: z.object({ id: z.string().min(1), matchId: z.string().min(1) }) },
}, async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const matchId = String((req as any).params?.matchId || "");
    const m = await (prisma as any).tournamentMatch.findUnique({ where: { id: matchId } });
    if (!m) return reply.code(404).send({ ok: false, error: "not_found" });
    if (m.status !== "REPORTED") return reply.code(400).send({ ok: false, error: "not_reported" });
    await (prisma as any).tournamentMatch.update({
      where: { id: matchId },
      data: { status: "DISPUTED" },
    });
    return reply.send({ ok: true });
  });

  app.post("/tournaments/:id/matches/:matchId/live", {
  schema: { tags: ["tournaments"], params: z.object({ id: z.string().min(1), matchId: z.string().min(1) }) },
}, async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const matchId = String((req as any).params?.matchId || "");
    const m = await (prisma as any).tournamentMatch.findUnique({ where: { id: matchId } });
    if (!m) return reply.code(404).send({ ok: false, error: "not_found" });
    if (m.status !== "READY" && m.status !== "LIVE") return reply.code(400).send({ ok: false, error: "not_ready" });
    await (prisma as any).tournamentMatch.update({
      where: { id: matchId },
      data: { status: "LIVE", liveAt: new Date() },
    });
    return reply.send({ ok: true });
  });

  app.patch("/tournaments/:id/matches/:matchId", {
  schema: { tags: ["tournaments"], params: z.object({ id: z.string().min(1), matchId: z.string().min(1) }) },
}, async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    if (!(await isStaffUser(u.id))) return reply.code(403).send({ ok: false, error: "forbidden" });
    const matchId = String((req as any).params?.matchId || "");
    const body: any = (req as any).body || {};
    const data: any = {};
    if (body.scheduledAt !== undefined) data.scheduledAt = body.scheduledAt ? new Date(body.scheduledAt) : null;
    if (body.twitchLogin !== undefined) data.twitchLogin = body.twitchLogin ? String(body.twitchLogin).slice(0, 30) : null;
    if (body.notes !== undefined) data.notes = body.notes ? String(body.notes).slice(0, 500) : null;
    if (Object.keys(data).length === 0) return reply.code(400).send({ ok: false, error: "no_fields" });
    const updated = await (prisma as any).tournamentMatch.update({ where: { id: matchId }, data });
    return reply.send({ ok: true, match: updated });
  });

  app.post("/tournaments/:id/matches/:matchId/admin-set", {
  schema: { tags: ["tournaments"], params: z.object({ id: z.string().min(1), matchId: z.string().min(1) }) },
}, async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    if (!(await isStaffUser(u.id))) return reply.code(403).send({ ok: false, error: "forbidden" });
    const matchId = String((req as any).params?.matchId || "");
    const body: any = (req as any).body || {};
    const m = await (prisma as any).tournamentMatch.findUnique({ where: { id: matchId } });
    if (!m) return reply.code(404).send({ ok: false, error: "not_found" });
    const winnerEntryId = String(body.winnerEntryId || "");
    if (![m.entryAId, m.entryBId].includes(winnerEntryId)) {
      return reply.code(400).send({ ok: false, error: "bad_winner" });
    }
    const scoreA = body.scoreA != null ? Math.max(0, Math.min(99, parseInt(body.scoreA))) : null;
    const scoreB = body.scoreB != null ? Math.max(0, Math.min(99, parseInt(body.scoreB))) : null;
    await (prisma as any).tournamentMatch.update({
      where: { id: matchId },
      data: {
        winnerEntryId, scoreA, scoreB,
        status: "CONFIRMED",
        reportedById: u.id,
        reportedAt: new Date(),
        confirmedAt: new Date(),
      },
    });
    await advanceWinner(matchId);
    return reply.send({ ok: true });
  });
}

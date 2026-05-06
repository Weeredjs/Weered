import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";

// /tournaments/* — admin-created competitions (LEADERBOARD format only
// today; BRACKET + ROUND_ROBIN are on the roadmap). Registration gates
// on Bungie account link. On complete, top-3 receive notoriety.
type Opts = {
  authFromHeader: (h?: string) => { id: string; globalRole?: string } | null;
  awardNotoriety: (userId: string, action: string) => Promise<number | null>;
  createNotification?: (opts: {
    userId: string; type: string; title: string;
    body?: string; actionUrl?: string;
    actorId?: string; actorName?: string; meta?: any;
  }) => Promise<any>;
};

export default async function tournamentsRoutes(app: FastifyInstance, opts: Opts) {
  const { authFromHeader, awardNotoriety, createNotification } = opts;

  app.get("/tournaments", async (req, reply) => {
    const { lobbyId, status } = req.query as any;
    const where: any = {};
    if (lobbyId) where.lobbyId = lobbyId;
    if (status) where.status = status;
    else where.status = { in: ["REGISTRATION", "ACTIVE"] };
    const tournaments = await prisma.tournament.findMany({
      where,
      include: { _count: { select: { entries: true } } },
      orderBy: { startsAt: "asc" },
      take: 50,
    });
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
    return reply.send({ ok: true, tournament });
  });

  app.post("/tournaments", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    if (!["GOD", "ADMIN", "STAFF"].includes(u.globalRole || "")) {
      return reply.code(403).send({ ok: false, error: "forbidden" });
    }
    const body = req.body as any;
    const tournament = await prisma.tournament.create({
      data: {
        title: String(body.title || "").trim(),
        description: String(body.description || "").trim(),
        iconUrl: body.iconUrl || null,
        format: body.format || "LEADERBOARD",
        entryType: body.entryType || "SOLO",
        lobbyId: body.lobbyId || null,
        createdById: u.id,
        scoringRule: body.scoringRule || {},
        registrationOpensAt: new Date(body.registrationOpensAt || Date.now()),
        startsAt: new Date(body.startsAt),
        endsAt: new Date(body.endsAt),
        maxEntries: parseInt(body.maxEntries) || 100,
        minEntries: parseInt(body.minEntries) || 2,
        rewards: body.rewards || [],
      },
    });
    return reply.send({ ok: true, tournament });
  });

  app.post("/tournaments/:id/register", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const id = String((req as any).params?.id || "");
    const tournament = await prisma.tournament.findUnique({
      where: { id },
      include: { _count: { select: { entries: true } } },
    });
    if (!tournament) return reply.code(404).send({ ok: false, error: "not_found" });
    if (tournament.status !== "REGISTRATION" && tournament.status !== "ACTIVE") {
      return reply.code(400).send({ ok: false, error: "registration_closed" });
    }
    if (tournament._count.entries >= tournament.maxEntries) {
      return reply.code(400).send({ ok: false, error: "tournament_full" });
    }

    const acct = await prisma.userGameAccount.findFirst({ where: { userId: u.id, gameType: "BUNGIE" } });
    if (!acct) return reply.code(400).send({ ok: false, error: "bungie_not_linked" });

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

  app.delete("/tournaments/:id/register", async (req, reply) => {
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

  app.post("/tournaments/:id/activate", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    if (!["GOD", "ADMIN", "STAFF"].includes(u.globalRole || "")) {
      return reply.code(403).send({ ok: false, error: "forbidden" });
    }
    const id = String((req as any).params?.id || "");
    const tournament = await prisma.tournament.update({
      where: { id },
      data: { status: "ACTIVE" },
    });
    return reply.send({ ok: true, tournament });
  });

  app.post("/tournaments/:id/complete", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    if (!["GOD", "ADMIN", "STAFF"].includes(u.globalRole || "")) {
      return reply.code(403).send({ ok: false, error: "forbidden" });
    }
    const id = String((req as any).params?.id || "");
    const entries = await prisma.tournamentEntry.findMany({
      where: { tournamentId: id },
      orderBy: { score: "desc" },
    });
    for (let i = 0; i < entries.length; i++) {
      await prisma.tournamentEntry.update({
        where: { id: entries[i].id },
        data: { rank: i + 1 },
      });
    }
    const tournament = await prisma.tournament.update({
      where: { id },
      data: { status: "COMPLETED" },
    });

    const top3 = entries.slice(0, 3);
    for (let i = 0; i < top3.length; i++) {
      if (top3[i].userId) {
        awardNotoriety(top3[i].userId!, "CHALLENGE_COMPLETED").catch(() => {});
      }
    }

    return reply.send({ ok: true, tournament });
  });

  // ────────────────────────────────────────────────────────────────────────
  // BRACKET ROUTES (single-elim, Phase 1)
  // ────────────────────────────────────────────────────────────────────────

  function isStaff(role?: string | null) {
    return ["GOD", "ADMIN", "STAFF"].includes(String(role || ""));
  }

  // Standard tournament seeding pattern. For nextPow2 size N, returns an
  // array of (seed1, seed2) pairs for the first round such that #1 and #2
  // can only meet in the final. Byes encoded as null.
  // e.g. for size=8 entries: [[1,8],[4,5],[3,6],[2,7]]
  function buildSeedPairs(numEntries: number): Array<[number | null, number | null]> {
    let size = 1; while (size < numEntries) size <<= 1;
    if (size < 2) size = 2;
    // Generate the standard seed order recursively
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

  // POST /tournaments/:id/bracket/start
  // Admin: generates the bracket / round-robin schedule from registered
  // entries. Handles all three competitive formats: BRACKET (single-elim),
  // BRACKET_DOUBLE (double-elim), ROUND_ROBIN (all-vs-all).
  app.post("/tournaments/:id/bracket/start", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    if (!isStaff(u.globalRole)) return reply.code(403).send({ ok: false, error: "forbidden" });
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

    // Seeding: random | rank | manual
    const seedingMode = String(body.seeding || "random");
    if (seedingMode === "random") {
      entries.sort(() => Math.random() - 0.5);
    } else if (seedingMode === "rank") {
      // Sort by user notoriety (high first) — works as a generic skill proxy.
      const userIds = entries.map((e: any) => e.userId).filter(Boolean);
      const users = userIds.length
        ? await (prisma as any).user.findMany({ where: { id: { in: userIds } }, select: { id: true, notoriety: true } })
        : [];
      const notMap = new Map(users.map((u: any) => [u.id, u.notoriety || 0]));
      entries.sort((a: any, b: any) => (notMap.get(b.userId) || 0) - (notMap.get(a.userId) || 0));
    } else if (seedingMode === "manual" && Array.isArray(body.entryOrder)) {
      // body.entryOrder is an array of entry IDs in seed order (1st = top seed)
      const idx = new Map<string, number>();
      body.entryOrder.forEach((eid: string, i: number) => idx.set(String(eid), i));
      entries.sort((a: any, b: any) => (idx.get(a.id) ?? 999) - (idx.get(b.id) ?? 999));
    }

    // ── ROUND_ROBIN ──────────────────────────────────────────────────────
    if (tourney.format === "ROUND_ROBIN") {
      // Generate all distinct pairs; round = "leg" (1..N-1 if even N, else N).
      const pairs: Array<[string, string]> = [];
      for (let i = 0; i < entries.length; i++) {
        for (let j = i + 1; j < entries.length; j++) {
          pairs.push([entries[i].id, entries[j].id]);
        }
      }
      // For round-robin, set every match status to READY (no dependencies).
      let pos = 0;
      for (const [aId, bId] of pairs) {
        await (prisma as any).tournamentMatch.create({
          data: {
            tournamentId: id,
            round: 1, // single-leg round-robin
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

    // ── BRACKET / BRACKET_DOUBLE ─────────────────────────────────────────
    const N = entries.length;
    let bracketSize = 1; while (bracketSize < N) bracketSize <<= 1;
    if (bracketSize < 2) bracketSize = 2;
    const numWinnerRounds = Math.log2(bracketSize);
    const seedPairs = buildSeedPairs(N);

    // Build winners-bracket round skeletons.
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
    // Fill WB round 1 with seed pairs + auto-byes
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
    // Insert WB matches
    const wbCreated: any[][] = [];
    for (const round of wb) {
      const created: any[] = [];
      for (const m of round) created.push(await (prisma as any).tournamentMatch.create({ data: m }));
      wbCreated.push(created);
    }
    // Wire WB nextMatchId
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

    // ── BRACKET_DOUBLE: build losers bracket + grand final ───────────────
    if (tourney.format === "BRACKET_DOUBLE") {
      // Losers bracket has 2*(numWinnerRounds-1) rounds total.
      // Pattern (for size M = 2^k):
      //   LB R1: receives losers from WB R1 (M/4 matches)
      //   LB R2: winner of LB R1 vs loser from WB R2 (M/4 matches)
      //   LB R3: winner of LB R2 vs loser of LB R2 — wait no.
      // Cleaner pattern (standard double-elim layout):
      //   LB has 2*(K-1) rounds where K = log2(M)
      //   "Drop rounds" alternate with "consolidation rounds"
      // For each WB round r in [1..K-1]:
      //   Drop round at LB index = 2r - 1 has M/2^(r+1) matches
      // Consolidation rounds between drops have same count as the prior drop round.
      const numLoserRounds = 2 * (numWinnerRounds - 1);
      const lb: any[][] = [];
      for (let lr = 1; lr <= numLoserRounds; lr++) {
        // Compute matches in this LB round
        const wbRoundContrib = Math.ceil(lr / 2); // which WB round drops here
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
      // Insert LB matches
      for (const round of lb) {
        const created: any[] = [];
        for (const m of round) created.push(await (prisma as any).tournamentMatch.create({ data: m }));
        lbCreated.push(created);
      }
      // Wire LB nextMatchId (winner advances within LB)
      for (let lr = 0; lr < lbCreated.length - 1; lr++) {
        const cur = lbCreated[lr];
        const next = lbCreated[lr + 1];
        // Drop rounds (odd 1-indexed lr=0,2,4...) and consolidation rounds (lr=1,3,5...)
        // alternate. For both, winner of cur[pos] feeds next[floor(pos/k)] where k
        // depends on whether sizes match. Simple rule: pos floored to next-length.
        for (let pos = 0; pos < cur.length; pos++) {
          const targetPos = Math.min(Math.floor(pos / (cur.length / next.length)), next.length - 1);
          await (prisma as any).tournamentMatch.update({
            where: { id: cur[pos].id },
            data: { nextMatchId: next[targetPos].id },
          });
        }
      }

      // Grand final
      grandFinal = await (prisma as any).tournamentMatch.create({
        data: {
          tournamentId: id,
          round: numWinnerRounds + 1,
          bracketPosition: 0,
          status: "PENDING",
          bracketSide: "GRAND",
        },
      });
      // WB final → grand final (winner advances)
      const wbFinal = wbCreated[wbCreated.length - 1][0];
      await (prisma as any).tournamentMatch.update({
        where: { id: wbFinal.id },
        data: { nextMatchId: grandFinal.id },
      });
      // LB final → grand final
      if (lbCreated.length > 0) {
        const lbFinal = lbCreated[lbCreated.length - 1][0];
        await (prisma as any).tournamentMatch.update({
          where: { id: lbFinal.id },
          data: { nextMatchId: grandFinal.id },
        });
      }

      // Wire WB → LB drop edges (loserMatchId).
      // WB R1 losers drop into LB R1.
      // WB R2 losers drop into LB R2 (consolidation).
      // ...
      // WB R(k) losers drop into LB R(2k-2) for k >= 2.
      for (let wr = 0; wr < wbCreated.length - 1; wr++) {
        const wbRound = wbCreated[wr];
        // The LB round that receives drops from WB round (wr+1):
        //   wr=0 (WB R1): LB R1 (lbIdx=0)
        //   wr=1 (WB R2): LB R2 (lbIdx=1)
        //   wr=2 (WB R3): LB R4 (lbIdx=3)
        //   wr=k (WB R(k+1)): LB R(2k) for k>=1, R1 for k=0
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

    // Cascade auto-byes (WB round 1 byes feed WB round 2)
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
    // Recompute status for WB round 2
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

  // GET /tournaments/:id/standings
  // For ROUND_ROBIN, computes wins/losses/point-diff from confirmed matches
  // and returns a ranked entry list. For BRACKET formats, returns entries
  // with wins-so-far + still-alive flag (lost === eliminated).
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
      // Point differential (if scores reported)
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
    // Assign rank
    ranked.forEach((e: any, i: number) => { e.rank = i + 1; });
    return reply.send({ ok: true, format: tourney.format, standings: ranked });
  });

  // GET /tournaments/:id/matches
  app.get("/tournaments/:id/matches", async (req, reply) => {
    const id = String((req as any).params?.id || "");
    const matches = await (prisma as any).tournamentMatch.findMany({
      where: { tournamentId: id },
      orderBy: [{ round: "asc" }, { bracketPosition: "asc" }],
    });
    // Pull entries to enrich names
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

  // Helper: advance the winner into its nextMatch slot. In double-elim,
  // also drop the LOSER into loserMatch's slot.
  async function advanceWinner(matchId: string) {
    const m = await (prisma as any).tournamentMatch.findUnique({ where: { id: matchId } });
    if (!m || !m.winnerEntryId) return;
    const loserId = m.winnerEntryId === m.entryAId ? m.entryBId : m.entryAId;

    // Advance winner
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

    // Drop loser to losers bracket (BRACKET_DOUBLE only)
    if (m.loserMatchId && loserId) {
      const lm = await (prisma as any).tournamentMatch.findUnique({ where: { id: m.loserMatchId } });
      if (lm) {
        // Pick the open slot (A first, then B)
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

  // Notify both participants that their match is ready to play.
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
          actionUrl: m.tournament.lobbyId ? `/lobby/${encodeURIComponent(m.tournament.lobbyId)}` : null,
          meta: { kind: "tournament_match_ready", tournamentId: m.tournament.id, matchId },
        });
      }
    } catch {}
  }

  // POST /tournaments/:id/matches/:matchId/report
  // Body: { winnerEntryId, scoreA, scoreB }
  // Allowed: any participant in the match, or staff
  app.post("/tournaments/:id/matches/:matchId/report", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const matchId = String((req as any).params?.matchId || "");
    const body: any = (req as any).body || {};

    const m = await (prisma as any).tournamentMatch.findUnique({ where: { id: matchId } });
    if (!m) return reply.code(404).send({ ok: false, error: "not_found" });
    if (m.status === "CONFIRMED" || m.status === "CANCELED") {
      return reply.code(400).send({ ok: false, error: "match_closed" });
    }
    // Permission: participant or staff
    const participantIds = await (prisma as any).tournamentEntry.findMany({
      where: { id: { in: [m.entryAId, m.entryBId].filter(Boolean) } },
      select: { userId: true },
    });
    const allowed = isStaff(u.globalRole) || participantIds.some((p: any) => p.userId === u.id);
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

    // Staff reports auto-confirm (no double-step)
    if (isStaff(u.globalRole)) {
      await (prisma as any).tournamentMatch.update({
        where: { id: matchId },
        data: { status: "CONFIRMED", confirmedAt: new Date() },
      });
      await advanceWinner(matchId);
    }

    return reply.send({ ok: true, autoConfirmed: isStaff(u.globalRole) });
  });

  // POST /tournaments/:id/matches/:matchId/confirm
  // Allowed: the opposing player from the reporter, or staff
  app.post("/tournaments/:id/matches/:matchId/confirm", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const matchId = String((req as any).params?.matchId || "");
    const m = await (prisma as any).tournamentMatch.findUnique({ where: { id: matchId } });
    if (!m) return reply.code(404).send({ ok: false, error: "not_found" });
    if (m.status !== "REPORTED") return reply.code(400).send({ ok: false, error: "not_reported" });

    if (!isStaff(u.globalRole)) {
      // Must be the participant who DIDN'T report
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

  // POST /tournaments/:id/matches/:matchId/dispute — opponent disputes report
  app.post("/tournaments/:id/matches/:matchId/dispute", async (req, reply) => {
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

  // POST /tournaments/:id/matches/:matchId/live — mark match as live
  app.post("/tournaments/:id/matches/:matchId/live", async (req, reply) => {
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

  // PATCH /tournaments/:id/matches/:matchId — admin update
  // Body: { scheduledAt?, twitchLogin?, notes? }
  app.patch("/tournaments/:id/matches/:matchId", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    if (!isStaff(u.globalRole)) return reply.code(403).send({ ok: false, error: "forbidden" });
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

  // POST /tournaments/:id/matches/:matchId/admin-set — admin override
  // Body: { winnerEntryId, scoreA, scoreB } — sets + confirms in one step
  app.post("/tournaments/:id/matches/:matchId/admin-set", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    if (!isStaff(u.globalRole)) return reply.code(403).send({ ok: false, error: "forbidden" });
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

import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";

// /tournaments/* — admin-created competitions (LEADERBOARD format only
// today; BRACKET + ROUND_ROBIN are on the roadmap). Registration gates
// on Bungie account link. On complete, top-3 receive notoriety.
type Opts = {
  authFromHeader: (h?: string) => { id: string; globalRole?: string } | null;
  awardNotoriety: (userId: string, action: string) => Promise<number | null>;
};

export default async function tournamentsRoutes(app: FastifyInstance, opts: Opts) {
  const { authFromHeader, awardNotoriety } = opts;

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
  // Admin: generates the bracket from registered entries. Sets status ACTIVE.
  app.post("/tournaments/:id/bracket/start", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    if (!isStaff(u.globalRole)) return reply.code(403).send({ ok: false, error: "forbidden" });
    const id = String((req as any).params?.id || "");

    const tourney = await (prisma as any).tournament.findUnique({ where: { id } });
    if (!tourney) return reply.code(404).send({ ok: false, error: "not_found" });
    if (tourney.format !== "BRACKET") return reply.code(400).send({ ok: false, error: "wrong_format", message: "Bracket only available on BRACKET-format tournaments." });
    if (tourney.status === "COMPLETED" || tourney.status === "CANCELED") {
      return reply.code(400).send({ ok: false, error: "tournament_closed" });
    }

    const existing = await (prisma as any).tournamentMatch.count({ where: { tournamentId: id } });
    if (existing > 0) return reply.code(400).send({ ok: false, error: "bracket_exists", message: "Bracket already generated. Reset on the admin page if you need to redraw." });

    // Pull entries (random order if no seeding yet — we treat array index as seed)
    const seedingMode = String(((req as any).body || {}).seeding || "random");
    let entries = await (prisma as any).tournamentEntry.findMany({ where: { tournamentId: id } });
    if (entries.length < (tourney.minEntries || 2)) {
      return reply.code(400).send({ ok: false, error: "not_enough_entries", count: entries.length, min: tourney.minEntries });
    }
    if (seedingMode === "random") {
      entries.sort(() => Math.random() - 0.5);
    }
    // (Future: seedingMode === "rank" pulls from Glory/Trials cards, etc.)

    const N = entries.length;
    let bracketSize = 1; while (bracketSize < N) bracketSize <<= 1;
    if (bracketSize < 2) bracketSize = 2;
    const numRounds = Math.log2(bracketSize);
    const seedPairs = buildSeedPairs(N);

    // Build all match records in advance, top-down per round, so we can
    // wire nextMatchId references. Each round has bracketSize / 2^round matches.
    // Round 1 has the seedPairs; later rounds have null entries (filled by
    // confirm).
    const matchesByRound: any[][] = [];
    for (let r = 1; r <= numRounds; r++) {
      const matchesInRound = bracketSize / Math.pow(2, r);
      const round: any[] = [];
      for (let pos = 0; pos < matchesInRound; pos++) {
        round.push({
          tournamentId: id,
          round: r,
          bracketPosition: pos,
          status: "PENDING",
        });
      }
      matchesByRound.push(round);
    }

    // Fill round 1 with seed pairs
    for (let pos = 0; pos < seedPairs.length; pos++) {
      const [aSeed, bSeed] = seedPairs[pos];
      const m = matchesByRound[0][pos];
      m.entryAId = aSeed != null ? entries[aSeed - 1].id : null;
      m.entryBId = bSeed != null ? entries[bSeed - 1].id : null;
      // Status: READY if both present, READY (auto-bye) if exactly one
      if (m.entryAId && m.entryBId) m.status = "READY";
      else if (m.entryAId || m.entryBId) {
        // Auto-advance bye: winner is the present entry, status CONFIRMED
        m.status = "CONFIRMED";
        m.winnerEntryId = m.entryAId || m.entryBId;
        m.confirmedAt = new Date();
      }
    }

    // Insert all matches and capture IDs
    const created: any[][] = [];
    for (let r = 0; r < matchesByRound.length; r++) {
      created.push([]);
      for (const m of matchesByRound[r]) {
        const row = await (prisma as any).tournamentMatch.create({ data: m });
        created[r].push(row);
      }
    }

    // Wire nextMatchId: round r position p → round r+1 position floor(p/2)
    for (let r = 0; r < created.length - 1; r++) {
      for (let pos = 0; pos < created[r].length; pos++) {
        const next = created[r + 1][Math.floor(pos / 2)];
        await (prisma as any).tournamentMatch.update({
          where: { id: created[r][pos].id },
          data: { nextMatchId: next.id },
        });
      }
    }

    // Cascade auto-byes into round 2 (if any round 1 was an auto-bye, advance it)
    for (let pos = 0; pos < created[0].length; pos++) {
      const m = created[0][pos];
      if (m.status === "CONFIRMED" && m.winnerEntryId && created.length > 1) {
        const next = created[1][Math.floor(pos / 2)];
        const slot = pos % 2 === 0 ? "entryAId" : "entryBId";
        await (prisma as any).tournamentMatch.update({
          where: { id: next.id },
          data: { [slot]: m.winnerEntryId },
        });
      }
    }
    // Recompute status for round 2 matches that now have both entries
    if (created.length > 1) {
      for (const m of created[1]) {
        const fresh = await (prisma as any).tournamentMatch.findUnique({ where: { id: m.id } });
        if (fresh.entryAId && fresh.entryBId && fresh.status === "PENDING") {
          await (prisma as any).tournamentMatch.update({ where: { id: m.id }, data: { status: "READY" } });
        }
      }
    }

    await (prisma as any).tournament.update({ where: { id }, data: { status: "ACTIVE" } });

    return reply.send({ ok: true, bracketSize, numRounds, totalMatches: created.flat().length });
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

  // Helper: advance the winner of a match into its nextMatch slot.
  async function advanceWinner(matchId: string) {
    const m = await (prisma as any).tournamentMatch.findUnique({ where: { id: matchId } });
    if (!m || !m.winnerEntryId || !m.nextMatchId) return;
    const next = await (prisma as any).tournamentMatch.findUnique({ where: { id: m.nextMatchId } });
    if (!next) return;
    // Bracket position parity decides slot (even pos → A, odd → B)
    const slot = m.bracketPosition % 2 === 0 ? "entryAId" : "entryBId";
    if (next[slot]) return; // already filled (defensive)
    const update: any = { [slot]: m.winnerEntryId };
    // If next now has both entries, mark READY
    const otherSlot = slot === "entryAId" ? "entryBId" : "entryAId";
    if (next[otherSlot]) update.status = "READY";
    await (prisma as any).tournamentMatch.update({ where: { id: next.id }, data: update });
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

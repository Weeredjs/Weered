import type { PrismaClient } from "@prisma/client";

// chessChallengeWorker.ts — evaluates chess-specific challenge enrollments
// against ChessActivityLog rows. Runs in parallel to the Bungie-flavored
// challengeWorker, sharing the same enrollment/Notoriety/Paper infrastructure.
//
// Chess objective types supported:
//   - chess_wins      : count W outcomes matching filters
//   - chess_streak    : longest consecutive W streak matching filters
//   - chess_rating_climb : rating delta in window for a perf
//   - chess_opening_wins : wins where openingName/ecoCode matches a regex
//
// Filters supported:
//   - timeControl: string[]  // "bullet" | "blitz" | "rapid" | "classical"
//   - provider: string[]     // "LICHESS" | "CHESS_COM"
//   - opening: string        // regex or substring matched against openingName
//   - ecoPrefix: string      // e.g. "B" matches all Sicilians (B20-B99)
//   - rated: boolean         // require rated games

const POLL_INTERVAL_MS = 60_000;
const CHESS_OBJECTIVE_TYPES = new Set(["chess_wins", "chess_streak", "chess_rating_climb", "chess_opening_wins"]);

type ChessFilters = {
  timeControl?: string[];
  provider?: string[];
  opening?: string;
  ecoPrefix?: string;
  rated?: boolean;
  perf?: string; // for rating_climb
};

type ChessObjectiveSpec = {
  id: string;
  type: string;
  description: string;
  target: number;
  filters?: ChessFilters;
};

type ObjProgress = {
  current: number;
  target: number;
  completed: boolean;
  currentStreak?: number;
};

type ChessGameRow = any; // ChessActivityLog row shape

function matchesChessFilters(g: ChessGameRow, f: ChessFilters | undefined): boolean {
  if (!f) return true;
  if (f.timeControl?.length && !f.timeControl.includes(g.timeControl)) return false;
  if (f.provider?.length && !f.provider.includes(g.provider)) return false;
  if (typeof f.rated === "boolean" && g.rated !== f.rated) return false;
  if (f.ecoPrefix && !(g.ecoCode || "").startsWith(f.ecoPrefix)) return false;
  if (f.opening) {
    try {
      const re = new RegExp(f.opening, "i");
      if (!re.test(String(g.openingName || ""))) return false;
    } catch {
      // Not a regex — substring match
      if (!String(g.openingName || "").toLowerCase().includes(f.opening.toLowerCase())) return false;
    }
  }
  return true;
}

function evaluateChessObjective(
  obj: ChessObjectiveSpec,
  games: ChessGameRow[],
  existing: ObjProgress,
): ObjProgress {
  if (existing.completed) return existing;

  // games arrive in DB order (we'll sort oldest-first for streak logic).
  const sorted = [...games].sort((a, b) => new Date(a.playedAt).getTime() - new Date(b.playedAt).getTime());

  let current = existing.current;
  let currentStreak = existing.currentStreak ?? 0;

  switch (obj.type) {
    case "chess_wins": {
      let wins = 0;
      for (const g of sorted) {
        if (!matchesChessFilters(g, obj.filters)) continue;
        if (g.result === "WIN") wins++;
      }
      current = wins;
      break;
    }

    case "chess_streak": {
      let maxStreak = 0;
      let cur = 0;
      for (const g of sorted) {
        if (!matchesChessFilters(g, obj.filters)) continue;
        if (g.result === "WIN") {
          cur++;
          if (cur > maxStreak) maxStreak = cur;
        } else {
          cur = 0;
        }
      }
      currentStreak = cur;
      current = Math.max(current, maxStreak);
      break;
    }

    case "chess_rating_climb": {
      // Net rating change across games matching filters in this window.
      // Sum ratingDiff. Lichess provides this directly; Chess.com doesn't,
      // so chess_rating_climb is effectively Lichess-only for now.
      let netDelta = 0;
      for (const g of sorted) {
        if (!matchesChessFilters(g, obj.filters)) continue;
        if (typeof g.ratingDiff === "number") netDelta += g.ratingDiff;
      }
      current = Math.max(0, netDelta); // only credit positive climb
      break;
    }

    case "chess_opening_wins": {
      // Same as chess_wins but with opening filter forced
      let wins = 0;
      for (const g of sorted) {
        if (!matchesChessFilters(g, obj.filters)) continue;
        if (g.result === "WIN") wins++;
      }
      current = wins;
      break;
    }
  }

  return {
    current,
    target: obj.target,
    completed: current >= obj.target,
    currentStreak,
  };
}

export function startChessChallengeWorker(
  prisma: PrismaClient,
  awardNotoriety: (userId: string, action: string) => Promise<any>,
  awardPaper?: (userId: string, type: string, amount: number, description: string, refId?: string) => Promise<any>,
  broadcastToLobby?: (lobbyId: string, event: any) => void,
) {
  console.log("[chess-challenges] worker started — polling every 60s");

  async function cycle() {
    try {
      // Pull all active enrollments whose definitions have at least one
      // chess-type objective. Two-step query because Prisma can't introspect
      // JSON path on the chess types we use.
      const enrollments = await prisma.challengeEnrollment.findMany({
        where: {
          status: "ACTIVE",
          instance: { status: "ACTIVE" },
        },
        include: { instance: { include: { definition: true } } },
        take: 200,
      });

      // Filter to chess-relevant enrollments
      const relevant = enrollments.filter(e => {
        const objs: any[] = (e.instance.definition.objectives as any[]) || [];
        return objs.some(o => CHESS_OBJECTIVE_TYPES.has(String(o?.type || "")));
      });
      if (relevant.length === 0) return;

      // Group by userId so we fetch chess games once per user
      const byUser = new Map<string, typeof relevant>();
      for (const e of relevant) {
        const list = byUser.get(e.userId) || [];
        list.push(e);
        byUser.set(e.userId, list);
      }

      for (const [userId, userEnrolls] of byUser) {
        // Pull this user's chess games (recent window). The worker that
        // ingests games keeps the table fresh; we just read it.
        const games = await (prisma as any).chessActivityLog.findMany({
          where: { userId },
          orderBy: { playedAt: "desc" },
          take: 500,
        });

        for (const enr of userEnrolls) {
          const def = enr.instance.definition;
          const objectives: ChessObjectiveSpec[] = (def.objectives as any[]) || [];
          const progress = (enr.progress as Record<string, ObjProgress>) || {};

          // Window: only games on or after the instance start
          const instanceStart = new Date(enr.instance.startsAt).getTime();
          const windowGames = games.filter((g: any) => new Date(g.playedAt).getTime() >= instanceStart);

          let allCompleted = true;
          let completedCount = 0;
          for (const obj of objectives) {
            if (!CHESS_OBJECTIVE_TYPES.has(obj.type)) {
              // Skip non-chess objectives; the other worker handles them.
              if (!progress[obj.id]?.completed) allCompleted = false;
              continue;
            }
            const existing = progress[obj.id] || { current: 0, target: obj.target, completed: false };
            const updated = evaluateChessObjective(obj, windowGames, existing);
            progress[obj.id] = updated;
            if (updated.completed) completedCount++;
            else allCompleted = false;
          }

          const isComplete = def.requireAll
            ? allCompleted
            : completedCount >= (def.requireCount || objectives.length);

          const updateData: any = {
            progress: progress as any,
            lastCheckedAt: new Date(),
          };
          if (isComplete && enr.status !== "COMPLETED") {
            updateData.status = "COMPLETED";
            updateData.completedAt = new Date();
            if (def.notorietyReward > 0) awardNotoriety(userId, "CHALLENGE_COMPLETED").catch(() => {});
            if ((def as any).paperReward > 0 && awardPaper) {
              awardPaper(userId, "EARN_CHALLENGE", (def as any).paperReward, `Chess challenge: ${def.title}`, enr.instanceId).catch(() => {});
            }
            if (def.badgeId) {
              prisma.userBadge.create({ data: { userId, badgeId: def.badgeId } }).catch(() => {});
            }
            console.log(`[chess-challenges] ${userId} completed "${def.title}"`);
            if (broadcastToLobby && (def as any).lobbyId) {
              broadcastToLobby((def as any).lobbyId, {
                type: "challenge:completed",
                userId,
                challengeTitle: def.title,
                lobbyId: (def as any).lobbyId,
              });
            }
          }

          await prisma.challengeEnrollment.update({ where: { id: enr.id }, data: updateData });
        }
      }
    } catch (err: any) {
      console.error("[chess-challenges] cycle error:", err?.message || err);
    }
  }

  setTimeout(() => { void cycle(); }, 45_000);
  setInterval(() => { void cycle(); }, POLL_INTERVAL_MS);
}

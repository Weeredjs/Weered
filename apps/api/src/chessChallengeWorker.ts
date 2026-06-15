import { log } from "./lib/logger";
import type { PrismaClient } from "@prisma/client";

const POLL_INTERVAL_MS = 60_000;
const CHESS_OBJECTIVE_TYPES = new Set([
  "chess_wins",
  "chess_streak",
  "chess_rating_climb",
  "chess_opening_wins",
]);

type ChessFilters = {
  timeControl?: string[];
  provider?: string[];
  opening?: string;
  ecoPrefix?: string;
  rated?: boolean;
  perf?: string;
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

type ChessGameRow = any;

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
      if (
        !String(g.openingName || "")
          .toLowerCase()
          .includes(f.opening.toLowerCase())
      )
        return false;
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

  const sorted = [...games].sort(
    (a, b) => new Date(a.playedAt).getTime() - new Date(b.playedAt).getTime(),
  );

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
      let netDelta = 0;
      for (const g of sorted) {
        if (!matchesChessFilters(g, obj.filters)) continue;
        if (typeof g.ratingDiff === "number") netDelta += g.ratingDiff;
      }
      current = Math.max(0, netDelta);
      break;
    }

    case "chess_opening_wins": {
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
  awardPaper?: (
    userId: string,
    type: string,
    amount: number,
    description: string,
    refId?: string,
  ) => Promise<any>,
  broadcastToLobby?: (lobbyId: string, event: any) => void,
) {
  log.log("[chess-challenges] worker started — polling every 60s");

  async function cycle() {
    try {
      const enrollments = await prisma.challengeEnrollment.findMany({
        where: {
          status: "ACTIVE",
          instance: { status: "ACTIVE" },
        },
        include: { instance: { include: { definition: true } } },
        take: 200,
      });

      const relevant = enrollments.filter((e) => {
        const objs: any[] = (e.instance.definition.objectives as any[]) || [];
        return objs.some((o) => CHESS_OBJECTIVE_TYPES.has(String(o?.type || "")));
      });
      if (relevant.length === 0) return;

      const byUser = new Map<string, typeof relevant>();
      for (const e of relevant) {
        const list = byUser.get(e.userId) || [];
        list.push(e);
        byUser.set(e.userId, list);
      }

      for (const [userId, userEnrolls] of byUser) {
        const games = await prisma.chessActivityLog.findMany({
          where: { userId },
          orderBy: { playedAt: "desc" },
          take: 500,
        });

        for (const enr of userEnrolls) {
          const def = enr.instance.definition;
          const objectives: ChessObjectiveSpec[] = (def.objectives as any[]) || [];
          const progress = (enr.progress as Record<string, ObjProgress>) || {};

          const instanceStart = new Date(enr.instance.startsAt).getTime();
          const windowGames = games.filter(
            (g: any) => new Date(g.playedAt).getTime() >= instanceStart,
          );

          let allCompleted = true;
          let completedCount = 0;
          for (const obj of objectives) {
            if (!CHESS_OBJECTIVE_TYPES.has(obj.type)) {
              if (!progress[obj.id]?.completed) allCompleted = false;
              continue;
            }
            const existing = progress[obj.id] || {
              current: 0,
              target: obj.target,
              completed: false,
            };
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
            if (def.notorietyReward > 0)
              awardNotoriety(userId, "CHALLENGE_COMPLETED").catch(() => {});
            if ((def as any).paperReward > 0 && awardPaper) {
              awardPaper(
                userId,
                "EARN_CHALLENGE",
                (def as any).paperReward,
                `Chess challenge: ${def.title}`,
                enr.instanceId,
              ).catch(() => {});
            }
            if (def.badgeId) {
              prisma.userBadge.create({ data: { userId, badgeId: def.badgeId } }).catch(() => {});
            }
            log.log(`[chess-challenges] ${userId} completed "${def.title}"`);
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
      log.error("[chess-challenges] cycle error:", err?.message || err);
    }
  }

  setTimeout(() => {
    void cycle();
  }, 45_000);
  setInterval(() => {
    void cycle();
  }, POLL_INTERVAL_MS);
}

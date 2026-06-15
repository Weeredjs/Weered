import { log, swallow } from "./lib/logger";
import type { PrismaClient } from "@prisma/client";
import { pollAndStoreActivities } from "./lib/bungieActivities";
import { advanceWinner as bracketAdvanceWinner } from "./lib/tournamentBracket";

type AutoDetectNotify = (
  userId: string,
  payload: {
    type: "tournament:auto_detected";
    tournamentId: string;
    matchId: string;
    pgcrInstanceId: string;
    won: boolean;
    score: number;
    opponentScore: number;
  },
) => void;

const POLL_INTERVAL_MS = 2 * 60 * 1000;
const FRESH_PULL_DEBOUNCE_MS = 30 * 1000;

export function startTournamentAutoDetect(
  prisma: PrismaClient,
  opts: {
    notify?: AutoDetectNotify;
    createNotification?: (n: {
      userId: string;
      type: string;
      title: string;
      body?: string;
      actionUrl?: string;
      actorId?: string;
      actorName?: string;
      meta?: any;
    }) => Promise<any>;
  },
) {
  const { notify, createNotification } = opts;
  const lastPullAt = new Map<string, number>();

  log.log("[tournament-autodetect] Worker started — polling every 2m");

  async function freshPullForMatch(matchId: string) {
    const m = await prisma.tournamentMatch.findUnique({
      where: { id: matchId },
      select: { entryAId: true, entryBId: true },
    });
    if (!m) return;
    const entryIds = [m.entryAId, m.entryBId].filter(Boolean) as string[];
    const entries = entryIds.length
      ? await prisma.tournamentEntry.findMany({
          where: { id: { in: entryIds } },
          select: { userId: true },
        })
      : [];
    const userIds: string[] = entries.map((e: any) => e.userId).filter(Boolean);
    const now = Date.now();
    for (const uid of userIds) {
      const last = lastPullAt.get(uid) || 0;
      if (now - last < FRESH_PULL_DEBOUNCE_MS) continue;
      lastPullAt.set(uid, now);
      try {
        await pollAndStoreActivities(prisma, uid, { count: 10 });
      } catch (err) {
        log.error("[tournament-autodetect] fresh pull failed", uid, err);
      }
    }
  }

  async function detectMatch(match: any): Promise<boolean> {
    if (!match.entryAId || !match.entryBId) return false;
    const aUserId = match.entryA?.userId;
    const bUserId = match.entryB?.userId;
    if (!aUserId || !bUserId) return false;

    const now = new Date();
    const startBound = match.scheduledAt
      ? new Date(new Date(match.scheduledAt).getTime() - 60 * 60 * 1000)
      : match.liveAt
        ? new Date(new Date(match.liveAt).getTime() - 60 * 60 * 1000)
        : new Date(now.getTime() - 4 * 60 * 60 * 1000);
    const endBound = new Date(now.getTime() + 30 * 60 * 1000);

    const aLogs = await prisma.bungieActivityLog.findMany({
      where: {
        userId: aUserId,
        period: { gte: startBound, lte: endBound },
        ...(match.expectedActivityHash ? { activityHash: match.expectedActivityHash } : {}),
      },
      select: { activityInstanceId: true, score: true, standing: true, kills: true, period: true },
    });
    if (aLogs.length === 0) return false;

    const aInstanceIds = aLogs.map((l: any) => l.activityInstanceId).filter(Boolean);
    if (aInstanceIds.length === 0) return false;

    const bLogs = await prisma.bungieActivityLog.findMany({
      where: {
        userId: bUserId,
        activityInstanceId: { in: aInstanceIds },
      },
      select: { activityInstanceId: true, score: true, standing: true, kills: true, period: true },
    });
    if (bLogs.length === 0) return false;

    const bByInstance = new Map<string, any>();
    for (const l of bLogs) bByInstance.set(l.activityInstanceId, l);
    const aByInstance = new Map<string, any>();
    for (const l of aLogs) aByInstance.set(l.activityInstanceId, l);

    const sharedIds = [...bByInstance.keys()]
      .map((id) => ({ id, period: aByInstance.get(id)?.period }))
      .filter((x) => x.period)
      .sort((x, y) => new Date(y.period).getTime() - new Date(x.period).getTime());

    if (sharedIds.length === 0) return false;

    const instanceId = sharedIds[0].id;
    const aRow = aByInstance.get(instanceId);
    const bRow = bByInstance.get(instanceId);

    let scoreA = aRow.score ?? 0;
    let scoreB = bRow.score ?? 0;
    if (scoreA === 0 && scoreB === 0) {
      scoreA = aRow.kills ?? 0;
      scoreB = bRow.kills ?? 0;
    }

    let winnerEntryId: string;
    if (aRow.standing === 0 && bRow.standing !== 0) {
      winnerEntryId = match.entryAId;
    } else if (bRow.standing === 0 && aRow.standing !== 0) {
      winnerEntryId = match.entryBId;
    } else if (scoreA > scoreB) {
      winnerEntryId = match.entryAId;
    } else if (scoreB > scoreA) {
      winnerEntryId = match.entryBId;
    } else {
      return false;
    }

    await prisma.tournamentMatch.update({
      where: { id: match.id },
      data: {
        scoreA,
        scoreB,
        winnerEntryId,
        status: "CONFIRMED",
        pgcrInstanceId: instanceId,
        autoDetectedAt: new Date(),
      },
    });

    try {
      await bracketAdvanceWinner(prisma, match.id, { createNotification });
    } catch (err) {
      log.error("[tournament-autodetect] advanceWinner failed", err);
    }

    const aWon = winnerEntryId === match.entryAId;
    if (notify) {
      try {
        notify(aUserId, {
          type: "tournament:auto_detected",
          tournamentId: match.tournamentId,
          matchId: match.id,
          pgcrInstanceId: instanceId,
          won: aWon,
          score: scoreA,
          opponentScore: scoreB,
        });
        notify(bUserId, {
          type: "tournament:auto_detected",
          tournamentId: match.tournamentId,
          matchId: match.id,
          pgcrInstanceId: instanceId,
          won: !aWon,
          score: scoreB,
          opponentScore: scoreA,
        });
      } catch (e) {
        swallow(e);
      }
    }
    if (createNotification) {
      const tournament = await prisma.tournament.findUnique({
        where: { id: match.tournamentId },
        select: { lobbyId: true, title: true },
      });
      const url = tournament?.lobbyId
        ? `/lobby/${encodeURIComponent(tournament.lobbyId)}`
        : undefined;
      const tag = `${tournament?.title || "Tournament"}`;
      const pgcrUrl = `https://destinytracker.com/destiny-2/pgcr/${instanceId}`;
      await createNotification({
        userId: aUserId,
        type: "CHALLENGE_PROGRESS",
        title: aWon
          ? `Verified · You won ${tag} match ${scoreA}-${scoreB}`
          : `Verified · Lost ${tag} match ${scoreA}-${scoreB}`,
        body: `Auto-detected from your Crucible history. PGCR: ${pgcrUrl}`,
        actionUrl: url,
        meta: {
          kind: "tournament_auto_detected",
          matchId: match.id,
          pgcrInstanceId: instanceId,
          won: aWon,
        },
      }).catch(swallow);
      await createNotification({
        userId: bUserId,
        type: "CHALLENGE_PROGRESS",
        title: !aWon
          ? `Verified · You won ${tag} match ${scoreB}-${scoreA}`
          : `Verified · Lost ${tag} match ${scoreB}-${scoreA}`,
        body: `Auto-detected from your Crucible history. PGCR: ${pgcrUrl}`,
        actionUrl: url,
        meta: {
          kind: "tournament_auto_detected",
          matchId: match.id,
          pgcrInstanceId: instanceId,
          won: !aWon,
        },
      }).catch(swallow);
    }

    log.log(
      `[tournament-autodetect] match ${match.id} confirmed via PGCR ${instanceId} (${scoreA}-${scoreB})`,
    );
    return true;
  }

  async function cycle() {
    try {
      const tourns = await prisma.tournament.findMany({
        where: { lobbyId: "destiny2", status: "ACTIVE" },
        select: { id: true },
      });
      if (tourns.length === 0) return;
      const tIds = tourns.map((t: any) => t.id);

      const rawMatches = await prisma.tournamentMatch.findMany({
        where: {
          status: { in: ["READY", "LIVE"] },
          pgcrInstanceId: null,
          tournamentId: { in: tIds },
        },
        take: 50,
      });
      if (rawMatches.length === 0) return;

      const entryIds = Array.from(
        new Set(rawMatches.flatMap((m: any) => [m.entryAId, m.entryBId]).filter(Boolean)),
      ) as string[];
      const entries = entryIds.length
        ? await prisma.tournamentEntry.findMany({
            where: { id: { in: entryIds } },
            select: { id: true, userId: true },
          })
        : [];
      const eById: Record<string, any> = {};
      for (const e of entries) eById[e.id] = e;
      const matches = rawMatches.map((m: any) => ({
        ...m,
        entryA: m.entryAId ? eById[m.entryAId] || null : null,
        entryB: m.entryBId ? eById[m.entryBId] || null : null,
      }));

      for (const m of matches) {
        if (m.status === "LIVE") await freshPullForMatch(m.id);
      }

      for (const m of matches) {
        try {
          await detectMatch(m);
        } catch (err) {
          log.error("[tournament-autodetect] detect failed", m.id, err);
        }
      }
    } catch (err) {
      log.error("[tournament-autodetect] cycle failed", err);
    }
  }

  setTimeout(() => {
    cycle();
    setInterval(cycle, POLL_INTERVAL_MS);
  }, 30_000);

  return {
    onMatchLive: freshPullForMatch,
    runOnce: cycle,
    detectMatch,
  };
}

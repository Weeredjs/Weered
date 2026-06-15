import { log } from "./logger";
import type { PrismaClient } from "@prisma/client";
import { grantFlairToUser } from "./flair";

type CreateNotification = (opts: {
  userId: string;
  type: string;
  title: string;
  body?: string;
  actionUrl?: string | null;
  actorId?: string;
  actorName?: string;
  meta?: any;
}) => Promise<any>;

type AwardPaper = (
  userId: string,
  type: string,
  amount: number,
  description: string,
  refId?: string,
) => Promise<{ balance: number } | null>;

export type TournamentCompleteDeps = {
  awardPaper?: AwardPaper;
  createNotification?: CreateNotification;
};

export type TournamentCompleteResult = {
  ok: boolean;
  error?: string;
  tournament?: any;
  payouts?: any[];
};

export async function completeTournament(
  prisma: PrismaClient,
  tournamentId: string,
  deps: TournamentCompleteDeps = {},
): Promise<TournamentCompleteResult> {
  const { awardPaper, createNotification } = deps;

  const tournament = await (prisma as any).tournament.findUnique({ where: { id: tournamentId } });
  if (!tournament) return { ok: false, error: "not_found" };
  if (tournament.status === "COMPLETED" || tournament.status === "CANCELED") {
    return { ok: false, error: "already_finalized" };
  }

  let entries: any[];
  if (tournament.format === "LEADERBOARD" || tournament.format === "CHALLENGE_RACE") {
    entries = await (prisma as any).tournamentEntry.findMany({
      where: { tournamentId },
      orderBy: { score: "desc" },
    });
  } else {
    const allEntries = await (prisma as any).tournamentEntry.findMany({ where: { tournamentId } });
    const matches = await (prisma as any).tournamentMatch.findMany({
      where: { tournamentId, status: "CONFIRMED" },
    });
    const stats: Record<string, { wins: number; losses: number; diff: number }> = {};
    for (const e of allEntries) stats[e.id] = { wins: 0, losses: 0, diff: 0 };
    for (const m of matches) {
      if (!m.winnerEntryId) continue;
      const loserId = m.winnerEntryId === m.entryAId ? m.entryBId : m.entryAId;
      if (stats[m.winnerEntryId]) stats[m.winnerEntryId].wins++;
      if (loserId && stats[loserId]) stats[loserId].losses++;
      if (m.scoreA != null && m.scoreB != null) {
        if (stats[m.entryAId!]) stats[m.entryAId!].diff += m.scoreA - m.scoreB;
        if (stats[m.entryBId!]) stats[m.entryBId!].diff += m.scoreB - m.scoreA;
      }
    }
    entries = allEntries
      .map((e: any) => ({
        ...e,
        _wins: stats[e.id].wins,
        _losses: stats[e.id].losses,
        _diff: stats[e.id].diff,
      }))
      .sort((a: any, b: any) => {
        if (b._wins !== a._wins) return b._wins - a._wins;
        if (b._diff !== a._diff) return b._diff - a._diff;
        return a._losses - b._losses;
      });
  }

  for (let i = 0; i < entries.length; i++) {
    await (prisma as any).tournamentEntry.update({
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
      case "CHAMPION":
        return { paper: Math.round(2000 * scale), notoriety: Math.round(500 * scale) };
      case "PODIUM":
        return { paper: Math.round(1000 * scale), notoriety: Math.round(250 * scale) };
      case "TOP8":
        return { paper: Math.round(500 * scale), notoriety: Math.round(100 * scale) };
      case "TOP16":
        return { paper: Math.round(200 * scale), notoriety: Math.round(50 * scale) };
      default:
        return { paper: 0, notoriety: 0 };
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
      await awardPaper(
        e.userId,
        "TOURNAMENT_PRIZE",
        p.paper,
        `${tournament.title} · ${t}`,
        tournamentId,
      ).catch(() => {});
    }
    if (p.notoriety > 0) {
      try {
        await (prisma as any).notorietyEvent.create({
          data: {
            userId: e.userId,
            action: `TOURNAMENT_${t}`,
            points: p.notoriety,
            refId: tournamentId,
          },
        });
        await (prisma as any).user.update({
          where: { id: e.userId },
          data: { notoriety: { increment: p.notoriety } },
        });
      } catch {}
    }

    if (t === "CHAMPION") {
      const rewardsArr: any[] = Array.isArray(tournament.rewards) ? tournament.rewards : [];
      for (const rw of rewardsArr) {
        if (rw && rw.kind === "FLAIR" && rw.flairItemId) {
          try {
            await grantFlairToUser(
              prisma,
              e.userId,
              String(rw.flairItemId),
              `tournament:${tournamentId}`,
            );
          } catch (err) {
            log.warn("[tournament] flair grant failed:", err);
          }
        }
      }
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
        log.warn("[tournament] badge award failed:", err);
      }
    }

    if (createNotification) {
      await createNotification({
        userId: e.userId,
        type: "CHALLENGE_COMPLETED",
        title:
          t === "CHAMPION"
            ? `🏆 You won ${tournament.title}`
            : `Top ${i + 1} in ${tournament.title}`,
        body:
          p.paper > 0 || p.notoriety > 0
            ? `Awarded ${p.paper > 0 ? `${p.paper}P` : ""}${p.paper > 0 && p.notoriety > 0 ? " + " : ""}${p.notoriety > 0 ? `${p.notoriety} Notoriety` : ""}.`
            : "Honor only — no payout.",
        actionUrl: tournament.lobbyId ? `/lobby/${encodeURIComponent(tournament.lobbyId)}` : null,
        meta: { kind: "tournament_complete", tournamentId, rank: i + 1, tier: t },
      }).catch(() => {});
    }
  }

  const updated = await (prisma as any).tournament.update({
    where: { id: tournamentId },
    data: { status: "COMPLETED" },
  });

  return { ok: true, tournament: updated, payouts };
}

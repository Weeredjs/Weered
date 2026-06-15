import type { PrismaClient } from "@prisma/client";

type CreateNotification = (n: {
  userId: string;
  type: string;
  title: string;
  body?: string;
  actionUrl?: string;
  actorId?: string;
  actorName?: string;
  meta?: any;
}) => Promise<any>;

export type BracketAdvanceOpts = {
  createNotification?: CreateNotification;
};

export async function notifyMatchReady(
  prisma: PrismaClient,
  matchId: string,
  opts: BracketAdvanceOpts = {},
) {
  const { createNotification } = opts;
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
        actionUrl: m.tournament.lobbyId
          ? `/lobby/${encodeURIComponent(m.tournament.lobbyId)}`
          : undefined,
        meta: { kind: "tournament_match_ready", tournamentId: m.tournament.id, matchId },
      });
    }
  } catch {}
}

export async function advanceWinner(
  prisma: PrismaClient,
  matchId: string,
  opts: BracketAdvanceOpts = {},
) {
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
        if (next[otherSlot]) await notifyMatchReady(prisma, next.id, opts);
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
        if (lm[otherSlot]) await notifyMatchReady(prisma, lm.id, opts);
      }
    }
  }
}

/**
 * Paper earned at FakeOut.
 *
 * Each winning close used to pay at least 1 Paper (10 in Ranked) and a losing
 * close cost nothing, and an account resets for free. So many tiny trades, or a
 * reset after every loss, paid Paper with no skill at all (fan-out audit,
 * 2026-11-13). Now an account is paid only for new highs of its realized
 * profit: what it is owed is its profit in hundreds of dollars, less what the
 * ledger shows it was already paid. A reset zeroes the profit but not the
 * ledger, so a reset account earns again only past its old best. On top of
 * that, no one takes more than FAKEOUT_DAILY_CAP Paper from FakeOut in a day.
 *
 * One payout per person at a time (the API is one process), so two closes
 * finishing together cannot both see the same "already paid".
 */

export const FAKEOUT_DAILY_CAP = 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

type Db = {
  paperAccount: { findUnique: (a: any) => Promise<any> };
  paperPosition: { findMany: (a: any) => Promise<Array<{ id: string }>> };
  paperTransaction: { aggregate: (a: any) => Promise<{ _sum: { amount: number | null } }> };
};

type Award = (
  userId: string,
  type: string,
  amount: number,
  description: string,
  refId?: string,
) => Promise<{ balance: number } | null>;

const queues = new Map<string, Promise<unknown>>();

function oneAtATime<T>(key: string, job: () => Promise<T>): Promise<T> {
  const before = queues.get(key) ?? Promise.resolve();
  const run = before.catch(() => undefined).then(job);
  const tail = run.catch(() => undefined);
  queues.set(key, tail);
  void tail.then(() => {
    if (queues.get(key) === tail) queues.delete(key);
  });
  return run;
}

/** What this account is owed now, before the daily cap. Pure, for tests. */
export function fakeoutOwed(realizedPnl: number, multiplier: number, alreadyPaid: number): number {
  if (!Number.isFinite(realizedPnl) || realizedPnl <= 0) return 0;
  const earned = Math.floor(realizedPnl / 100) * multiplier;
  return Math.max(0, earned - Math.max(0, alreadyPaid || 0));
}

/** Pay whatever the account is owed. Returns the Paper paid (0 if none). */
export function payFakeoutProfit(
  deps: { db: Db; awardPaper: Award; now?: () => number },
  userId: string,
  accountId: string,
  multiplier: number,
  description: string,
): Promise<number> {
  return oneAtATime(userId, async () => {
    const account = await deps.db.paperAccount.findUnique({
      where: { id: accountId },
      select: { userId: true, realizedPnl: true, competitionId: true },
    });
    if (!account || account.userId !== userId || account.competitionId) return 0;
    const positions = await deps.db.paperPosition.findMany({
      where: { accountId },
      select: { id: true },
    });
    // Earlier payouts named the position; newer ones name the account.
    const refs = [accountId, ...positions.map((p) => p.id)];
    const paid = await deps.db.paperTransaction.aggregate({
      where: { userId, type: "EARN_FAKEOUT", refId: { in: refs } },
      _sum: { amount: true },
    });
    let owed = fakeoutOwed(account.realizedPnl, multiplier, paid._sum.amount ?? 0);
    if (owed <= 0) return 0;
    const since = new Date((deps.now?.() ?? Date.now()) - DAY_MS);
    const today = await deps.db.paperTransaction.aggregate({
      where: { userId, type: "EARN_FAKEOUT", createdAt: { gte: since } },
      _sum: { amount: true },
    });
    owed = Math.min(owed, FAKEOUT_DAILY_CAP - (today._sum.amount ?? 0));
    if (owed <= 0) return 0;
    const r = await deps.awardPaper(userId, "EARN_FAKEOUT", owed, description, accountId);
    return r ? owed : 0;
  });
}

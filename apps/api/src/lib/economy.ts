import { prisma } from "./prisma";

// Server-authoritative Paper economy primitive. Race-safe atomic credit/debit:
// the WHERE guard re-checks the balance on the locked row INSIDE the transaction
// so concurrent debits can never overdraft, and the double-entry PaperTransaction
// ledger row is written in the same transaction. Returns null when a debit would
// overdraft (caller treats as "insufficient"). Shared by the API (index.ts) and
// the integration tests so both exercise identical money code.
export async function awardPaper(
  userId: string,
  type: string,
  amount: number,
  description: string,
  refId?: string,
): Promise<{ balance: number } | null> {
  try {
    return await prisma.$transaction(async (tx) => {
      const upd = await tx.user.updateMany({
        where: amount < 0 ? { id: userId, paper: { gte: -amount } } : { id: userId },
        data: { paper: { increment: amount } },
      });
      if (upd.count === 0) return null;
      const fresh = await tx.user.findUnique({ where: { id: userId }, select: { paper: true } });
      const newBalance = (fresh as any)?.paper ?? 0;
      await (tx as any).paperTransaction.create({
        data: { userId, type, amount, balance: newBalance, description, refId: refId || null },
      });
      return { balance: newBalance };
    });
  } catch (e) {
    console.error("[paper] awardPaper error:", e);
    return null;
  }
}

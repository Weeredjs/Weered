import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";

// /paper/* — wallet, tip, daily bonus. The awardPaper helper is the
// single chokepoint for all Paper movement (it lives in main() because
// many other modules call it too); routes here just compose it.
type Opts = {
  authFromHeader: (h?: string) => { id: string; name?: string } | null;
  awardPaper: (userId: string, type: string, amount: number, description: string, refId?: string) => Promise<{ balance: number } | null>;
};

export default async function paperRoutes(app: FastifyInstance, opts: Opts) {
  const { authFromHeader, awardPaper } = opts;
  const TIP_MIN = 1;
  const TIP_MAX = 100_000;

  app.post("/paper/tip", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const body: any = (req as any).body || {};
    const toUsername = String(body.toUsername || "").trim();
    const amount = Math.floor(Number(body.amount) || 0);
    const note = String(body.note || "").trim().slice(0, 200);
    if (!toUsername) return reply.code(400).send({ ok: false, error: "recipient_required" });
    if (amount < TIP_MIN) return reply.code(400).send({ ok: false, error: "amount_too_low", message: `Minimum tip is ${TIP_MIN} Paper.` });
    if (amount > TIP_MAX) return reply.code(400).send({ ok: false, error: "amount_too_high", message: `Maximum tip is ${TIP_MAX.toLocaleString()} Paper.` });

    try {
      const recipient = await prisma.user.findFirst({
        where: { name: { equals: toUsername, mode: "insensitive" } },
        select: { id: true, name: true },
      });
      if (!recipient) return reply.code(404).send({ ok: false, error: "recipient_not_found", message: `No user named @${toUsername}.` });
      if (recipient.id === u.id) return reply.code(400).send({ ok: false, error: "cannot_self_tip" });

      const debit = await awardPaper(u.id, "SPEND_GIFT", -amount, `Tip to ${recipient.name}${note ? ` · ${note}` : ""}`, recipient.id);
      if (!debit) return reply.code(400).send({ ok: false, error: "insufficient_paper" });

      const credit = await awardPaper(recipient.id, "EARN_GIFT", amount, `Tip from ${u.name || u.id}${note ? ` · ${note}` : ""}`, u.id);
      if (!credit) {
        await awardPaper(u.id, "ADJUSTMENT", amount, "Tip refund (credit failed)").catch(() => {});
        return reply.code(500).send({ ok: false, error: "credit_failed" });
      }

      return reply.send({
        ok: true,
        recipient: { id: recipient.id, name: recipient.name },
        amount,
        balance: debit.balance,
      });
    } catch (e) {
      console.error("[paper/tip]", e);
      return reply.code(500).send({ ok: false, error: "tip_failed" });
    }
  });

  app.get("/paper/wallet", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });

    const user = await prisma.user.findUnique({ where: { id: u.id }, select: { paper: true } });
    const txns = await (prisma as any).paperTransaction.findMany({
      where: { userId: u.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return reply.send({
      ok: true,
      balance: (user as any)?.paper || 0,
      transactions: txns.map((t: any) => ({ ...t, createdAt: t.createdAt?.toISOString() })),
    });
  });

  app.post("/paper/daily", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });

    const lastDaily = await (prisma as any).paperTransaction.findFirst({
      where: { userId: u.id, type: "EARN_DAILY" },
      orderBy: { createdAt: "desc" },
    });

    if (lastDaily) {
      const since = Date.now() - new Date(lastDaily.createdAt).getTime();
      if (since < 86400000) {
        const nextAt = new Date(new Date(lastDaily.createdAt).getTime() + 86400000);
        return reply.send({ ok: false, error: "cooldown", nextAt: nextAt.toISOString() });
      }
    }

    const result = await awardPaper(u.id, "EARN_DAILY", 25, "Daily login bonus");
    if (!result) return reply.send({ ok: false, error: "failed" });
    return reply.send({ ok: true, awarded: 25, balance: result.balance });
  });
}

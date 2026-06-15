import { log } from "../lib/logger";
import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";
import { z } from "zod";

type Opts = {
  authFromHeader: (h?: string) => { id: string; name?: string } | null;
  awardPaper: (
    userId: string,
    type: string,
    amount: number,
    description: string,
    refId?: string,
  ) => Promise<{ balance: number } | null>;
};

export default async function paperRoutes(app: FastifyInstance, opts: Opts) {
  const { authFromHeader, awardPaper } = opts;
  const TIP_MIN = 1;
  const TIP_MAX = 100_000;

  app.post(
    "/paper/tip",
    {
      schema: {
        tags: ["paper"],
        summary: "Tip Paper to another user",
        body: z
          .object({
            toUsername: z.string().min(1).max(64),
            amount: z.coerce.number(),
            note: z.string().max(2000).optional().nullable(),
          })
          .passthrough(),
      },
    },
    async (req, reply) => {
      const u = authFromHeader((req as any).headers?.authorization);
      if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
      const body: any = (req as any).body || {};
      const toUsername = String(body.toUsername || "").trim();
      const amount = Math.floor(Number(body.amount) || 0);
      const note = String(body.note || "")
        .trim()
        .slice(0, 200);
      if (!toUsername) return reply.code(400).send({ ok: false, error: "recipient_required" });
      if (amount < TIP_MIN)
        return reply
          .code(400)
          .send({
            ok: false,
            error: "amount_too_low",
            message: `Minimum tip is ${TIP_MIN} Paper.`,
          });
      if (amount > TIP_MAX)
        return reply
          .code(400)
          .send({
            ok: false,
            error: "amount_too_high",
            message: `Maximum tip is ${TIP_MAX.toLocaleString()} Paper.`,
          });

      try {
        const recipient = await prisma.user.findFirst({
          where: { name: { equals: toUsername, mode: "insensitive" } },
          select: { id: true, name: true },
        });
        if (!recipient)
          return reply
            .code(404)
            .send({
              ok: false,
              error: "recipient_not_found",
              message: `No user named @${toUsername}.`,
            });
        if (recipient.id === u.id)
          return reply.code(400).send({ ok: false, error: "cannot_self_tip" });

        const result = await prisma.$transaction(async (tx) => {
          const deb = await tx.user.updateMany({
            where: { id: u.id, paper: { gte: amount } },
            data: { paper: { decrement: amount } },
          });
          if (deb.count === 0) return { ok: false as const, balance: 0 };
          const sender = await tx.user.findUnique({ where: { id: u.id }, select: { paper: true } });
          const senderBal = (sender as any)?.paper ?? 0;
          await tx.paperTransaction.create({
            data: {
              userId: u.id,
              type: "SPEND_GIFT",
              amount: -amount,
              balance: senderBal,
              description: `Tip to ${recipient.name}${note ? ` · ${note}` : ""}`,
              refId: recipient.id,
            },
          });
          await tx.user.update({
            where: { id: recipient.id },
            data: { paper: { increment: amount } },
          });
          const recip = await tx.user.findUnique({
            where: { id: recipient.id },
            select: { paper: true },
          });
          const recipBal = (recip as any)?.paper ?? 0;
          await tx.paperTransaction.create({
            data: {
              userId: recipient.id,
              type: "EARN_GIFT",
              amount,
              balance: recipBal,
              description: `Tip from ${u.name || u.id}${note ? ` · ${note}` : ""}`,
              refId: u.id,
            },
          });
          return { ok: true as const, balance: senderBal };
        });
        if (!result.ok) return reply.code(400).send({ ok: false, error: "insufficient_paper" });

        return reply.send({
          ok: true,
          recipient: { id: recipient.id, name: recipient.name },
          amount,
          balance: result.balance,
        });
      } catch (e) {
        log.error("[paper/tip]", e);
        return reply.code(500).send({ ok: false, error: "tip_failed" });
      }
    },
  );

  app.get("/paper/wallet", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });

    const user = await prisma.user.findUnique({ where: { id: u.id }, select: { paper: true } });
    const txns = await prisma.paperTransaction.findMany({
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

    // Atomic 24h claim: only one request can flip lastDailyAt within the window,
    // so concurrent calls cannot double-claim the bonus.
    const DAY = 86400000;
    const claimed = await prisma.user.updateMany({
      where: {
        id: u.id,
        OR: [{ lastDailyAt: null }, { lastDailyAt: { lt: new Date(Date.now() - DAY) } }],
      },
      data: { lastDailyAt: new Date() },
    });
    if (claimed.count === 0) {
      const cur = await prisma.user.findUnique({
        where: { id: u.id },
        select: { lastDailyAt: true },
      });
      const last = (cur as any)?.lastDailyAt
        ? new Date((cur as any).lastDailyAt).getTime()
        : Date.now();
      return reply.send({
        ok: false,
        error: "cooldown",
        nextAt: new Date(last + DAY).toISOString(),
      });
    }

    const result = await awardPaper(u.id, "EARN_DAILY", 25, "Daily login bonus");
    if (!result) {
      await prisma.user
        .updateMany({ where: { id: u.id }, data: { lastDailyAt: null } })
        .catch(() => {});
      return reply.send({ ok: false, error: "failed" });
    }
    return reply.send({ ok: true, awarded: 25, balance: result.balance });
  });
}

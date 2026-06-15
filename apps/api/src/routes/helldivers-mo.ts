import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";
import { z } from "zod";
import { getHelldiversSteamPlayers } from "../helldiversWorker";

type Opts = {
  authFromHeader: (h?: string) => { id: string; name: string } | null;
  awardPaper?: (userId: string, type: string, amount: number, description: string, refId?: string) => Promise<any>;
  awardNotoriety?: (userId: string, action: string) => Promise<number | null>;
};

export default async function helldiversMoRoutes(app: FastifyInstance, opts: Opts) {
  const { authFromHeader, awardPaper, awardNotoriety } = opts;

  app.get("/helldivers/steam-players", async (_req, reply) => {
    const r = await getHelldiversSteamPlayers();
    return reply.send(r);
  });

  app.post("/helldivers/major-orders/:moId/claim", {
    schema: { tags: ["helldivers"], params: z.object({ moId: z.string().min(1) }) },
  }, async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const moId = String((req as any).params?.moId || "");
    if (!moId) return reply.code(400).send({ ok: false, error: "missing_mo_id" });

    // Anti-cheat: only Steam-linked accounts (who can actually play Helldivers 2)
    // may claim Major Order rewards. Without this gate ANY account could farm
    // every active MO's reward with a self-report and no participation.
    const claimant = await prisma.user.findUnique({ where: { id: u.id }, select: { steamId: true } });
    if (!claimant?.steamId) {
      return reply.code(403).send({ ok: false, error: "steam_required", message: "Link your Steam account to claim Helldivers Major Order rewards." });
    }

    const externalRef = `hd2:mo:${moId}`;
    const def = await prisma.challengeDefinition.findFirst({
      where: { kind: "MAJOR_ORDER", externalRef },
    });
    if (!def) return reply.code(404).send({ ok: false, error: "challenge_not_found" });

    const inst = await prisma.challengeInstance.findFirst({
      where: { definitionId: def.id, status: "ACTIVE" },
      orderBy: { createdAt: "desc" },
    });
    if (!inst) return reply.code(404).send({ ok: false, error: "no_active_instance" });

    const existing = await prisma.challengeEnrollment.findUnique({
      where: { instanceId_userId: { instanceId: inst.id, userId: u.id } },
    }).catch(() => null);
    if (existing && existing.status === "COMPLETED") {
      return reply.send({ ok: true, alreadyClaimed: true });
    }

    const now = new Date();
    if (existing) {
      await prisma.challengeEnrollment.update({
        where: { id: existing.id },
        data: {
          status: "COMPLETED",
          completedAt: now,
          progress: { self_report: { current: 1, target: 1, completed: true } },
        },
      });
    } else {
      await prisma.challengeEnrollment.create({
        data: {
          instanceId: inst.id,
          userId: u.id,
          status: "COMPLETED",
          completedAt: now,
          progress: { self_report: { current: 1, target: 1, completed: true } },
        },
      });
    }

    try {
      if (def.paperReward && awardPaper) {
        await awardPaper(u.id, "CHALLENGE_REWARD", Number(def.paperReward), `Helldivers 2 Major Order: ${moId}`, def.id);
      }
      // Route notoriety through the central awardNotoriety (ledgered notorietyEvent
      // + atomic increment + rank-up notifications) instead of a raw, unledgered
      // prisma.user.update increment. Per-MO idempotency is held by the enrollment
      // COMPLETED guard above, so the fixed-50 HD2_MAJOR_ORDER action fires once
      // per user per MO.
      if (def.notorietyReward && awardNotoriety) {
        await awardNotoriety(u.id, "HD2_MAJOR_ORDER");
      }
    } catch (e) {
      console.warn("[helldivers-mo] payout failed", (e as any)?.message);
    }

    return reply.send({
      ok: true,
      paper: def.paperReward,
      notoriety: def.notorietyReward,
    });
  });
}

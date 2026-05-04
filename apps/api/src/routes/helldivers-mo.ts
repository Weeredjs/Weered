/**
 * Helldivers 2 — Slice D auxiliary routes
 *
 *   POST /helldivers/major-orders/:moId/claim   self-report participation
 *   GET  /helldivers/steam-players              cached Steam concurrent players
 *
 * Kept separate from routes/helldivers.ts (owned by Slice A).
 */

import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";
import { getHelldiversSteamPlayers } from "../helldiversWorker";

type Opts = {
  authFromHeader: (h?: string) => { id: string; name: string } | null;
  // (userId, type, amount, description, refId?) — matches index.ts awardPaper
  awardPaper?: (userId: string, type: string, amount: number, description: string, refId?: string) => Promise<any>;
};

export default async function helldiversMoRoutes(app: FastifyInstance, opts: Opts) {
  const { authFromHeader, awardPaper } = opts;

  app.get("/helldivers/steam-players", async (_req, reply) => {
    const r = await getHelldiversSteamPlayers();
    return reply.send(r);
  });

  // Self-report participation in a Major Order. We record a
  // ChallengeEnrollment against the active MO instance and pay out once.
  app.post("/helldivers/major-orders/:moId/claim", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const moId = String((req as any).params?.moId || "");
    if (!moId) return reply.code(400).send({ ok: false, error: "missing_mo_id" });

    const externalRef = `hd2:mo:${moId}`;
    const def = await (prisma as any).challengeDefinition.findFirst({
      where: { kind: "MAJOR_ORDER", externalRef },
    });
    if (!def) return reply.code(404).send({ ok: false, error: "challenge_not_found" });

    // Active instance — most recent
    const inst = await (prisma as any).challengeInstance.findFirst({
      where: { definitionId: def.id, status: "ACTIVE" },
      orderBy: { createdAt: "desc" },
    });
    if (!inst) return reply.code(404).send({ ok: false, error: "no_active_instance" });

    // Already claimed?
    const existing = await (prisma as any).challengeEnrollment.findUnique({
      where: { instanceId_userId: { instanceId: inst.id, userId: u.id } },
    }).catch(() => null);
    if (existing && existing.status === "COMPLETED") {
      return reply.send({ ok: true, alreadyClaimed: true });
    }

    const now = new Date();
    if (existing) {
      await (prisma as any).challengeEnrollment.update({
        where: { id: existing.id },
        data: {
          status: "COMPLETED",
          completedAt: now,
          progress: { self_report: { current: 1, target: 1, completed: true } },
        },
      });
    } else {
      await (prisma as any).challengeEnrollment.create({
        data: {
          instanceId: inst.id,
          userId: u.id,
          status: "COMPLETED",
          completedAt: now,
          progress: { self_report: { current: 1, target: 1, completed: true } },
        },
      });
    }

    // Pay out — best-effort; if the helpers aren't wired the DB still records
    // the completion and admins can reconcile.
    try {
      if (def.paperReward && awardPaper) {
        await awardPaper(u.id, "CHALLENGE_REWARD", Number(def.paperReward), `Helldivers 2 Major Order: ${moId}`, def.id);
      }
      if (def.notorietyReward) {
        // Direct increment — awardNotoriety in index.ts is action-keyed and
        // not exposed for ad-hoc grants. Audit via the enrollment record.
        await prisma.user.update({
          where: { id: u.id },
          data: { notoriety: { increment: Number(def.notorietyReward) } },
        }).catch(() => {});
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

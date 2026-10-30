// The front desk (James 2026-10-30: "Full reception area and digital
// offices"). A visitor rings the Front desk block on a lobby's Home
// (apps/web/components/lobby-design/FrontDeskBlock.tsx) and the lobby's
// owner and staff (moderators and up) get a notification that links to the
// room the visitor waits in. Registered from routes/lobbies.ts.
import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";
import { createNotification } from "../lib/notifications";

type Deps = {
  authFromHeader: (h?: string) => { id: string; name: string } | null;
};

/** One ring a minute per visitor per lobby. */
const RING_GAP_MS = 60_000;
const MAX_STAFF = 25;
const lastRing = new Map<string, number>();

export function hasFrontDesk(layout: unknown): boolean {
  const blocks = layout && typeof layout === "object" ? (layout as any).blocks : null;
  return Array.isArray(blocks) && blocks.some((b: any) => b?.type === "frontdesk");
}

export function registerFrontDesk(app: FastifyInstance, { authFromHeader }: Deps) {
  app.post("/lobbies/:id/ring", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const lobbyId = String((req.params as any).id || "");
    const lobby = await prisma.lobby.findUnique({
      where: { id: lobbyId },
      select: { id: true, name: true, ownerId: true, layout: true },
    });
    // Only a lobby with a front desk on its Home takes rings.
    if (!lobby || !hasFrontDesk(lobby.layout))
      return reply.code(404).send({ ok: false, error: "no_front_desk" });
    const ban = await prisma.lobbyBan.findUnique({
      where: { lobbyId_userId: { lobbyId, userId: u.id } },
      select: { id: true },
    });
    if (ban) return reply.code(403).send({ ok: false, error: "banned" });

    const key = `${lobbyId}:${u.id}`;
    const now = Date.now();
    const last = lastRing.get(key) || 0;
    if (now - last < RING_GAP_MS)
      return reply.code(429).send({
        ok: false,
        error: "rang_recently",
        retryInSec: Math.ceil((RING_GAP_MS - (now - last)) / 1000),
      });
    lastRing.set(key, now);
    if (lastRing.size > 5000) {
      for (const [k, t] of lastRing) if (now - t > RING_GAP_MS) lastRing.delete(k);
    }

    // The room they wait in, when it really is one of this lobby's.
    const body = ((req as any).body || {}) as any;
    const roomId = typeof body.roomId === "string" ? body.roomId.slice(0, 64) : "";
    const room = roomId
      ? await prisma.room.findUnique({
          where: { id: roomId },
          select: { lobbyId: true, name: true },
        })
      : null;
    const waitIn = room && room.lobbyId === lobbyId ? { id: roomId, name: room.name || "" } : null;

    const staff = await prisma.lobbyMember.findMany({
      where: { lobbyId, roleLevel: { gte: 3 } },
      select: { userId: true },
      orderBy: { roleLevel: "desc" },
      take: MAX_STAFF,
    });
    const to = new Set(staff.map((s: { userId: string }) => s.userId));
    if (lobby.ownerId) to.add(lobby.ownerId);
    to.delete(u.id);

    const me = await prisma.user.findUnique({ where: { id: u.id }, select: { name: true } });
    const who = me?.name || u.name || "Someone";
    const where = lobby.name || lobbyId;
    await Promise.all(
      [...to].map((userId) =>
        createNotification({
          userId,
          type: "SYSTEM",
          title: `🛎 ${who} is at the front desk`,
          body: waitIn ? `${where} · waiting in ${waitIn.name}` : where,
          actionUrl: waitIn ? `/room/${waitIn.id}` : `/lobby/${lobbyId}`,
          actorId: u.id,
          actorName: who,
          meta: { kind: "frontdesk", lobbyId, roomId: waitIn?.id || null },
        }),
      ),
    );
    return reply.send({ ok: true, notified: to.size });
  });
}

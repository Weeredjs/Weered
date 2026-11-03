import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";
import { swallow } from "../lib/logger";
import { isStaffRole } from "../lib/lobbyAuth";
import { deleteLobby, HOLD_DAYS, restoreLobby } from "../lib/lobbyDelete";

// Deleting a lobby (lib/lobbyDelete.ts, James 2026-11-02).
//   POST /lobbies/:id/admin/delete { confirm }  the owner, typing its name
//   GET  /staff/lobbies/deleted                 staff: what's held, and until when
//   POST /staff/lobbies/:id/delete { reason }   staff: an abandoned or abusive lobby
//   POST /staff/lobbies/:id/restore             staff: within the 30 days
export default async function lobbyDeleteRoutes(
  app: FastifyInstance,
  opts: {
    authFromHeader: (h?: string) => { id: string; name: string } | null;
    getGlobalRole: (userId: string) => Promise<any>;
  },
) {
  const { authFromHeader, getGlobalRole } = opts;
  const staffAudit = (
    actor: { id: string; name: string },
    action: string,
    id: string,
    meta?: any,
  ) =>
    prisma.globalAudit
      .create({
        data: {
          actorId: actor.id,
          actorName: actor.name,
          action,
          targetId: id,
          targetName: id,
          meta,
        },
      })
      .catch(swallow);

  app.post("/lobbies/:id/admin/delete", async (req, reply) => {
    const u = authFromHeader((req.headers as any).authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const id = String((req.params as any).id || "");
    const lobby = await prisma.lobby.findUnique({
      where: { id },
      select: { name: true, ownerId: true, deletedAt: true },
    });
    if (!lobby || lobby.deletedAt)
      return reply
        .code(404)
        .send({ ok: false, error: "not_found", message: "That lobby doesn't exist." });
    // The owner only: a moderator or admin can't delete it, and staff use Ops.
    if (lobby.ownerId !== u.id)
      return reply
        .code(403)
        .send({ ok: false, error: "owner_only", message: "Only the lobby's owner can delete it." });
    const typed = String(((req as any).body || {}).confirm || "")
      .trim()
      .toLowerCase();
    if (typed !== (lobby.name || "").trim().toLowerCase() && typed !== id.toLowerCase())
      return reply.code(400).send({
        ok: false,
        error: "confirm_name",
        message: "Type the lobby's name exactly to confirm.",
      });
    const r = await deleteLobby(id, { id: u.id, name: u.name });
    if (!r.ok) return reply.code(r.error === "paying_members" ? 409 : 404).send(r);
    return reply.send({ ok: true, heldDays: HOLD_DAYS });
  });

  const staff = async (req: any, reply: any) => {
    const u = authFromHeader(req.headers?.authorization);
    if (!u) {
      reply.code(401).send({ ok: false, error: "unauthorized" });
      return null;
    }
    // Staff, not Support: Support moderates but doesn't delete (James 2026-11-01).
    if (!isStaffRole(await getGlobalRole(u.id))) {
      reply.code(403).send({ ok: false, error: "forbidden" });
      return null;
    }
    return u;
  };

  app.get("/staff/lobbies/deleted", async (req, reply) => {
    if (!(await staff(req, reply))) return;
    const rows = await prisma.lobby.findMany({
      where: { deletedAt: { not: null } },
      select: { id: true, name: true, ownerId: true, deletedAt: true, deletedById: true },
      orderBy: { deletedAt: "desc" },
      take: 200,
    });
    const ids = [
      ...new Set(rows.flatMap((r) => [r.ownerId, r.deletedById]).filter(Boolean)),
    ] as string[];
    const names = new Map(
      (
        await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } })
      ).map((x) => [x.id, x.name]),
    );
    return reply.send({
      ok: true,
      heldDays: HOLD_DAYS,
      lobbies: rows.map((r) => ({
        id: r.id,
        name: r.name,
        owner: (r.ownerId && names.get(r.ownerId)) || null,
        deletedBy: (r.deletedById && names.get(r.deletedById)) || null,
        deletedAt: r.deletedAt!.toISOString(),
        erasedAt: new Date(r.deletedAt!.getTime() + HOLD_DAYS * 24 * 3600_000).toISOString(),
      })),
    });
  });

  app.post("/staff/lobbies/:id/delete", async (req, reply) => {
    const u = await staff(req, reply);
    if (!u) return;
    const id = String((req.params as any).id || "");
    const reason = String(((req as any).body || {}).reason || "").slice(0, 300);
    const r = await deleteLobby(id, u, reason ? `by staff: ${reason}` : "by staff");
    if (!r.ok) return reply.code(r.error === "paying_members" ? 409 : 404).send(r);
    await staffAudit(u, "lobby_delete", id, reason ? { reason } : undefined);
    return reply.send({ ok: true, heldDays: HOLD_DAYS });
  });

  app.post("/staff/lobbies/:id/restore", async (req, reply) => {
    const u = await staff(req, reply);
    if (!u) return;
    const id = String((req.params as any).id || "");
    const r = await restoreLobby(id, u);
    if (!r.ok) return reply.code(404).send(r);
    await staffAudit(u, "lobby_restore", id);
    return reply.send({ ok: true });
  });
}

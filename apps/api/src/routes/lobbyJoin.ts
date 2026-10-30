// Joining a lobby: the join itself (through the front door when the lobby
// has one, lib/lobbyDoor.ts), leaving, the join-request queue owners review,
// and the join mode. Split out of routes/lobbies.ts, which registers it.
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { logLobbyAudit } from "../lib/lobbyAudit";
import { passDoor, readDoor, type DoorEntry } from "../lib/lobbyDoor";

type Deps = {
  authFromHeader: (h?: string) => { id: string; name: string } | null;
  lobbyAdminAccess: (req: any, reply: any, requiredLevel: number) => Promise<any>;
};

export function registerLobbyJoin(
  app: FastifyInstance,
  { authFromHeader, lobbyAdminAccess }: Deps,
) {
  app.post(
    "/lobbies/:id/join",
    {
      schema: { tags: ["lobbies"], params: z.object({ id: z.string().min(1) }) },
    },
    async (req, reply) => {
      const lobbyId = (req.params as any).id as string;
      const u = authFromHeader((req as any).headers?.authorization);
      if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });

      const lobby = await prisma.lobby.findUnique({
        where: { id: lobbyId },
        select: { id: true, joinMode: true, joinPassword: true, name: true, layout: true },
      });
      if (!lobby) return reply.code(404).send({ ok: false, error: "not_found" });

      const ban = await prisma.lobbyBan.findUnique({
        where: { lobbyId_userId: { lobbyId, userId: u.id } },
      });
      if (ban)
        return reply
          .code(403)
          .send({ ok: false, error: "banned", message: "You are banned from this lobby." });

      const existing = await prisma.lobbyMember.findUnique({
        where: { lobbyId_userId: { lobbyId, userId: u.id } },
      });
      if (existing)
        return reply.send({
          ok: true,
          already: true,
          role: existing.role,
          roleLevel: existing.roleLevel,
        });

      const body = (req.body || {}) as any;
      const mode = lobby.joinMode || "OPEN";

      if (mode === "PAID") {
        return reply.code(403).send({
          ok: false,
          error: "paid_required",
          message: "Subscribe to a lobby tier to join.",
        });
      }

      if (mode === "PASSWORD") {
        const pw = String(body.password || "").trim();
        if (!pw || pw !== lobby.joinPassword) {
          return reply
            .code(403)
            .send({ ok: false, error: "wrong_password", message: "Incorrect lobby password." });
        }
      }

      // The front door (lib/lobbyDoor.ts): rules accepted, questions answered,
      // 18+ confirmed, the account old enough. The answers go with the
      // membership, or with the request for an owner to read.
      const door = readDoor(lobby.layout);
      let doorEntry: DoorEntry | undefined;
      if (door) {
        const acct = await prisma.user.findUnique({
          where: { id: u.id },
          select: { createdAt: true },
        });
        const pass = passDoor(door, body, acct?.createdAt ?? null);
        if (!pass.ok)
          return reply.code(403).send({ ok: false, error: pass.error, message: pass.message });
        doorEntry = pass.entry;
      }

      if (mode === "APPROVAL") {
        const existingReq = await prisma.lobbyJoinRequest.findUnique({
          where: { lobbyId_userId: { lobbyId, userId: u.id } },
        });
        if (existingReq) {
          if (existingReq.status === "PENDING") return reply.send({ ok: true, pending: true });
          if (existingReq.status === "DENIED") {
            await prisma.lobbyJoinRequest.update({
              where: { id: existingReq.id },
              data: {
                status: "PENDING",
                message: String(body.message || "").slice(0, 500),
                answers: (doorEntry as any) ?? Prisma.DbNull,
                reviewedAt: null,
                reviewedById: null,
                reviewedByName: null,
                denyReason: null,
              },
            });
            return reply.send({ ok: true, pending: true, resubmitted: true });
          }
        }
        const user = await prisma.user.findUnique({ where: { id: u.id }, select: { name: true } });
        await prisma.lobbyJoinRequest.create({
          data: {
            lobbyId,
            userId: u.id,
            userName: user?.name || u.name || "Unknown",
            message: String(body.message || "").slice(0, 500),
            ...(doorEntry ? { answers: doorEntry as any } : {}),
          },
        });
        return reply.send({ ok: true, pending: true });
      }

      const user = await prisma.user.findUnique({ where: { id: u.id }, select: { name: true } });
      const member = await prisma.lobbyMember.create({
        data: {
          lobbyId,
          userId: u.id,
          name: user?.name || u.name || "Unknown",
          role: "MEMBER",
          roleLevel: 1,
          ...(doorEntry ? { door: doorEntry as any } : {}),
        },
      });

      await logLobbyAudit({
        lobbyId,
        type: "member_join",
        actorId: u.id,
        actorName: user?.name || "Unknown",
        note: `Joined lobby (${mode})`,
      });

      return reply.send({ ok: true, role: member.role, roleLevel: member.roleLevel });
    },
  );

  app.post(
    "/lobbies/:id/leave",
    {
      schema: { tags: ["lobbies"], params: z.object({ id: z.string().min(1) }) },
    },
    async (req, reply) => {
      const lobbyId = (req.params as any).id as string;
      const u = authFromHeader((req as any).headers?.authorization);
      if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });

      const member = await prisma.lobbyMember.findUnique({
        where: { lobbyId_userId: { lobbyId, userId: u.id } },
        select: { id: true, role: true, roleLevel: true },
      });
      if (!member) return reply.code(404).send({ ok: false, error: "not_a_member" });

      if (member.roleLevel >= 5) {
        return reply.code(403).send({
          ok: false,
          error: "owner_cannot_leave",
          message: "Transfer ownership before leaving.",
        });
      }

      await prisma.lobbyMember.delete({ where: { id: member.id } });

      await prisma.lobbyTierSub.updateMany({
        where: { lobbyId, userId: u.id, status: "active" },
        data: { status: "canceled", cancelAtPeriodEnd: true },
      });

      const user = await prisma.user.findUnique({ where: { id: u.id }, select: { name: true } });
      await logLobbyAudit({
        lobbyId,
        type: "member_leave",
        actorId: u.id,
        actorName: user?.name || "Unknown",
        note: "Left lobby",
      });

      return reply.send({ ok: true });
    },
  );

  app.get("/lobbies/:id/admin/join-requests", async (req, reply) => {
    const ctx = await lobbyAdminAccess(req, reply, 3);
    if (!ctx) return;
    const requests = await prisma.lobbyJoinRequest.findMany({
      where: { lobbyId: ctx.lobby.id },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return reply.send({ ok: true, requests });
  });

  app.post(
    "/lobbies/:id/admin/join-requests/:reqId/approve",
    {
      schema: {
        tags: ["lobbies"],
        params: z.object({ id: z.string().min(1), reqId: z.string().min(1) }),
      },
    },
    async (req, reply) => {
      const ctx = await lobbyAdminAccess(req, reply, 3);
      if (!ctx) return;
      const reqId = (req.params as any).reqId as string;
      const jr = await prisma.lobbyJoinRequest.findUnique({ where: { id: reqId } });
      if (!jr || jr.lobbyId !== ctx.lobby.id)
        return reply.code(404).send({ ok: false, error: "not_found" });
      if (jr.status !== "PENDING")
        return reply.code(400).send({ ok: false, error: "already_reviewed" });

      // Staff reviewing a lobby they don't belong to have no membership row.
      const reviewerId = ctx.member?.userId ?? ctx.user.id;
      const reviewerName = ctx.member?.name ?? ctx.user.name ?? "Staff";
      await prisma.lobbyJoinRequest.update({
        where: { id: reqId },
        data: {
          status: "APPROVED",
          reviewedById: reviewerId,
          reviewedByName: reviewerName,
          reviewedAt: new Date(),
        },
      });
      await prisma.lobbyMember.create({
        data: {
          lobbyId: ctx.lobby.id,
          userId: jr.userId,
          name: jr.userName,
          role: "MEMBER",
          roleLevel: 1,
          // What they told the front door comes with them.
          ...(jr.answers ? { door: jr.answers as any } : {}),
        },
      });

      await logLobbyAudit({
        lobbyId: ctx.lobby.id,
        type: "join_request_approved",
        actorId: reviewerId,
        actorName: reviewerName,
        note: `Approved join request from ${jr.userName}`,
      });

      return reply.send({ ok: true });
    },
  );

  app.post(
    "/lobbies/:id/admin/join-requests/:reqId/deny",
    {
      schema: {
        tags: ["lobbies"],
        params: z.object({ id: z.string().min(1), reqId: z.string().min(1) }),
      },
    },
    async (req, reply) => {
      const ctx = await lobbyAdminAccess(req, reply, 3);
      if (!ctx) return;
      const reqId = (req.params as any).reqId as string;
      const jr = await prisma.lobbyJoinRequest.findUnique({ where: { id: reqId } });
      if (!jr || jr.lobbyId !== ctx.lobby.id)
        return reply.code(404).send({ ok: false, error: "not_found" });
      if (jr.status !== "PENDING")
        return reply.code(400).send({ ok: false, error: "already_reviewed" });

      const body = (req.body || {}) as any;
      await prisma.lobbyJoinRequest.update({
        where: { id: reqId },
        data: {
          status: "DENIED",
          reviewedById: ctx.member?.userId ?? ctx.user.id,
          reviewedByName: ctx.member?.name ?? ctx.user.name ?? "Staff",
          reviewedAt: new Date(),
          denyReason: String(body.reason || "").slice(0, 500) || null,
        },
      });

      await logLobbyAudit({
        lobbyId: ctx.lobby.id,
        type: "join_request_denied",
        actorId: ctx.member?.userId ?? ctx.user.id,
        actorName: ctx.member?.name ?? ctx.user.name ?? "Staff",
        note: `Denied join request from ${jr.userName}`,
      });

      return reply.send({ ok: true });
    },
  );

  app.patch(
    "/lobbies/:id/admin/join-mode",
    {
      schema: { tags: ["lobbies"], params: z.object({ id: z.string().min(1) }) },
    },
    async (req, reply) => {
      const ctx = await lobbyAdminAccess(req, reply, 4);
      if (!ctx) return;
      const body = (req.body || {}) as any;
      const mode = String(body.joinMode || "OPEN");
      if (!["OPEN", "APPROVAL", "PASSWORD", "PAID"].includes(mode)) {
        return reply.code(400).send({ ok: false, error: "invalid_mode" });
      }
      const data: any = { joinMode: mode };
      if (mode === "PASSWORD") {
        const pw = String(body.password || "").trim();
        if (!pw) return reply.code(400).send({ ok: false, error: "password_required" });
        data.joinPassword = pw;
      } else {
        data.joinPassword = null;
      }
      await prisma.lobby.update({ where: { id: ctx.lobby.id }, data });

      await logLobbyAudit({
        lobbyId: ctx.lobby.id,
        type: "join_mode_changed",
        actorId: ctx.member?.userId ?? ctx.user.id,
        actorName: ctx.member?.name ?? ctx.user.name ?? "Staff",
        note: `Join mode set to ${mode}`,
      });

      return reply.send({ ok: true, joinMode: mode });
    },
  );
}

import type { FastifyInstance } from "fastify";
import jwt from "jsonwebtoken";
import { randomBytes } from "crypto";
import { prisma } from "../lib/prisma";
import { setAuthCookie } from "../lib/authCookie";
import { isOfficeRoom } from "../lib/officeRooms";
import { isStaffRole } from "../lib/lobbyAuth";
import { cleanDisplayName } from "../lib/displayName";

// A lobby's guest link (James 2026-11-01: "a very nice Microsoft Teams/Zoom"):
// someone without an account types a name and is in, as a guest of that one
// lobby, for the length of the link or 12 hours at most.
//
//   POST /auth/guest-lobby { inviteToken, name }
//
// The owner makes the link (a GUEST invite whose target is the lobby; routes/
// invites.ts lets only the owner). The session is a cookie like anyone's, but
// its token is scoped: lib/guestScope.ts lets it into that lobby's rooms only,
// and index.ts lets it read but not change anything over HTTP. The ECEB
// office's guests are a different flow (routes/auth.ts /auth/guest, the foyer).
const GUEST_HOURS_MAX = 12;

export default async function guestJoinRoutes(app: FastifyInstance, opts: { JWT_SECRET: string }) {
  const { JWT_SECRET } = opts;

  app.post(
    "/auth/guest-lobby",
    { config: { rateLimit: { max: 30, timeWindow: "1 hour" } } },
    async (req, reply) => {
      const body: any = (req as any).body || {};
      const inviteToken = String(body.inviteToken || "").trim();
      if (!inviteToken) return reply.code(400).send({ ok: false, error: "missing_invite" });
      // A guest can't come in as the Operator or as Weered (lib/displayName.ts).
      const name = await cleanDisplayName(body.name);
      if (name === null)
        return reply.code(400).send({
          ok: false,
          error: "name_reserved",
          message: "That name is kept for Weered. Type your own.",
        });
      if (name.length < 2)
        return reply
          .code(400)
          .send({ ok: false, error: "name_required", message: "Type the name people will see." });

      const invite = await prisma.invite.findUnique({ where: { token: inviteToken } });
      if (!invite || invite.type !== "GUEST" || !invite.targetId || isOfficeRoom(invite.targetId))
        return reply.code(404).send({ ok: false, error: "invalid_invite" });
      if (invite.expiresAt && invite.expiresAt.getTime() < Date.now())
        return reply
          .code(410)
          .send({ ok: false, error: "expired", message: "This link has expired." });
      const lobby = await prisma.lobby.findUnique({
        where: { id: invite.targetId },
        select: { id: true, ownerId: true },
      });
      if (!lobby) return reply.code(404).send({ ok: false, error: "invalid_invite" });
      // The link works only while its maker still owns the lobby (or is staff).
      const maker = await prisma.user.findUnique({
        where: { id: invite.createdBy },
        select: { globalRole: true },
      });
      if (lobby.ownerId !== invite.createdBy && !isStaffRole(maker?.globalRole))
        return reply
          .code(403)
          .send({ ok: false, error: "invite_revoked", message: "This link no longer works." });

      const used = await prisma.invite.updateMany({
        where:
          invite.maxUses > 0
            ? { token: inviteToken, uses: { lt: invite.maxUses } }
            : { token: inviteToken },
        data: { uses: { increment: 1 } },
      });
      if (used.count !== 1)
        return reply
          .code(410)
          .send({ ok: false, error: "exhausted", message: "This link is full." });

      const cap = Date.now() + GUEST_HOURS_MAX * 3600_000;
      const expMs = invite.expiresAt ? Math.min(invite.expiresAt.getTime(), cap) : cap;
      const ttlSec = Math.max(60, Math.floor((expMs - Date.now()) / 1000));
      const user = await prisma.user.create({
        data: {
          usernameKey: `guest_${randomBytes(12).toString("hex")}`,
          name,
          isGuest: true,
          guestExpiresAt: new Date(expMs),
        },
        select: { id: true, name: true },
      });
      const token = jwt.sign(
        { sub: user.id, name: user.name, guest: true, scope: { lobby: lobby.id } },
        JWT_SECRET,
        { expiresIn: ttlSec },
      );
      setAuthCookie(reply, token);
      return reply.send({
        ok: true,
        lobbyId: lobby.id,
        expiresIn: ttlSec,
        user: { id: user.id, name: user.name, isGuest: true },
      });
    },
  );
}

import type { FastifyInstance } from "fastify";
import { randomBytes } from "node:crypto";
import { prisma } from "../lib/prisma";

type RoomEntry = { users: Map<string, any>; name?: string; lobbyId?: string; thumbnail?: string };

type Opts = {
  rooms: Map<string, RoomEntry>;
  verifyToken: (token: string) => { id: string; name: string } | null;
};

function newOverlayToken(): string {
  return randomBytes(18).toString("base64url");
}

function authedUserId(req: any, verifyToken: Opts["verifyToken"]): string | null {
  const token = String((req.headers.authorization || "").replace("Bearer ", "").trim());
  if (!token) return null;
  const u = verifyToken(token);
  return u?.id || null;
}

export default async function overlayRoutes(app: FastifyInstance, opts: Opts) {
  const { rooms, verifyToken } = opts;
  const db = prisma as any;

  app.get("/me/overlay", async (req, reply) => {
    const userId = authedUserId(req, verifyToken);
    if (!userId) return reply.code(401).send({ error: "Unauthorized" });
    const u = await db.user.findUnique({ where: { id: userId }, select: { overlayToken: true } });
    return reply.send({ ok: true, token: u?.overlayToken || null });
  });

  app.post("/me/overlay/token/rotate", async (req, reply) => {
    const userId = authedUserId(req, verifyToken);
    if (!userId) return reply.code(401).send({ error: "Unauthorized" });
    let token = newOverlayToken();
    for (let i = 0; i < 4; i++) {
      const clash = await db.user.findUnique({ where: { overlayToken: token }, select: { id: true } });
      if (!clash) break;
      token = newOverlayToken();
    }
    await db.user.update({ where: { id: userId }, data: { overlayToken: token } });
    return reply.send({ ok: true, token });
  });

  app.delete("/me/overlay/token", async (req, reply) => {
    const userId = authedUserId(req, verifyToken);
    if (!userId) return reply.code(401).send({ error: "Unauthorized" });
    await db.user.update({ where: { id: userId }, data: { overlayToken: null } });
    return reply.send({ ok: true });
  });

  app.get("/public/overlay/:token", async (req: any, reply) => {
    const token = String(req.params?.token || "").trim();
    if (!token || token.length < 8) return reply.code(404).send({ ok: false, error: "Not found" });
    const user = await db.user.findUnique({
      where: { overlayToken: token },
      select: {
        id: true, name: true, usernameKey: true, avatar: true, avatarColor: true,
        tier: true, globalRole: true, banned: true,
      },
    });
    if (!user || user.banned) return reply.code(404).send({ ok: false, error: "Not found" });

    let found: { roomId: string; room: RoomEntry; isAway: boolean } | null = null;
    for (const [rid, rs] of rooms) {
      const entry = (rs.users as Map<string, any>)?.get?.(user.id);
      if (entry) {
        found = { roomId: rid, room: rs, isAway: Boolean((entry as any).isAway) };
        break;
      }
    }

    const userOut = {
      name: user.name || user.usernameKey,
      avatar: user.avatar || null,
      avatarColor: user.avatarColor || null,
      tier: user.tier,
    };

    reply.header("Cache-Control", "no-store");

    if (!found) {
      return reply.send({ ok: true, online: false, user: userOut });
    }

    const { roomId, room, isAway } = found;
    const roomCount = (room.users as Map<string, any>)?.size ?? 0;

    const lobbyIdHint = (room as any).lobbyId || (roomId.startsWith("lobby:") ? roomId.slice(6) : null);
    let lobby: any = null;
    if (lobbyIdHint) {
      lobby = await db.lobby.findUnique({
        where: { id: lobbyIdHint },
        select: { id: true, name: true, accentColor: true, logoUrl: true, moduleType: true, verified: true },
      });
    } else {
      const guess = await db.lobby.findUnique({
        where: { id: roomId },
        select: { id: true, name: true, accentColor: true, logoUrl: true, moduleType: true, verified: true },
      });
      if (guess) lobby = guess;
    }

    const isLobbyRoot = !!lobby && (lobby.id === roomId || `lobby:${lobby.id}` === roomId);
    const joinUrl = lobby ? `https://weered.ca/lobby/${lobby.id}` : `https://weered.ca/`;

    return reply.send({
      ok: true,
      online: true,
      isAway,
      user: userOut,
      lobby: lobby ? {
        id: lobby.id,
        name: lobby.name,
        accentColor: lobby.accentColor || "#D9A942",
        logoUrl: lobby.logoUrl || null,
        moduleType: lobby.moduleType || null,
        verified: !!lobby.verified,
      } : null,
      room: {
        id: roomId,
        name: room.name || (lobby?.name ?? "a room"),
        isLobbyRoot,
        count: roomCount,
      },
      joinUrl,
    });
  });
}

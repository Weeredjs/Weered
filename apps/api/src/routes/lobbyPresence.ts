import type { FastifyInstance } from "fastify";
import { isAIAvailable, OPERATOR_PRESENCE } from "../lib/roomState";
import { lobbyLevelOf } from "../lib/lobbyAccess";

// GET /lobbies/:lobbyId/presence: who is online in a lobby, for its member
// sidebar and the home page counts. Split out of routes/lobbies.ts (the file
// size tripwire), unchanged apart from the hidden-room rule it carries.
type Deps = {
  authFromHeader: (h?: string) => { id: string; name: string } | null;
  getGlobalRole: (userId: string) => Promise<any>;
  canAccessStaff: (role: any) => boolean;
  rooms: Map<string, any>;
};

export function registerLobbyPresence(app: FastifyInstance, deps: Deps) {
  const { authFromHeader, getGlobalRole, canAccessStaff, rooms } = deps;

  app.get("/lobbies/:lobbyId/presence", async (req, reply) => {
    const lobbyId = String((req as any).params?.lobbyId || "");
    if (!lobbyId) return reply.code(400).send({ ok: false, error: "missing lobbyId" });

    // Someone in a room the viewer could not enter still shows as online in the
    // lobby, but not WHERE (audit 2026-09-27: this unauthenticated list placed
    // people inside the vOCN staff room, which every other listing hides).
    const viewer = authFromHeader((req as any).headers?.authorization);
    const viewerLevel = !viewer
      ? 0
      : canAccessStaff(await getGlobalRole(viewer.id))
        ? Number.POSITIVE_INFINITY
        : await lobbyLevelOf(viewer.id, lobbyId).catch(() => 0);
    const seen = new Map<string, any>();
    for (const [, room] of rooms) {
      if (room.lobbyId !== lobbyId) continue;
      const placeHidden =
        (Number(room.minLevel) || 0) > viewerLevel || Boolean(room.locked || room.passwordHash);
      for (const [uid, u] of room.users) {
        if (!seen.has(uid)) {
          seen.set(uid, {
            id: uid,
            name: u.name,
            role: u.role,
            // Rank in this lobby (1..5) — the client turns it into a title and
            // icon via the lobby's roleNames/roleIcons.
            lobbyRoleLevel: u.lobbyRoleLevel ?? null,
            globalRole: u.globalRole,
            tier: u.tier,
            avatarColor: u.avatarColor,
            avatar: u.avatar,
            isAway: Boolean(u.isAway),
            steamId: u.steamId,
            twitchLogin: u.twitchLogin,
            xboxGamertag: u.xboxGamertag,
            livePresence: u.livePresence ?? null,
            pillBgColor: u.pillBgColor ?? null,
            pillAccentColor: u.pillAccentColor ?? null,
            statusText: u.statusText ?? null,
            statusEmoji: u.statusEmoji ?? null,
            nameEffect: u.nameEffect ?? null,
            avatarFrame: u.avatarFrame ?? null,
            roomId: placeHidden ? null : room.roomId,
            roomName: placeHidden ? null : room.name || room.roomId,
          });
        }
      }
    }

    const users = Array.from(seen.values());
    // The Operator (AI) is an always-on presence — matches the WS presence:state,
    // so anon viewers see it too and the lobby never reads as fully empty.
    if (isAIAvailable() && !seen.has("operator")) {
      users.push({ ...OPERATOR_PRESENCE, isAway: false });
    }
    // `count` included for consumers that only need the headline number
    // (home/page.tsx reads it; omitting it silently zeroed home live counts).
    return reply.send({ ok: true, count: users.length, users });
  });
}

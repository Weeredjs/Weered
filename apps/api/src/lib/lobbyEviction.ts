import { leaveRoom } from "./roomState";
import { removeFromVoice } from "./livekitAdmin";

/**
 * Take a user out of a lobby's live rooms after a kick, ban or demotion.
 *
 * Room.minLevel and LobbyBan are checked when someone JOINS. The admin routes
 * only changed LobbyMember/LobbyBan rows, so a member already inside a gated
 * room kept reading and posting there for as long as their tab stayed open:
 * proven 2026-09-26 with a kicked-then-banned crew member still chatting in the
 * vOCN crew lounge. This closes the gap for sockets that are already in.
 *
 * `allowedLevel`:
 *   null   = remove from EVERY room of the lobby (a ban),
 *   number = remove from rooms whose minLevel is above it (kick = 0, demote = new level).
 *
 * Returns how many sockets were removed.
 */
export function evictFromLobbyRooms(opts: {
  rooms: Map<string, any>;
  send: (ws: any, event: any) => void;
  lobbyId: string;
  userId: string;
  allowedLevel: number | null;
  reason: "lobby_banned" | "lobby_kicked" | "level_required";
}): number {
  const { rooms, send, lobbyId, userId, allowedLevel, reason } = opts;
  let removed = 0;
  for (const [roomId, room] of rooms) {
    // A lobby's rooms, plus its own chat container (the room whose id IS the lobby id).
    if (room?.lobbyId !== lobbyId && roomId !== lobbyId) continue;
    const minLevel = Number(room.minLevel) || 0;
    if (allowedLevel !== null && minLevel <= allowedLevel) continue;
    for (const s of [...room.sockets]) {
      if (s?.user?.id !== userId) continue;
      try {
        send(s, { type: "room:denied", roomId, reason, minLevel: minLevel || undefined });
      } catch {
        /* the socket may already be closing */
      }
      leaveRoom(s);
      removed++;
    }
    // Voice outlives navigation: the user can be in this room's call while their
    // socket is elsewhere, so remove them from every affected room's call.
    void removeFromVoice(roomId, userId);
  }
  return removed;
}

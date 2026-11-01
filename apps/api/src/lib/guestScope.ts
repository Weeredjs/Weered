import { prisma } from "./prisma";
import { isOfficeRoom, scopeAllows } from "./officeRooms";

/**
 * Where a guest (or an office host) may go.
 *
 * - An office guest is scoped to an office namespace (lib/officeRooms.ts).
 * - A lobby guest came in on that lobby's guest link (routes/guestJoin.ts,
 *   James 2026-11-01: clients join a business's lobby without an account).
 *   They may enter its own chat and its rooms, never an office room or
 *   another lobby's.
 *
 * Pass the room's lobby when it's already loaded. Otherwise it's read from the
 * database, so an id that isn't a room yet is never in scope (a guest can't
 * create rooms by naming them).
 */
export async function guestMayEnter(
  user: { scope?: any } | null | undefined,
  roomId: string,
  roomLobbyId?: string | null,
): Promise<boolean> {
  const scope = (user && user.scope) || {};
  if (scope.lobby) {
    const lob = String(scope.lobby);
    if (!roomId || isOfficeRoom(roomId)) return false;
    if (roomId === lob) return true;
    const lid =
      roomLobbyId !== undefined
        ? roomLobbyId
        : (
            await prisma.room
              .findUnique({ where: { id: roomId }, select: { lobbyId: true } })
              .catch(() => null)
          )?.lobbyId;
    return lid === lob;
  }
  return scopeAllows(String(scope.office || ""), roomId);
}

/** Is this a lobby guest (from a lobby's guest link), as opposed to an office one? */
export const isLobbyGuest = (decoded: any) => !!(decoded?.guest && decoded?.scope?.lobby);

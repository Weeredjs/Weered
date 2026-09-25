import { prisma } from "./prisma";
import { isStaffUser } from "./isStaffUser";
import { swallow } from "./logger";

/**
 * A user's effective level inside a lobby: 5 for its owner, the LobbyMember
 * level for a member, 0 for anyone else.
 *
 * The owner case is not redundant. POST /lobbies sets only `lobby.ownerId` and
 * never writes a LobbyMember row, and /claim upserts one at the default level 1
 * — so reading LobbyMember alone would lock an owner out of their own staff
 * room. Staff are NOT folded in here; callers decide how staff are treated.
 */
export async function lobbyLevelOf(userId: string, lobbyId: string): Promise<number> {
  const [lobby, m] = await Promise.all([
    prisma.lobby.findUnique({ where: { id: lobbyId }, select: { ownerId: true } }),
    prisma.lobbyMember.findUnique({
      where: { lobbyId_userId: { lobbyId, userId } },
      select: { roleLevel: true },
    }),
  ]);
  if (lobby?.ownerId === userId) return 5;
  return m ? Math.max(1, m.roleLevel ?? 1) : 0;
}

/**
 * May this user enter a room gated at `minLevel` (Room.minLevel)?
 *
 * Fails CLOSED: a guest, a room with no lobby, or any lookup error is a no.
 * That is deliberately the opposite of the role-icon lookup in doJoin, which
 * fails open because a missing icon is cosmetic and a leaked staff room is not.
 */
export async function canEnterGatedRoom(
  user: { id?: string; guest?: boolean; host?: boolean } | null | undefined,
  lobbyId: string | null | undefined,
  minLevel: number,
): Promise<boolean> {
  if (!minLevel || minLevel <= 0) return true;
  if (!user?.id || user.guest || user.host || !lobbyId) return false;
  try {
    if (await isStaffUser(user.id)) return true;
    return (await lobbyLevelOf(user.id, lobbyId)) >= minLevel;
  } catch (e) {
    swallow(e);
    return false;
  }
}

/** Can this user run a lobby's tools: staff, the lobby's owner, or a member
 *  at Moderator (3) or above. The same test the RCON link uses. */
export async function canManageLobby(userId: string, lobbyId: string): Promise<boolean> {
  try {
    if (await isStaffUser(userId)) return true;
    const lobby = await prisma.lobby.findUnique({
      where: { id: lobbyId },
      select: { ownerId: true },
    });
    if (lobby?.ownerId === userId) return true;
    const m = await prisma.lobbyMember.findUnique({
      where: { lobbyId_userId: { lobbyId, userId } },
      select: { roleLevel: true },
    });
    return (m?.roleLevel || 0) >= 3;
  } catch (e) {
    swallow(e);
    return false;
  }
}

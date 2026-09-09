import { prisma } from "./prisma";
import { isStaffUser } from "./isStaffUser";
import { swallow } from "./logger";

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

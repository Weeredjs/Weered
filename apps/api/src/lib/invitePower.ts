import { prisma } from "./prisma";
import { canAssignRoles, getGlobalRole } from "./lobbyAuth";
import { lobbyLevelOf } from "./lobbyAccess";
import { gateOf, isPlaceId } from "../routes/places";

/**
 * Who may hand out an invite into a lobby, a room or a crew (red team
 * 2026-11-01, finding 2). Anyone used to be able to mint one for any target and
 * accept it themselves, walking past passwords, approval and paid doors.
 *
 * An invite lets its holder skip the lock, so making one takes the power to
 * let people in:
 * - staff, a lobby's owner, or a moderator (level 3 and up);
 * - a room's owner;
 * - a crew's leader or officers.
 * An ordinary member may invite only where anyone can walk in anyway, and a
 * paid lobby's door is the owner's alone. The check runs again when the invite
 * is used, so an invite dies with its maker's rights.
 */
export async function canInvite(
  type: string,
  targetId: string | null,
  userId: string,
): Promise<boolean> {
  if (type === "PLATFORM") return true;
  if (!targetId) return false;
  if (canAssignRoles(await getGlobalRole(userId))) return true;

  if (type === "LOBBY") {
    const lobby = await prisma.lobby.findUnique({
      where: { id: targetId },
      select: { ownerId: true, joinMode: true, moduleConfig: true },
    });
    if (!lobby) return false;
    if (lobby.ownerId === userId) return true;
    if (lobby.joinMode === "PAID" && !isPlaceId(targetId)) return false;
    const level = await lobbyLevelOf(userId, targetId);
    if (level >= 3) return true;
    const open = isPlaceId(targetId) ? gateOf(lobby) === "anyone" : lobby.joinMode === "OPEN";
    return level >= 1 && open;
  }

  if (type === "ROOM") {
    const room = await prisma.room.findUnique({
      where: { id: targetId },
      select: { ownerId: true, lobbyId: true },
    });
    if (!room) return false;
    if (room.ownerId === userId) return true;
    return !!room.lobbyId && (await lobbyLevelOf(userId, room.lobbyId)) >= 3;
  }

  if (type === "CREW") {
    const m = await prisma.crewMember.findUnique({
      where: { crewId_userId: { crewId: targetId, userId } },
      select: { role: true },
    });
    return m?.role === "LEADER" || m?.role === "OFFICER";
  }

  return false;
}

/** An invite that can still be used for this target: right type, not expired,
 *  not used up, and its maker still allowed to make it. */
export async function usableInvite(token: string, type: string, targetId: string) {
  const invite = await prisma.invite.findUnique({ where: { token } });
  if (!invite || invite.type !== type || invite.targetId !== targetId) return null;
  if (invite.expiresAt && invite.expiresAt < new Date()) return null;
  if (invite.maxUses > 0 && invite.uses >= invite.maxUses) return null;
  if (!(await canInvite(type, targetId, invite.createdBy))) return null;
  return invite;
}

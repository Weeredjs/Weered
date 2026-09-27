import { prisma } from "./prisma";
import { isStaffUser } from "./isStaffUser";
import { canEnterGatedRoom, canManageLobby } from "./lobbyAccess";
import { swallow } from "./logger";

/**
 * Room checks for HTTP routes that act on a room by id.
 *
 * doJoin checks three things before a socket enters a room: the room exists,
 * its minLevel gate lets the user in, and its lobby has not banned them. Routes
 * that take `/rooms/:roomId/...` skipped all three: the 2026-09-26 audit created
 * NPCs in the vOCN staff room and seized DM of a campaign in vocn-training as a
 * stranger. These helpers give those routes the same answer doJoin gives.
 */

export type AccessRoom = {
  id: string;
  lobbyId: string | null;
  minLevel: number;
  ownerId: string | null;
  defaultModule: string | null;
  disabledModules: string[];
};

const ROOM_SELECT = {
  id: true,
  lobbyId: true,
  minLevel: true,
  ownerId: true,
  defaultModule: true,
  disabledModules: true,
} as const;

/** The room, if this user may be inside it; null otherwise. Fails closed. */
export async function roomIfEnterable(
  roomId: string,
  user: { id: string; guest?: boolean } | null | undefined,
): Promise<AccessRoom | null> {
  if (!user?.id || !roomId) return null;
  try {
    const room = await prisma.room.findUnique({ where: { id: roomId }, select: ROOM_SELECT });
    if (!room) return null;
    if (room.lobbyId) {
      const ban = await prisma.lobbyBan.findUnique({
        where: { lobbyId_userId: { lobbyId: room.lobbyId, userId: user.id } },
        select: { id: true },
      });
      if (ban && !(await isStaffUser(user.id))) return null;
    }
    if (!(await canEnterGatedRoom(user, room.lobbyId, room.minLevel || 0))) return null;
    return room;
  } catch (e) {
    swallow(e);
    return null;
  }
}

/**
 * Reads of a room's content. Rooms with no gate stay readable by anyone, as
 * before; a gated room needs a user who may enter it.
 */
export async function mayReadRoom(
  roomId: string,
  user: { id: string; guest?: boolean } | null | undefined,
): Promise<boolean> {
  try {
    const room = await prisma.room.findUnique({
      where: { id: roomId },
      select: { minLevel: true },
    });
    if (!room || !(room.minLevel > 0)) return true;
    return (await roomIfEnterable(roomId, user)) !== null;
  } catch (e) {
    swallow(e);
    return false;
  }
}

/** The room's owner, a moderator (3+) of its lobby, or global staff. */
export async function managesRoom(room: AccessRoom, userId: string): Promise<boolean> {
  if (room.ownerId && room.ownerId === userId) return true;
  if (room.lobbyId) return canManageLobby(userId, room.lobbyId); // staff included
  return isStaffUser(userId);
}

/** Is this user the DM of the campaign bound to the room? */
export async function isCampaignDm(roomId: string, userId: string): Promise<boolean> {
  const c = await prisma.campaign
    .findFirst({ where: { roomId, dmUserId: userId }, select: { id: true } })
    .catch(() => null);
  return !!c;
}

/**
 * May this user start the room's campaign and become its DM?
 *
 * The tavern rule stays: in a D&D room nobody owns (the D&D lobby's rooms, or a
 * room whose stage opens on D&D), whoever christens the first campaign is DM.
 * Anywhere else it takes someone who already runs the room.
 */
export async function mayStartCampaign(room: AccessRoom, userId: string): Promise<boolean> {
  if (room.disabledModules?.includes("dnd")) return false;
  if (await managesRoom(room, userId)) return true;
  if (room.ownerId) return false;
  if (room.defaultModule === "dnd") return true;
  if (!room.lobbyId) return false;
  const lobby = await prisma.lobby
    .findUnique({ where: { id: room.lobbyId }, select: { moduleType: true } })
    .catch(() => null);
  return String(lobby?.moduleType || "") === "DND";
}

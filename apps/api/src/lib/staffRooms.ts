import { prisma } from "./prisma";
import { lobbyLevelOf } from "./lobbyAccess";

/**
 * The staff-only chat rooms, and who may enter them (2026-11-01 ops audit: no
 * join path checked either, so any signed-in member could join `@ops`, read the
 * last 80 staff messages and post, and `@admin-<lobby>` was open the same way).
 *
 * - `@ops`: Weered's own staff, SUPPORT and up.
 * - `@admin-<lobby>`: that lobby's moderators and up (level 3+), or Weered's
 *   staff, who moderate everywhere.
 *
 * The role is read from the database, not the socket's copy, so a demotion
 * takes effect at once.
 */
const GLOBAL_STAFF = ["SUPPORT", "STAFF", "ADMIN", "GOD"];

export function isStaffRoomId(roomId: string): boolean {
  return roomId === "@ops" || roomId.startsWith("@admin-");
}

export async function mayEnterStaffRoom(
  userId: string | undefined,
  roomId: string,
): Promise<boolean> {
  if (!isStaffRoomId(roomId)) return true;
  if (!userId) return false;
  const u = await prisma.user
    .findUnique({ where: { id: userId }, select: { globalRole: true } })
    .catch(() => null);
  if (GLOBAL_STAFF.includes(String(u?.globalRole || ""))) return true;
  if (roomId === "@ops") return false;
  const lobbyId = roomId.slice("@admin-".length);
  if (!lobbyId) return false;
  return (await lobbyLevelOf(userId, lobbyId).catch(() => 0)) >= 3;
}

import { prisma } from "./prisma";
import { isStaffRoomId } from "./staffRooms";

/**
 * What a room is, from its id. A lobby's own chat is stored as a nameless room
 * keyed by the lobby's id; each lobby's admin chat is "@admin-<lobby>" (older
 * ones "<lobby>/admin"); "@ops" is staff chat. The ops Rooms tab listed these
 * as "(unnamed)" with a one-click Delete that erased the lobby's whole chat
 * history (ops audit 2026-11-01).
 */
export type RoomKind = "ops" | "admin" | "lobby" | "room";

export function roomKind(id: string, isLobby: boolean): RoomKind {
  if (id === "@ops") return "ops";
  if (isStaffRoomId(id) || id.endsWith("/admin")) return "admin";
  if (isLobby || id === "lobby") return "lobby";
  return "room";
}

/** Rooms that belong to a lobby or to staff: never deleted or closed from ops. */
export async function isProtectedRoom(id: string): Promise<boolean> {
  if (id === "lobby" || id === "@ops" || isStaffRoomId(id) || id.endsWith("/admin")) return true;
  const lobby = await prisma.lobby
    .findUnique({ where: { id }, select: { id: true } })
    .catch(() => null);
  return !!lobby;
}

/**
 * Office (consult) rooms: the professional side of Weered, where ECEB meets
 * clients.
 *
 * They were identified by the bare "mtg-" prefix, but "mtg" is also the Magic:
 * The Gathering lobby, whose rooms are mtg-library, mtg-brew and so on. Found
 * 2026-09-27: every Magic room was treated as a private consult (refused to
 * members, force-locked), and worse, a guest scoped to the Magic lobby matched
 * every consult room by prefix. An office is now an exact namespace.
 */
export const OFFICE_NAMESPACES = ["mtg-eceb"] as const;

/** The office namespace this room belongs to, or null for an ordinary room. */
export function officeOf(roomId: string): string | null {
  const id = String(roomId || "");
  for (const ns of OFFICE_NAMESPACES) if (id === ns || id.startsWith(ns + "-")) return ns;
  return null;
}

export function isOfficeRoom(roomId: string): boolean {
  return officeOf(roomId) !== null;
}

/**
 * May a guest (or office host) whose token is scoped to `scope` enter `roomId`?
 * The room must sit inside the scope, and an office room is reachable only from
 * a scope inside that same office: a lobby-scoped guest never reaches a consult
 * room, whatever the lobby happens to be called.
 */
export function scopeAllows(scope: string, roomId: string): boolean {
  const s = String(scope || "");
  const id = String(roomId || "");
  if (!s || !id) return false;
  if (!(id === s || id.startsWith(s + "-"))) return false;
  return officeOf(id) === officeOf(s);
}

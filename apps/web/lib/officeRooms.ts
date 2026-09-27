// Office (consult) rooms: ECEB's side of Weered. Mirrors
// apps/api/src/lib/officeRooms.ts. An office is an exact namespace, not the bare
// "mtg-" prefix: "mtg" is also the Magic: The Gathering lobby, and its rooms
// (mtg-library, mtg-brew...) were getting the office skin and office stage.
export const OFFICE_NAMESPACES = ["mtg-eceb"] as const;

export function isOfficeRoomId(roomId: string): boolean {
  const id = String(roomId || "");
  return OFFICE_NAMESPACES.some((ns) => id === ns || id.startsWith(ns + "-"));
}

/** True on /room/<office room>, whatever follows the id. */
export function isOfficeRoomPath(pathname: string): boolean {
  const p = String(pathname || "");
  if (!p.startsWith("/room/")) return false;
  const id = p.slice("/room/".length).split("/")[0].split("?")[0].split("#")[0];
  let clean = id;
  try {
    clean = decodeURIComponent(id);
  } catch {}
  return isOfficeRoomId(clean);
}

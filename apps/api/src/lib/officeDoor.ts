// The office door (James 2026-11-12: "Have it like a space people can walk
// into. I am here all day so it isn't crazy").
//
// A consult room is born locked (lib/roomState.ts): a client's plan on screen
// is confidential, and nobody may walk into someone else's meeting. The
// walk-in office keeps that and adds one rule: with the host's Walk-ins switch
// on, its door is open while no visitor is in with the host, and it closes
// behind the first one to walk in. When the last visitor leaves, it opens
// again. Walk-ins off (or never set): everyone knocks, always. Every other
// consult room stays locked.
import { readFileSync } from "fs";

export const WALKIN_OFFICE = "mtg-eceb-office";

/** The office's hours and switches (routes/office.ts writes it). */
export const officeStateFile = () =>
  process.env.OFFICE_STATE_FILE || "/opt/weered/office-hours.json";

/** The host's Walk-ins switch. Off when unset or unreadable: everyone knocks. */
export function walkInsOn(file = officeStateFile()): boolean {
  try {
    return JSON.parse(readFileSync(file, "utf8"))?.walkIn === true;
  } catch {
    return false;
  }
}

/** Visitors seated in the room; the host and office staff aren't visitors. */
export function guestsIn(room: { users?: Map<string, any> } | null | undefined): number {
  const users = room?.users;
  if (!users || typeof users.values !== "function") return 0;
  return Array.from(users.values()).filter((u: any) => !!u?.isGuest).length;
}

/** Locked unless this is the walk-in office, walk-ins are on, and nobody's in with the host. */
export function doorShouldBeLocked(
  roomId: string,
  room: { users?: Map<string, any> } | null | undefined,
  walkIn: boolean,
): boolean {
  if (roomId !== WALKIN_OFFICE) return true;
  return !walkIn || guestsIn(room) > 0;
}

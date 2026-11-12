// Guest deny-by-default (index.ts): a guest token works ONLY on these HTTP
// routes; every other one answers 403 guest_forbidden. Each route listed here
// re-checks the guest and its scope itself.
export const GUEST_ALLOWED_PATHS = new Set([
  "/auth/ws-ticket",
  "/auth/logout",
  "/voice/token",
  // Read-only: returns ONLY what the host explicitly presented to this guest's
  // office scope (route re-checks guest + scope). See routes/office.ts.
  "/office/plan/presented",
  // The office's note board (2026-11-12): a visitor reads the wall and their own
  // notes, and leaves James a note only he sees (routes/office.ts, lib/officeBoard.ts).
  // The end-to-end run on prod found visitors stopped here with an empty board.
  "/office/board",
]);

/** A visitor takes down a note of their own (the route checks it's theirs). */
const OWN_NOTE = /^\/office\/board\/[A-Za-z0-9_-]{1,64}$/;

export function guestMayCall(method: string, path: string, lobbyGuestRead: boolean): boolean {
  if (GUEST_ALLOWED_PATHS.has(path)) return true;
  if (String(method).toUpperCase() === "DELETE" && OWN_NOTE.test(path)) return true;
  return lobbyGuestRead;
}

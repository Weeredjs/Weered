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

/**
 * A host pass (the office's advisor link: scripts/host-link.sh, GET
 * /office/host-pass) is as narrow as a guest's. It works on the office's own
 * routes and on the three that let it into a room and out again; every other
 * route answers 403 host_forbidden. The pass names no account ("eceb-host"),
 * so on any other route it was a signed-in caller that nobody is, with no ban
 * or sign-out check behind it (hardening pass, 2026-11-13).
 */
export function hostMayCall(path: string): boolean {
  return (
    path === "/auth/ws-ticket" ||
    path === "/auth/logout" ||
    path === "/voice/token" ||
    path.startsWith("/office/")
  );
}

export function guestMayCall(method: string, path: string, lobbyGuestRead: boolean): boolean {
  if (GUEST_ALLOWED_PATHS.has(path)) return true;
  if (String(method).toUpperCase() === "DELETE" && OWN_NOTE.test(path)) return true;
  return lobbyGuestRead;
}

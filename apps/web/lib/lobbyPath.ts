// Which lobby a page address is inside.
//
// /lobby/<id> is a lobby, except the addresses the app keeps for itself: the
// builder lives at /lobby/create. The sidebars read the lobby out of the
// address on their own and didn't know that, so the builder page asked the API
// about a lobby called "create" and was told there isn't one (page sweep,
// hardening pass 2026-11-13). The provider did know, with its own copy of the
// list. This is the one place both read from now.

/** Addresses under /lobby/ that are the app's own pages, never a lobby. The
 *  API refuses to make a lobby with one of these (apps/api/src/lib/
 *  lobbyFields.ts holds the same list; a test there keeps the two in step). */
export const LOBBY_ROUTE_NAMES: readonly string[] = ["create", "admin", "settings"];

/** An address the builder can't have: one of the app's own, or a member's
 *  place ("u-…", made on its own page). */
export const isKeptAddress = (slug: string): boolean =>
  LOBBY_ROUTE_NAMES.includes(slug) || slug.startsWith("u-");

function decoded(seg: string): string {
  try {
    return decodeURIComponent(seg);
  } catch {
    return seg; // a broken escape: the text as it stands, never a thrown render
  }
}

/**
 * The lobby a page address names: "/lobby/vocn/admin" is "vocn".
 *
 * "" for "/lobby" itself, the main lobby's page. null where the address isn't
 * a lobby's at all: any other page, or one of the app's own under /lobby/.
 */
export function lobbyInPath(pathname: string | null | undefined): string | null {
  const m = /^\/lobby(?:\/([^/]*))?(?:\/|$)/.exec(pathname || "");
  if (!m) return null;
  const seg = (m[1] || "").trim();
  if (!seg) return "";
  if (LOBBY_ROUTE_NAMES.includes(seg)) return null;
  return decoded(seg);
}

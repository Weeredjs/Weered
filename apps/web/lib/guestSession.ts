// A guest: someone in on a lobby's guest link, with no account (api
// routes/guestJoin.ts, James 2026-11-01). They can look round that lobby, chat
// and talk, but change nothing, so the app shows them the lobby alone: no rails
// (components/ShellGate.tsx) and nothing they'd press only to be refused.
//
// <html data-weered-guest> carries it, set before paint by app/layout.tsx and
// kept current by components/ThemeRestore.tsx. Anything marked data-guest-hide
// stays out of a guest's way, and data-guest-only shows to guests alone
// (styles/55-auth.css).

/** Is this browser's session a guest's? */
export function isGuestSession(): boolean {
  try {
    return !!JSON.parse(localStorage.getItem("weered_user") || "null")?.isGuest;
  } catch {
    return false;
  }
}

/** Mark <html> for a guest, or clear the mark. */
export function markGuest(): void {
  try {
    const d = document.documentElement;
    if (isGuestSession()) d.setAttribute("data-weered-guest", "1");
    else d.removeAttribute("data-weered-guest");
  } catch {}
}

/** Where a guest's lobby id is kept while they're in (set on joining, app/invite). */
export const GUEST_LOBBY_KEY = "weered_guest_lobby";

/** The lobby this guest is visiting: from the address when they're on its page,
 *  else what was kept when they joined. */
export function guestLobbyId(pathname: string | null | undefined): string {
  const m = String(pathname || "").match(/^\/lobby\/([^/?#]+)/);
  if (m) {
    try {
      return decodeURIComponent(m[1]);
    } catch {
      return m[1];
    }
  }
  try {
    return localStorage.getItem(GUEST_LOBBY_KEY) || "";
  } catch {
    return "";
  }
}

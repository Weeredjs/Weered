// Where someone was headed when they left to sign up with Google or Discord.
// The form's own sign-up carries ?next= through; the two buttons at its top
// left the site and came back to /home, so a friend invited to a lobby who
// signed up with Google never arrived in it (found in the 2026-11-12 review).
// Kept for this tab only, used once.
import { isSitePath } from "./shellLayout";

const KEY = "weered_after_auth";

/** Before leaving for Google or Discord. /home is the default: nothing to keep. */
export function rememberAfterAuth(path: string): void {
  try {
    if (path && path !== "/home" && isSitePath(path)) sessionStorage.setItem(KEY, path);
    else sessionStorage.removeItem(KEY);
  } catch {}
}

/** Back from them: that place, once, or the fallback. Only ever a path on this site. */
export function takeAfterAuth(fallback = "/home"): string {
  try {
    const p = sessionStorage.getItem(KEY) || "";
    sessionStorage.removeItem(KEY);
    return p && isSitePath(p) ? p : fallback;
  } catch {
    return fallback;
  }
}

/** The sign-up door for someone who pressed Join on a lobby while signed out. */
export function joinSignupPath(lobbyId: string): string {
  const back = `/lobby/${encodeURIComponent(lobbyId)}?join=1`;
  return `/login?mode=register&next=${encodeURIComponent(back)}`;
}

/** The way to the builder. Signed out, /lobby/create itself says "Welcome back,
 *  sign in", so a stranger is sent to Create account, headed for the builder. */
export function builderPath(): string {
  let signedIn = false;
  try {
    signedIn = !!localStorage.getItem("weered_user");
  } catch {}
  return signedIn ? "/lobby/create" : "/login?mode=register&next=%2Flobby%2Fcreate";
}

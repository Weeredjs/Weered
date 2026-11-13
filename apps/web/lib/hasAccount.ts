// Is someone with an account signed in on this browser? The session itself is
// an httpOnly cookie the page can't read, so this is the remembered user the
// sign-in pages write. A guest in on a lobby's guest link has no account.
//
// For calls that only an account can make (a balance, a paid tier): a
// signed-out visitor's page used to make them anyway and be refused, a red
// line in the console on every lobby (page sweep, hardening pass 2026-11-12).
export function hasAccount(): boolean {
  try {
    const u = JSON.parse(localStorage.getItem("weered_user") || "null");
    return !!u?.id && !u.isGuest;
  } catch {
    return false;
  }
}

// Who is signed in on this browser? The session itself is an httpOnly cookie
// the page can't read, so this is the remembered user the sign-in pages write.
// A guest in on a lobby's guest link is remembered too, and has no account.
//
// For calls that only an account can make (a balance, a paid tier, a rap
// sheet, the staff desk): a signed-out visitor's page used to make them anyway
// and be refused, a red line in the console each time (page sweeps, hardening
// pass 2026-11-12 and 13).
export function whoIsHere(): "account" | "guest" | "nobody" {
  try {
    const u = JSON.parse(localStorage.getItem("weered_user") || "null");
    if (!u?.id) return "nobody";
    return u.isGuest ? "guest" : "account";
  } catch {
    return "nobody";
  }
}

/** Is someone with an account signed in on this browser? */
export const hasAccount = (): boolean => whoIsHere() === "account";

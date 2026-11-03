"use client";

// A browser that remembers a sign-in the API no longer honours: the 7-day
// session ran out, the password was reset, the account was deleted, a guest
// pass ended. The site kept saying "Hey, name" over an empty chat, and Sign in
// bounced back to /home, so Sign out was the only way back in (2026-11-03).
// Now one refused check forgets it and opens Sign in with the name filled in
// (the login page keeps "weered:returning").

/** Is the session cookie still good? null when the API can't say (offline,
 *  a lobby's own domain, where no session is ever read). */
export async function sessionAlive(api: string): Promise<boolean | null> {
  try {
    const r = await fetch(`${api}/auth/ws-ticket`, { credentials: "include" });
    if (r.ok) return true;
    return r.status === 401 ? false : null;
  } catch {
    return null;
  }
}

/** Forget the remembered sign-in, then Sign in (unless already there). */
export function forgetSession() {
  let guest = false;
  try {
    guest = !!JSON.parse(localStorage.getItem("weered_user") || "null")?.isGuest;
    localStorage.removeItem("weered_user");
    localStorage.removeItem("weered_token");
    document.documentElement.removeAttribute("data-weered-authed");
    document.documentElement.removeAttribute("data-weered-guest");
  } catch {}
  if (location.pathname === "/login") return;
  const why = guest ? "guest_ended" : "session_ended";
  const next = encodeURIComponent(location.pathname + location.search);
  location.replace(`/login?error=${why}&next=${next}`);
}

/**
 * Checks now, and again whenever an API call is refused (RightRail's
 * "weered:session-expired"); a refused session is forgotten after `onEnded`.
 * Returns the cleanup.
 */
export function watchSession(api: string, onEnded: () => void): () => void {
  let done = false;
  const check = () => {
    if (done) return;
    void sessionAlive(api).then((alive) => {
      if (alive !== false || done) return;
      done = true;
      onEnded();
      forgetSession();
    });
  };
  check();
  window.addEventListener("weered:session-expired", check);
  return () => {
    done = true;
    window.removeEventListener("weered:session-expired", check);
  };
}

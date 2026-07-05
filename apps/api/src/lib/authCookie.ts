// Session cookie helpers shared by the auth routes (which set/clear the cookie)
// and the global onRequest hook in index.ts (which reads it). Keeping the cookie
// name + attributes in ONE place guarantees they stay byte-identical across that
// boundary — any mismatch silently breaks every web session.
export const AUTH_COOKIE = "weered_token";

// Weered-family hosts share one session across subdomains (Domain=.weered.ca).
// Any other host — the white-label office domains — gets a host-only first-party
// cookie, so a broker's domain is a self-contained session world that never
// bleeds into gaming Weered or another broker's office.
function cookieDomainAttr(reply: any): string {
  const host = String(reply?.request?.headers?.host || "")
    .toLowerCase()
    .split(":")[0];
  return host === "weered.ca" || host.endsWith(".weered.ca") ? " Domain=.weered.ca;" : "";
}

export function setAuthCookie(reply: any, token: string) {
  reply.header(
    "Set-Cookie",
    AUTH_COOKIE +
      "=" +
      token +
      "; HttpOnly; Secure; SameSite=Lax;" +
      cookieDomainAttr(reply) +
      " Path=/; Max-Age=" +
      7 * 24 * 3600,
  );
}

export function clearAuthCookie(reply: any) {
  reply.header(
    "Set-Cookie",
    AUTH_COOKIE +
      "=; HttpOnly; Secure; SameSite=Lax;" +
      cookieDomainAttr(reply) +
      " Path=/; Max-Age=0",
  );
}

// Web clients auth via the httpOnly cookie alone; omitting the body token
// closes the one-shot XSS grab at login. Mobile (Bearer-header client) still
// needs the body token and doesn't send X-Client: web.
export function isWebClient(req: any): boolean {
  return String(req.headers["x-client"] || "").toLowerCase() === "web";
}

export function readCookieToken(req: any): string | null {
  const raw = req.headers.cookie;
  if (!raw) return null;
  for (const part of String(raw).split(";")) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === AUTH_COOKIE)
      return decodeURIComponent(part.slice(i + 1).trim());
  }
  return null;
}

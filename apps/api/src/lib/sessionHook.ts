import { clearAuthCookie, readCookieToken } from "./authCookie";
import { hostOfRequest, isTenantHost } from "./siteHost";

/**
 * The first onRequest hook: the session cookie becomes the Authorization header
 * the routes read (web clients send only the cookie).
 *
 * A lobby's own domain never carries a session (lib/siteHost.ts): no credential
 * is read there, an old cookie is cleared, and signing in is refused, because
 * it happens on weered.ca (red team 2026-11-01, finding 4).
 */
export async function sessionHook(req: any, reply: any) {
  if (isTenantHost(hostOfRequest(req))) {
    delete req.headers.authorization;
    if (readCookieToken(req)) clearAuthCookie(reply);
    const path = String(req.url || "").split("?")[0];
    if (path.startsWith("/auth/") && path !== "/auth/logout")
      return reply.code(403).send({
        ok: false,
        error: "sign_in_on_weered",
        message: "Sign in on weered.ca.",
      });
    return;
  }
  if (!req.headers.authorization) {
    const c = readCookieToken(req);
    if (c) req.headers.authorization = "Bearer " + c;
  }
}

/**
 * Hosts where a Weered session may live: weered.ca and its subdomains (places
 * included), the ECEB and Scotia Blue office hosts, and local development. The
 * same list as OWN_HOST in apps/web/middleware.ts.
 *
 * Any other host is a lobby's own domain, and its owner decides where that name
 * points. A session cookie set there could be collected by pointing the name at
 * a server they run for a while, then replayed against Weered (red team
 * 2026-11-01, finding 4). So a lobby's own domain shows the lobby to visitors,
 * and signing in and taking part happen on weered.ca.
 */
const OWN_HOST =
  /(^|\.)(weered\.ca|eastcoastemployeebenefits\.com|scotiablue\.com)$|^(localhost|127\.0\.0\.1)$|\.localhost$/i;

/** The host a request was made to, lower-case, without a port. */
export function hostOfRequest(req: any): string {
  return String(req?.headers?.host || "")
    .split(",")[0]
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, "");
}

/** A lobby's own domain: never carries a Weered session. */
export function isTenantHost(host: string): boolean {
  return !!host && !OWN_HOST.test(host);
}

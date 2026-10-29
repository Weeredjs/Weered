// A lobby on its own domain (2026-10-29). Caddy issues the certificate on
// demand for hosts registered as a lobby's customDomain and proxies them here;
// the root of such a host sends the visitor to that lobby, on the same host. Every other path is the normal app
// (sign-in, rooms, profiles), and /api + /ws are same-origin through Caddy.
//
// Weered's own hosts, the ECEB office hosts and dev never reach the lookup.
import { NextResponse, type NextRequest } from "next/server";

const OWN_HOST =
  /(^|\.)(weered\.ca|eastcoastemployeebenefits\.com|scotiablue\.com)$|^(localhost|127\.0\.0\.1)$|\.localhost$/i;
const API_INTERNAL = process.env.WEERED_API_INTERNAL || "http://127.0.0.1:4000";
const TTL_MS = 60_000;
const cache = new Map<string, { id: string | null; at: number }>();

async function lobbyFor(host: string): Promise<string | null> {
  const hit = cache.get(host);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.id;
  let id: string | null = null;
  try {
    const r = await fetch(`${API_INTERNAL}/domains/resolve?host=${encodeURIComponent(host)}`, {
      cache: "no-store",
    });
    if (r.ok) id = ((await r.json()) as any)?.lobbyId || null;
  } catch {
    // API down: fall through to the normal app rather than an error page.
    return hit?.id ?? null;
  }
  cache.set(host, { id, at: Date.now() });
  return id;
}

export async function middleware(req: NextRequest) {
  const host = (req.headers.get("x-forwarded-host") || req.headers.get("host") || "")
    .split(",")[0]
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, "");
  if (!host || OWN_HOST.test(host)) return NextResponse.next();
  const id = await lobbyFor(host);
  if (!id) return NextResponse.next();
  // Redirect, not rewrite: the client app keys its shell and auth logic on the
  // browser path, and at "/" it took a rewritten lobby for the home page (blank
  // screen, bounce to /?next=/). The visitor stays on the club's own domain.
  return NextResponse.redirect(new URL(`/lobby/${encodeURIComponent(id)}`, `https://${host}`), 307);
}

// Only the root of a custom host is rewritten; deeper paths are the app itself.
export const config = { matcher: ["/"] };

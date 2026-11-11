// A lobby on its own domain (2026-10-29). Caddy issues the certificate on
// demand for a lobby's live customDomain and proxies it here; the root sends the
// visitor to that lobby, on the same host, and /api + /ws are same-origin
// through Caddy. That lobby and its rooms are all such a host serves: signing in
// and the rest of Weered are on weered.ca, because a session can't be kept on a
// name its owner controls (red team 2026-11-01, finding 4; API lib/siteHost.ts).
//
// Weered's own hosts, the ECEB office hosts and dev never reach the lookup,
// except <label>.weered.ca: someone's place, a lobby's own weered.ca address
// or a paying member's name (api lib/weeredHosts.ts).
import { NextResponse, type NextRequest } from "next/server";

const OWN_HOST =
  /(^|\.)(weered\.ca|eastcoastemployeebenefits\.com|scotiablue\.com)$|^(localhost|127\.0\.0\.1)$|\.localhost$/i;
const PLACE_HOST = /^(?!www\.)[a-z0-9](?:[a-z0-9-]{0,28}[a-z0-9])?\.weered\.ca$/i;
const API_INTERNAL = process.env.WEERED_API_INTERNAL || "http://127.0.0.1:4000";
const TTL_MS = 60_000;
const cache = new Map<string, { id: string | null; at: number }>();

/** The lobby behind a host: its id, null when there is none, undefined when the
 *  API can't say (down or failing). Only the API's 404 means "none". */
async function lobbyFor(host: string): Promise<string | null | undefined> {
  const hit = cache.get(host);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.id;
  let id: string | null = null;
  try {
    const r = await fetch(`${API_INTERNAL}/domains/resolve?host=${encodeURIComponent(host)}`, {
      cache: "no-store",
    });
    if (r.ok) id = ((await r.json()) as any)?.lobbyId || null;
    else if (r.status !== 404) return hit ? hit.id : undefined;
  } catch {
    return hit ? hit.id : undefined;
  }
  cache.set(host, { id, at: Date.now() });
  return id;
}

/** The ECEB office's own hosts (components/useOfficeSkin.ts). */
const OFFICE_HOST = /^(office|meet)\.eastcoastemployeebenefits\.com$/i;

export async function middleware(req: NextRequest) {
  const host = (req.headers.get("x-forwarded-host") || req.headers.get("host") || "")
    .split(",")[0]
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, "");
  // The office's address is the one link a client gets (James 2026-11-11), so
  // its root is the Review Room's door, or the office itself for someone
  // signed in there, before any page draws. It showed Weered's front page: the
  // client-side redirect in RootFrame never fired from "/".
  if (OFFICE_HOST.test(host)) {
    const path = req.nextUrl.pathname;
    // Someone signed in here trades their session for a host pass (api
    // /office/host-pass), which sends anyone who isn't office staff to the door.
    if (path === "/" || path === "/home") {
      const to = req.cookies.get("weered_token")?.value ? "/api/office/host-pass" : "/foyer";
      return NextResponse.redirect(new URL(to, `https://${host}`), 307);
    }
    // One office (James 2026-11-11: "combine the two spaces"): the old Weered
    // room for it goes to the Review Room too.
    if (path.startsWith("/room/mtg-eceb"))
      return NextResponse.redirect(new URL("/api/office/host-pass", `https://${host}`), 307);
    return NextResponse.next();
  }
  // weered.ca's copy of the office room retires into the one office: the host
  // pass sends office staff there and anyone else to its door.
  if (/^(www\.)?weered\.ca$/.test(host) && req.nextUrl.pathname.startsWith("/room/mtg-eceb"))
    return NextResponse.redirect(new URL("/api/office/host-pass", `https://${host}`), 307);
  if (!host || (OWN_HOST.test(host) && !PLACE_HOST.test(host))) return NextResponse.next();
  const path = req.nextUrl.pathname;
  const place = PLACE_HOST.test(host);
  const id = await lobbyFor(host);
  // The API can't say: a place falls through to the app rather than an error
  // page; a club's domain still serves nothing but its lobby.
  if (id === undefined) return place ? NextResponse.next() : toWeered(req);
  // Nothing behind this name: a domain that isn't live, or a <label>.weered.ca
  // that is nobody's place (the *.weered.ca certificate covers every name,
  // 2026-11-01). It goes to weered.ca, whatever the path.
  if (!id) return toWeered(req);
  // A place (<label>.weered.ca) is Weered's own: only its root, and its sign-in
  // (which wears the place's brand), are taken over.
  if (place && path !== "/" && path !== "/login") return NextResponse.next();
  // Sign-in for this lobby wears its brand (app/login ?lobby=): on a place's own
  // subdomain, or on weered.ca for a lobby's own domain, which never hosts a
  // password box (James 2026-11-01).
  if (path === "/login") {
    if (place && req.nextUrl.searchParams.get("lobby")) return NextResponse.next();
    const to = new URL(place ? `https://${host}/login` : "https://weered.ca/login");
    req.nextUrl.searchParams.forEach((v, k) => to.searchParams.set(k, v));
    to.searchParams.set("lobby", id);
    if (!to.searchParams.get("next"))
      to.searchParams.set("next", `/lobby/${encodeURIComponent(id)}`);
    return NextResponse.redirect(to, 307);
  }
  // Redirect, not rewrite: the client app keys its shell and auth logic on the
  // browser path, and at "/" it took a rewritten lobby for the home page (blank
  // screen, bounce to /?next=/). The visitor stays on the club's own domain.
  if (path === "/")
    return NextResponse.redirect(
      new URL(`/lobby/${encodeURIComponent(id)}`, `https://${host}`),
      307,
    );
  const seg = path.split("/");
  let lobby = "";
  try {
    lobby = decodeURIComponent(seg[2] || "");
  } catch {}
  if ((seg[1] === "lobby" && lobby === id) || seg[1] === "room") return NextResponse.next();
  return toWeered(req);
}

/** The same path on weered.ca: sign-in, Home and everything but this lobby. */
function toWeered(req: NextRequest) {
  return NextResponse.redirect(
    new URL(req.nextUrl.pathname + req.nextUrl.search, "https://weered.ca"),
    307,
  );
}

// Every page path (not assets, files, /api or /ws). Weered's own hosts return
// at the first check, so this costs them one regex.
export const config = { matcher: ["/((?!_next/|api/|ws|.*\\..*).*)"] };

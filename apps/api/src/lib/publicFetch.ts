// Outbound fetches to URLs a USER supplied.
//
// /unfurl takes a link off a forum post or a chat message and fetches it from
// the droplet. Without a guard that is a server-side request forgery hole: the
// droplet will happily fetch http://127.0.0.1:4000, http://10.x anything on the
// private network, or http://169.254.169.254 (the cloud metadata service, which
// hands out credentials on some providers). Anything that fetches a URL a
// stranger chose must go through here.
//
// Two things have to be checked, not one:
//   1. where the URL points, and
//   2. where every redirect it answers with points.
// A public host that 302s to 169.254.169.254 defeats a check that only looks at
// the URL the user typed, so redirects are followed by hand.
//
// Residual risk, accepted: DNS rebinding. The name is resolved here and
// resolved again by fetch, and an attacker controlling the nameserver could
// answer differently the second time. Closing that needs the connection pinned
// to the verified address, which breaks TLS SNI for https. The realistic
// attacks — a hostname that simply resolves to a private address, and a
// redirect chain — are both closed.
import { lookup } from "node:dns/promises";
import net from "node:net";

const MAX_HOPS = 3;

/** Address ranges that are not the public internet. */
export function isBlockedAddress(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const p = ip.split(".").map(Number);
    const [a, b] = p;
    if (a === 0) return true; // this network
    if (a === 10) return true; // private
    if (a === 127) return true; // loopback
    if (a === 169 && b === 254) return true; // link-local AND cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return true; // private
    if (a === 192 && b === 168) return true; // private
    if (a === 192 && b === 0) return true; // IETF protocol assignments
    if (a === 100 && b >= 64 && b <= 127) return true; // carrier NAT
    if (a >= 224) return true; // multicast, reserved, broadcast
    return false;
  }
  if (net.isIPv6(ip)) {
    const s = ip.toLowerCase().replace(/^\[|\]$/g, "");
    if (s === "::" || s === "::1") return true; // unspecified, loopback
    if (s.startsWith("fe80")) return true; // link-local
    if (/^f[cd]/.test(s)) return true; // unique local
    if (s.startsWith("::ffff:")) return isBlockedAddress(s.slice(7)); // v4-mapped
    return false;
  }
  return true; // not an address we can reason about
}

/** Throws unless the URL is http(s), on a normal web port, and resolves only
 *  to public addresses. Every address behind the name has to pass: a host with
 *  one public A record and one pointing at 127.0.0.1 is not safe. */
export async function assertPublicUrl(raw: string): Promise<URL> {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new Error("unfetchable: not a url");
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new Error("unfetchable: scheme");
  }
  // A link preview has no business on port 22 or 6379. Restricting to the web
  // ports also removes most of the value of using this endpoint as a port
  // scanner against third parties.
  if (u.port && u.port !== "80" && u.port !== "443") {
    throw new Error("unfetchable: port");
  }
  const host = u.hostname.replace(/^\[|\]$/g, "");
  if (net.isIP(host)) {
    if (isBlockedAddress(host)) throw new Error("unfetchable: address");
    return u;
  }
  let addrs: { address: string }[];
  try {
    addrs = await lookup(host, { all: true });
  } catch {
    throw new Error("unfetchable: dns");
  }
  if (!addrs.length) throw new Error("unfetchable: dns");
  for (const a of addrs) {
    if (isBlockedAddress(a.address)) throw new Error("unfetchable: address");
  }
  return u;
}

/**
 * fetch() for a user-supplied URL. Validates the target, then walks redirects
 * by hand so each hop is validated too.
 */
export async function fetchPublic(
  raw: string,
  init: RequestInit = {},
  timeoutMs = 4000,
): Promise<Response> {
  let target = (await assertPublicUrl(raw)).toString();

  for (let hop = 0; hop <= MAX_HOPS; hop++) {
    const res = await fetch(target, {
      ...init,
      redirect: "manual",
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (res.status < 300 || res.status > 399) return res;

    const loc = res.headers.get("location");
    if (!loc) return res;
    // Relative redirects are resolved against the hop we are on, then checked
    // like any other destination.
    const next = new URL(loc, target).toString();
    target = (await assertPublicUrl(next)).toString();
  }
  throw new Error("unfetchable: too many redirects");
}

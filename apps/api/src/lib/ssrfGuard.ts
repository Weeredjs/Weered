import { lookup } from "node:dns/promises";
import net from "node:net";

// Blocks SSRF: rejects non-http(s) URLs and any host that resolves to a
// private / loopback / link-local / cloud-metadata address. Use before any
// fetch() of a URL that originates (even partly) from client input.

function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true; // link-local incl. 169.254.169.254 metadata
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    if (a === 192 && b === 0) return true; // IETF protocol assignments / TEST-NET-1
    if (a >= 224) return true; // multicast, reserved, broadcast
    return false;
  }
  if (net.isIPv6(ip)) {
    const low = ip.toLowerCase();
    if (low === "::1" || low === "::") return true;
    if (low.startsWith("fc") || low.startsWith("fd")) return true; // unique-local
    if (low.startsWith("fe80")) return true; // link-local
    if (low.startsWith("::ffff:")) return isPrivateIp(low.slice(7)); // v4-mapped
    return false;
  }
  return true; // unparseable → treat as unsafe
}

export type SafeUrlOpts = {
  /** Restrict to the normal web ports. Right for link previews, WRONG for
   *  anything self-hosted: CRCON panels commonly answer on 8010 or 8080, so
   *  this stays off unless a caller asks for it. */
  webPortsOnly?: boolean;
};

export async function assertSafeUrl(raw: string, opts: SafeUrlOpts = {}): Promise<URL> {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new Error("invalid_url");
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") throw new Error("bad_protocol");
  if (opts.webPortsOnly && u.port && u.port !== "80" && u.port !== "443") {
    throw new Error("bad_port");
  }
  const host = u.hostname.replaceAll(/(^\[)|(\]$)/g, "");
  if (net.isIP(host)) {
    if (isPrivateIp(host)) throw new Error("private_host");
    return u;
  }
  const results = await lookup(host, { all: true });
  if (!results.length) throw new Error("dns_empty");
  for (const r of results) {
    if (isPrivateIp(r.address)) throw new Error("private_host");
  }
  return u;
}

const MAX_HOPS = 3;

/**
 * fetch() for a URL a stranger chose, with every redirect hop re-validated.
 *
 * assertSafeUrl alone is not enough when redirects are followed: a public host
 * that answers 302 to http://169.254.169.254 walks straight past a check made
 * only on the URL the user typed. So redirects are followed by hand here.
 *
 * Residual risk, accepted: DNS rebinding. The name is resolved here and again
 * by fetch, and a hostile nameserver could answer differently the second time.
 * Closing that means pinning the connection to the verified address, which
 * breaks TLS SNI. The realistic attacks — a name that simply resolves inward,
 * and a redirect chain — are both closed.
 */
export async function fetchSafe(
  raw: string,
  init: RequestInit = {},
  timeoutMs = 4000,
  opts: SafeUrlOpts = {},
): Promise<Response> {
  let target = (await assertSafeUrl(raw, opts)).toString();
  for (let hop = 0; hop <= MAX_HOPS; hop++) {
    const res = await fetch(target, {
      ...init,
      redirect: "manual",
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (res.status < 300 || res.status > 399) return res;
    const loc = res.headers.get("location");
    if (!loc) return res;
    target = (await assertSafeUrl(new URL(loc, target).toString(), opts)).toString();
  }
  throw new Error("too_many_redirects");
}

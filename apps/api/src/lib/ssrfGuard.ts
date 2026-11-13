import { lookup } from "node:dns/promises";
import net from "node:net";
import http from "node:http";
import https from "node:https";
import zlib from "node:zlib";
import { Readable } from "node:stream";

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

/**
 * Resolve a hostname for a raw TCP connection (game RCON, not HTTP) and hand
 * back ONE address that is safe to dial.
 *
 * Callers connect to the returned address, not the name, which is what closes
 * the DNS-rebind window that fetchSafe has to leave open: a raw socket has no
 * SNI, so pinning the verified address costs nothing.
 */
export async function resolveSafeHost(host: string): Promise<string> {
  const h = String(host || "")
    .trim()
    .replaceAll(/(^\[)|(\]$)/g, "");
  if (!h || h.length > 253) throw new Error("invalid_host");
  if (net.isIP(h)) {
    if (isPrivateIp(h)) throw new Error("private_host");
    return h;
  }
  if (!/^[a-z0-9.-]+$/i.test(h)) throw new Error("invalid_host");
  const results = await lookup(h, { all: true });
  if (!results.length) throw new Error("dns_empty");
  for (const r of results) if (isPrivateIp(r.address)) throw new Error("private_host");
  return results[0].address;
}

const MAX_HOPS = 3;

/**
 * The address lookup for a connection to a stranger's host: every address the
 * name resolves to must be public, and the connection is made to the one that
 * was checked. Doing the check inside the connection's own lookup is what
 * closes DNS rebinding (a name that answers a public address to the check and
 * an inward one to the connection). TLS still names the host (SNI), so https
 * works as before.
 */
export function pinnedLookup(
  hostname: string,
  options: any,
  cb: (err: Error | null, address?: any, family?: number) => void,
): void {
  const h = String(hostname || "").replaceAll(/(^\[)|(\]$)/g, "");
  if (net.isIP(h)) {
    if (isPrivateIp(h)) return cb(new Error("private_host"));
    return options?.all
      ? cb(null, [{ address: h, family: net.isIP(h) }])
      : cb(null, h, net.isIP(h));
  }
  lookup(h, { all: true }).then(
    (rs) => {
      if (!rs.length) return cb(new Error("dns_empty"));
      for (const r of rs) if (isPrivateIp(r.address)) return cb(new Error("private_host"));
      if (options?.all) cb(null, rs);
      else cb(null, rs[0].address, rs[0].family);
    },
    (e) => cb(e),
  );
}

/**
 * One request over node's own http client, connected through pinnedLookup,
 * handed back as a fetch Response. A compressed reply is unpacked as a stream,
 * so a reader that stops early (lib/htmlScan.ts readCapped) never unpacks
 * more than it reads: fetch() unpacked the whole body first, and a few
 * kilobytes could unpack to gigabytes (fan-out audit, 2026-11-13).
 */
function pinnedRequest(target: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  return new Promise((resolve, reject) => {
    const u = new URL(target);
    const mod = u.protocol === "https:" ? https : http;
    const headers: Record<string, string> = {};
    new Headers(init.headers).forEach((v, k) => {
      headers[k] = v;
    });
    headers["accept-encoding"] = "gzip, deflate, br";
    let settled = false;
    const req = mod.request(
      u,
      { method: init.method || "GET", headers, lookup: pinnedLookup as any },
      (res) => {
        const h = new Headers();
        for (const [k, v] of Object.entries(res.headers))
          if (v != null) h.set(k, Array.isArray(v) ? v.join(", ") : String(v));
        const status = res.statusCode || 502;
        const enc = String(res.headers["content-encoding"] || "").toLowerCase();
        const unpack =
          enc === "gzip" || enc === "x-gzip"
            ? zlib.createGunzip()
            : enc === "br"
              ? zlib.createBrotliDecompress()
              : enc === "deflate"
                ? zlib.createInflate()
                : null;
        const stream = unpack ? res.pipe(unpack) : res;
        if (unpack) {
          h.delete("content-encoding");
          h.delete("content-length");
          res.on("error", (e) => unpack.destroy(e));
        }
        const noBody = status === 204 || status === 304 || (init.method || "GET") === "HEAD";
        settled = true;
        resolve(
          new Response(noBody ? null : (Readable.toWeb(stream as Readable) as any), {
            status: status < 200 || status > 599 ? 502 : status,
            headers: h,
          }),
        );
      },
    );
    const timer = setTimeout(() => req.destroy(new Error("timeout")), timeoutMs);
    req.on("close", () => clearTimeout(timer));
    req.on("error", (e) => {
      if (!settled) reject(e);
    });
    if (init.body != null) req.write(init.body as any);
    req.end();
  });
}

type Transport = (target: string, init: RequestInit, timeoutMs: number) => Promise<Response>;
let transport: Transport = pinnedRequest;
/** Tests only: what fetchSafe sends each hop through. */
export const fetchSafeTransport = {
  set(t: Transport) {
    transport = t;
  },
  reset() {
    transport = pinnedRequest;
  },
};

/**
 * fetch() for a URL a stranger chose, with every redirect hop re-validated and
 * every connection made to an address that was checked (pinnedLookup).
 *
 * assertSafeUrl alone is not enough when redirects are followed: a public host
 * that answers 302 to http://169.254.169.254 walks straight past a check made
 * only on the URL the user typed. So redirects are followed by hand here.
 * The timeout covers the whole exchange, body included.
 */
export async function fetchSafe(
  raw: string,
  init: RequestInit = {},
  timeoutMs = 4000,
  opts: SafeUrlOpts = {},
): Promise<Response> {
  let target = (await assertSafeUrl(raw, opts)).toString();
  const origin = new URL(target).origin;
  for (let hop = 0; hop <= MAX_HOPS; hop++) {
    const res = await transport(
      target,
      new URL(target).origin === origin ? init : withoutCredentials(init),
      timeoutMs,
    );
    if (res.status < 300 || res.status > 399) return res;
    const loc = res.headers.get("location");
    if (!loc) return res;
    target = (await assertSafeUrl(new URL(loc, target).toString(), opts)).toString();
  }
  throw new Error("too_many_redirects");
}

/**
 * The same request minus anything that authenticates it. fetch() drops the
 * Authorization header when a redirect crosses origins; following redirects by
 * hand loses that, so a caller's key would otherwise ride along to whatever
 * host the first one pointed at.
 */
function withoutCredentials(init: RequestInit): RequestInit {
  const headers = new Headers(init.headers);
  for (const h of ["authorization", "cookie", "proxy-authorization"]) headers.delete(h);
  return { ...init, headers };
}

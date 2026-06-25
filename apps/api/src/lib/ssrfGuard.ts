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

export async function assertSafeUrl(raw: string): Promise<URL> {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new Error("invalid_url");
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") throw new Error("bad_protocol");
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

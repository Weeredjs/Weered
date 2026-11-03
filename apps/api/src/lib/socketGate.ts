import type { IncomingMessage } from "node:http";
import { swallow } from "./logger";

/**
 * Live sockets per address (flood readiness 2026-11-02). Each socket holds
 * memory and is in every site-wide fan-out, and nothing stopped one script
 * opening thousands. Generous on purpose: a school or office shares one
 * address, and every tab is a socket.
 *
 * The socket server listens on loopback behind Caddy, which sends the visitor's
 * address in X-Forwarded-For (the last entry is the one Caddy saw). A loopback
 * socket with no forwarded address is local tooling and isn't counted.
 */
export const SOCKETS_PER_ADDRESS = 120;
const open = new Map<string, number>();

export function socketAddress(req?: IncomingMessage): string | null {
  const fwd = String(req?.headers?.["x-forwarded-for"] || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (fwd.length) return fwd[fwd.length - 1];
  const remote = String(req?.socket?.remoteAddress || "");
  return /^(127\.|::1$|::ffff:127\.)/.test(remote) ? null : remote || null;
}

/** Let this socket in, or close it (4029) when its address has too many. */
export function admitSocket(ws: any, req?: IncomingMessage): boolean {
  const addr = socketAddress(req);
  if (!addr) return true;
  const n = open.get(addr) || 0;
  if (n >= SOCKETS_PER_ADDRESS) {
    try {
      ws.close(4029, "too_many_sockets");
    } catch (e) {
      swallow(e);
    }
    return false;
  }
  open.set(addr, n + 1);
  ws.on("close", () => {
    const left = (open.get(addr) || 1) - 1;
    if (left > 0) open.set(addr, left);
    else open.delete(addr);
  });
  return true;
}

/** For tests. */
export const _openSockets = open;

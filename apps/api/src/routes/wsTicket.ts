import type { FastifyInstance } from "fastify";
import jwt from "jsonwebtoken";
import { readCookieToken, setAuthCookie } from "../lib/authCookie";
import { TICKET_CLAIM } from "../lib/sessionToken";

// GET /auth/ws-ticket: a 60-second ticket the socket signs in with. The web
// asks for one on every page load (and its session check does,
// web lib/staleSession.ts), so this is where sessions roll.
//
// Rolling sessions (James 2026-11-03, "Go"): someone who uses the site at
// least once a week is never asked to sign in again. A session cookie more
// than a day old comes back as a fresh 7-day one. Only an ordinary cookie
// session: a guest's or a host's ends with its invite, and a Bearer token (the
// mobile app's) is the app's to keep. A banned, deleted or reset account never
// gets here: the account hook in index.ts answers 401 first.
type Opts = {
  authFromHeader: (h?: string) => { id: string; name: string } | null;
  JWT_SECRET: string;
};

export const ROLL_AFTER_S = 24 * 3600;

/** A fresh 7-day session cookie for one more than a day old; true when swapped. */
export function rollSession(req: any, reply: any, secret: string): boolean {
  const cookie = readCookieToken(req);
  const header = String(req.headers?.authorization || "").replace(/^Bearer\s+/i, "");
  if (!cookie || cookie !== header) return false;
  let d: any;
  try {
    d = jwt.verify(cookie, secret, { algorithms: ["HS256"] });
  } catch {
    return false;
  }
  if (!d?.sub || !d.name || d.guest || d.host || d.scope || d[TICKET_CLAIM]) return false;
  if (Date.now() / 1000 - Number(d.iat || 0) < ROLL_AFTER_S) return false;
  setAuthCookie(reply, jwt.sign({ sub: d.sub, name: d.name }, secret, { expiresIn: "7d" }));
  return true;
}

export default function wsTicketRoute(app: FastifyInstance, opts: Opts) {
  const { authFromHeader, JWT_SECRET } = opts;
  app.get("/auth/ws-ticket", async (req, reply) => {
    const u = authFromHeader((req.headers as any).authorization);
    if (!u) return reply.code(401).send({ ok: false });
    rollSession(req, reply, JWT_SECRET);
    // Marked as a ticket: it signs a socket in and is refused everywhere else,
    // this route included, so it can't be traded for another (lib/sessionToken.ts).
    const claims: any = { sub: u.id, name: u.name, [TICKET_CLAIM]: 1 };
    if ((u as any).guest) {
      claims.guest = true;
      claims.scope = (u as any).scope ?? null;
    } else if ((u as any).host) {
      claims.host = true;
      claims.scope = (u as any).scope ?? null;
    }
    return reply.send({
      ok: true,
      ticket: jwt.sign(claims, JWT_SECRET, { expiresIn: "60s" }),
    });
  });
}

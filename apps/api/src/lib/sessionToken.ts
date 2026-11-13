import jwt from "jsonwebtoken";
import type { AuthedUser } from "./roomState";

// Who a token says is calling. Out of index.ts so it can be tested.
//
// Two kinds of token carry the same signature:
// - a session: the web's httpOnly cookie, or the phone app's Bearer token;
// - a socket ticket (routes/wsTicket.ts): 60 seconds, handed to the page's own
//   script so its chat socket can sign in.
//
// A ticket used to be accepted everywhere a session is. The page's script can
// read a ticket, so any script on the page could lift one out of the browser,
// use it as a session from anywhere, and trade it for a fresh ticket every
// minute for as long as it liked: the httpOnly cookie kept nothing in. Found
// in the hardening pass of 2026-11-12. A ticket now carries a mark, and only
// the socket's sign-in accepts a marked token.

/** The claim that marks a socket ticket. */
export const TICKET_CLAIM = "tkt";

export function makeVerifyToken(secret: string) {
  /** The caller, or null. `forSocket` is the socket's sign-in: it takes a ticket too. */
  return function verifyToken(token?: string, forSocket = false): AuthedUser | null {
    if (!token) return null;
    try {
      const decoded: any = jwt.verify(token, secret, { algorithms: ["HS256"] });
      if (decoded?.[TICKET_CLAIM] && !forSocket) return null;
      const id = String(decoded?.sub || decoded?.id || "");
      const name = String(decoded?.name || decoded?.username || "");
      if (!id || !name) return null;
      const out: AuthedUser = { id, name };
      // Issue time, for the account's sign-out-everywhere cut-off (lib/sessionCutoff).
      (out as any).iat = Number(decoded?.iat) || 0;
      if (decoded?.guest) {
        (out as any).guest = true;
        (out as any).scope = decoded?.scope ?? null;
      } else if (decoded?.host) {
        (out as any).host = true;
        (out as any).scope = decoded?.scope ?? null;
      }
      return out;
    } catch {
      return null;
    }
  };
}

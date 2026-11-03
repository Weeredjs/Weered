import { describe, it, expect } from "vitest";
import jwt from "jsonwebtoken";
import { rollSession, ROLL_AFTER_S } from "../../src/routes/wsTicket";
import { AUTH_COOKIE } from "../../src/lib/authCookie";

// Rolling sessions (James 2026-11-03): a session cookie more than a day old is
// swapped for a fresh 7-day one, so a weekly visitor never signs in again.
const SECRET = "unit-roll-secret";
const now = () => Math.floor(Date.now() / 1000);
const session = (ageS: number, extra: object = {}, secret = SECRET) =>
  jwt.sign({ sub: "u1", name: "member", iat: now() - ageS, ...extra }, secret, {
    expiresIn: "7d",
  });

// A request as the session hook leaves it: the cookie copied into Authorization.
function request(tok: string, o: { cookie?: boolean } = {}) {
  return {
    headers: {
      host: "api.weered.ca",
      ...(o.cookie === false ? {} : { cookie: `${AUTH_COOKIE}=${tok}` }),
      authorization: `Bearer ${tok}`,
    },
  };
}
function replyFor(req: any) {
  const headers: Record<string, string> = {};
  return {
    request: req,
    header: (k: string, v: string) => {
      headers[k] = v;
    },
    headers,
  };
}
const swapped = (reply: any): any => {
  const m = String(reply.headers["Set-Cookie"] || "").match(new RegExp(`${AUTH_COOKIE}=([^;]+)`));
  return m ? jwt.verify(m[1], SECRET) : null;
};

describe("rollSession", () => {
  it("swaps a session cookie more than a day old for a fresh 7-day one", () => {
    const req = request(session(ROLL_AFTER_S + 60));
    const reply = replyFor(req);
    expect(rollSession(req, reply, SECRET)).toBe(true);
    const d = swapped(reply);
    expect(d.sub).toBe("u1");
    expect(d.name).toBe("member");
    expect(Math.abs(d.iat - now())).toBeLessThan(5);
    expect(d.exp - d.iat).toBe(7 * 24 * 3600);
    expect(reply.headers["Set-Cookie"]).toContain("Domain=.weered.ca");
    expect(reply.headers["Set-Cookie"]).toContain("Max-Age=604800");
  });

  it("leaves a session from today alone", () => {
    const req = request(session(6 * 3600));
    const reply = replyFor(req);
    expect(rollSession(req, reply, SECRET)).toBe(false);
    expect(reply.headers["Set-Cookie"]).toBeUndefined();
  });

  it("never stretches a guest's or a host's session", () => {
    for (const extra of [
      { guest: true, scope: { lobby: "l1" } },
      { host: true, scope: {} },
    ]) {
      const req = request(session(2 * 24 * 3600, extra));
      const reply = replyFor(req);
      expect(rollSession(req, reply, SECRET)).toBe(false);
      expect(reply.headers["Set-Cookie"]).toBeUndefined();
    }
  });

  it("leaves a Bearer token (the mobile app's) to the app", () => {
    const req = request(session(2 * 24 * 3600), { cookie: false });
    const reply = replyFor(req);
    expect(rollSession(req, reply, SECRET)).toBe(false);
  });

  it("gives nothing for an expired or forged cookie", () => {
    for (const tok of [session(8 * 24 * 3600), session(2 * 24 * 3600, {}, "someone-else")]) {
      const req = request(tok);
      const reply = replyFor(req);
      expect(rollSession(req, reply, SECRET)).toBe(false);
      expect(reply.headers["Set-Cookie"]).toBeUndefined();
    }
  });
});

import { describe, expect, it } from "vitest";
import Fastify from "fastify";
import jwt from "jsonwebtoken";
import { makeVerifyToken, TICKET_CLAIM } from "../../src/lib/sessionToken";
import wsTicketRoute from "../../src/routes/wsTicket";

// A socket ticket signs a socket in and nothing else (lib/sessionToken.ts,
// hardening pass 2026-11-12). The page's script can read a ticket; while a
// ticket passed for a session, any script on the page could carry a working
// sign-in out of the browser and renew it every minute from anywhere.

const SECRET = "unit-test-secret";
const verify = makeVerifyToken(SECRET);
const authFromHeader = (h?: string) => (h ? verify(String(h).replace(/^Bearer\s+/i, "")) : null);

async function app() {
  const a = Fastify({ logger: false });
  wsTicketRoute(a as any, { authFromHeader: authFromHeader as any, JWT_SECRET: SECRET });
  await a.ready();
  return a;
}
const session = (claims: object = {}) =>
  jwt.sign({ sub: "u1", name: "kaede", ...claims }, SECRET, { expiresIn: "7d" });

describe("a session token", () => {
  it("says who is calling", () => {
    const u: any = verify(session());
    expect(u).toMatchObject({ id: "u1", name: "kaede" });
    expect(u.iat).toBeGreaterThan(0);
    expect(u.guest).toBeUndefined();
  });

  it("carries a guest's or a host's scope", () => {
    expect(verify(session({ guest: true, scope: { lobby: "nyan" } }))).toMatchObject({
      guest: true,
      scope: { lobby: "nyan" },
    });
    expect(verify(session({ host: true, scope: { office: "eceb" } }))).toMatchObject({
      host: true,
      scope: { office: "eceb" },
    });
  });

  it("is refused when it isn't ours", () => {
    expect(verify(undefined)).toBeNull();
    expect(verify("nonsense")).toBeNull();
    expect(verify(jwt.sign({ sub: "u1", name: "kaede" }, "another-secret"))).toBeNull();
    expect(verify(jwt.sign({ sub: "u1" }, SECRET))).toBeNull();
    // Signed with no algorithm at all.
    const none =
      Buffer.from('{"alg":"none","typ":"JWT"}').toString("base64url") +
      "." +
      Buffer.from('{"sub":"u1","name":"kaede"}').toString("base64url") +
      ".";
    expect(verify(none)).toBeNull();
  });
});

describe("a socket ticket", () => {
  it("is marked, and lasts a minute", async () => {
    const a = await app();
    const r = await a.inject({
      method: "GET",
      url: "/auth/ws-ticket",
      headers: { authorization: `Bearer ${session()}` },
    });
    expect(r.statusCode).toBe(200);
    const d: any = jwt.verify(r.json().ticket, SECRET);
    expect(d[TICKET_CLAIM]).toBe(1);
    expect(d.sub).toBe("u1");
    expect(d.exp - d.iat).toBe(60);
    await a.close();
  });

  it("signs a socket in, and is no use anywhere else", async () => {
    const a = await app();
    const first = await a.inject({
      method: "GET",
      url: "/auth/ws-ticket",
      headers: { authorization: `Bearer ${session({ guest: true, scope: { lobby: "nyan" } })}` },
    });
    const ticket = first.json().ticket as string;
    // The socket's sign-in takes it, scope and all.
    expect(verify(ticket, true)).toMatchObject({ id: "u1", guest: true, scope: { lobby: "nyan" } });
    // Every other caller is told it's nobody.
    expect(verify(ticket)).toBeNull();
    // Including this route: a ticket can't be traded for the next one.
    const again = await a.inject({
      method: "GET",
      url: "/auth/ws-ticket",
      headers: { authorization: `Bearer ${ticket}` },
    });
    expect(again.statusCode).toBe(401);
    await a.close();
  });
});

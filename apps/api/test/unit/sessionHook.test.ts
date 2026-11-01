import { describe, it, expect } from "vitest";
import { sessionHook } from "../../src/lib/sessionHook";
import { isTenantHost } from "../../src/lib/siteHost";

// No session on a lobby's own domain (red team 2026-11-01, finding 4): its
// owner controls where the name points, so a cookie set there could be
// collected and replayed against Weered.
function call(host: string, url: string, headers: Record<string, string> = {}) {
  const req: any = { url, headers: { host, ...headers } };
  const out: any = { code: 0, body: null, headers: {} as Record<string, string> };
  const reply: any = {
    request: req,
    code(c: number) {
      out.code = c;
      return reply;
    },
    send(b: any) {
      out.body = b;
      return reply;
    },
    header(k: string, v: string) {
      out.headers[k] = v;
      return reply;
    },
  };
  return sessionHook(req, reply).then(() => ({ req, out }));
}

describe("sessions and hosts", () => {
  it("knows Weered's own hosts from a lobby's own domain", () => {
    for (const h of [
      "weered.ca",
      "api.weered.ca",
      "joe.weered.ca",
      "office.eastcoastemployeebenefits.com",
      "fathom.scotiablue.com",
      "127.0.0.1",
      "localhost",
      "bar.localhost",
    ])
      expect(isTenantHost(h)).toBe(false);
    for (const h of [
      "club.example.com",
      "demo.142-93-148-29.sslip.io",
      "weered.ca.evil.example",
      "notweered.ca",
    ])
      expect(isTenantHost(h)).toBe(true);
  });

  it("turns the cookie into the session on Weered's hosts", async () => {
    const { req } = await call("api.weered.ca", "/profile/me", { cookie: "weered_token=abc" });
    expect(req.headers.authorization).toBe("Bearer abc");
  });

  it("reads no credential on a lobby's own domain, and clears an old cookie", async () => {
    const { req, out } = await call("club.example.com", "/lobbies/x", {
      cookie: "weered_token=abc",
      authorization: "Bearer xyz",
    });
    expect(req.headers.authorization).toBeUndefined();
    expect(out.headers["Set-Cookie"]).toMatch(/^weered_token=;.*Max-Age=0/);
    expect(out.headers["Set-Cookie"]).not.toMatch(/Domain=/);
  });

  it("refuses signing in there", async () => {
    const { out } = await call("club.example.com", "/auth/login");
    expect(out.code).toBe(403);
    expect(out.body.error).toBe("sign_in_on_weered");
    expect((await call("club.example.com", "/auth/logout")).out.code).toBe(0);
  });
});

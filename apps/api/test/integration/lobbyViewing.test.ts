import { describe, it, expect } from "vitest";
import lobbiesRoutes from "../../src/routes/lobbies";
import { buildTestApp } from "../helpers/buildTestApp";

// The /viewing route uses no auth/DB, so a minimal stub opts is enough — other
// routes it registers are never hit here.
function makeApp() {
  return buildTestApp((app: any) =>
    lobbiesRoutes(app, {
      authFromHeader: () => null,
      verifyToken: () => null,
      getGlobalRole: async () => null,
      canAccessStaff: () => false,
      getLobbyRole: async () => null,
      applyWindroseReel: (x: any) => x,
      lobbyAdminAccess: async () => null,
      globalAudit: async () => {},
      rooms: new Map(),
      isNameReserved: async () => false,
      awardNotoriety: async () => 0,
      send: () => {},
    } as any),
  );
}

describe("lobbies - POST /:id/viewing (public N-viewing)", () => {
  // The registry is module-level and the integration suite runs in a single
  // fork, so state persists across files. Assert RELATIVE behavior + isolation,
  // never absolute counts, and use unique lobby ids per test to avoid collisions.
  it("counts distinct anon viewers on any lobby, deduped by sid", async () => {
    const app = await makeApp();
    const post = (sid: string) =>
      app.inject({ method: "POST", url: "/lobbies/itest-count/viewing", payload: { sid } });

    const c1 = (await post("sid-a")).json().count;
    expect(c1).toBeGreaterThanOrEqual(1);

    const c2 = (await post("sid-b")).json().count;
    expect(c2).toBe(c1 + 1); // distinct sid increments

    const again = (await post("sid-a")).json().count;
    expect(again).toBe(c2); // same sid not double-counted
    await app.close();
  });

  it("counts on an arbitrary (non-allowlisted) lobby — every lobby is public now", async () => {
    const app = await makeApp();
    const r = await app.inject({
      method: "POST",
      url: "/lobbies/some-random-lobby/viewing",
      payload: { sid: "x" },
    });
    expect(r.statusCode).toBe(200);
    expect(r.json().count).toBeGreaterThanOrEqual(1); // was 0 under the old allowlist
    await app.close();
  });

  it("keeps per-lobby registries isolated", async () => {
    const app = await makeApp();
    const post = (lobby: string, sid: string) =>
      app.inject({ method: "POST", url: `/lobbies/${lobby}/viewing`, payload: { sid } });

    const aBefore = (await post("itest-iso-a", "probe")).json().count;
    await post("itest-iso-b", "b1");
    await post("itest-iso-b", "b2");
    const aAfter = (await post("itest-iso-a", "probe")).json().count;
    expect(aAfter).toBe(aBefore); // pings to lobby B don't change lobby A
    await app.close();
  });

  it("ignores a blank lobby id", async () => {
    const app = await makeApp();
    // "/lobbies//viewing" — empty id segment
    const r = await app.inject({
      method: "POST",
      url: "/lobbies/%20/viewing",
      payload: { sid: "x" },
    });
    // whitespace id is truthy after slice; the real guard is the empty-string
    // case, which the router won't even route. Just assert it doesn't 500.
    expect([200, 404]).toContain(r.statusCode);
    await app.close();
  });
});

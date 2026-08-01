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
  it("counts distinct anon viewers on an allowlisted launch lobby", async () => {
    const app = await makeApp();
    const post = (sid: string) =>
      app.inject({ method: "POST", url: "/lobbies/helldivers2/viewing", payload: { sid } });

    const a = await post("sid-a");
    expect(a.statusCode).toBe(200);
    expect(a.json().count).toBe(1);

    const b = await post("sid-b");
    expect(b.json().count).toBe(2);

    const aAgain = await post("sid-a"); // same session id → not double-counted
    expect(aAgain.json().count).toBe(2);
    await app.close();
  });

  it("counts viewers on cowork (public launch lobby) without leaking across lobbies", async () => {
    const app = await makeApp();
    const post = (lobby: string, sid: string) =>
      app.inject({ method: "POST", url: `/lobbies/${lobby}/viewing`, payload: { sid } });

    // The viewer registry is module-level and the integration suite runs in a
    // single fork, so state persists across files. Assert RELATIVE behavior,
    // never absolute counts.
    const hdBefore = (await post("helldivers2", "sid-leak-probe")).json().count;

    const first = await post("cowork", "sid-cw-1");
    expect(first.statusCode).toBe(200);
    const c1 = first.json().count;
    expect(c1).toBeGreaterThanOrEqual(1); // cowork is allowlisted, not a no-op

    const c2 = (await post("cowork", "sid-cw-2")).json().count;
    expect(c2).toBe(c1 + 1); // distinct sid increments

    const c2again = (await post("cowork", "sid-cw-2")).json().count;
    expect(c2again).toBe(c2); // same sid is not double-counted

    // cowork pings must not have leaked into helldivers2's registry
    const hdAfter = (await post("helldivers2", "sid-leak-probe")).json().count;
    expect(hdAfter).toBe(hdBefore);
    await app.close();
  });

  it("is a no-op (count 0) for lobbies not on the allowlist", async () => {
    const app = await makeApp();
    const r = await app.inject({
      method: "POST",
      url: "/lobbies/some-random-lobby/viewing",
      payload: { sid: "x" },
    });
    expect(r.statusCode).toBe(200);
    expect(r.json().count).toBe(0);
    await app.close();
  });
});

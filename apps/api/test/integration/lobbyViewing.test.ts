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

  it("counts viewers on cowork (public launch lobby) with an independent registry", async () => {
    const app = await makeApp();
    const r = await app.inject({
      method: "POST",
      url: "/lobbies/cowork/viewing",
      payload: { sid: "sid-cowork" },
    });
    expect(r.statusCode).toBe(200);
    expect(r.json().count).toBe(1);

    // registries are per-lobby: the cowork viewer doesn't leak into helldivers2
    const hd = await app.inject({
      method: "POST",
      url: "/lobbies/helldivers2/viewing",
      payload: { sid: "sid-hd" },
    });
    expect(hd.json().count).toBe(1);
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

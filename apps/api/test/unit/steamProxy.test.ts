import { describe, it, expect, afterEach, vi } from "vitest";
import steamRoutes from "../../src/routes/steam";
import { buildTestApp } from "../helpers/buildTestApp";

function stub(handler: () => any) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => handler()),
  );
}
async function makeApp() {
  const opts = new Proxy(
    { authFromHeader: () => null },
    { get: (t, p) => (p in t ? t[p] : () => Promise.resolve()) },
  );
  return buildTestApp((app) => steamRoutes(app, opts));
}
afterEach(() => vi.unstubAllGlobals());

describe("steam current-players proxy", () => {
  it("400 on a non-numeric appId", async () => {
    stub(() => ({ status: 200, ok: true, json: async () => ({ response: { player_count: 1 } }) }));
    const app = await makeApp();
    const r = await app.inject({ method: "GET", url: "/steam/players/notanid" });
    expect(r.statusCode).toBe(400);
    expect(r.json().error).toBe("bad_appid");
    await app.close();
  });

  it("returns the current player count on success", async () => {
    stub(() => ({
      status: 200,
      ok: true,
      json: async () => ({ response: { player_count: 54321 } }),
    }));
    const app = await makeApp();
    const r = await app.inject({ method: "GET", url: "/steam/players/730" });
    expect(r.json()).toMatchObject({ ok: true, count: 54321 });
    await app.close();
  });

  it("502 steam_unavailable when upstream is unusable (no cache)", async () => {
    stub(() => ({
      status: 200,
      ok: true,
      json: async () => {
        throw new Error("bad");
      },
    }));
    const app = await makeApp();
    const r = await app.inject({ method: "GET", url: "/steam/players/440" });
    expect(r.statusCode).toBe(502);
    expect(r.json().error).toBe("steam_unavailable");
    await app.close();
  });
});

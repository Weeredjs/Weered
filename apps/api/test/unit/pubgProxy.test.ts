import { describe, it, expect, afterEach, vi } from "vitest";
import pubgRoutes from "../../src/routes/pubg";
import { buildTestApp } from "../helpers/buildTestApp";

let fetchCalls: number;
function stub(handler: () => any) {
  fetchCalls = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      fetchCalls++;
      return handler();
    }),
  );
}
async function makeApp() {
  return buildTestApp((app: any) => pubgRoutes(app));
}
afterEach(() => vi.unstubAllGlobals());

describe("pubg stats proxy - key gate + not-found + validation", () => {
  it("400 when the name is blank", async () => {
    process.env.PUBG_API_KEY = "testkey";
    stub(() => ({ status: 200, ok: true, json: async () => ({ data: [] }) }));
    const app = await makeApp();
    const r = await app.inject({ method: "GET", url: "/pubg/stats/%20" }); // whitespace name
    expect(r.statusCode).toBe(400);
    expect(r.json().error).toBe("name_required");
    await app.close();
  });

  it("degrades to player_not_found when no API key is configured (never hits upstream)", async () => {
    delete process.env.PUBG_API_KEY;
    stub(() => ({ status: 200, ok: true, json: async () => ({ data: [{ id: "x" }] }) }));
    const app = await makeApp();
    const r = await app.inject({ method: "GET", url: "/pubg/stats/SomePlayer" });
    expect(r.json()).toMatchObject({ ok: false, error: "player_not_found" });
    expect(fetchCalls).toBe(0); // no key -> never calls the PUBG API
    await app.close();
  });

  it("returns player_not_found when the PUBG API has no such player", async () => {
    process.env.PUBG_API_KEY = "testkey";
    stub(() => ({ status: 200, ok: true, json: async () => ({ data: [] }) }));
    const app = await makeApp();
    const r = await app.inject({ method: "GET", url: "/pubg/stats/Ghost" });
    expect(r.json()).toMatchObject({ ok: false, error: "player_not_found" });
    expect(fetchCalls).toBeGreaterThan(0); // did query upstream
    await app.close();
  });
});

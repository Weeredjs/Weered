import { describe, it, expect, afterEach, vi } from "vitest";
import fortniteRoutes from "../../src/routes/fortnite";
import { buildTestApp } from "../helpers/buildTestApp";

function stub(handler: () => any) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => handler()),
  );
}
const opts = () => new Proxy({}, { get: () => () => Promise.resolve() });
async function makeApp() {
  return buildTestApp((app: any) => fortniteRoutes(app, opts()));
}
afterEach(() => vi.unstubAllGlobals());

describe("fortnite stats proxy - validation + not-found + transform", () => {
  it("400 when the name is blank", async () => {
    stub(() => ({ status: 200, ok: true, json: async () => ({ status: 200, data: {} }) }));
    const app = await makeApp();
    const r = await app.inject({ method: "GET", url: "/fortnite/stats/%20" });
    expect(r.statusCode).toBe(400);
    expect(r.json().error).toBe("name_required");
    await app.close();
  });

  it("player_not_found when the fortnite API reports a non-200 body status", async () => {
    stub(() => ({
      status: 200,
      ok: true,
      json: async () => ({ status: 404, error: "player_not_found" }),
    }));
    const app = await makeApp();
    const r = await app.inject({ method: "GET", url: "/fortnite/stats/NoSuchPlayer" });
    expect(r.json()).toMatchObject({ ok: false, error: "player_not_found" });
    await app.close();
  });

  it("returns flattened stats on a successful lookup", async () => {
    const body = {
      status: 200,
      data: {
        account: { id: "acc1", name: "Ninja" },
        battlePass: { level: 100 },
        image: "img",
        stats: { all: { overall: { wins: 500 }, solo: { wins: 100 } } },
      },
    };
    stub(() => ({ status: 200, ok: true, json: async () => body }));
    const app = await makeApp();
    const r = await app.inject({ method: "GET", url: "/fortnite/stats/Ninja" });
    expect(r.statusCode).toBe(200);
    expect(r.json()).toMatchObject({
      ok: true,
      account: { id: "acc1", name: "Ninja" },
      stats: { all: { wins: 500 }, solo: { wins: 100 } },
    });
    await app.close();
  });
});

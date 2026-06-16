import { describe, it, expect, afterEach, vi } from "vitest";
import bungieRoutes from "../../src/routes/bungie";
import { buildTestApp } from "../helpers/buildTestApp";

function stub(handler: (url: string, opts: any) => any) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, o: any) => handler(String(url), o)),
  );
}
const proxyOpts = () =>
  new Proxy(
    { authFromHeader: () => null, awardNotoriety: async () => null },
    { get: (t: any, p: string) => (p in t ? t[p] : () => Promise.resolve()) },
  );
async function makeApp() {
  return buildTestApp((app: any) => bungieRoutes(app, proxyOpts()));
}
afterEach(() => vi.unstubAllGlobals());

describe("bungie player proxy - key gate + search/profile chain", () => {
  it("degrades to bungie_not_configured with no API key", async () => {
    delete process.env.BUNGIE_API_KEY;
    stub(() => ({ status: 200, ok: true, json: async () => ({}) }));
    const app = await makeApp();
    const r = await app.inject({ method: "GET", url: "/bungie/player/Guardian%231234" });
    expect(r.json()).toMatchObject({ ok: false, error: "bungie_not_configured" });
    await app.close();
  });

  it("found:false when the player search returns no matches", async () => {
    process.env.BUNGIE_API_KEY = "bkey";
    stub(() => ({ status: 200, ok: true, json: async () => ({ Response: [] }) }));
    const app = await makeApp();
    const r = await app.inject({ method: "GET", url: "/bungie/player/NoSuch%230000" });
    expect(r.json()).toMatchObject({ ok: true, found: false, players: [] });
    await app.close();
  });

  it("returns a character summary when the player + profile resolve", async () => {
    process.env.BUNGIE_API_KEY = "bkey";
    stub((url) => {
      if (url.includes("SearchDestinyPlayerByBungieName"))
        return {
          status: 200,
          ok: true,
          json: async () => ({ Response: [{ membershipType: 3, membershipId: "456" }] }),
        };
      // profile
      return {
        status: 200,
        ok: true,
        json: async () => ({
          Response: {
            characters: {
              data: {
                c1: {
                  characterId: "c1",
                  classType: 1,
                  light: 1810,
                  raceType: 0,
                  emblemPath: "/e.jpg",
                },
              },
            },
            characterEquipment: { data: {}, privacy: 1 },
            itemComponents: {},
          },
        }),
      };
    });
    const app = await makeApp();
    const r = await app.inject({ method: "GET", url: "/bungie/player/Guardian%231234" });
    expect(r.statusCode).toBe(200);
    expect(r.json().ok).toBe(true);
    await app.close();
  });
});

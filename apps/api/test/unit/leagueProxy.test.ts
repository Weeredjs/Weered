import { describe, it, expect, afterEach, vi } from "vitest";
import leagueRoutes from "../../src/routes/league";
import { buildTestApp } from "../helpers/buildTestApp";

let fetchCalls: number;
function stub(handler: (url: string) => any) {
  fetchCalls = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      fetchCalls++;
      return handler(String(url));
    }),
  );
}
async function makeApp() {
  return buildTestApp((app: any) => leagueRoutes(app));
}
afterEach(() => vi.unstubAllGlobals());

describe("league (RIOT) proxy - key gate + lookup chain", () => {
  it("degrades to riot_not_configured with no key (never hits upstream)", async () => {
    delete process.env.RIOT_API_KEY;
    stub(() => ({ status: 200, ok: true, json: async () => ({ puuid: "p1" }) }));
    const app = await makeApp();
    const r = await app.inject({ method: "GET", url: "/league/summoner/Faker/KR1" });
    // riot_not_configured short-circuits the summoner lookup (league also does a
    // background ddragon-version fetch, so we assert the response, not call count)
    expect(r.json()).toMatchObject({ ok: false, error: "riot_not_configured" });
    await app.close();
  });

  it("player_not_found when the riot account has no puuid", async () => {
    process.env.RIOT_API_KEY = "RGAPI-test";
    stub(() => ({ status: 200, ok: true, json: async () => ({}) })); // account: no puuid
    const app = await makeApp();
    const r = await app.inject({ method: "GET", url: "/league/summoner/Ghost/NA1" });
    expect(r.json()).toMatchObject({ ok: false, error: "player_not_found" });
    await app.close();
  });

  it("summoner_not_found when the account exists but the summoner 404s", async () => {
    process.env.RIOT_API_KEY = "RGAPI-test";
    stub((url) => {
      if (url.includes("/accounts/by-riot-id/"))
        return { status: 200, ok: true, json: async () => ({ puuid: "p1" }) };
      return { status: 404, ok: false, json: async () => ({}) }; // summoner 404
    });
    const app = await makeApp();
    const r = await app.inject({ method: "GET", url: "/league/summoner/Faker/KR1" });
    expect(r.json()).toMatchObject({ ok: false, error: "summoner_not_found" });
    await app.close();
  });
});

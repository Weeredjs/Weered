import { describe, it, expect, afterEach, vi } from "vitest";
import mlbRoutes from "../../src/routes/mlb";
import { buildTestApp } from "../helpers/buildTestApp";

const schedule = {
  dates: [
    {
      games: [
        {
          gamePk: 777,
          status: { detailedState: "Final", statusCode: "F" },
          gameDate: "2026-06-16T18:00:00Z",
          venue: { name: "Fenway Park" },
          teams: {
            away: {
              team: { id: 1, name: "Yankees", abbreviation: "NYY" },
              score: 3,
              leagueRecord: { wins: 40, losses: 30 },
            },
            home: {
              team: { id: 2, name: "Red Sox", abbreviation: "BOS" },
              score: 5,
              leagueRecord: { wins: 45, losses: 25 },
            },
          },
          linescore: {
            currentInning: 9,
            inningHalf: "Bottom",
            outs: 3,
            innings: [{ num: 1, away: { runs: 1 }, home: { runs: 0 } }],
          },
        },
      ],
    },
  ],
};

function stub(handler: () => any) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => handler()),
  );
}
async function makeApp() {
  return buildTestApp((app: any) => mlbRoutes(app));
}
afterEach(() => vi.unstubAllGlobals());

describe("mlb scoreboard proxy - transform + degradation", () => {
  it("flattens the MLB schedule into game cards", async () => {
    stub(() => ({ status: 200, ok: true, json: async () => schedule }));
    const app = await makeApp();
    const r = await app.inject({ method: "GET", url: "/mlb/scoreboard?date=2026-06-16" });
    expect(r.statusCode).toBe(200);
    const g = r.json().games[0];
    expect(g.gameId).toBe(777);
    expect(g.status).toBe("Final");
    expect(g.away).toMatchObject({ name: "Yankees", abbr: "NYY", score: 3, wins: 40 });
    expect(g.home).toMatchObject({ name: "Red Sox", score: 5 });
    expect(g.linescore.currentInning).toBe(9);
    await app.close();
  });

  it("returns an empty board (no games) when the date has none", async () => {
    stub(() => ({ status: 200, ok: true, json: async () => ({ dates: [] }) }));
    const app = await makeApp();
    const r = await app.inject({ method: "GET", url: "/mlb/scoreboard?date=2026-01-01" });
    expect(r.statusCode).toBe(200);
    expect(r.json().games).toEqual([]);
    await app.close();
  });

  it("degrades gracefully (200, empty, fetch_failed) when upstream is unusable", async () => {
    stub(() => ({
      status: 200,
      ok: true,
      json: async () => {
        throw new Error("bad upstream json");
      },
    }));
    const app = await makeApp();
    const r = await app.inject({ method: "GET", url: "/mlb/scoreboard" });
    expect(r.statusCode).toBe(200); // never a 500
    expect(r.json()).toMatchObject({ ok: true, games: [], error: "fetch_failed" });
    await app.close();
  });
});

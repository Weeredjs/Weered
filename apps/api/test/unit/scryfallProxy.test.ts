import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import scryfallRoutes from "../../src/routes/scryfall";
import { buildTestApp } from "../helpers/buildTestApp";

// Live-API proxy tested WITHOUT the network: stub global fetch (which
// fetchWithTimeout calls) to drive validation / success / 404 / graceful
// degradation / caching deterministically.
const mockCard = {
  name: "Lightning Bolt",
  set: "lea",
  set_name: "Limited Edition Alpha",
  mana_cost: "{R}",
  type_line: "Instant",
  oracle_text: "Lightning Bolt deals 3 damage to any target.",
  image_uris: { normal: "http://img/normal.jpg", small: "http://img/small.jpg" },
  scryfall_uri: "https://scryfall.com/card/lea/161",
  colors: ["R"],
  cmc: 1,
};

let fetchCalls: number;
function stubFetch(handler: (url: string) => any) {
  fetchCalls = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      fetchCalls++;
      return handler(String(url));
    }),
  );
}
const okResp = () => ({ status: 200, ok: true, json: async () => mockCard });
const notFoundResp = () => ({ status: 404, ok: false, json: async () => ({}) });

async function makeApp() {
  return buildTestApp((app: any) => scryfallRoutes(app, {}));
}

beforeEach(() => {
  fetchCalls = 0;
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("scryfall proxy - validation / fetch / cache / degradation", () => {
  it("400 when the name is missing", async () => {
    stubFetch(okResp);
    const app = await makeApp();
    const r = await app.inject({ method: "GET", url: "/scryfall/card" });
    expect(r.statusCode).toBe(400);
    expect(fetchCalls).toBe(0); // never hits upstream
    await app.close();
  });

  it("returns a flattened card on a successful upstream response", async () => {
    stubFetch(okResp);
    const app = await makeApp();
    const r = await app.inject({ method: "GET", url: "/scryfall/card?name=Lightning Bolt" });
    expect(r.statusCode).toBe(200);
    const card = r.json().card;
    expect(card).toMatchObject({
      name: "Lightning Bolt",
      mana_cost: "{R}",
      image: "http://img/normal.jpg",
      colors: ["R"],
      cmc: 1,
    });
    await app.close();
  });

  it("404 not_found when scryfall 404s", async () => {
    stubFetch(notFoundResp);
    const app = await makeApp();
    const r = await app.inject({ method: "GET", url: "/scryfall/card?name=notarealcard" });
    expect(r.statusCode).toBe(404);
    expect(r.json().error).toBe("not_found");
    await app.close();
  });

  it("degrades gracefully (404, no crash) when upstream throws", async () => {
    stubFetch(() => {
      throw new Error("network down");
    });
    const app = await makeApp();
    const r = await app.inject({ method: "GET", url: "/scryfall/card?name=Lightning Bolt" });
    expect(r.statusCode).toBe(404); // not a 500
    await app.close();
  });

  it("serves a second identical lookup from cache (one upstream call)", async () => {
    stubFetch(okResp);
    const app = await makeApp();
    await app.inject({ method: "GET", url: "/scryfall/card?name=Lightning Bolt" });
    await app.inject({ method: "GET", url: "/scryfall/card?name=Lightning Bolt" });
    expect(fetchCalls).toBe(1); // second served from cache
    await app.close();
  });

  it("batch endpoint maps each requested name", async () => {
    stubFetch((url) => (url.includes("Counterspell") ? notFoundResp() : okResp()));
    const app = await makeApp();
    const r = await app.inject({
      method: "GET",
      url: "/scryfall/cards?names=Lightning Bolt,Counterspell",
    });
    expect(r.statusCode).toBe(200);
    const cards = r.json().cards;
    expect(cards["Lightning Bolt"]?.name).toBe("Lightning Bolt");
    expect(cards["Counterspell"]).toBeNull();
    await app.close();
  });
});

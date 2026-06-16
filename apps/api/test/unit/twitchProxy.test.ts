import { describe, it, expect, afterEach, vi } from "vitest";
import twitchRoutes from "../../src/routes/twitch";
import { buildTestApp } from "../helpers/buildTestApp";

function stub(handler: (url: string) => any) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => handler(String(url))),
  );
}
async function makeApp() {
  return buildTestApp((app: any) => twitchRoutes(app));
}
afterEach(() => vi.unstubAllGlobals());

describe("twitch streams proxy", () => {
  it("degrades to twitch_not_configured with no client creds", async () => {
    delete process.env.TWITCH_CLIENT_ID;
    delete process.env.TWITCH_CLIENT_SECRET;
    stub(() => ({ status: 200, ok: true, json: async () => ({}) }));
    const app = await makeApp();
    const r = await app.inject({ method: "GET", url: "/twitch/streams?game=Destiny 2" });
    expect(r.json()).toMatchObject({ ok: true, streams: [], error: "twitch_not_configured" });
    await app.close();
  });

  it("returns live streams for a game (token -> games -> streams chain)", async () => {
    process.env.TWITCH_CLIENT_ID = "cid";
    process.env.TWITCH_CLIENT_SECRET = "csec";
    stub((url) => {
      if (url.includes("oauth2/token"))
        return {
          status: 200,
          ok: true,
          json: async () => ({ access_token: "tok", expires_in: 3600 }),
        };
      if (url.includes("helix/games"))
        return {
          status: 200,
          ok: true,
          json: async () => ({ data: [{ id: "g1", name: "Destiny 2" }] }),
        };
      if (url.includes("helix/streams"))
        return {
          status: 200,
          ok: true,
          json: async () => ({
            data: [
              {
                id: "s1",
                user_name: "streamer",
                user_login: "streamer",
                title: "raid",
                viewer_count: 120,
                thumbnail_url: "t",
              },
            ],
          }),
        };
      return { status: 200, ok: true, json: async () => ({ data: [] }) };
    });
    const app = await makeApp();
    const r = await app.inject({ method: "GET", url: "/twitch/streams" });
    expect(r.json().ok).toBe(true);
    expect(r.json().streams.length).toBe(1);
    await app.close();
  });

  it("empty when the game is unknown", async () => {
    process.env.TWITCH_CLIENT_ID = "cid";
    process.env.TWITCH_CLIENT_SECRET = "csec";
    stub((url) => {
      if (url.includes("oauth2/token"))
        return {
          status: 200,
          ok: true,
          json: async () => ({ access_token: "tok", expires_in: 3600 }),
        };
      return { status: 200, ok: true, json: async () => ({ data: [] }) };
    });
    const app = await makeApp();
    const r = await app.inject({ method: "GET", url: "/twitch/streams?game=NoSuchGame" });
    expect(r.json().streams).toEqual([]);
    await app.close();
  });
});

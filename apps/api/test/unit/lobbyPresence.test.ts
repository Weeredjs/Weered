import { describe, it, expect } from "vitest";
import Fastify from "fastify";
import { registerLobbyPresence } from "../../src/routes/lobbyPresence";

// A lobby's member list (all its rooms) carries what each room's entry carries,
// the background included: it was left off, so backgrounds showed on Home's
// live list and nowhere else (James 2026-11-05).
describe("GET /lobbies/:lobbyId/presence", () => {
  it("passes each person's background and banner through", async () => {
    const rooms = new Map<string, any>([
      [
        "r1",
        {
          roomId: "r1",
          lobbyId: "l1",
          name: "General",
          mods: new Set(),
          users: new Map([
            [
              "u1",
              {
                name: "weered",
                globalRole: "GOD",
                tier: "KINGPIN",
                lookBg: "banner",
                bannerUrl: "https://api.weered.ca/banners/u1-1.webp",
              },
            ],
            ["u2", { name: "plain", globalRole: "USER", tier: "INNOCENT" }],
          ]),
        },
      ],
    ]);
    const app = Fastify();
    registerLobbyPresence(app as any, {
      authFromHeader: () => null,
      getGlobalRole: async () => "USER",
      canAccessStaff: () => false,
      rooms,
    });
    const r = await app.inject({ method: "GET", url: "/lobbies/l1/presence" });
    expect(r.statusCode).toBe(200);
    const users = r.json().users as any[];
    const u1 = users.find((u) => u.id === "u1");
    expect(u1).toMatchObject({
      lookBg: "banner",
      bannerUrl: "https://api.weered.ca/banners/u1-1.webp",
    });
    const u2 = users.find((u) => u.id === "u2");
    expect(u2.lookBg).toBeNull();
    expect(u2.bannerUrl).toBeNull();
    await app.close();
  });
});

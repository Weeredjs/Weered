import { describe, it, expect, vi, beforeEach } from "vitest";
import Fastify from "fastify";

// The bar's search (James 2026-11-06: "Just search that taps into everything"):
// lobbies, rooms, people, crews and posts in one answer.
const H = vi.hoisted(() => ({
  lobbies: [] as any[],
  rooms: [] as any[],
  users: [] as any[],
  crews: [] as any[],
  posts: [] as any[],
  sql: "",
  userWhere: null as any,
}));
vi.mock("../../src/lib/prisma", () => ({
  prisma: {
    lobby: {
      findMany: async ({ where }: any) => (where?.pinned ? H.lobbies : []),
    },
    room: { findMany: async () => H.rooms },
    lobbyMember: { findMany: async () => [] },
    user: {
      findMany: async ({ where }: any) => {
        H.userWhere = where;
        return H.users;
      },
    },
    crew: { findMany: async () => H.crews },
    $queryRaw: (strings: TemplateStringsArray) => {
      H.sql = strings.join("?");
      return Promise.resolve(H.posts);
    },
  },
}));
vi.mock("../../src/lib/isStaffUser", () => ({ isStaffUser: async () => false }));

import searchRoutes from "../../src/routes/search";

async function search(q: string) {
  const app = Fastify();
  await app.register(searchRoutes, { authFromHeader: () => null });
  const r = await app.inject({ method: "GET", url: `/search?q=${encodeURIComponent(q)}` });
  await app.close();
  return r.json();
}

beforeEach(() => {
  H.lobbies = [];
  H.rooms = [];
  H.users = [];
  H.crews = [];
  H.posts = [];
  H.sql = "";
  H.userWhere = null;
});

describe("GET /search", () => {
  it("answers nothing under two characters", async () => {
    H.lobbies = [{ id: "poker", name: "Poker", keywords: [] }];
    const j = await search("p");
    expect(j).toMatchObject({ lobbies: [], rooms: [], people: [], crews: [], posts: [] });
  });

  it("finds lobbies by name or keyword and sends them slim", async () => {
    H.lobbies = [
      {
        id: "poker",
        name: "Poker Night",
        keywords: [],
        verified: true,
        moduleConfig: { va: { secret: 1 } },
        _count: { rooms: 3, members: 41 },
      },
      { id: "chess", name: "Chess", keywords: ["board games"] },
      { id: "eve", name: "EVE Online", keywords: ["space"] },
    ];
    expect((await search("poker")).lobbies).toEqual([
      {
        id: "poker",
        name: "Poker Night",
        verified: true,
        unlisted: false,
        accentColor: null,
        logoUrl: null,
        members: 41,
      },
    ]);
    expect((await search("board")).lobbies.map((l: any) => l.id)).toEqual(["chess"]);
  });

  it("passes rooms, people, crews and posts through", async () => {
    H.rooms = [{ id: "r1", name: "Poker Table", lobby: { id: "poker", name: "Poker" } }];
    H.users = [{ id: "u1", name: "Nyx", usernameKey: "nyx" }];
    H.crews = [{ id: "c1", name: "Night Shift", tagKey: "NGHT", _count: { members: 4 } }];
    H.posts = [{ id: "p1", title: "Night raids", lobbyId: null, commentCount: BigInt(3) }];
    const j = await search("night");
    expect(j.rooms).toHaveLength(1);
    expect(j.people).toEqual([{ id: "u1", name: "Nyx", usernameKey: "nyx" }]);
    expect(j.crews[0]).toMatchObject({ name: "Night Shift", tagKey: "NGHT" });
    expect(j.posts).toEqual([{ id: "p1", title: "Night raids", lobbyId: null, commentCount: 3 }]);
  });

  it("puts the best name first: whole, then start, then anywhere, then a keyword", async () => {
    H.lobbies = [
      { id: "kw", name: "Destiny 2", keywords: ["nightfall"], _count: { members: 90 } },
      { id: "mid", name: "Late Night Club", keywords: [], _count: { members: 50 } },
      { id: "small", name: "Night Owls", keywords: [], _count: { members: 2 } },
      { id: "big", name: "Night Shift HQ", keywords: [], _count: { members: 40 } },
      { id: "exact", name: "Night", keywords: [] },
    ];
    expect((await search("night")).lobbies.map((l: any) => l.id)).toEqual([
      "exact",
      "big",
      "small",
      "mid",
      "kw",
    ]);
    H.users = [
      { id: "a", name: "Nyxie", usernameKey: "nyxie" },
      { id: "b", name: "Lynx", usernameKey: "lynx" },
      { id: "c", name: "Nyx", usernameKey: "nyx" },
    ];
    expect((await search("nyx")).people.map((p: any) => p.id)).toEqual(["c", "a", "b"]);
  });

  it("never finds banned people or guests", async () => {
    await search("nyx");
    expect(H.userWhere).toMatchObject({ banned: false, isGuest: false });
  });

  it("keeps posts in unlisted or deleted lobbies out", async () => {
    await search("raid");
    expect(H.sql).toContain('l.unlisted = false AND l."deletedAt" IS NULL');
    expect(H.sql).toContain('p."removedAt" IS NULL');
  });
});

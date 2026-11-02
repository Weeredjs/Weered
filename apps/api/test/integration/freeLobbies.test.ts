import { describe, it, expect, beforeAll, afterAll } from "vitest";
import lobbiesRoutes from "../../src/routes/lobbies";
import placesRoutes, { placeForHost } from "../../src/routes/places";
import { releaseEarnedListings } from "../../src/lib/listingHold";
import { prisma } from "../../src/lib/prisma";
import { buildTestApp, testAuthFromHeader, testToken } from "../helpers/buildTestApp";

// Lobbies are free for everyone, three each; a free account's new lobby stays
// off the listings until three people besides its owner join. New places live
// at a code address with no subdomain (James 2026-11-02).
const stamp = Date.now().toString(36);
const id: Record<string, string> = {};
const made: string[] = [];
let app: any;

beforeAll(async () => {
  for (const [k, tier] of [
    ["free", "INNOCENT"],
    ["paid", "INDICTED"],
    ["full", "INNOCENT"],
    ["placer", "INNOCENT"],
    ["j1", "INNOCENT"],
    ["j2", "INNOCENT"],
    ["j3", "INNOCENT"],
  ] as const) {
    id[k] = (
      await prisma.user.create({
        data: { usernameKey: `itest_fl_${k}_${stamp}`, name: `fl ${k}`, tier },
        select: { id: true },
      })
    ).id;
  }
  // "full" already owns three lobbies; a place doesn't count.
  for (const n of [1, 2, 3]) {
    const lid = `itest-fl-full${n}-${stamp}`;
    await prisma.lobby.create({ data: { id: lid, name: lid, ownerId: id.full } });
    made.push(lid);
  }
  const verify = (t: string) => testAuthFromHeader(`Bearer ${t}`);
  app = await buildTestApp(async (a: any) => {
    await lobbiesRoutes(a, {
      authFromHeader: testAuthFromHeader,
      verifyToken: verify,
      getGlobalRole: async () => "USER",
      canAccessStaff: () => false,
      getLobbyRole: async () => null,
      applyWindroseReel: (x: any) => x,
      lobbyAdminAccess: async () => null,
      globalAudit: async () => {},
      rooms: new Map(),
      isNameReserved: async () => false,
      awardNotoriety: async () => 0,
      send: () => {},
    } as any);
    await placesRoutes(a, { authFromHeader: testAuthFromHeader });
  });
});

afterAll(async () => {
  await app?.close();
  const ids = Object.values(id);
  const owned = await prisma.lobby.findMany({
    where: { ownerId: { in: ids } },
    select: { id: true },
  });
  const all = [...new Set([...made, ...owned.map((l) => l.id)])];
  await prisma.lobbyMember.deleteMany({ where: { lobbyId: { in: all } } }).catch(() => {});
  await prisma.room.deleteMany({ where: { id: { in: all } } }).catch(() => {});
  await prisma.lobby.deleteMany({ where: { id: { in: all } } }).catch(() => {});
  await prisma.user.deleteMany({ where: { id: { in: ids } } }).catch(() => {});
  await prisma.$disconnect();
});

const create = (who: string, lid: string) =>
  app.inject({
    method: "POST",
    url: "/lobbies",
    headers: { authorization: `Bearer ${testToken(id[who])}` },
    payload: { id: lid, name: `Lobby ${lid}` },
  });

describe("free lobbies", () => {
  it("lets a free account make one, held off the listings", async () => {
    const lid = `itest-fl-free-${stamp}`;
    made.push(lid);
    const r = await create("free", lid);
    expect(r.statusCode).toBe(200);
    expect(
      await prisma.lobby.findUnique({
        where: { id: lid },
        select: { unlisted: true, listingHeld: true },
      }),
    ).toEqual({
      unlisted: true,
      listingHeld: true,
    });
  });

  it("lists a paying account's lobby at once", async () => {
    const lid = `itest-fl-paid-${stamp}`;
    made.push(lid);
    expect((await create("paid", lid)).statusCode).toBe(200);
    expect(
      await prisma.lobby.findUnique({
        where: { id: lid },
        select: { unlisted: true, listingHeld: true },
      }),
    ).toEqual({
      unlisted: false,
      listingHeld: false,
    });
  });

  it("stops at three", async () => {
    const r = await create("full", `itest-fl-fourth-${stamp}`);
    expect(r.statusCode).toBe(403);
    expect(r.json().error).toBe("lobby_limit");
  });

  it("releases a held lobby once three people besides the owner join, and leaves staff-unlisted ones alone", async () => {
    const lid = `itest-fl-free-${stamp}`;
    const staffHidden = `itest-fl-hidden-${stamp}`;
    made.push(staffHidden);
    await prisma.lobby.create({ data: { id: staffHidden, name: "hidden", unlisted: true } as any });
    for (const k of ["j1", "j2"])
      await prisma.lobbyMember.create({ data: { lobbyId: lid, userId: id[k], roleLevel: 1 } });
    await releaseEarnedListings();
    expect((await prisma.lobby.findUnique({ where: { id: lid } }))?.unlisted).toBe(true);
    await prisma.lobbyMember.create({ data: { lobbyId: lid, userId: id.j3, roleLevel: 1 } });
    await releaseEarnedListings();
    expect(
      await prisma.lobby.findUnique({
        where: { id: lid },
        select: { unlisted: true, listingHeld: true },
      }),
    ).toEqual({
      unlisted: false,
      listingHeld: false,
    });
    expect((await prisma.lobby.findUnique({ where: { id: staffHidden } }))?.unlisted).toBe(true);
  });
});

describe("places on a code address", () => {
  it("gets a code, no subdomain; an older named place keeps its subdomain", async () => {
    const r = await app.inject({
      method: "POST",
      url: "/places/mine",
      headers: { authorization: `Bearer ${testToken(id.placer)}` },
      payload: {},
    });
    const place = r.json().place;
    expect(place.label).toMatch(/^[a-z2-9]{8}$/);
    expect(place.host).toBeNull();
    expect(place.path).toBe(`/u/${place.label}`);
    expect(await placeForHost(`${place.label}.weered.ca`)).toBeNull();

    const legacy = `u-itestlegacy${stamp}`.slice(0, 32);
    made.push(legacy);
    await prisma.lobby.create({ data: { id: legacy, name: "old place", unlisted: true } as any });
    expect(await placeForHost(`${legacy.slice(2)}.weered.ca`)).toBe(legacy);
  });
});

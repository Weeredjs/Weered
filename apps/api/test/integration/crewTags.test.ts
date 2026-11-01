import { describe, it, expect, afterAll } from "vitest";
import jwt from "jsonwebtoken";
import crewsRoutes from "../../src/routes/crews";
import { buildTestApp, testToken } from "../helpers/buildTestApp";
import { prisma } from "../../src/lib/prisma";

// One crew per tag, so a tag can be claimed before GTA VI's launch, and a tag is
// the crew's address too (weered.ca/crew/TAG). lib/crewTag.ts.
const SECRET = "weered-integration-test-secret";
const verifyToken = (token: string) => {
  try {
    const d: any = jwt.verify(token, SECRET);
    return d?.sub ? { id: String(d.sub), name: String(d.name || d.sub) } : null;
  } catch {
    return null;
  }
};
const stamp = Date.now().toString(36).slice(-4).toUpperCase();
const TAG = `QT${stamp}`; // 6 characters, unique to this run
const OTHER = `QU${stamp}`;
const users: string[] = [];
const crews: string[] = [];
let app: any;

async function newUser(tag: string) {
  const u = await prisma.user.create({
    data: { usernameKey: `itest_tag_${tag}_${stamp}_${Math.floor(performance.now())}`, name: tag },
    select: { id: true },
  });
  users.push(u.id);
  return u.id;
}
const as = (userId: string) => ({ authorization: `Bearer ${testToken(userId)}` });
const create = async (userId: string, tag: string) => {
  const r = await app.inject({
    method: "POST",
    url: "/crews",
    headers: as(userId),
    payload: { name: `Crew ${tag || "none"}`, tag },
  });
  if (r.json()?.crew?.id) crews.push(r.json().crew.id);
  return r;
};

afterAll(async () => {
  await app?.close();
  await (prisma as any).crewMember.deleteMany({ where: { crewId: { in: crews } } }).catch(() => {});
  await (prisma as any).crew.deleteMany({ where: { id: { in: crews } } }).catch(() => {});
  await prisma.user.deleteMany({ where: { id: { in: users } } }).catch(() => {});
  await prisma.$disconnect();
});

describe("crew tags", () => {
  let a = "";
  let b = "";
  let crewA = "";
  let crewB = "";

  it("claims a tag in capitals, and only once whatever the case", async () => {
    app = await buildTestApp((x: any) =>
      crewsRoutes(x, {
        authFromHeader: (h?: string) => verifyToken(String(h || "").replace(/^Bearer\s+/i, "")),
        verifyToken,
        awardNotoriety: async () => null,
        createNotification: async () => {},
        rooms: new Map(),
        fetchReactionsForTargets: async () => ({}),
        getNotorietyRank: () => ({ title: "Unknown" }),
      } as any),
    );
    a = await newUser("a");
    b = await newUser("b");
    const r = await create(a, `[${TAG.toLowerCase()}]`);
    expect(r.statusCode).toBe(200);
    expect(r.json().crew).toMatchObject({ tag: TAG, tagKey: TAG });
    crewA = r.json().crew.id;
    const clash = await create(b, TAG.toLowerCase());
    expect(clash.statusCode).toBe(409);
    expect(clash.json()).toMatchObject({ error: "tag_taken" });
  });

  it("refuses tags that aren't letters and numbers, too short or long, or reserved", async () => {
    expect((await create(b, "A B")).json()).toMatchObject({ error: "tag_chars" });
    expect((await create(b, "A")).json()).toMatchObject({ error: "tag_length" });
    expect((await create(b, "TOOLONG7")).json()).toMatchObject({ error: "tag_length" });
    expect((await create(b, "gta6")).json()).toMatchObject({ error: "tag_reserved" });
    const none = await create(b, "");
    expect(none.statusCode).toBe(200);
    expect(none.json().crew).toMatchObject({ tag: "", tagKey: null });
    crewB = none.json().crew.id;
  });

  it("says whether a tag is free as it's typed", async () => {
    const check = async (tag: string, crewId = "") =>
      (
        await app.inject({
          method: "GET",
          url: `/crews/tag-check?tag=${encodeURIComponent(tag)}&crewId=${crewId}`,
        })
      ).json();
    expect(await check(TAG)).toMatchObject({ available: false });
    expect(await check(OTHER)).toMatchObject({ available: true, tag: OTHER });
    expect(await check(TAG, crewA)).toMatchObject({ available: true });
    expect(await check("x y")).toMatchObject({ available: false });
  });

  it("finds a crew by its tag, in any case", async () => {
    const byTag = await app.inject({ method: "GET", url: `/crews/${TAG.toLowerCase()}` });
    expect(byTag.statusCode).toBe(200);
    expect(byTag.json().crew.id).toBe(crewA);
    expect((await app.inject({ method: "GET", url: `/crews/${crewA}` })).json().crew.tag).toBe(TAG);
  });

  it("keeps the tag theirs when another crew edits toward it, and frees it when dropped", async () => {
    const patch = (userId: string, crewId: string, payload: any) =>
      app.inject({ method: "PATCH", url: `/crews/${crewId}`, headers: as(userId), payload });
    expect((await patch(b, crewB, { tag: TAG })).statusCode).toBe(409);
    expect((await patch(a, crewA, { tag: "" })).json().crew).toMatchObject({
      tag: "",
      tagKey: null,
    });
    expect((await patch(b, crewB, { tag: TAG })).json().crew).toMatchObject({
      tag: TAG,
      tagKey: TAG,
    });
  });

  it("lists a crew in the lobby it was founded in, never a member's place or a made-up lobby", async () => {
    const LOBBY = `itest-taglobby-${stamp.toLowerCase()}`;
    await prisma.lobby.create({ data: { id: LOBBY, name: "Tag lobby", ownerId: a } });
    try {
      const found = async (lobbyId: string) => {
        const r = await app.inject({
          method: "POST",
          url: "/crews",
          headers: as(b),
          payload: { name: `In ${lobbyId}`, lobbyId },
        });
        crews.push(r.json().crew.id);
        return r.json().crew.publicInLobbies;
      };
      expect(await found(LOBBY)).toEqual([LOBBY]);
      expect(await found("u-someone")).toEqual([]);
      expect(await found("no-such-lobby-here")).toEqual([]);
    } finally {
      await prisma.lobby.delete({ where: { id: LOBBY } }).catch(() => {});
    }
  });

  it("lets a crew with a tag from before the rules save other changes", async () => {
    const legacy = await (prisma as any).crew.create({
      data: {
        name: "Old crew",
        tag: "OLD TAG8",
        ownerId: a,
        members: { create: { userId: a, role: "LEADER" } },
      },
    });
    crews.push(legacy.id);
    const r = await app.inject({
      method: "PATCH",
      url: `/crews/${legacy.id}`,
      headers: as(a),
      payload: { name: "Renamed", tag: "OLD TAG8" },
    });
    expect(r.statusCode).toBe(200);
    expect(r.json().crew).toMatchObject({ name: "Renamed", tag: "OLD TAG8" });
  });
});

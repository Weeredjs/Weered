import { describe, it, expect, beforeAll, afterAll } from "vitest";
import lobbyExtrasRoutes from "../../src/routes/lobbyExtras";
import { prisma } from "../../src/lib/prisma";
import { buildTestApp, testAuthFromHeader, testToken } from "../helpers/buildTestApp";

// What a lobby's staff build into it (routes/lobbyExtras.ts): who may save
// scheduled posts, hookups, the host, custom blocks and pages, whose alerts are
// whose, and what a custom block's shared data lets each kind of key do. The
// gates mirror index.ts (lobbyAdminAccess, real role lookups).
const getGlobalRole = async (userId: string) =>
  (await prisma.user.findUnique({ where: { id: userId }, select: { globalRole: true } }))
    ?.globalRole ?? "USER";
const canAccessStaff = (role: any) => ["SUPPORT", "STAFF", "ADMIN", "GOD"].includes(String(role));

async function lobbyAdminAccess(req: any, reply: any, minLevel = 4) {
  const u = testAuthFromHeader(req.headers?.authorization);
  if (!u) {
    reply.code(401).send({ ok: false, error: "unauthorized" });
    return null;
  }
  const lobbyId = String(req.params?.id || "");
  const lobby = await prisma.lobby.findUnique({ where: { id: lobbyId } });
  if (!lobby) {
    reply.code(404).send({ ok: false, error: "lobby_not_found" });
    return null;
  }
  const gr = await getGlobalRole(u.id);
  if (canAccessStaff(gr)) return { user: u, lobby, member: null, globalRole: gr, overrideRole: gr };
  const member = await prisma.lobbyMember.findUnique({
    where: { lobbyId_userId: { lobbyId, userId: u.id } },
  });
  if (!member || (member.roleLevel ?? 1) < minLevel) {
    reply.code(403).send({ ok: false, error: "forbidden" });
    return null;
  }
  return { user: u, lobby, member, globalRole: gr, overrideRole: null };
}

const LOBBY = "itest-extras";
const users: Record<string, string> = {};
let app: any;

const as = (who: string) => ({ authorization: `Bearer ${testToken(users[who])}` });
const call = (who: string | null, method: string, url: string, payload?: unknown) =>
  app.inject({
    method,
    url,
    ...(who ? { headers: as(who) } : {}),
    ...(payload !== undefined ? { payload } : {}),
  });

const CODE = "<div id=p>poll poll poll</div><script>weered.list('mine:vote')</script>";

beforeAll(async () => {
  await prisma.lobby.deleteMany({ where: { id: LOBBY } }).catch(() => {});
  const stamp = Date.now().toString(36);
  for (const [k, tier] of [
    ["owner", "FELON"],
    ["mod", "INNOCENT"],
    ["member", "INNOCENT"],
    ["outsider", "INNOCENT"],
  ]) {
    const u = await prisma.user.create({
      data: { usernameKey: `itest_x_${k}_${stamp}`, name: k, tier: tier as any },
      select: { id: true },
    });
    users[k] = u.id;
  }
  await prisma.lobby.create({ data: { id: LOBBY, name: "Extras Test", ownerId: users.owner } });
  await prisma.lobbyMember.createMany({
    data: [
      { lobbyId: LOBBY, userId: users.owner, roleLevel: 5 },
      { lobbyId: LOBBY, userId: users.mod, roleLevel: 3 },
      { lobbyId: LOBBY, userId: users.member, roleLevel: 1 },
    ],
  });
  await prisma.room.create({ data: { id: `${LOBBY}-war`, name: "War Room", lobbyId: LOBBY } });
  await prisma.room.create({
    data: { id: `${LOBBY}-staff`, name: "Staff", lobbyId: LOBBY, minLevel: 4 },
  });
  app = await buildTestApp((a) =>
    lobbyExtrasRoutes(a, {
      authFromHeader: testAuthFromHeader,
      lobbyAdminAccess,
      getGlobalRole,
      canAccessStaff,
    } as any),
  );
});

afterAll(async () => {
  await app?.close().catch(() => {});
  await prisma.room.deleteMany({ where: { lobbyId: LOBBY } }).catch(() => {});
  await prisma.lobby.deleteMany({ where: { id: LOBBY } }).catch(() => {});
  await prisma.user.deleteMany({ where: { id: { in: Object.values(users) } } }).catch(() => {});
  await prisma.$disconnect();
});

describe("scheduled posts and hookups", () => {
  it("are the staff's: a member and an outsider are refused", async () => {
    const spec = { cadence: "weekly", days: ["tue"], time: "13:00", message: "Reset day." };
    expect(
      (await call("member", "POST", `/lobbies/${LOBBY}/admin/automations`, { kind: "post", spec }))
        .statusCode,
    ).toBe(403);
    expect(
      (
        await call("outsider", "POST", `/lobbies/${LOBBY}/admin/automations`, {
          kind: "post",
          spec,
        })
      ).statusCode,
    ).toBe(403);
    expect(
      (await call(null, "POST", `/lobbies/${LOBBY}/admin/automations`, { kind: "post", spec }))
        .statusCode,
    ).toBe(401);
    const ok = await call("owner", "POST", `/lobbies/${LOBBY}/admin/automations`, {
      kind: "post",
      spec,
      tz: "America/Halifax",
    });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().automation.nextRunAt).toBeTruthy();
  });

  it("refuses a one-off in the past and a hookup that isn't a channel or feed", async () => {
    const past = await call("owner", "POST", `/lobbies/${LOBBY}/admin/automations`, {
      kind: "post",
      spec: { cadence: "once", date: "2020-01-01", time: "10:00", message: "x" },
    });
    expect(past.json().error).toBe("in_the_past");
    const bad = await call("owner", "POST", `/lobbies/${LOBBY}/admin/automations`, {
      kind: "feed",
      spec: { source: "rss", target: "file:///etc/passwd" },
    });
    expect(bad.json().error).toBe("bad_feed");
    const good = await call("owner", "POST", `/lobbies/${LOBBY}/admin/automations`, {
      kind: "feed",
      spec: { source: "twitch", target: "https://twitch.tv/SomeStreamer" },
    });
    expect(good.json().automation.spec.target).toBe("somestreamer");
  });
});

describe("alerts", () => {
  it("are each member's own, only for rooms they can enter", async () => {
    const mine = await call("member", "POST", `/lobbies/${LOBBY}/alerts`, {
      roomId: `${LOBBY}-war`,
      threshold: 4,
    });
    expect(mine.statusCode).toBe(200);
    // A staff-only room is not one a member can watch.
    const staff = await call("member", "POST", `/lobbies/${LOBBY}/alerts`, {
      roomId: `${LOBBY}-staff`,
      threshold: 2,
    });
    expect(staff.statusCode).toBe(404);
    // Another lobby's room id is not this lobby's room.
    const other = await call("member", "POST", `/lobbies/${LOBBY}/alerts`, {
      roomId: "lobby",
      threshold: 2,
    });
    expect(other.statusCode).toBe(404);
    expect(
      (
        await call("outsider", "POST", `/lobbies/${LOBBY}/alerts`, {
          roomId: `${LOBBY}-war`,
          threshold: 2,
        })
      ).statusCode,
    ).toBe(403);
    // Someone else can't see or delete it.
    const ownerList = await call("owner", "GET", `/lobbies/${LOBBY}/alerts`);
    expect(ownerList.json().alerts).toHaveLength(0);
    const del = await call("owner", "DELETE", `/lobbies/${LOBBY}/alerts/${mine.json().alert.id}`);
    expect(del.json().removed).toBe(0);
  });
});

describe("the host", () => {
  it("is saved by staff, cleaned, and needs a persona to be on", async () => {
    const noPersona = await call("owner", "PATCH", `/lobbies/${LOBBY}/admin/host`, {
      host: { name: "Sarge", persona: "" },
    });
    expect(noPersona.json().error).toBe("persona_required");
    const ok = await call("owner", "PATCH", `/lobbies/${LOBBY}/admin/host`, {
      host: {
        name: "Sarge",
        persona: "You are Sarge.",
        welcomeLines: ["Hi {name}", "no placeholder"],
      },
    });
    expect(ok.json().host).toMatchObject({ on: true, name: "Sarge", welcomeLines: ["Hi {name}"] });
    expect(
      (
        await call("member", "PATCH", `/lobbies/${LOBBY}/admin/host`, {
          host: { name: "X", persona: "y" },
        })
      ).statusCode,
    ).toBe(403);
  });
});

describe("custom blocks and what they keep", () => {
  let blockId = "";
  it("are saved by paid staff, never with code that reaches out", async () => {
    const bad = await call("owner", "POST", `/lobbies/${LOBBY}/admin/blocks`, {
      kind: "block",
      title: "x",
      code: "<div>ok ok ok ok ok</div><script>fetch('https://evil.example')</script>",
    });
    expect(bad.json().error).toBe("bad_code");
    // The moderator is staff here but not at the level that edits the lobby's look.
    expect(
      (
        await call("mod", "POST", `/lobbies/${LOBBY}/admin/blocks`, {
          kind: "block",
          title: "x",
          code: CODE,
        })
      ).statusCode,
    ).toBe(403);
    const ok = await call("owner", "POST", `/lobbies/${LOBBY}/admin/blocks`, {
      kind: "block",
      title: "Poll",
      code: CODE,
    });
    expect(ok.statusCode).toBe(200);
    blockId = ok.json().block.id;
    // Anyone can load it to run it.
    expect((await call(null, "GET", `/lobbies/${LOBBY}/blocks/${blockId}`)).json().block.code).toBe(
      CODE,
    );
  });

  it("keeps mine: keys per person, staff: keys for staff, and refuses the signed-out", async () => {
    const put = (who: string | null, key: string, value: unknown) =>
      call(who, "PUT", `/blocks/${blockId}/data/${encodeURIComponent(key)}`, { value });
    expect((await put(null, "mine:vote", "A")).statusCode).toBe(401);
    expect((await put("member", "mine:vote", "A")).statusCode).toBe(200);
    expect((await put("outsider", "mine:vote", "B")).statusCode).toBe(200);
    // Each person's own: the member's vote is still A.
    const memberVote = await call("member", "GET", `/blocks/${blockId}/data/mine:vote`);
    expect(memberVote.json().item.value).toBe("A");
    const all = await call(null, "GET", `/blocks/${blockId}/data?prefix=mine:vote`);
    expect(
      all
        .json()
        .items.map((i: any) => i.value)
        .sort(),
    ).toEqual(["A", "B"]);
    expect(all.json().items.every((i: any) => i.key === "mine:vote")).toBe(true);
    // staff: keys are the moderators' and up.
    expect((await put("member", "staff:score", 10)).statusCode).toBe(403);
    expect((await put("mod", "staff:score", 10)).statusCode).toBe(200);
    // Keys are plain, values small.
    expect((await put("member", "bad key!", 1)).statusCode).toBe(400);
    expect((await put("member", "big", "x".repeat(3000))).statusCode).toBe(400);
    // null removes.
    await put("outsider", "mine:vote", null);
    const after = await call(null, "GET", `/blocks/${blockId}/data?prefix=mine:vote`);
    expect(after.json().items).toHaveLength(1);
  });
});

describe("pages", () => {
  it("are written by staff with unique slugs and read by anyone", async () => {
    const a = await call("owner", "POST", `/lobbies/${LOBBY}/admin/pages`, {
      title: "Build guide",
      body: "## Gear",
    });
    const b = await call("owner", "POST", `/lobbies/${LOBBY}/admin/pages`, {
      title: "Build guide",
      body: "again",
    });
    expect(a.json().page.slug).toBe("build-guide");
    expect(b.json().page.slug).toBe("build-guide-2");
    expect(
      (await call("member", "POST", `/lobbies/${LOBBY}/admin/pages`, { title: "x", body: "y" }))
        .statusCode,
    ).toBe(403);
    const list = await call(null, "GET", `/lobbies/${LOBBY}/pages`);
    expect(list.json().pages.map((p: any) => p.slug)).toEqual(["build-guide", "build-guide-2"]);
    expect((await call(null, "GET", `/lobbies/${LOBBY}/pages/build-guide`)).json().page.body).toBe(
      "## Gear",
    );
  });
});

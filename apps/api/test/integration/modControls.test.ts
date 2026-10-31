import { describe, it, expect, beforeAll, afterAll } from "vitest";
import staffRoutes from "../../src/routes/staff";
import profileRoutes from "../../src/routes/profile";
import { prisma } from "../../src/lib/prisma";
import { buildTestApp, testAuthFromHeader, testToken } from "../helpers/buildTestApp";

// The lobby chat's mod tools James tested on 2026-10-31 (routes/staff.ts): clear
// takes the messages out of the table they're loaded from, so they don't come
// back on reload; lock stops the chat, not the door; and the lobby's own
// moderators can do both, members can't. Then a member saving a look of their
// own (routes/profile.ts with lib/looks.ts).
const LOBBY = "itest-modctl";
const users: Record<string, string> = {};
const sent: any[] = [];
const memRoom: any = {
  roomId: LOBBY,
  msgs: [{ id: "m" }],
  pinnedMsgs: new Map([["m", {}]]),
  chatLocked: false,
};

const getGlobalRole = async (userId: string) =>
  (await prisma.user.findUnique({ where: { id: userId }, select: { globalRole: true } }))
    ?.globalRole ?? "USER";

let staff: any;
let profile: any;
const as = (who: string) => ({ authorization: `Bearer ${testToken(users[who])}` });

beforeAll(async () => {
  await prisma.room.deleteMany({ where: { id: LOBBY } }).catch(() => {});
  await prisma.lobby.deleteMany({ where: { id: LOBBY } }).catch(() => {});
  const stamp = Date.now().toString(36);
  for (const k of ["owner", "mod", "member"]) {
    const u = await prisma.user.create({
      data: { usernameKey: `itest_mc_${k}_${stamp}`, name: k },
      select: { id: true },
    });
    users[k] = u.id;
  }
  await prisma.lobby.create({ data: { id: LOBBY, name: "Mod Controls", ownerId: users.owner } });
  await prisma.lobbyMember.createMany({
    data: [
      { lobbyId: LOBBY, userId: users.owner, roleLevel: 5 },
      { lobbyId: LOBBY, userId: users.mod, roleLevel: 3 },
      { lobbyId: LOBBY, userId: users.member, roleLevel: 1 },
    ],
  });
  await prisma.room.create({ data: { id: LOBBY, name: "Mod Controls", lobbyId: LOBBY } });
  await prisma.roomMessage.createMany({
    data: [1, 2, 3].map((n) => ({
      id: `${LOBBY}-m${n}`,
      roomId: LOBBY,
      userId: users.member,
      body: `msg ${n}`,
    })),
  });

  const target: any = {
    authFromHeader: testAuthFromHeader,
    getGlobalRole,
    canAccessStaff: (r: string | null) => ["ADMIN", "STAFF", "GOD", "SUPPORT"].includes(String(r)),
    canAssignRoles: () => false,
    globalAudit: async () => {},
    broadcast: (_room: any, m: any) => sent.push(m),
    publishState: () => {},
    rooms: new Map([[LOBBY, memRoom]]),
  };
  const opts = new Proxy(target, {
    get: (t: any, p: string) => (p in t ? t[p] : () => Promise.resolve()),
  });
  staff = await buildTestApp((app: any) => staffRoutes(app, opts));
  profile = await buildTestApp((app: any) =>
    profileRoutes(app, {
      authFromHeader: testAuthFromHeader,
      getNotorietyRank: () => ({ title: "Innocent", min: 0, next: null }),
      awardNotoriety: async () => null,
      rooms: new Map(),
      publishState: () => {},
    } as any),
  );
});

afterAll(async () => {
  await staff?.close();
  await profile?.close();
  await prisma.room.deleteMany({ where: { id: LOBBY } }).catch(() => {});
  await prisma.lobby.deleteMany({ where: { id: LOBBY } }).catch(() => {});
  await prisma.user.deleteMany({ where: { id: { in: Object.values(users) } } }).catch(() => {});
  await prisma.$disconnect();
});

describe("lobby chat mod tools", () => {
  it("a member can't clear or lock the lobby's chat", async () => {
    for (const url of ["/staff/lobby/clear-chat", "/staff/lobby/lock"]) {
      const r = await staff.inject({
        method: "POST",
        url,
        headers: as("member"),
        payload: { lobbyId: LOBBY },
      });
      expect(r.statusCode, url).toBe(403);
    }
    expect(await prisma.roomMessage.count({ where: { roomId: LOBBY } })).toBe(3);
  });

  it("the lobby's moderator clears it for good", async () => {
    const r = await staff.inject({
      method: "POST",
      url: "/staff/lobby/clear-chat",
      headers: as("mod"),
      payload: { lobbyId: LOBBY },
    });
    expect(r.statusCode).toBe(200);
    expect(r.json().removed).toBe(3);
    // Gone from the table the chat loads from, so a reload doesn't bring it back.
    expect(await prisma.roomMessage.count({ where: { roomId: LOBBY } })).toBe(0);
    expect(memRoom.msgs).toEqual([]);
    expect(memRoom.pinnedMsgs.size).toBe(0);
    expect(sent.map((m) => m.type)).toEqual(expect.arrayContaining(["chat:cleared", "chat:pins"]));
  });

  it("lock stops the chat and leaves the door alone", async () => {
    const lock = await staff.inject({
      method: "POST",
      url: "/staff/lobby/lock",
      headers: as("mod"),
      payload: { lobbyId: LOBBY },
    });
    expect(lock.statusCode).toBe(200);
    let row = await prisma.room.findUnique({
      where: { id: LOBBY },
      select: { chatLocked: true, locked: true },
    });
    expect(row).toEqual({ chatLocked: true, locked: false });
    expect(memRoom.chatLocked).toBe(true);
    expect(sent.some((m) => m.type === "room:chat:disable")).toBe(true);

    const unlock = await staff.inject({
      method: "POST",
      url: "/staff/lobby/unlock",
      headers: as("owner"),
      payload: { lobbyId: LOBBY },
    });
    expect(unlock.statusCode).toBe(200);
    row = await prisma.room.findUnique({
      where: { id: LOBBY },
      select: { chatLocked: true, locked: true },
    });
    expect(row).toEqual({ chatLocked: false, locked: false });
  });

  it("nobody but Weered's staff touches the main lobby", async () => {
    const r = await staff.inject({
      method: "POST",
      url: "/staff/lobby/clear-chat",
      headers: as("owner"),
      payload: { lobbyId: "lobby" },
    });
    expect(r.statusCode).toBe(403);
  });
});

describe("a look of their own", () => {
  const patch = (payload: unknown) =>
    profile.inject({ method: "PATCH", url: "/profile/me", headers: as("member"), payload });
  const saved = async () =>
    prisma.user.findUnique({
      where: { id: users.member },
      select: { nameEffect: true, avatarFrame: true },
    });

  it("saves their colours, a preset, and none", async () => {
    let r = await patch({
      nameEffect: { colors: ["#FF00AA", "#22ccff"], glow: true, motion: "shimmer" },
      avatarFrame: "c:#ffd700,#8b5cf6:cycle",
    });
    expect(r.statusCode).toBe(200);
    expect(await saved()).toEqual({
      nameEffect: "c:#ff00aa,#22ccff:g1:shimmer",
      avatarFrame: "c:#ffd700,#8b5cf6:cycle",
    });

    r = await patch({ nameEffect: "gilded", avatarFrame: "holo" });
    expect(r.statusCode).toBe(200);
    expect(await saved()).toEqual({ nameEffect: "gilded", avatarFrame: "holo" });

    r = await patch({ nameEffect: "none", avatarFrame: null });
    expect(r.statusCode).toBe(200);
    expect(await saved()).toEqual({ nameEffect: null, avatarFrame: null });
  });

  it("anything that isn't a look is not written", async () => {
    await patch({ nameEffect: "fire" });
    await patch({ nameEffect: "c:#ff0000;background:url(x):g1:none", bio: "still saves" });
    expect((await saved())?.nameEffect).toBe("fire");
  });
});

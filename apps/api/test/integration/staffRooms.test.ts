import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mayEnterStaffRoom, isStaffRoomId } from "../../src/lib/staffRooms";
import { prisma } from "../../src/lib/prisma";

// Staff chat is staff only (2026-11-01 ops audit: any member could join @ops,
// read the last 80 staff messages and post, and @admin-<lobby> the same).
const stamp = Date.now().toString(36);
const LOBBY = `itest-staffroom-${stamp}`;
const id: Record<string, string> = {};

beforeAll(async () => {
  const roles: Record<string, any> = {
    member: "USER",
    support: "SUPPORT",
    owner: "USER",
    mod: "USER",
    helper: "USER",
  };
  for (const [k, globalRole] of Object.entries(roles)) {
    const u = await prisma.user.create({
      data: { usernameKey: `itest_sr_${k}_${stamp}`, name: k, globalRole },
      select: { id: true },
    });
    id[k] = u.id;
  }
  await prisma.lobby.create({ data: { id: LOBBY, name: "Staff room test", ownerId: id.owner } });
  await prisma.lobbyMember.create({ data: { lobbyId: LOBBY, userId: id.mod, roleLevel: 3 } });
  await prisma.lobbyMember.create({ data: { lobbyId: LOBBY, userId: id.helper, roleLevel: 2 } });
});

afterAll(async () => {
  await prisma.lobbyMember.deleteMany({ where: { lobbyId: LOBBY } }).catch(() => {});
  await prisma.lobby.deleteMany({ where: { id: LOBBY } }).catch(() => {});
  await prisma.user.deleteMany({ where: { id: { in: Object.values(id) } } }).catch(() => {});
  await prisma.$disconnect();
});

describe("staff chat rooms", () => {
  it("knows which rooms are staff chat", () => {
    expect(isStaffRoomId("@ops")).toBe(true);
    expect(isStaffRoomId(`@admin-${LOBBY}`)).toBe(true);
    expect(isStaffRoomId("lobby")).toBe(false);
    expect(isStaffRoomId("ops")).toBe(false);
  });

  it("lets only Weered's staff into @ops", async () => {
    expect(await mayEnterStaffRoom(id.member, "@ops")).toBe(false);
    expect(await mayEnterStaffRoom(id.owner, "@ops")).toBe(false);
    expect(await mayEnterStaffRoom(undefined, "@ops")).toBe(false);
    expect(await mayEnterStaffRoom(id.support, "@ops")).toBe(true);
  });

  it("lets a lobby's moderators and up, and Weered's staff, into its admin chat", async () => {
    const room = `@admin-${LOBBY}`;
    expect(await mayEnterStaffRoom(id.owner, room)).toBe(true);
    expect(await mayEnterStaffRoom(id.mod, room)).toBe(true);
    expect(await mayEnterStaffRoom(id.support, room)).toBe(true);
    expect(await mayEnterStaffRoom(id.helper, room)).toBe(false);
    expect(await mayEnterStaffRoom(id.member, room)).toBe(false);
    expect(await mayEnterStaffRoom(id.member, "@admin-")).toBe(false);
  });

  it("leaves every other room alone", async () => {
    expect(await mayEnterStaffRoom(id.member, "lobby")).toBe(true);
    expect(await mayEnterStaffRoom(undefined, LOBBY)).toBe(true);
  });
});

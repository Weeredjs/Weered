import { describe, it, expect, beforeAll, afterAll } from "vitest";
import invitesRoutes from "../../src/routes/invites";
import { registerLobbyJoin } from "../../src/routes/lobbyJoin";
import { prisma } from "../../src/lib/prisma";
import { canAssignRoles, getGlobalRole } from "../../src/lib/lobbyAuth";
import { buildTestApp, testAuthFromHeader, testToken } from "../helpers/buildTestApp";

// Invites into lobbies, rooms and crews (red team 2026-11-01, finding 2):
// making one takes the power to let people in; using one never beats a ban or
// the front door, and an invite dies with its maker's rights.
const stamp = Date.now().toString(36);
const id: Record<string, string> = {};
const PW = `itest-inv-pw-${stamp}`;
const OPEN = `itest-inv-open-${stamp}`;
const DOOR = `itest-inv-door-${stamp}`;
const ROOM = `itest-inv-room-${stamp}`;
let crewId = "";
let app: any;

const as = (who: string) => ({ authorization: `Bearer ${testToken(id[who])}` });
const mint = (who: string, type: string, targetId: string) =>
  app.inject({ method: "POST", url: "/invites", headers: as(who), payload: { type, targetId } });
const accept = (who: string, token: string) =>
  app.inject({ method: "POST", url: `/invites/${token}/accept`, headers: as(who), payload: {} });
const memberOf = (lobbyId: string, who: string) =>
  prisma.lobbyMember.findUnique({ where: { lobbyId_userId: { lobbyId, userId: id[who] } } });

beforeAll(async () => {
  for (const k of [
    "owner",
    "mod",
    "member",
    "outsider",
    "banned",
    "staff",
    "lead",
    "crew",
    "guest1",
    "guest2",
    "guest3",
  ]) {
    const u = await prisma.user.create({
      data: {
        usernameKey: `itest_inv_${k}_${stamp}`,
        name: k,
        globalRole: k === "staff" ? "ADMIN" : "USER",
      },
      select: { id: true },
    });
    id[k] = u.id;
  }
  const door = { door: { on: true, rules: ["Be decent"], questions: [], age18: false } };
  await prisma.lobby.create({
    data: { id: PW, name: "pw", ownerId: id.owner, joinMode: "PASSWORD", joinPassword: "secret" },
  });
  await prisma.lobby.create({ data: { id: OPEN, name: "open", ownerId: id.owner } });
  await prisma.lobby.create({
    data: {
      id: DOOR,
      name: "door",
      ownerId: id.owner,
      joinMode: "PASSWORD",
      joinPassword: "secret",
      layout: door,
    },
  });
  for (const lobbyId of [PW, OPEN, DOOR])
    await prisma.lobbyMember.createMany({
      data: [
        { lobbyId, userId: id.mod, name: "mod", role: "MOD", roleLevel: 3 },
        { lobbyId, userId: id.member, name: "member", role: "MEMBER", roleLevel: 1 },
      ],
    });
  await prisma.lobbyBan.create({ data: { lobbyId: PW, userId: id.banned } });
  await prisma.room.create({ data: { id: ROOM, name: "room", lobbyId: OPEN, ownerId: id.owner } });
  const crew = await prisma.crew.create({
    data: { name: `itest crew ${stamp}`, ownerId: id.lead },
  });
  crewId = crew.id;
  await prisma.crewMember.createMany({
    data: [
      { crewId, userId: id.lead, name: "lead", role: "LEADER" },
      { crewId, userId: id.crew, name: "crew", role: "MEMBER" },
    ],
  });
  app = await buildTestApp(async (a: any) => {
    await invitesRoutes(a, {
      authFromHeader: testAuthFromHeader,
      awardNotoriety: async () => null,
      getGlobalRole,
      canAssignRoles,
      WEB_URL: "https://weered.ca",
    } as any);
    registerLobbyJoin(a, {
      authFromHeader: testAuthFromHeader,
      lobbyAdminAccess: async () => null,
    } as any);
  });
});

afterAll(async () => {
  await app?.close();
  const users = Object.values(id);
  await prisma.invite.deleteMany({ where: { createdBy: { in: users } } }).catch(() => {});
  await prisma.directMessage
    .deleteMany({ where: { OR: [{ fromId: { in: users } }, { toId: { in: users } }] } })
    .catch(() => {});
  await prisma.lobby.deleteMany({ where: { id: { in: [PW, OPEN, DOOR] } } }).catch(() => {});
  await prisma.lobbyBan.deleteMany({ where: { lobbyId: PW } }).catch(() => {});
  await prisma.crew.deleteMany({ where: { id: crewId } }).catch(() => {});
  await prisma.user.deleteMany({ where: { id: { in: users } } }).catch(() => {});
  await prisma.$disconnect();
});

describe("who may make an invite", () => {
  it("not an outsider, for a lobby, a room or a crew", async () => {
    expect((await mint("outsider", "LOBBY", PW)).statusCode).toBe(403);
    expect((await mint("outsider", "ROOM", ROOM)).statusCode).toBe(403);
    expect((await mint("outsider", "CREW", crewId)).statusCode).toBe(403);
  });

  it("not a plain member behind a lock, but yes where anyone can walk in", async () => {
    expect((await mint("member", "LOBBY", PW)).statusCode).toBe(403);
    expect((await mint("member", "LOBBY", OPEN)).statusCode).toBe(200);
    expect((await mint("crew", "CREW", crewId)).statusCode).toBe(403);
  });

  it("yes for a moderator, the owner, a crew leader and staff", async () => {
    expect((await mint("mod", "LOBBY", PW)).statusCode).toBe(200);
    expect((await mint("owner", "ROOM", ROOM)).statusCode).toBe(200);
    expect((await mint("lead", "CREW", crewId)).statusCode).toBe(200);
    expect((await mint("staff", "LOBBY", PW)).statusCode).toBe(200);
  });
});

describe("using an invite", () => {
  it("a moderator's invite gets someone past the password", async () => {
    const token = (await mint("mod", "LOBBY", PW)).json().invite.token;
    expect((await accept("guest1", token)).statusCode).toBe(200);
    expect(await memberOf(PW, "guest1")).toBeTruthy();
  });

  it("never gets a banned person back in", async () => {
    const token = (await mint("mod", "LOBBY", PW)).json().invite.token;
    const r = await accept("banned", token);
    expect(r.statusCode).toBe(403);
    expect(r.json().error).toBe("banned");
    expect(await memberOf(PW, "banned")).toBeNull();
  });

  it("dies when its maker loses the right to make it", async () => {
    const token = (await mint("mod", "LOBBY", PW)).json().invite.token;
    await prisma.lobbyMember.update({
      where: { lobbyId_userId: { lobbyId: PW, userId: id.mod } },
      data: { roleLevel: 1, role: "MEMBER" },
    });
    const r = await accept("guest2", token);
    await prisma.lobbyMember.update({
      where: { lobbyId_userId: { lobbyId: PW, userId: id.mod } },
      data: { roleLevel: 3, role: "MOD" },
    });
    expect(r.statusCode).toBe(403);
    expect(await memberOf(PW, "guest2")).toBeNull();
  });

  it("still goes through the front door, skipping only the lock", async () => {
    const token = (await mint("mod", "LOBBY", DOOR)).json().invite.token;
    const r = await accept("guest3", token);
    expect(r.json().error).toBe("door_required");
    expect(r.json().redirect).toBe(`/lobby/${DOOR}?invite=${token}`);
    expect(await memberOf(DOOR, "guest3")).toBeNull();

    const join = (body: any) =>
      app.inject({
        method: "POST",
        url: `/lobbies/${DOOR}/join`,
        headers: as("guest3"),
        payload: body,
      });
    // The rules still have to be accepted...
    expect((await join({ invite: token })).statusCode).toBe(403);
    // ...but no password is asked.
    const ok = await join({ invite: token, acceptRules: true });
    expect(ok.statusCode).toBe(200);
    expect((await memberOf(DOOR, "guest3"))?.door).toBeTruthy();
    expect((await prisma.invite.findUnique({ where: { token } }))?.uses).toBe(1);
  });

  it("a stranger's made-up token doesn't open the lock", async () => {
    const r = await app.inject({
      method: "POST",
      url: `/lobbies/${DOOR}/join`,
      headers: as("outsider"),
      payload: { invite: "not-a-token", acceptRules: true },
    });
    expect(r.statusCode).toBe(403);
    expect(r.json().error).toBe("wrong_password");
  });
});

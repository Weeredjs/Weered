import { describe, it, expect, beforeAll, afterAll } from "vitest";
import lobbyDeleteRoutes from "../../src/routes/lobbyDelete";
import {
  handOffLobbies,
  isLobbyDeleted,
  loadDeletedLobbies,
  purgeDeletedLobbies,
} from "../../src/lib/lobbyDelete";
import { prisma } from "../../src/lib/prisma";
import { buildTestApp, testAuthFromHeader, testToken } from "../helpers/buildTestApp";

// Deleting a lobby (James 2026-11-02: "30 day is smart", "Top mod"): gone at
// once, restorable by staff for 30 days, then erased with everything filed
// under its id; an owner's account deletion hands each lobby to its top mod.
const s = Date.now().toString(36);
const id: Record<string, string> = {};
const L = (k: string) => `itest-ld-${k}-${s}`;
const roles: Record<string, string> = {};
let app: any;

async function user(k: string, globalRole = "USER") {
  id[k] = (
    await prisma.user.create({
      data: { usernameKey: `itest_ld_${k}_${s}`, name: `ld ${k}`, globalRole: globalRole as any },
      select: { id: true },
    })
  ).id;
  roles[id[k]] = globalRole;
}
async function lobby(k: string, owner: string, data: any = {}) {
  await prisma.lobby.create({
    data: { id: L(k), name: `Lobby ${k}`, ownerId: id[owner], ...data },
  });
  return L(k);
}
const post = (who: string, url: string, payload: any = {}) =>
  app.inject({
    method: "POST",
    url,
    headers: { authorization: `Bearer ${testToken(id[who])}` },
    payload,
  });

beforeAll(async () => {
  for (const k of ["owner", "mod", "admin", "member", "outsider"]) await user(k);
  await user("staff", "STAFF");
  await user("support", "SUPPORT");
  app = await buildTestApp((a: any) =>
    lobbyDeleteRoutes(a, {
      authFromHeader: testAuthFromHeader,
      getGlobalRole: async (uid: string) => roles[uid] || "USER",
    }),
  );
});

afterAll(async () => {
  await app?.close();
  const ids = await prisma.lobby.findMany({
    where: { id: { startsWith: "itest-ld-" } },
    select: { id: true },
  });
  await prisma.room
    .deleteMany({
      where: {
        OR: [{ lobbyId: { in: ids.map((x) => x.id) } }, { id: { startsWith: "itest-ld-" } }],
      },
    })
    .catch(() => {});
  await prisma.lobby.deleteMany({ where: { id: { startsWith: "itest-ld-" } } }).catch(() => {});
  await prisma.user.deleteMany({ where: { id: { in: Object.values(id) } } }).catch(() => {});
  await prisma.$disconnect();
});

describe("the owner deletes a lobby", () => {
  it("only the owner, and only with its name typed", async () => {
    const lid = await lobby("own", "owner");
    await prisma.lobbyMember.create({
      data: { lobbyId: lid, userId: id.mod, roleLevel: 4, role: "MOD" },
    });
    expect(
      (await post("mod", `/lobbies/${lid}/admin/delete`, { confirm: "Lobby own" })).statusCode,
    ).toBe(403);
    expect(
      (await post("owner", `/lobbies/${lid}/admin/delete`, { confirm: "wrong" })).statusCode,
    ).toBe(400);
    expect(
      (await post("owner", `/lobbies/${lid}/admin/delete`, { confirm: "lobby OWN" })).statusCode,
    ).toBe(200);
  });

  it("is gone at once: off every list, address and domain released, invites dead", async () => {
    const lid = await lobby("gone", "owner", {
      subdomain: true,
      featured: true,
      customDomain: `ld-${s}.example.com`,
      domainStatus: "live",
    });
    const inv = await prisma.invite.create({
      data: { type: "LOBBY", targetId: lid, createdBy: id.owner },
    });
    expect((await post("owner", `/lobbies/${lid}/admin/delete`, { confirm: lid })).statusCode).toBe(
      200,
    );
    const row = await prisma.lobby.findUnique({ where: { id: lid } });
    expect(row?.deletedAt).toBeTruthy();
    expect(row).toMatchObject({
      unlisted: true,
      subdomain: false,
      featured: false,
      customDomain: null,
    });
    expect(await prisma.invite.findUnique({ where: { id: inv.id } })).toBeNull();
    expect(isLobbyDeleted(lid)).toBe(true);
  });

  it("is refused while members pay the lobby every month", async () => {
    const lid = await lobby("paid", "owner");
    const tier = await prisma.lobbyTier.create({
      data: { lobbyId: lid, name: "Gold", priceMonthly: 500 } as any,
    });
    await prisma.lobbyTierSub.create({
      data: { lobbyTierId: tier.id, lobbyId: lid, userId: id.member, status: "active" },
    });
    const r = await post("owner", `/lobbies/${lid}/admin/delete`, { confirm: lid });
    expect(r.statusCode).toBe(409);
    expect(r.json().error).toBe("paying_members");
  });
});

describe("staff", () => {
  it("Support can't delete; staff can, and can bring it back as it was", async () => {
    const lid = await lobby("staff", "owner", { subdomain: true, unlisted: false });
    expect((await post("support", `/staff/lobbies/${lid}/delete`)).statusCode).toBe(403);
    expect(
      (await post("staff", `/staff/lobbies/${lid}/delete`, { reason: "abandoned" })).statusCode,
    ).toBe(200);
    const list = await app.inject({
      method: "GET",
      url: "/staff/lobbies/deleted",
      headers: { authorization: `Bearer ${testToken(id.staff)}` },
    });
    expect(list.json().lobbies.some((x: any) => x.id === lid)).toBe(true);
    expect((await post("staff", `/staff/lobbies/${lid}/restore`)).statusCode).toBe(200);
    const row = await prisma.lobby.findUnique({ where: { id: lid } });
    expect(row).toMatchObject({ deletedAt: null, unlisted: false, subdomain: true });
    expect(isLobbyDeleted(lid)).toBe(false);
  });
});

describe("after 30 days", () => {
  it("erases the lobby and everything filed under its id; a younger one stays", async () => {
    const old = await lobby("old", "owner");
    const young = await lobby("young", "owner");
    await prisma.room.create({ data: { id: `${old}-room`, name: "Room", lobbyId: old } });
    // Filed under the id with no database link: the purge clears it by hand.
    await prisma.lfgPost.create({ data: { lobbyId: old, userId: id.owner, activity: "Raid" } });
    expect(await prisma.lfgPost.count({ where: { lobbyId: old } })).toBe(1);
    await post("owner", `/lobbies/${old}/admin/delete`, { confirm: old });
    await post("owner", `/lobbies/${young}/admin/delete`, { confirm: young });
    await prisma.lobby.update({
      where: { id: old },
      data: { deletedAt: new Date(Date.now() - 31 * 24 * 3600_000) },
    });
    await purgeDeletedLobbies();
    expect(await prisma.lobby.findUnique({ where: { id: old } })).toBeNull();
    expect(await prisma.room.findUnique({ where: { id: `${old}-room` } })).toBeNull();
    expect(await prisma.lfgPost.count({ where: { lobbyId: old } })).toBe(0);
    expect(await prisma.lobby.findUnique({ where: { id: young } })).not.toBeNull();
    await loadDeletedLobbies();
    expect(isLobbyDeleted(old)).toBe(false);
    expect(isLobbyDeleted(young)).toBe(true);
  });
});

describe("an owner deleting their account", () => {
  it("hands each lobby to its top moderator; one without, and their place, is deleted", async () => {
    await user("leaver");
    const withMods = await lobby("heirs", "leaver");
    const noMods = await lobby("nomods", "leaver");
    const place = `u-itestld${s}`;
    await prisma.lobby.create({
      data: { id: place, name: "place", ownerId: id.leaver, unlisted: true },
    });
    await prisma.lobbyMember.createMany({
      data: [
        { lobbyId: withMods, userId: id.leaver, roleLevel: 5, role: "OWNER" },
        { lobbyId: withMods, userId: id.mod, roleLevel: 3, role: "MOD" },
        { lobbyId: withMods, userId: id.admin, roleLevel: 4, role: "MOD" },
        { lobbyId: noMods, userId: id.member, roleLevel: 2, role: "MEMBER" },
      ],
    });
    await handOffLobbies(id.leaver, "deleted_x");
    const heirs = await prisma.lobby.findUnique({ where: { id: withMods } });
    expect(heirs?.ownerId).toBe(id.admin);
    expect(heirs?.deletedAt).toBeNull();
    const heir = await prisma.lobbyMember.findFirst({
      where: { lobbyId: withMods, userId: id.admin },
    });
    expect(heir).toMatchObject({ roleLevel: 5, role: "OWNER" });
    const told = await prisma.notification.findFirst({
      where: { userId: id.admin, title: { contains: "You now own" } },
    });
    expect(told).toBeTruthy();
    expect((await prisma.lobby.findUnique({ where: { id: noMods } }))?.deletedAt).toBeTruthy();
    expect((await prisma.lobby.findUnique({ where: { id: place } }))?.deletedAt).toBeTruthy();
    await prisma.lobby.deleteMany({ where: { id: place } }).catch(() => {});
  });
});

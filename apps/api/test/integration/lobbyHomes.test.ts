import { describe, it, expect, afterAll } from "vitest";
import { homeLobbiesOf } from "../../src/lib/lobbyHomes";
import { prisma } from "../../src/lib/prisma";

// The Town Square's tags read only lobbies already public in Downtown: a held
// one, an unlisted one and a deleted one never show (2026-11-12).
const stamp = Date.now().toString(36) + Math.floor(Math.random() * 1e4);
const id = (k: string) => `itest-home-${k}-${stamp}`;
const users: Record<string, string> = {};
const lobbies = ["open", "held", "hidden", "gone"].map(id);

afterAll(async () => {
  await prisma.lobbyMember.deleteMany({ where: { lobbyId: { in: lobbies } } }).catch(() => {});
  await prisma.lobby.deleteMany({ where: { id: { in: lobbies } } }).catch(() => {});
  await prisma.user.deleteMany({ where: { id: { in: Object.values(users) } } }).catch(() => {});
  await prisma.$disconnect();
});

describe("homeLobbiesOf", () => {
  it("tags people with public lobbies only", async () => {
    for (const k of ["owner", "member", "heldOwner", "loner"]) {
      const u = await prisma.user.create({
        data: { usernameKey: `itest_home_${k}_${stamp}`, name: k },
        select: { id: true },
      });
      users[k] = u.id;
    }
    await prisma.lobby.create({
      data: { id: id("open"), name: "Open House", ownerId: users.owner },
    });
    await prisma.lobby.create({
      data: {
        id: id("held"),
        name: "Held",
        ownerId: users.heldOwner,
        unlisted: true,
        listingHeld: true,
      },
    });
    await prisma.lobby.create({ data: { id: id("hidden"), name: "Hidden", unlisted: true } });
    await prisma.lobby.create({ data: { id: id("gone"), name: "Gone", deletedAt: new Date() } });
    for (const [lobbyId, userId] of [
      [id("open"), users.member],
      [id("hidden"), users.loner],
      [id("gone"), users.loner],
    ])
      await prisma.lobbyMember.create({ data: { lobbyId, userId, name: "x" } });

    const homes = await homeLobbiesOf([
      users.owner,
      users.member,
      users.heldOwner,
      users.loner,
      "",
      users.owner,
    ]);
    expect(homes[users.owner]).toMatchObject({ id: id("open"), name: "Open House" });
    expect(homes[users.member]).toMatchObject({ id: id("open") });
    expect(homes[users.heldOwner]).toBeNull();
    expect(homes[users.loner]).toBeNull();
    expect(Object.keys(homes)).toHaveLength(4);
  });
});

import { describe, it, expect, afterAll } from "vitest";
import { cameFrom, tellOwnerOfJoin } from "../../src/lib/growthSignals";
import { prisma } from "../../src/lib/prisma";

// The moment a stranger walks into someone's new lobby, its owner hears
// (2026-11-12): two lobbies were built that week and nobody was ever told.
const stamp = Date.now().toString(36) + Math.floor(Math.random() * 1e4);
const LOBBY = `itest-grow-${stamp}`;
const ids: Record<string, string> = {};

afterAll(async () => {
  await prisma.notification
    .deleteMany({ where: { userId: { in: Object.values(ids) } } })
    .catch(() => {});
  await prisma.lobbyMember.deleteMany({ where: { lobbyId: LOBBY } }).catch(() => {});
  await prisma.lobby.deleteMany({ where: { id: LOBBY } }).catch(() => {});
  await prisma.user.deleteMany({ where: { id: { in: Object.values(ids) } } }).catch(() => {});
  await prisma.$disconnect();
});

describe("tellOwnerOfJoin", () => {
  it("tells the owner who walked in, and how close Downtown is", async () => {
    for (const k of ["owner", "pat", "sam"]) {
      const u = await prisma.user.create({
        data: { usernameKey: `itest_grow_${k}_${stamp}`, name: k },
        select: { id: true },
      });
      ids[k] = u.id;
    }
    await prisma.lobby.create({
      data: {
        id: LOBBY,
        name: "After Hours",
        ownerId: ids.owner,
        unlisted: true,
        listingHeld: true,
      },
    });
    await prisma.lobbyMember.create({
      data: { lobbyId: LOBBY, userId: ids.owner, name: "owner", role: "OWNER", roleLevel: 5 },
    });
    // The owner's own membership tells nobody anything.
    expect(
      await tellOwnerOfJoin({ lobbyId: LOBBY, joinerId: ids.owner, joinerName: "owner" }),
    ).toBe(false);

    await prisma.lobbyMember.create({
      data: { lobbyId: LOBBY, userId: ids.pat, name: "pat", role: "MEMBER", roleLevel: 1 },
    });
    expect(await tellOwnerOfJoin({ lobbyId: LOBBY, joinerId: ids.pat, joinerName: "pat" })).toBe(
      true,
    );
    const n = await prisma.notification.findFirst({
      where: { userId: ids.owner },
      orderBy: { createdAt: "desc" },
    });
    expect(n?.title).toBe("pat joined After Hours");
    expect(n?.body).toMatch(/1 in\. At 3, Downtown lists it/);
    expect(n?.actionUrl).toBe(`/lobby/${LOBBY}`);
  });

  it("says where an account came from in a few words", () => {
    expect(cameFrom({ signupFrom: "google.com", signupLanding: "/lobby/poe" })).toBe(
      "from google.com, landed on /lobby/poe",
    );
    expect(cameFrom({ signupSource: "accounts" })).toBe("?ref=accounts");
    expect(cameFrom({})).toBe("");
  });
});

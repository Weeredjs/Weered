import { describe, it, expect, afterEach, afterAll } from "vitest";
import { getLobbyRole, canModLobby, canAccessStaff } from "../../src/lib/lobbyAuth";
import { prisma } from "../../src/lib/prisma";
import { GlobalRole, LobbyRole } from "@prisma/client";

// Exercises the REAL extracted lobby-permission helpers against the test DB.
// Covers the moderation gate (staff bypass + owner/mod) that protects every
// lobby admin route - previously untested.
describe("lobbyAuth - getLobbyRole + canModLobby", () => {
  const lobbies: string[] = [];

  afterEach(async () => {
    if (lobbies.length) {
      // lobbyMember rows cascade from the lobby delete
      await prisma.lobby.deleteMany({ where: { id: { in: lobbies } } }).catch(() => {});
      lobbies.length = 0;
    }
  });
  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function fixture() {
    const stamp = Date.now() + "_" + Math.floor(performance.now());
    const lobbyId = "itest_lobby_" + stamp;
    await prisma.lobby.create({ data: { id: lobbyId, name: "itest" } });
    lobbies.push(lobbyId);
    const owner = "u_owner_" + stamp;
    const mod = "u_mod_" + stamp;
    const member = "u_member_" + stamp;
    const stranger = "u_stranger_" + stamp;
    await prisma.lobbyMember.createMany({
      data: [
        { lobbyId, userId: owner, role: LobbyRole.OWNER },
        { lobbyId, userId: mod, role: LobbyRole.MOD },
        { lobbyId, userId: member, role: LobbyRole.MEMBER },
      ],
    });
    return { lobbyId, owner, mod, member, stranger };
  }

  it("getLobbyRole returns the member role, null for non-members", async () => {
    const f = await fixture();
    expect(await getLobbyRole(f.owner, f.lobbyId)).toBe("OWNER");
    expect(await getLobbyRole(f.mod, f.lobbyId)).toBe("MOD");
    expect(await getLobbyRole(f.member, f.lobbyId)).toBe("MEMBER");
    expect(await getLobbyRole(f.stranger, f.lobbyId)).toBeNull();
  });

  it("canModLobby: owner and mod can moderate, plain member + stranger cannot", async () => {
    const f = await fixture();
    expect(await canModLobby(f.owner, f.lobbyId, GlobalRole.USER)).toBe(true);
    expect(await canModLobby(f.mod, f.lobbyId, GlobalRole.USER)).toBe(true);
    expect(await canModLobby(f.member, f.lobbyId, GlobalRole.USER)).toBe(false);
    expect(await canModLobby(f.stranger, f.lobbyId, GlobalRole.USER)).toBe(false);
  });

  it("canModLobby: staff global role bypasses lobby membership entirely", async () => {
    const f = await fixture();
    // a stranger who is ADMIN/STAFF/GOD can moderate any lobby
    expect(await canModLobby(f.stranger, f.lobbyId, GlobalRole.ADMIN)).toBe(true);
    expect(await canModLobby(f.stranger, f.lobbyId, GlobalRole.STAFF)).toBe(true);
    expect(await canModLobby(f.stranger, f.lobbyId, GlobalRole.GOD)).toBe(true);
    // SUPPORT counts as staff for access; plain USER does not
    expect(canAccessStaff(GlobalRole.SUPPORT)).toBe(true);
    expect(canAccessStaff(GlobalRole.USER)).toBe(false);
  });
});

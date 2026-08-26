import { describe, it, expect, afterAll } from "vitest";
import lobbiesRoutes from "../../src/routes/lobbies";
import { buildTestApp } from "../helpers/buildTestApp";
import { prisma } from "../../src/lib/prisma";

/**
 * An unlisted lobby must be reachable by direct link and absent from every
 * listing surface. The second half is the part that breaks quietly: a new
 * listing endpoint added later simply won't filter, and nothing fails — the
 * lobby just starts showing up. These tests fail loudly if that happens to the
 * two surfaces that already exist.
 *
 * Room search is the non-obvious one. It queries ROOM names, but returns the
 * parent lobby's name, logo and accent alongside — so without a lobby filter an
 * unlisted lobby leaks through its own room names.
 */
function makeApp() {
  return buildTestApp((app: any) =>
    lobbiesRoutes(app, {
      authFromHeader: () => null,
      verifyToken: () => null,
      getGlobalRole: async () => null,
      canAccessStaff: () => false,
      getLobbyRole: async () => null,
      applyWindroseReel: (x: any) => x,
      lobbyAdminAccess: async () => null,
      globalAudit: async () => {},
      rooms: new Map(),
      isNameReserved: async () => false,
      awardNotoriety: async () => 0,
      send: () => {},
    } as any),
  );
}

const OPEN = "itest-unlisted-open";
const HIDDEN = "itest-unlisted-hidden";
const ROOM_TOKEN = "zqxjunlisted"; // distinctive, so search can't match anything else

afterAll(async () => {
  await prisma.room.deleteMany({ where: { lobbyId: { in: [OPEN, HIDDEN] } } }).catch(() => {});
  await prisma.lobby.deleteMany({ where: { id: { in: [OPEN, HIDDEN] } } }).catch(() => {});
});

describe("unlisted lobbies are absent from listing surfaces", () => {
  it("hides an unlisted lobby from browse but still serves it by direct id", async () => {
    const app = await makeApp();
    await prisma.lobby.deleteMany({ where: { id: { in: [OPEN, HIDDEN] } } }).catch(() => {});
    await prisma.lobby.create({ data: { id: OPEN, name: "itest open", unlisted: false } });
    await prisma.lobby.create({ data: { id: HIDDEN, name: "itest hidden", unlisted: true } });

    const browse = await app.inject({ method: "GET", url: "/lobbies" });
    const ids = browse.json().lobbies.map((l: any) => l.id);
    expect(ids).toContain(OPEN);
    expect(ids).not.toContain(HIDDEN);

    // Unlisted is a listing rule, NOT an access rule — the direct link works.
    const direct = await app.inject({ method: "GET", url: `/lobbies/${HIDDEN}` });
    expect(direct.statusCode).toBe(200);
    await app.close();
  });

  it("does not leak an unlisted lobby through its own room names in search", async () => {
    const app = await makeApp();
    await prisma.room.deleteMany({ where: { lobbyId: { in: [OPEN, HIDDEN] } } }).catch(() => {});
    await prisma.room.create({
      data: { id: `${OPEN}-r`, name: `${ROOM_TOKEN} open room`, lobbyId: OPEN },
    });
    await prisma.room.create({
      data: { id: `${HIDDEN}-r`, name: `${ROOM_TOKEN} hidden room`, lobbyId: HIDDEN },
    });

    const res = await app.inject({ method: "GET", url: `/lobbies/search?q=${ROOM_TOKEN}` });
    const roomLobbyIds = res.json().rooms.map((r: any) => r.lobbyId);
    expect(roomLobbyIds).toContain(OPEN);
    expect(roomLobbyIds).not.toContain(HIDDEN);
    await app.close();
  });
});

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { prisma } from "../../src/lib/prisma";
import { makeEmptyRoom } from "../../src/lib/roomState";
import { buildTestApp, testAuthFromHeader, testToken } from "../helpers/buildTestApp";

// Voice tokens and the room's door (red team 2026-11-01, finding 8): a lobby ban
// or a running kick kept people out of the room but not out of its voice call.
vi.hoisted(() => {
  process.env.LIVEKIT_API_KEY = "itest-key";
  process.env.LIVEKIT_API_SECRET = "itest-secret-itest-secret-itest-secret";
});
import voiceRoutes from "../../src/routes/voice";

const stamp = Date.now().toString(36);
const LOBBY = `itest-voice-${stamp}`;
const ROOM = `itest-voice-room-${stamp}`;
const id: Record<string, string> = {};
const room: any = makeEmptyRoom(ROOM);
room.lobbyId = LOBBY;
let app: any;

beforeAll(async () => {
  for (const [k, role] of [
    ["member", "USER"],
    ["banned", "USER"],
    ["kicked", "USER"],
    ["staff", "ADMIN"],
  ] as const) {
    const u = await prisma.user.create({
      data: { usernameKey: `itest_voice_${k}_${stamp}`, name: k, globalRole: role },
      select: { id: true },
    });
    id[k] = u.id;
  }
  await prisma.lobby.create({ data: { id: LOBBY, name: "voice" } });
  await prisma.room.create({ data: { id: ROOM, name: "voice room", lobbyId: LOBBY } });
  await prisma.lobbyBan.createMany({
    data: [
      { lobbyId: LOBBY, userId: id.banned },
      { lobbyId: LOBBY, userId: id.staff },
    ],
  });
  room.kickedUntil = new Map([[id.kicked, Date.now() + 10 * 60_000]]);
  app = await buildTestApp((a: any) =>
    voiceRoutes(a, {
      authFromHeader: testAuthFromHeader,
      rooms: new Map([[ROOM, room]]),
      loadExistingRoom: async (rid: string) => (rid === ROOM ? room : null),
      normalizeRoomId: (x: string) => x,
      isModOrOwner: () => false,
      awardNotoriety: async () => null,
      isOfficeStaff: async () => false,
    } as any),
  );
});

afterAll(async () => {
  await app?.close();
  await prisma.lobbyBan.deleteMany({ where: { lobbyId: LOBBY } }).catch(() => {});
  await prisma.room.deleteMany({ where: { id: ROOM } }).catch(() => {});
  await prisma.lobby.deleteMany({ where: { id: LOBBY } }).catch(() => {});
  await prisma.user.deleteMany({ where: { id: { in: Object.values(id) } } }).catch(() => {});
  await prisma.$disconnect();
});

const token = (who: string) =>
  app.inject({
    method: "POST",
    url: "/voice/token",
    headers: { authorization: `Bearer ${testToken(id[who])}` },
    payload: { roomId: ROOM },
  });

describe("voice follows the room's door", () => {
  it("gives a member a token", async () => {
    expect((await token("member")).statusCode).toBe(200);
  });

  it("refuses someone banned from the lobby", async () => {
    const r = await token("banned");
    expect(r.statusCode).toBe(403);
    expect(r.json().error).toBe("lobby_banned");
  });

  it("refuses someone whose kick is still running", async () => {
    const r = await token("kicked");
    expect(r.statusCode).toBe(403);
    expect(r.json().error).toBe("kicked");
  });

  it("lets staff through, as the door does", async () => {
    expect((await token("staff")).statusCode).toBe(200);
  });
});

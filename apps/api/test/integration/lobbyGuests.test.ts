import { describe, it, expect, beforeAll, afterAll } from "vitest";
import guestJoinRoutes from "../../src/routes/guestJoin";
import lobbiesRoutes from "../../src/routes/lobbies";
import authRoutes from "../../src/routes/auth";
import { guestMayEnter } from "../../src/lib/guestScope";
import { handleCrewDm } from "../../src/sockets/messaging";
import { prisma } from "../../src/lib/prisma";
import { buildTestApp, testAuthFromHeader } from "../helpers/buildTestApp";
import jwt from "jsonwebtoken";

// A lobby's guest link: a name and you're in, as a guest of that lobby only
// (James 2026-11-01). Office guests keep their own scope.
const JWT_SECRET = "weered-integration-test-secret";
const stamp = Date.now().toString(36);
const LOBBY = `itest-guest-${stamp}`;
const OTHER = `itest-guest-other-${stamp}`;
const ROOM = `itest-guest-room-${stamp}`;
const OTHER_ROOM = `itest-guest-oroom-${stamp}`;
const id: Record<string, string> = {};
const tokens: Record<string, string> = {};
let app: any;

beforeAll(async () => {
  for (const k of ["owner", "stranger"]) {
    const u = await prisma.user.create({
      data: { usernameKey: `itest_gl_${k}_${stamp}`, name: k },
      select: { id: true },
    });
    id[k] = u.id;
  }
  await prisma.lobby.create({ data: { id: LOBBY, name: "Acme Office", ownerId: id.owner } });
  await prisma.lobby.create({ data: { id: OTHER, name: "Other", ownerId: id.stranger } });
  await prisma.room.create({ data: { id: ROOM, name: "Consult", lobbyId: LOBBY } });
  await prisma.room.create({ data: { id: OTHER_ROOM, name: "Elsewhere", lobbyId: OTHER } });
  const mk = async (createdBy: string, maxUses: number) =>
    (await prisma.invite.create({ data: { type: "GUEST", targetId: LOBBY, createdBy, maxUses } }))
      .token;
  tokens.good = await mk(id.owner, 2);
  tokens.notOwner = await mk(id.stranger, 5);
  tokens.view = await mk(id.owner, 5);
  tokens.office = await mk(id.owner, 3);
  app = await buildTestApp((a: any) => guestJoinRoutes(a, { JWT_SECRET }));
});

afterAll(async () => {
  await app?.close();
  await prisma.invite.deleteMany({ where: { targetId: LOBBY } }).catch(() => {});
  await prisma.user
    .deleteMany({
      where: {
        OR: [{ id: { in: Object.values(id) } }, { isGuest: true, name: { startsWith: "Pat " } }],
      },
    })
    .catch(() => {});
  await prisma.room.deleteMany({ where: { id: { in: [ROOM, OTHER_ROOM] } } }).catch(() => {});
  await prisma.lobby.deleteMany({ where: { id: { in: [LOBBY, OTHER] } } }).catch(() => {});
  await prisma.$disconnect();
});

const join = (inviteToken: string, name: string) =>
  app.inject({ method: "POST", url: "/auth/guest-lobby", payload: { inviteToken, name } });

// The prod authFromHeader (index.ts) carries a guest's scope along.
function authWithScope(h?: string) {
  try {
    const d: any = jwt.verify(String(h || "").replace(/^Bearer\s+/i, ""), JWT_SECRET);
    if (!d?.sub) return null;
    return {
      id: String(d.sub),
      name: String(d.name || ""),
      ...(d.guest ? { guest: true, scope: d.scope ?? null } : {}),
    };
  } catch {
    return null;
  }
}

const lobbyApp = () =>
  buildTestApp(async (a: any) => {
    await lobbiesRoutes(a, {
      authFromHeader: authWithScope,
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
    } as any);
  });

describe("a lobby's guest link", () => {
  it("lets someone in with just a name, as a guest of that lobby", async () => {
    const r = await join(tokens.good, "Pat Client");
    expect(r.statusCode).toBe(200);
    expect(r.json()).toMatchObject({
      ok: true,
      lobbyId: LOBBY,
      user: { isGuest: true, name: "Pat Client" },
    });
    const cookie = String(r.headers["set-cookie"] || "");
    const tok = /weered_token=([^;]+)/.exec(cookie)?.[1] || "";
    const claims: any = jwt.verify(tok, JWT_SECRET);
    expect(claims.guest).toBe(true);
    expect(claims.scope).toEqual({ lobby: LOBBY });
  });

  it("needs a name, and stops when it's used up", async () => {
    expect((await join(tokens.good, " ")).statusCode).toBe(400);
    expect((await join(tokens.good, "Pat Two")).statusCode).toBe(200);
    expect((await join(tokens.good, "Pat Three")).statusCode).toBe(410);
  });

  it("only works while its maker owns the lobby", async () => {
    expect((await join(tokens.notOwner, "Pat Four")).statusCode).toBe(403);
  });

  it("lets a lobby guest into that lobby's chat and rooms, nowhere else", async () => {
    const guest = { scope: { lobby: LOBBY } };
    expect(await guestMayEnter(guest, LOBBY)).toBe(true);
    expect(await guestMayEnter(guest, ROOM)).toBe(true);
    expect(await guestMayEnter(guest, OTHER_ROOM)).toBe(false);
    expect(await guestMayEnter(guest, OTHER)).toBe(false);
    expect(await guestMayEnter(guest, `made-up-${stamp}`)).toBe(false);
    expect(await guestMayEnter(guest, "mtg-eceb-foyer")).toBe(false);
  });

  it("shows a guest its own lobby from the inside, at the first rank, and no other", async () => {
    const r = await join(tokens.view, "Pat View");
    const tok = /weered_token=([^;]+)/.exec(String(r.headers["set-cookie"] || ""))?.[1] || "";
    const lob = await lobbyApp();
    const own = await lob.inject({
      method: "GET",
      url: `/lobbies/${LOBBY}`,
      headers: { authorization: `Bearer ${tok}` },
    });
    expect(own.json().membership).toEqual({ role: "GUEST", roleLevel: 1, guest: true });
    const other = await lob.inject({
      method: "GET",
      url: `/lobbies/${OTHER}`,
      headers: { authorization: `Bearer ${tok}` },
    });
    expect(other.json().membership).toBeNull();
    await lob.close();
  });

  it("keeps the office's guest door to the office's own links", async () => {
    const auth = await buildTestApp((a: any) =>
      authRoutes(a, {
        authFromHeader: testAuthFromHeader,
        JWT_SECRET,
        isNameReserved: async () => false,
        getSiteConfig: async () => null,
        seedWelcomeDM: async () => {},
      } as any),
    );
    const r = await auth.inject({
      method: "POST",
      url: "/auth/guest",
      payload: { inviteToken: tokens.office, name: "Sneaky" },
    });
    expect(r.statusCode).toBe(404);
    // Refused before it was counted: the lobby's link is untouched.
    expect((await prisma.invite.findUnique({ where: { token: tokens.office } }))?.uses).toBe(0);
    await auth.close();
  });

  it("keeps a guest's talk in its lobby: no direct messages", async () => {
    const r = await join(tokens.view, "Pat Talker");
    const guestId = r.json().user.id;
    const sent: any[] = [];
    const ws = { user: { id: guestId, name: "Pat Talker", guest: true, scope: { lobby: LOBBY } } };
    await handleCrewDm(ws, { type: "dm:send", toId: id.owner, body: "hi from a guest" }, {
      checkUrlSpam: () => ({ ok: true }),
      checkChatRateLimit: () => ({ ok: true }),
      createNotification: async () => {},
      dmDeliver: () => {},
      isUserOnline: () => false,
      resolveMentions: async () => [],
      resolveUserId: async (x: string) => x,
      send: (_ws: any, m: any) => sent.push(m),
      sendPush: async () => {},
      toggleReactionOnTarget: async () => {},
      awardNotoriety: async () => null,
      wss: { clients: new Set() },
    } as any);
    expect(sent[0]).toMatchObject({ type: "dm:rejected" });
    expect(await prisma.directMessage.count({ where: { fromId: guestId } })).toBe(0);
  });

  it("leaves office guests to their office", async () => {
    const office = { scope: { office: "mtg-eceb" } };
    expect(await guestMayEnter(office, "mtg-eceb-foyer")).toBe(true);
    expect(await guestMayEnter(office, ROOM)).toBe(false);
  });
});

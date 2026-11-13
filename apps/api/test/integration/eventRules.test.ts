import { describe, it, expect, beforeAll, afterAll } from "vitest";
import eventsRoutes from "../../src/routes/events";
import { prisma } from "../../src/lib/prisma";
import { buildTestApp, testAuthFromHeader, testToken } from "../helpers/buildTestApp";

// A lobby's events are held to size (lib/fieldSize.ts, hardening pass
// 2026-11-13). The routes stored whatever they were sent, and anyone with a
// lobby of their own can make events in it: a megabyte of description each,
// as many as they liked. A date that wasn't one, or a status that isn't one,
// came back as a server error.
const stamp = Date.now().toString(36);
const lobbyId = `itest-ev-${stamp}`;
let owner = "";
let app: any;

beforeAll(async () => {
  owner = (
    await prisma.user.create({
      data: { usernameKey: `itest_ev_owner_${stamp}`, name: "ev owner" },
      select: { id: true },
    })
  ).id;
  await prisma.lobby.create({ data: { id: lobbyId, name: "Events", ownerId: owner } });
  app = await buildTestApp(async (a: any) => {
    await eventsRoutes(a, {
      authFromHeader: testAuthFromHeader,
      getGlobalRole: async () => "USER",
      canAccessStaff: () => false,
      // The owner of the lobby in the address, as the real check would find them.
      lobbyAdminAccess: async (req: any, reply: any) => {
        const u = testAuthFromHeader(req.headers.authorization);
        if (!u) {
          reply.code(401).send({ ok: false });
          return null;
        }
        return { user: u, lobby: { id: req.params.id } };
      },
    } as any);
  });
});

afterAll(async () => {
  await app?.close();
  await prisma.lobbyAudit.deleteMany({ where: { lobbyId } }).catch(() => {});
  await prisma.event.deleteMany({ where: { lobbyId } }).catch(() => {});
  await prisma.lobby.deleteMany({ where: { id: lobbyId } }).catch(() => {});
  await prisma.user.deleteMany({ where: { id: owner } }).catch(() => {});
  await prisma.$disconnect();
});

const headers = () => ({ authorization: `Bearer ${testToken(owner)}` });
const make = (payload: object) =>
  app.inject({ method: "POST", url: `/lobbies/${lobbyId}/events`, headers: headers(), payload });
const count = () => prisma.event.count({ where: { lobbyId } });

describe("a lobby's events", () => {
  it("makes an ordinary one", async () => {
    const r = await make({
      title: "Friday night ops",
      description: "Bring a mic.",
      category: "Ops",
      startsAt: "2026-12-04T23:00:00Z",
      status: "published",
    });
    expect(r.statusCode).toBe(200);
    expect(r.json().event.status).toBe("PUBLISHED");
    expect(await count()).toBe(1);
  });

  it("refuses more words than an event holds, and stores nothing", async () => {
    const big = await make({ title: "Big", description: "d".repeat(900_000) });
    expect(big.statusCode).toBe(400);
    expect(big.json().error).toBe("too_long");
    expect(big.json().field).toBe("description");
    // The refusal is short: it does not send the megabyte back.
    expect(big.body.length).toBeLessThan(400);
    expect((await make({ title: "t".repeat(201) })).statusCode).toBe(400);
    expect((await make({ title: "Tz", timezone: "z".repeat(65) })).statusCode).toBe(400);
    expect(await count()).toBe(1);
  });

  it("refuses a date that isn't one and a picture link that isn't https", async () => {
    const date = await make({ title: "When", startsAt: "next tuesday" });
    expect(date.statusCode).toBe(400);
    expect(date.json().error).toBe("bad_date");
    const link = await make({ title: "Pic", coverImageUrl: "javascript:alert(1)" });
    expect(link.statusCode).toBe(400);
    expect(link.json().error).toBe("bad_link");
    expect(await count()).toBe(1);
  });

  it("holds an edit to the same rules, and answers a bad status in words", async () => {
    const ev = await prisma.event.findFirst({ where: { lobbyId }, select: { id: true } });
    const edit = (payload: object) =>
      app.inject({
        method: "PATCH",
        url: `/lobbies/${lobbyId}/events/${ev!.id}`,
        headers: headers(),
        payload,
      });
    expect((await edit({ description: "A longer note for the night." })).statusCode).toBe(200);
    const big = await edit({ description: "d".repeat(4001) });
    expect(big.statusCode).toBe(400);
    expect(big.json().error).toBe("too_long");
    // These two used to reach the database and come back as a server error.
    const status = await edit({ status: "NOT_A_STATUS" });
    expect(status.statusCode).toBe(400);
    expect(status.json().error).toBe("bad_status");
    expect((await edit({ startsAt: "never" })).statusCode).toBe(400);
    const now = await prisma.event.findUnique({
      where: { id: ev!.id },
      select: { description: true, status: true },
    });
    expect(now).toEqual({ description: "A longer note for the night.", status: "PUBLISHED" });
  });
});

import { describe, it, expect, afterEach, afterAll } from "vitest";
import dmRoutes from "../../src/routes/dm";
import { buildTestApp, testToken } from "../helpers/buildTestApp";
import { prisma } from "../../src/lib/prisma";

// Exercises the REAL dm routes against the test DB: send persists a
// directMessage, the conversation GET returns it for both parties, empty body
// is rejected, and unauthenticated send is blocked. Side effects (deliver,
// push, reactions) are stubbed.
async function makeApp() {
  return buildTestApp((app: any) =>
    dmRoutes(app, {
      authFromHeader: (h?: string) => {
        const m = String(h || "").match(/^Bearer\s+(.+)$/i);
        if (!m) return null;
        try {
          const jwt = require("jsonwebtoken");
          const d: any = jwt.verify(m[1], "weered-integration-test-secret");
          return d?.sub ? { id: String(d.sub), name: String(d.name || d.sub) } : null;
        } catch {
          return null;
        }
      },
      resolveUserId: async (raw: string) => raw,
      fetchReactionsForTargets: async () => ({}),
      dmDeliver: () => {},
      isUserOnline: () => false,
      sendPush: async () => {},
    } as any),
  );
}

const userIds: string[] = [];

describe("dmRoutes - send + conversation", () => {
  afterEach(async () => {
    if (userIds.length) {
      // directMessages cascade from the user delete
      await prisma.user.deleteMany({ where: { id: { in: userIds } } }).catch(() => {});
      userIds.length = 0;
    }
  });
  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function twoUsers() {
    const stamp = Date.now() + "_" + Math.floor(performance.now());
    const a = await prisma.user.create({
      data: { usernameKey: "itest_dm_a_" + stamp, name: "A" },
      select: { id: true },
    });
    const b = await prisma.user.create({
      data: { usernameKey: "itest_dm_b_" + stamp, name: "B" },
      select: { id: true },
    });
    userIds.push(a.id, b.id);
    return { a: a.id, b: b.id };
  }

  it("sends a DM and returns it in the conversation for both parties", async () => {
    const app = await makeApp();
    const { a, b } = await twoUsers();
    const sent = await app.inject({
      method: "POST",
      url: `/dm/${b}`,
      headers: { authorization: `Bearer ${testToken(a)}` },
      payload: { body: "hello there" },
    });
    expect(sent.statusCode).toBe(200);

    const row = await prisma.directMessage.findFirst({ where: { fromId: a, toId: b } });
    expect(row?.body).toBe("hello there");

    // sender sees it
    const asA = await app.inject({
      method: "GET",
      url: `/dm/${b}`,
      headers: { authorization: `Bearer ${testToken(a)}` },
    });
    expect(asA.statusCode).toBe(200);
    expect(asA.json().messages.some((m: any) => m.body === "hello there")).toBe(true);
    // recipient sees it too
    const asB = await app.inject({
      method: "GET",
      url: `/dm/${a}`,
      headers: { authorization: `Bearer ${testToken(b)}` },
    });
    expect(asB.json().messages.some((m: any) => m.body === "hello there")).toBe(true);
    await app.close();
  });

  it("rejects an empty message (400) and an unauthenticated send (401)", async () => {
    const app = await makeApp();
    const { a, b } = await twoUsers();
    const empty = await app.inject({
      method: "POST",
      url: `/dm/${b}`,
      headers: { authorization: `Bearer ${testToken(a)}` },
      payload: { body: "" },
    });
    expect(empty.statusCode).toBe(400);
    const noauth = await app.inject({ method: "POST", url: `/dm/${b}`, payload: { body: "hi" } });
    expect(noauth.statusCode).toBe(401);
    await app.close();
  });

  it("refuses a note to yourself and keeps old ones out of the list and unread", async () => {
    const app = await makeApp();
    const { a, b } = await twoUsers();
    const self = await app.inject({
      method: "POST",
      url: `/dm/${a}`,
      headers: { authorization: `Bearer ${testToken(a)}` },
      payload: { body: "note" },
    });
    expect(self.statusCode).toBe(400);
    // One from before the refusal, and a real unread one from b.
    await prisma.directMessage.create({ data: { fromId: a, toId: a, body: "." } });
    await prisma.directMessage.create({ data: { fromId: b, toId: a, body: "hey" } });
    const auth = { authorization: `Bearer ${testToken(a)}` };
    const convos = (
      await app.inject({ method: "GET", url: "/dm/conversations", headers: auth })
    ).json();
    expect(convos.conversations.map((c: any) => c.id)).toEqual([b]);
    const unread = (await app.inject({ method: "GET", url: "/dm/unread", headers: auth })).json();
    expect(unread.counts).toEqual({ [b]: 1 });
    const previews = (
      await app.inject({ method: "GET", url: "/dm/previews", headers: auth })
    ).json();
    expect(JSON.stringify(previews)).not.toContain(`"peerId":"${a}"`);
    await app.close();
  });
});

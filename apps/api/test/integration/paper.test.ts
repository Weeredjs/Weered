import { describe, it, expect, beforeEach, afterEach, afterAll } from "vitest";
import paperRoutes from "../../src/routes/paper";
import { awardPaper } from "../../src/lib/economy";
import { prisma } from "../../src/lib/prisma";
import { buildTestApp, testToken } from "../helpers/buildTestApp";

// Exercises the REAL paperRoutes + the REAL awardPaper (extracted to lib/economy
// so prod and tests share identical money code). Covers the atomic daily-claim
// and the guarded tip debit under concurrency — the audit's untested money path.
describe("paperRoutes — atomic daily claim + tip overdraft guard", () => {
  let app: any;
  const created: string[] = [];

  beforeEach(async () => {
    app = await buildTestApp((a, { authFromHeader }) => paperRoutes(a, { authFromHeader, awardPaper } as any));
  });
  afterEach(async () => {
    try { await app?.close(); } catch {}
    if (created.length) {
      try { await prisma.paperTransaction.deleteMany({ where: { userId: { in: created } } }); } catch {}
      try { await prisma.user.deleteMany({ where: { id: { in: created } } }); } catch {}
      created.length = 0;
    }
  });
  afterAll(async () => { await prisma.$disconnect(); });

  it("grants the daily bonus exactly once under concurrent claims", async () => {
    const stamp = Date.now() + "_" + Math.floor(performance.now());
    const user = await prisma.user.create({ data: { usernameKey: "itest_daily_" + stamp, name: "daily", paper: 0, lastDailyAt: null }, select: { id: true } });
    created.push(user.id);
    const token = testToken(user.id);

    const N = 6;
    await Promise.all(Array.from({ length: N }, () =>
      app.inject({ method: "POST", url: "/paper/daily", headers: { authorization: `Bearer ${token}` }, payload: {} })));

    const paper = (await prisma.user.findUnique({ where: { id: user.id }, select: { paper: true } }))?.paper;
    const grants = await prisma.paperTransaction.count({ where: { userId: user.id, type: "EARN_DAILY" } });
    expect(paper).toBe(25);   // 25 once, never 25*N
    expect(grants).toBe(1);
  });

  it("processes a tip exactly once under concurrent sends (no overdraft, recipient credited once)", async () => {
    const stamp = Date.now() + "_" + Math.floor(performance.now());
    const sender = await prisma.user.create({ data: { usernameKey: "itest_tipper_" + stamp, name: "tipper_" + stamp, paper: 10 }, select: { id: true } });
    const recip = await prisma.user.create({ data: { usernameKey: "itest_recip_" + stamp, name: "recip_" + stamp, paper: 0 }, select: { id: true, name: true } });
    created.push(sender.id, recip.id);
    const token = testToken(sender.id);

    const N = 6;
    const results = await Promise.all(Array.from({ length: N }, () =>
      app.inject({
        method: "POST", url: "/paper/tip",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        payload: { toUsername: recip.name, amount: 10 },
      })));

    const successes = results.filter((r: any) => r.statusCode === 200 && r.json()?.ok).length;
    const senderPaper = (await prisma.user.findUnique({ where: { id: sender.id }, select: { paper: true } }))?.paper;
    const recipPaper = (await prisma.user.findUnique({ where: { id: recip.id }, select: { paper: true } }))?.paper;
    const spend = await prisma.paperTransaction.count({ where: { userId: sender.id, type: "SPEND_GIFT" } });
    const earn = await prisma.paperTransaction.count({ where: { userId: recip.id, type: "EARN_GIFT" } });

    expect(successes).toBe(1);
    expect(senderPaper).toBe(0);   // charged exactly once, never negative
    expect(recipPaper).toBe(10);   // credited exactly once
    expect(spend).toBe(1);
    expect(earn).toBe(1);
  });

  it("rejects a tip below the minimum (400 amount_too_low)", async () => {
    const stamp = Date.now() + "_" + Math.floor(performance.now());
    const sender = await prisma.user.create({ data: { usernameKey: "itest_tiplo_" + stamp, name: "tiplo_" + stamp, paper: 100 }, select: { id: true } });
    const recip = await prisma.user.create({ data: { usernameKey: "itest_reclo_" + stamp, name: "reclo_" + stamp, paper: 0 }, select: { name: true, id: true } });
    created.push(sender.id, recip.id);
    const res = await app.inject({
      method: "POST", url: "/paper/tip",
      headers: { authorization: `Bearer ${testToken(sender.id)}`, "content-type": "application/json" },
      payload: { toUsername: recip.name, amount: 0 },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()?.error).toBe("amount_too_low");
  });
});

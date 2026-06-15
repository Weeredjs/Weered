import { describe, it, expect, beforeEach, afterEach, afterAll } from "vitest";
import storeRoutes from "../../src/routes/store";
import { prisma } from "../../src/lib/prisma";
import { buildTestApp, testToken } from "../helpers/buildTestApp";

// Regression coverage for the /store/buy purchase TOCTOU (audit P2, fixed
// 9cf9d06): a user with paper for EXACTLY ONE item firing concurrent buys must
// end with one purchase, balance floored at 0, and a single ledger row — never
// an overdraft. Drives the REAL storeRoutes module via inject against the test DB.
describe("POST /store/buy — concurrency / overdraft guard", () => {
  let app: any;
  let userId: string;
  let itemId: string;
  const PRICE = 100;

  beforeEach(async () => {
    const stamp = Date.now() + "_" + Math.floor(performance.now());
    const user = await prisma.user.create({
      data: { usernameKey: "itest_buyer_" + stamp, name: "itest_buyer", paper: PRICE },
      select: { id: true },
    });
    userId = user.id;
    const item = await prisma.storeItem.create({
      data: {
        name: "itest_item_" + stamp,
        category: "CONSUMABLE",
        price: PRICE,
        maxSupply: null,
        available: true,
      },
      select: { id: true },
    });
    itemId = item.id;
    app = await buildTestApp((a, { authFromHeader }) => storeRoutes(a, { authFromHeader } as any));
  });

  afterEach(async () => {
    try {
      await app?.close();
    } catch {}
    try {
      await prisma.paperTransaction.deleteMany({ where: { refId: itemId } });
    } catch {}
    try {
      await prisma.userItem.deleteMany({ where: { itemId } });
    } catch {}
    try {
      await prisma.storeItem.deleteMany({ where: { id: itemId } });
    } catch {}
    try {
      await prisma.user.deleteMany({ where: { id: userId } });
    } catch {}
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("credits exactly one purchase and never overdrafts under concurrent buys", async () => {
    const token = testToken(userId);
    const N = 6;
    const results = await Promise.all(
      Array.from({ length: N }, () =>
        app.inject({
          method: "POST",
          url: `/store/buy/${itemId}`,
          headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
          payload: {},
        }),
      ),
    );

    const successes = results.filter((r: any) => r.statusCode === 200 && r.json()?.ok).length;
    const insufficient = results.filter(
      (r: any) => r.statusCode === 400 && r.json()?.error === "insufficient_paper",
    ).length;

    const finalPaper = (
      await prisma.user.findUnique({ where: { id: userId }, select: { paper: true } })
    )?.paper;
    const spendRows = await prisma.paperTransaction.count({
      where: { userId, refId: itemId, type: "SPEND_STORE" },
    });
    const owned = await prisma.userItem.count({ where: { userId, itemId } });

    expect(successes).toBe(1);
    expect(insufficient).toBe(N - 1);
    expect(finalPaper).toBe(0); // floored — never negative
    expect(spendRows).toBe(1);
    expect(owned).toBe(1);
  });

  it("rejects a buy with no auth (401)", async () => {
    const res = await app.inject({ method: "POST", url: `/store/buy/${itemId}`, payload: {} });
    expect(res.statusCode).toBe(401);
  });
});

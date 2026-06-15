import { describe, it, expect, afterEach, afterAll } from "vitest";
import tradingRoutes from "../../src/routes/trading";
import { buildTestApp, testToken, testAuthFromHeader } from "../helpers/buildTestApp";
import { prisma } from "../../src/lib/prisma";

const LOBBY = "tlobby";
function makeApp() {
  return buildTestApp((app: any) =>
    tradingRoutes(app, {
      authFromHeader: testAuthFromHeader,
      awardPaper: async () => ({ balance: 0 }),
      awardNotoriety: async () => null,
      livePrices: new Map([["btcusdt", { price: 50000, time: 1 }]]),
      broadcastToLobby: () => {},
      notifyUser: () => {},
      operatorCommentateOnTrade: async () => {},
    } as any),
  );
}

const users: string[] = [];
async function newUser(tag: string) {
  const stamp = Date.now() + "_" + Math.floor(performance.now()) + Math.floor(Math.random() * 1e6);
  const u = await prisma.user.create({
    data: { usernameKey: "itest_trd_" + tag + "_" + stamp, name: tag },
    select: { id: true },
  });
  users.push(u.id);
  return u.id;
}

describe("trading - place order (FakeOut paper money path)", () => {
  afterEach(async () => {
    if (users.length) {
      const accts = await prisma.paperAccount.findMany({
        where: { userId: { in: users } },
        select: { id: true },
      });
      const ids = accts.map((a) => a.id);
      if (ids.length) {
        await prisma.paperOrder.deleteMany({ where: { accountId: { in: ids } } }).catch(() => {});
        await prisma.paperPosition
          .deleteMany({ where: { accountId: { in: ids } } })
          .catch(() => {});
      }
      await prisma.paperAccount.deleteMany({ where: { userId: { in: users } } }).catch(() => {});
      await prisma.user.deleteMany({ where: { id: { in: users } } }).catch(() => {});
    }
    users.length = 0;
  });
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("validates side, quantity, and limit price (400s) + 401", async () => {
    const app = await makeApp();
    const uid = await newUser("v");
    const auth = { authorization: `Bearer ${testToken(uid)}` };
    expect(
      (
        await app.inject({
          method: "POST",
          url: `/trading/order/${LOBBY}`,
          payload: { symbol: "BTCUSDT", side: "BUY", quantity: 1 },
        })
      ).statusCode,
    ).toBe(401);
    expect(
      (
        await app.inject({
          method: "POST",
          url: `/trading/order/${LOBBY}`,
          headers: auth,
          payload: { symbol: "BTCUSDT", side: "HOLD", quantity: 1 },
        })
      ).json().error,
    ).toBe("invalid_params");
    expect(
      (
        await app.inject({
          method: "POST",
          url: `/trading/order/${LOBBY}`,
          headers: auth,
          payload: { symbol: "BTCUSDT", side: "BUY", quantity: 0 },
        })
      ).json().error,
    ).toBe("invalid_quantity");
    expect(
      (
        await app.inject({
          method: "POST",
          url: `/trading/order/${LOBBY}`,
          headers: auth,
          payload: { symbol: "BTCUSDT", side: "BUY", quantity: 1, orderType: "LIMIT" },
        })
      ).json().error,
    ).toBe("limit_price_required");
    await app.close();
  });

  it("a LIMIT order is queued PENDING; a MARKET order with no price is rejected", async () => {
    const app = await makeApp();
    const uid = await newUser("l");
    const auth = { authorization: `Bearer ${testToken(uid)}` };
    const limit = await app.inject({
      method: "POST",
      url: `/trading/order/${LOBBY}`,
      headers: auth,
      payload: { symbol: "BTCUSDT", side: "BUY", quantity: 0.01, orderType: "LIMIT", price: 40000 },
    });
    expect(limit.statusCode).toBe(200);
    expect(limit.json().order.status).toBe("PENDING");

    const noPrice = await app.inject({
      method: "POST",
      url: `/trading/order/${LOBBY}`,
      headers: auth,
      payload: { symbol: "ETHUSDT", side: "BUY", quantity: 1 },
    });
    expect(noPrice.json().error).toBe("no_price_data");
    await app.close();
  });

  it("a MARKET BUY fills: a position opens and cash is debited from the 100k start", async () => {
    const app = await makeApp();
    const uid = await newUser("m");
    const auth = { authorization: `Bearer ${testToken(uid)}` };
    const r = await app.inject({
      method: "POST",
      url: `/trading/order/${LOBBY}`,
      headers: auth,
      payload: { symbol: "BTCUSDT", side: "BUY", quantity: 0.01 },
    });
    expect(r.statusCode).toBe(200);

    const acct = await prisma.paperAccount.findFirst({
      where: { userId: uid, lobbyId: LOBBY },
      select: { id: true, cashBalance: true, startBalance: true },
    });
    expect(acct).toBeTruthy();
    expect(acct!.cashBalance).toBeLessThan(acct!.startBalance); // ~500 spent on 0.01 BTC @ 50k
    const pos = await prisma.paperPosition.findFirst({
      where: { accountId: acct!.id, symbol: "BTCUSDT", status: "OPEN" },
    });
    expect(pos).toBeTruthy();
    await app.close();
  });
});

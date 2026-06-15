import { describe, it, expect, beforeEach, afterEach, afterAll } from "vitest";
import storeRoutes from "../../src/routes/store";
import { prisma } from "../../src/lib/prisma";
import { buildTestApp, testToken } from "../helpers/buildTestApp";

// Regression coverage for the /market/buy purchase TOCTOU (audit P2, fixed
// 9cf9d06): concurrent buys of the SAME listing must sell it once, transfer the
// item once, charge the buyer once (never overdraft), and credit the seller once
// (no lost-update). Drives the real storeRoutes via inject against the test DB.
describe("POST /market/buy — concurrency / double-sell + lost-update guard", () => {
  let app: any;
  let sellerId: string;
  let buyerId: string;
  let itemId: string;
  let userItemId: string;
  let listingId: string;
  const PRICE = 100;

  beforeEach(async () => {
    const stamp = Date.now() + "_" + Math.floor(performance.now());
    const seller = await prisma.user.create({ data: { usernameKey: "itest_seller_" + stamp, name: "seller", paper: 0 }, select: { id: true } });
    const buyer = await prisma.user.create({ data: { usernameKey: "itest_mbuyer_" + stamp, name: "buyer", paper: PRICE }, select: { id: true } });
    sellerId = seller.id; buyerId = buyer.id;
    const item = await prisma.storeItem.create({ data: { name: "itest_mitem_" + stamp, category: "COLLECTIBLE", price: PRICE, available: true }, select: { id: true } });
    itemId = item.id;
    const ui = await prisma.userItem.create({ data: { userId: sellerId, itemId, acquiredFrom: "store", acquiredPrice: PRICE }, select: { id: true } });
    userItemId = ui.id;
    const listing = await prisma.marketListing.create({
      data: { sellerId, userItemId, itemId, itemName: "itest_mitem", price: PRICE, status: "ACTIVE" },
      select: { id: true },
    });
    listingId = listing.id;
    app = await buildTestApp((a, { authFromHeader }) => storeRoutes(a, { authFromHeader } as any));
  });

  afterEach(async () => {
    try { await app?.close(); } catch {}
    try { await prisma.paperTransaction.deleteMany({ where: { refId: listingId } }); } catch {}
    try { await prisma.marketListing.deleteMany({ where: { id: listingId } }); } catch {}
    try { await prisma.userItem.deleteMany({ where: { id: userItemId } }); } catch {}
    try { await prisma.storeItem.deleteMany({ where: { id: itemId } }); } catch {}
    try { await prisma.user.deleteMany({ where: { id: { in: [sellerId, buyerId] } } }); } catch {}
  });

  afterAll(async () => { await prisma.$disconnect(); });

  it("sells the listing exactly once under concurrent buys (no double-sell, no overdraft, no lost-update)", async () => {
    const token = testToken(buyerId);
    const N = 6;
    const results = await Promise.all(
      Array.from({ length: N }, () =>
        app.inject({
          method: "POST",
          url: `/market/buy/${listingId}`,
          headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
          payload: {},
        }),
      ),
    );

    const successes = results.filter((r: any) => r.statusCode === 200 && r.json()?.ok).length;

    const buyer = await prisma.user.findUnique({ where: { id: buyerId }, select: { paper: true } });
    const seller = await prisma.user.findUnique({ where: { id: sellerId }, select: { paper: true } });
    const listing = await prisma.marketListing.findUnique({ where: { id: listingId }, select: { status: true, buyerId: true } });
    const ui = await prisma.userItem.findUnique({ where: { id: userItemId }, select: { userId: true } });
    const spend = await prisma.paperTransaction.count({ where: { userId: buyerId, refId: listingId, type: "SPEND_MARKET" } });
    const earn = await prisma.paperTransaction.count({ where: { userId: sellerId, refId: listingId, type: "EARN_TRADE_SOLD" } });

    expect(successes).toBe(1);
    expect(buyer?.paper).toBe(0);        // charged exactly once, never negative
    expect(seller?.paper).toBe(PRICE);   // credited exactly once (increment, not lost-update)
    expect(listing?.status).toBe("SOLD");
    expect(listing?.buyerId).toBe(buyerId);
    expect(ui?.userId).toBe(buyerId);    // item transferred exactly once
    expect(spend).toBe(1);
    expect(earn).toBe(1);
  });

  it("refuses buying your own listing (400 cant_buy_own)", async () => {
    const res = await app.inject({
      method: "POST", url: `/market/buy/${listingId}`,
      headers: { authorization: `Bearer ${testToken(sellerId)}`, "content-type": "application/json" }, payload: {},
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()?.error).toBe("cant_buy_own");
  });
});

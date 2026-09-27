import { describe, it, expect, afterAll, afterEach, vi } from "vitest";
import { createHmac } from "crypto";
import billingRoutes from "../../src/routes/billing";
import { buildTestApp, testAuthFromHeader } from "../helpers/buildTestApp";
import { prisma } from "../../src/lib/prisma";

// What a payment grants, and taking it back (audit 2026-09-27): full refunds,
// chargebacks and unpaid subscriptions used to leave the paid tier in place,
// and a lobby tier was only undone when the member's level still matched the
// tier's CURRENT grant level. Signed webhook events drive the real handler
// against the test database; Stripe's own API is stubbed.
const SECRET = "whsec_test_" + "b".repeat(24);
process.env.STRIPE_WEBHOOK_SECRET = SECRET;

function sign(payload: string) {
  const t = Math.floor(Date.now() / 1000);
  return `t=${t},v1=${createHmac("sha256", SECRET).update(`${t}.${payload}`).digest("hex")}`;
}

async function makeApp() {
  return buildTestApp((app: any) => {
    app.removeContentTypeParser("application/json");
    app.addContentTypeParser(
      "application/json",
      { parseAs: "buffer" },
      (req: any, body: Buffer, done: any) => {
        req.rawBody = body;
        try {
          done(null, JSON.parse(body.toString() || "{}"));
        } catch (e) {
          done(e, undefined);
        }
      },
    );
    const opts = new Proxy(
      { authFromHeader: testAuthFromHeader },
      { get: (t: any, p: string) => (p in t ? t[p] : () => Promise.resolve()) },
    );
    return billingRoutes(app, opts);
  });
}

async function send(app: any, type: string, object: any) {
  const payload = JSON.stringify({ type, data: { object } });
  const r = await app.inject({
    method: "POST",
    url: "/subscribe/webhook",
    headers: { "content-type": "application/json", "stripe-signature": sign(payload) },
    payload,
  });
  expect(r.statusCode).toBe(200);
}

// Stripe API stub: path -> response, and a log of every call.
let calls: { method: string; path: string }[] = [];
function stubStripe(routes: Record<string, any>) {
  calls = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: any) => {
      const path = String(url).replace("https://api.stripe.com/v1", "");
      const method = String(init?.method || "GET");
      calls.push({ method, path });
      const body = routes[`${method} ${path}`] ?? { id: "stub" };
      return new Response(JSON.stringify(body), { status: 200 });
    }),
  );
}
afterEach(() => vi.unstubAllGlobals());

const made = { users: [] as string[], lobbies: [] as string[] };
const tag = () => `${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
async function newUser(tier: "INNOCENT" | "INDICTED" | "FELON" = "INNOCENT") {
  const u = await prisma.user.create({
    data: { usernameKey: "itest_ent_" + tag(), name: "ent", tier },
    select: { id: true },
  });
  made.users.push(u.id);
  return u.id;
}
async function platformSub(userId: string, over: any = {}) {
  const t = tag();
  return prisma.subscription.create({
    data: {
      userId,
      tier: "FELON",
      status: "active",
      stripeSubId: "sub_" + t,
      stripeCustomerId: "cus_" + t,
      ...over,
    },
  });
}
async function lobbyWithTier(grantLevel: number) {
  const id = "itest-ent-" + tag();
  await prisma.lobby.create({ data: { id, name: "Ent" } });
  made.lobbies.push(id);
  const tier = await prisma.lobbyTier.create({
    data: { lobbyId: id, name: "Patron", priceMonthly: 500, grantLevel },
  });
  return { lobbyId: id, tierId: tier.id };
}
async function levelOf(lobbyId: string, userId: string) {
  const m = await prisma.lobbyMember.findUnique({ where: { lobbyId_userId: { lobbyId, userId } } });
  return m?.roleLevel ?? null;
}
async function buyLobbyTier(app: any, lobbyId: string, tierId: string, userId: string) {
  const subId = "sub_" + tag();
  stubStripe({ [`GET /subscriptions/${subId}`]: { id: subId, current_period_end: 1_900_000_000 } });
  await send(app, "checkout.session.completed", {
    subscription: subId,
    customer: "cus_" + tag(),
    metadata: {
      sub_type: "lobby_tier",
      lobby_id: lobbyId,
      lobby_tier_id: tierId,
      weered_user_id: userId,
    },
  });
  return subId;
}

afterAll(async () => {
  await prisma.lobby.deleteMany({ where: { id: { in: made.lobbies } } });
  await prisma.subscription.deleteMany({ where: { userId: { in: made.users } } });
  await prisma.user.deleteMany({ where: { id: { in: made.users } } });
  await prisma.$disconnect();
});

describe("platform tier follows the money", () => {
  it("an unpaid subscription loses the tier, and paying again restores it", async () => {
    const app = await makeApp();
    const uid = await newUser("FELON");
    const sub = await platformSub(uid);
    await send(app, "customer.subscription.updated", { id: sub.stripeSubId, status: "unpaid" });
    expect((await prisma.user.findUnique({ where: { id: uid } }))?.tier).toBe("INNOCENT");
    await send(app, "customer.subscription.updated", { id: sub.stripeSubId, status: "active" });
    expect((await prisma.user.findUnique({ where: { id: uid } }))?.tier).toBe("FELON");
    await app.close();
  });

  it("past_due keeps access while Stripe retries", async () => {
    const app = await makeApp();
    const uid = await newUser("INDICTED");
    const sub = await platformSub(uid, { tier: "INDICTED" });
    await send(app, "customer.subscription.updated", { id: sub.stripeSubId, status: "past_due" });
    expect((await prisma.user.findUnique({ where: { id: uid } }))?.tier).toBe("INDICTED");
    await app.close();
  });

  it("a full refund cancels the subscription and removes the tier", async () => {
    const app = await makeApp();
    const uid = await newUser("FELON");
    const sub = await platformSub(uid);
    stubStripe({ "GET /invoices/in_r1": { id: "in_r1", subscription: sub.stripeSubId } });
    await send(app, "charge.refunded", {
      id: "ch_r1",
      refunded: true,
      invoice: "in_r1",
      customer: sub.stripeCustomerId,
    });
    expect(calls).toContainEqual({ method: "DELETE", path: `/subscriptions/${sub.stripeSubId}` });
    expect((await prisma.user.findUnique({ where: { id: uid } }))?.tier).toBe("INNOCENT");
    const row = await prisma.subscription.findUnique({ where: { id: sub.id } });
    expect(row?.status).toBe("canceled");
    expect(row?.tier).toBe("FREE");
    await app.close();
  });

  it("a partial refund changes nothing", async () => {
    const app = await makeApp();
    const uid = await newUser("FELON");
    const sub = await platformSub(uid);
    stubStripe({});
    await send(app, "charge.refunded", {
      id: "ch_r2",
      refunded: false,
      invoice: "in_x",
      customer: sub.stripeCustomerId,
    });
    expect(calls).toEqual([]);
    expect((await prisma.user.findUnique({ where: { id: uid } }))?.tier).toBe("FELON");
    await app.close();
  });

  it("a chargeback ends it too, with the newer invoice shape", async () => {
    const app = await makeApp();
    const uid = await newUser("FELON");
    const sub = await platformSub(uid);
    stubStripe({
      "GET /charges/ch_d1": { id: "ch_d1", customer: sub.stripeCustomerId, invoice: "in_d1" },
      "GET /invoices/in_d1": {
        id: "in_d1",
        parent: { subscription_details: { subscription: sub.stripeSubId } },
      },
    });
    await send(app, "charge.dispute.created", { id: "dp_1", charge: "ch_d1" });
    expect(calls).toContainEqual({ method: "DELETE", path: `/subscriptions/${sub.stripeSubId}` });
    expect((await prisma.user.findUnique({ where: { id: uid } }))?.tier).toBe("INNOCENT");
    await app.close();
  });

  it("a refund it cannot tie to one subscription is left for a person", async () => {
    const app = await makeApp();
    const uid = await newUser("FELON");
    const sub = await platformSub(uid);
    const { lobbyId, tierId } = await lobbyWithTier(2);
    await prisma.lobbyTierSub.create({
      data: {
        lobbyTierId: tierId,
        lobbyId,
        userId: uid,
        stripeSubId: "sub_" + tag(),
        stripeCustomerId: sub.stripeCustomerId,
        status: "active",
      },
    });
    stubStripe({});
    await send(app, "charge.refunded", {
      id: "ch_r3",
      refunded: true,
      customer: sub.stripeCustomerId,
    });
    expect(calls.filter((c) => c.method === "DELETE")).toEqual([]);
    expect((await prisma.user.findUnique({ where: { id: uid } }))?.tier).toBe("FELON");
    await app.close();
  });
});

describe("lobby tier undoes exactly what it granted", () => {
  it("cancelling returns the member to their level before, even if the tier was edited since", async () => {
    const app = await makeApp();
    const { lobbyId, tierId } = await lobbyWithTier(3);
    const uid = await newUser();
    await prisma.lobbyMember.create({ data: { lobbyId, userId: uid, roleLevel: 2, name: "" } });
    const subId = await buyLobbyTier(app, lobbyId, tierId, uid);
    expect(await levelOf(lobbyId, uid)).toBe(3);
    await prisma.lobbyTier.update({ where: { id: tierId }, data: { grantLevel: 4 } });
    await send(app, "customer.subscription.deleted", { id: subId });
    expect(await levelOf(lobbyId, uid)).toBe(2);
    await app.close();
  });

  it("a member already at the tier's level is neither raised nor lowered", async () => {
    const app = await makeApp();
    const { lobbyId, tierId } = await lobbyWithTier(3);
    const uid = await newUser();
    await prisma.lobbyMember.create({ data: { lobbyId, userId: uid, roleLevel: 3, name: "" } });
    const subId = await buyLobbyTier(app, lobbyId, tierId, uid);
    await send(app, "customer.subscription.deleted", { id: subId });
    expect(await levelOf(lobbyId, uid)).toBe(3);
    await app.close();
  });

  it("an admin's change since the purchase is kept", async () => {
    const app = await makeApp();
    const { lobbyId, tierId } = await lobbyWithTier(3);
    const uid = await newUser();
    const subId = await buyLobbyTier(app, lobbyId, tierId, uid); // no membership before
    expect(await levelOf(lobbyId, uid)).toBe(3);
    await prisma.lobbyMember.update({
      where: { lobbyId_userId: { lobbyId, userId: uid } },
      data: { roleLevel: 4 },
    });
    await send(app, "customer.subscription.deleted", { id: subId });
    expect(await levelOf(lobbyId, uid)).toBe(4);
    await app.close();
  });

  it("unpaid removes the level, paying again restores it, and a later cancel still undoes it", async () => {
    const app = await makeApp();
    const { lobbyId, tierId } = await lobbyWithTier(3);
    const uid = await newUser();
    await prisma.lobbyMember.create({ data: { lobbyId, userId: uid, roleLevel: 1, name: "" } });
    const subId = await buyLobbyTier(app, lobbyId, tierId, uid);
    await send(app, "customer.subscription.updated", { id: subId, status: "unpaid" });
    expect(await levelOf(lobbyId, uid)).toBe(1);
    await send(app, "customer.subscription.updated", { id: subId, status: "active" });
    expect(await levelOf(lobbyId, uid)).toBe(3);
    await send(app, "customer.subscription.deleted", { id: subId });
    expect(await levelOf(lobbyId, uid)).toBe(1);
    await app.close();
  });

  it("a subscription from before the change still follows the old rule", async () => {
    const app = await makeApp();
    const { lobbyId, tierId } = await lobbyWithTier(3);
    const uid = await newUser();
    await prisma.lobbyMember.create({ data: { lobbyId, userId: uid, roleLevel: 3, name: "" } });
    const subId = "sub_" + tag();
    await prisma.lobbyTierSub.create({
      data: { lobbyTierId: tierId, lobbyId, userId: uid, stripeSubId: subId, status: "active" },
    });
    await send(app, "customer.subscription.deleted", { id: subId });
    expect(await levelOf(lobbyId, uid)).toBe(1);
    await app.close();
  });
});

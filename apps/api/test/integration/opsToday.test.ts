import { describe, it, expect, beforeAll, afterAll } from "vitest";
import staffTodayRoutes from "../../src/routes/staffToday";
import staffRoutes from "../../src/routes/staff";
import billingRoutes from "../../src/routes/billing";
import { prisma } from "../../src/lib/prisma";
import { canAccessStaff, canAssignRoles } from "../../src/lib/lobbyAuth";
import { buildTestApp, testAuthFromHeader, testToken } from "../helpers/buildTestApp";

// The ops rebuild (2026-11-02): Today's summary, and Subscriptions as the tier
// list for every account (it had never shown anyone, and a hand change to a
// paying member's tier was undone by Stripe's next update).
const stamp = Date.now().toString(36);
const id: Record<string, string> = {};
const contacts: string[] = [];
let bugId = "";
let app: any;

beforeAll(async () => {
  const people: [string, string, string][] = [
    ["member", "USER", "INNOCENT"],
    ["support", "SUPPORT", "INNOCENT"],
    ["admin", "ADMIN", "INNOCENT"],
    ["paid", "USER", "FELON"],
    ["given", "USER", "KINGPIN"],
    ["plain", "USER", "INNOCENT"],
  ];
  for (const [k, globalRole, tier] of people) {
    const u = await prisma.user.create({
      data: {
        usernameKey: `itest_ops_${k}_${stamp}`,
        name: `ops ${k} ${stamp}`,
        globalRole,
        tier,
      } as any,
      select: { id: true },
    });
    id[k] = u.id;
  }
  await prisma.subscription.create({
    data: {
      userId: id.paid,
      tier: "FELON",
      status: "active",
      stripeSubId: `sub_itest_${stamp}`,
      stripeCustomerId: `cus_itest_${stamp}`,
    },
  });
  bugId = (
    await prisma.bugReport.create({ data: { userId: id.member, body: `ops today ${stamp}` } })
  ).id;
  const yesterday = new Date(Date.now() - 86_400_000);
  for (const status of ["LEAD", "DECLINED"] as const) {
    const c = await prisma.outreachContact.create({
      data: {
        name: `ops ${status} ${stamp}`,
        company: "Test Co",
        status,
        nextFollowUp: yesterday,
        createdById: id.admin,
      },
    });
    contacts.push(c.id);
  }

  const target: any = {
    authFromHeader: testAuthFromHeader,
    getGlobalRole: async (uid: string) =>
      (await prisma.user.findUnique({ where: { id: uid }, select: { globalRole: true } }))
        ?.globalRole ?? "USER",
    canAccessStaff,
    canAssignRoles,
    rooms: new Map(),
    send: () => {},
  };
  const opts = new Proxy(target, {
    get: (t: any, p: string) => (p in t ? t[p] : () => Promise.resolve()),
  });
  app = await buildTestApp(async (a: any) => {
    await staffTodayRoutes(a, opts);
    await staffRoutes(a, opts);
    await billingRoutes(a, opts);
  });
});

afterAll(async () => {
  await app?.close();
  await prisma.outreachContact.deleteMany({ where: { id: { in: contacts } } }).catch(() => {});
  await prisma.bugReport.deleteMany({ where: { id: bugId } }).catch(() => {});
  await prisma.subscription
    .deleteMany({ where: { userId: { in: Object.values(id) } } })
    .catch(() => {});
  await prisma.globalAudit
    .deleteMany({ where: { actorId: { in: Object.values(id) } } })
    .catch(() => {});
  await prisma.user.deleteMany({ where: { id: { in: Object.values(id) } } }).catch(() => {});
  await prisma.$disconnect();
});

const as = (who: string) => ({ authorization: `Bearer ${testToken(id[who])}` });
const get = (who: string, url: string) => app.inject({ method: "GET", url, headers: as(who) });
const post = (who: string, url: string, body: any) =>
  app.inject({ method: "POST", url, headers: as(who), payload: body });

describe("ops Today", () => {
  it("is staff only", async () => {
    expect((await get("member", "/staff/today")).statusCode).toBe(403);
  });

  it("gives support the safety queue and nothing more", async () => {
    const j = (await get("support", "/staff/today")).json();
    expect(j.queue.bugs.open).toBeGreaterThanOrEqual(1);
    expect(j.queue.bugs.latest.map((b: any) => b.id)).toContain(bugId);
    expect(j.pulse).toBeUndefined();
    expect(j.outreach).toBeUndefined();
    expect(j.recent).toBeUndefined();
  });

  it("gives staff the pulse, the site switches and follow-ups still in play", async () => {
    const j = (await get("admin", "/staff/today")).json();
    expect(j.pulse.accounts).toBeGreaterThan(0);
    expect(j.pulse.paying).toBeGreaterThanOrEqual(1);
    expect(typeof j.site.registrationOpen).toBe("boolean");
    const due = j.outreach.list.map((c: any) => c.id);
    // Up to five are listed; the open one is due, the declined one never is.
    expect(due).not.toContain(contacts[1]);
    if (j.outreach.due <= 5) expect(due).toContain(contacts[0]);
    const mine = j.outreach.list.find((c: any) => c.id === contacts[0]);
    if (mine) expect(mine.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("ops Subscriptions", () => {
  it("lists everyone who holds a tier, paid or given, and not the rest", async () => {
    const r = await get("admin", "/staff/subscriptions");
    expect(r.statusCode).toBe(200);
    const byId = new Map(r.json().members.map((m: any) => [m.id, m]));
    expect(byId.get(id.paid)).toMatchObject({ tier: "FELON", paying: true });
    expect((byId.get(id.paid) as any).stripeUrl).toContain(`/customers/cus_itest_${stamp}`);
    expect(byId.get(id.given)).toMatchObject({ tier: "KINGPIN", paying: false });
    expect(byId.has(id.plain)).toBe(false);
  });

  it("finds any account by name, to give it a tier", async () => {
    const j = (await get("admin", `/staff/subscriptions?q=itest_ops_plain_${stamp}`)).json();
    expect(j.members.map((m: any) => m.id)).toEqual([id.plain]);
  });

  it("is closed to support", async () => {
    expect((await get("support", "/staff/subscriptions")).statusCode).toBe(403);
  });

  it("changes a tier by the person's id, and leaves a paying member's to Stripe", async () => {
    const ok = await post("admin", `/staff/users/${id.plain}/tier`, { tier: "INDICTED" });
    expect(ok.statusCode).toBe(200);
    expect((await prisma.user.findUnique({ where: { id: id.plain } }))?.tier).toBe("INDICTED");

    const paid = await post("admin", `/staff/users/${id.paid}/tier`, { tier: "KINGPIN" });
    expect(paid.statusCode).toBe(409);
    expect(paid.json().error).toBe("paid_through_stripe");
    const grant = await post("admin", "/staff/subscriptions/grant", {
      userId: id.paid,
      tier: "KINGPIN",
    });
    expect(grant.statusCode).toBe(409);
    expect((await prisma.user.findUnique({ where: { id: id.paid } }))?.tier).toBe("FELON");

    const gone = await post("admin", "/staff/users/no-such-user/tier", { tier: "FELON" });
    expect(gone.statusCode).toBe(404);
  });
});

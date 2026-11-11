import { describe, it, expect, beforeAll, afterAll } from "vitest";
import authRoutes from "../../src/routes/auth";
import { prisma } from "../../src/lib/prisma";
import { buildTestApp, testAuthFromHeader, testToken } from "../helpers/buildTestApp";
import jwt from "jsonwebtoken";

// The ECEB office's door opens itself while the advisor is in the office room
// (James 2026-11-11: "Just send people a quick link and the office is always set
// up"). With nobody in, a walk-in is turned away (the sign's hours are off in
// the test: no office-hours file).
const JWT_SECRET = "weered-integration-test-secret";
const STAFF = "itest_office_staff";
const rooms = new Map<string, any>();
let app: any;

beforeAll(async () => {
  app = await buildTestApp((a: any) =>
    authRoutes(a, {
      authFromHeader: testAuthFromHeader,
      JWT_SECRET,
      isNameReserved: async () => false,
      getSiteConfig: async () => null,
      seedWelcomeDM: async () => {},
      rooms,
      isOfficeStaff: async (id?: string) => id === STAFF,
      JWT_SECRET,
    } as any),
  );
});

afterAll(async () => {
  await app?.close();
  await prisma.invite
    .deleteMany({ where: { targetId: "mtg-eceb", note: null, uses: 0, maxUses: 1 } })
    .catch(() => {});
  await prisma.$disconnect();
});

const status = async () => (await app.inject({ method: "GET", url: "/office/status" })).json();
const walkIn = () =>
  app.inject({ method: "POST", url: "/office/walkin", payload: { name: "Pat Client" } });

describe("the office door", () => {
  it("stays shut with nobody in, and with only a guest in", async () => {
    rooms.clear();
    expect((await status()).receiving).toBe(false);
    expect((await walkIn()).statusCode).toBe(403);
    rooms.set("mtg-eceb-office", {
      users: new Map([["guest_abc", { id: "guest_abc", name: "Pat" }]]),
    });
    expect((await status()).hostIn).toBe(false);
    expect((await walkIn()).statusCode).toBe(403);
  });

  it("opens while the advisor is in the office, for a walk-in to knock", async () => {
    rooms.set("mtg-eceb-office", {
      users: new Map([[STAFF, { id: STAFF, name: "James" }]]),
    });
    const s = await status();
    expect(s.hostIn).toBe(true);
    expect(s.receiving).toBe(true);
    // The sign itself is untouched: the ECEB site still shows the hours.
    expect(s.open).toBe(false);
    const r = await walkIn();
    expect(r.statusCode).toBe(200);
    expect(r.json().url).toMatch(/^\/foyer\?invite=m_[0-9a-f]+/);
  });
});

describe("the host pass", () => {
  const pass = (who?: string) =>
    app.inject({
      method: "GET",
      url: "/office/host-pass",
      headers: who ? { authorization: `Bearer ${testToken(who)}` } : {},
    });

  it("sends office staff into the office as its host, the pass in the fragment", async () => {
    const r = await pass(STAFF);
    expect(r.statusCode).toBe(302);
    const to = String(r.headers.location);
    expect(to.startsWith("https://office.eastcoastemployeebenefits.com/foyer#host=")).toBe(true);
    const claims: any = jwt.verify(to.split("#host=")[1], JWT_SECRET);
    expect(claims).toMatchObject({ sub: "eceb-host", host: true, scope: { office: "mtg-eceb" } });
    expect(r.headers["cache-control"]).toBe("no-store");
  });

  it("gives anyone else the client's door, and no pass", async () => {
    for (const r of [await pass("itest_somebody_else"), await pass()]) {
      expect(r.statusCode).toBe(302);
      expect(String(r.headers.location)).toBe("https://office.eastcoastemployeebenefits.com/foyer");
    }
  });
});

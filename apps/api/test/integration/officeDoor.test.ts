import { describe, it, expect, beforeAll, afterAll } from "vitest";
import authRoutes from "../../src/routes/auth";
import { prisma } from "../../src/lib/prisma";
import { buildTestApp, testAuthFromHeader, testToken } from "../helpers/buildTestApp";
import { makeEmptyRoom, settleOfficeDoor } from "../../src/lib/roomState";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
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

describe("walk-ins", () => {
  // The office's file in a temp folder (it's /opt/weered/office-hours.json on
  // the droplet), and a real room state for the live door.
  let dir = "";
  const prevFile = process.env.OFFICE_STATE_FILE;
  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), "office-"));
    process.env.OFFICE_STATE_FILE = join(dir, "office-hours.json");
  });
  afterAll(() => {
    if (prevFile === undefined) delete process.env.OFFICE_STATE_FILE;
    else process.env.OFFICE_STATE_FILE = prevFile;
    rmSync(dir, { recursive: true, force: true });
  });
  const set = (body: any, who = STAFF) =>
    app.inject({
      method: "POST",
      url: "/office/set",
      headers: { authorization: `Bearer ${testToken(who)}` },
      payload: body,
    });

  it("are off until the host turns them on, and only the host can", async () => {
    rooms.clear();
    let s = await status();
    expect(s.walkIn).toBe(false);
    expect(s.doorOpen).toBe(false);
    expect((await set({ walkIn: true }, "itest_somebody_else")).statusCode).toBe(403);
    const r = await set({ walkIn: true });
    expect(r.statusCode).toBe(200);
    expect(r.json()).toMatchObject({ walkIn: true, doorOpen: true });
    s = await status();
    expect(s.walkIn).toBe(true);
    expect(s.doorOpen).toBe(true);
  });

  it("shut the live door behind a visitor, and open it when walk-ins go back on", async () => {
    const room = makeEmptyRoom("mtg-eceb-office");
    room.locked = false;
    room.users.set("guest_pat", { id: "guest_pat", name: "Pat", isGuest: true } as any);
    rooms.set("mtg-eceb-office", room);
    await settleOfficeDoor(room);
    expect(room.locked).toBe(true);
    expect((await status()).doorOpen).toBe(false);
    // The visitor leaves: the door opens again.
    room.users.delete("guest_pat");
    await settleOfficeDoor(room);
    expect(room.locked).toBe(false);
    // Walk-ins off: shut, with nobody in.
    expect((await set({ walkIn: false })).json()).toMatchObject({ walkIn: false, doorOpen: false });
    expect(room.locked).toBe(true);
    rooms.clear();
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

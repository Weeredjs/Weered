import { describe, it, expect, beforeAll, afterAll } from "vitest";
import rapSheetRoutes from "../../src/routes/rapSheet";
import { buildTestApp, testAuthFromHeader, testToken } from "../helpers/buildTestApp";
import { prisma } from "../../src/lib/prisma";

// A player's rap sheet, weered.ca/rap/<name> (2026-11-01, the GTA VI launch).
const stamp = Date.now().toString(36);
const NAME = `itest_rap_${stamp}`;
const TAG = `QR${stamp.slice(-4).toUpperCase()}`;
const id: Record<string, string> = {};
let crewId = "";
let app: any;
const as = (userId: string) => ({ authorization: `Bearer ${testToken(userId)}` });

beforeAll(async () => {
  id.alice = (
    await prisma.user.create({
      data: {
        usernameKey: NAME,
        name: "Alice",
        email: `${NAME}@example.com`,
        notoriety: 1200,
        createdAt: new Date("2026-10-01T00:00:00Z"),
      },
    })
  ).id;
  id.guest = (
    await prisma.user.create({
      data: { usernameKey: `guest_${stamp}`, name: "Visitor", isGuest: true },
    })
  ).id;
  crewId = (
    await (prisma as any).crew.create({
      data: {
        name: "Night Shift",
        tag: TAG,
        tagKey: TAG,
        ownerId: id.alice,
        members: { create: { userId: id.alice, role: "LEADER" } },
      },
    })
  ).id;
  // Four people came in on Alice's links; a guest link's visitors don't count.
  await prisma.invite.create({
    data: { type: "LOBBY", targetId: "x", createdBy: id.alice, maxUses: 10, uses: 4 },
  });
  await prisma.invite.create({
    data: { type: "GUEST", targetId: "x", createdBy: id.alice, maxUses: 10, uses: 9 },
  });
  app = await buildTestApp((a: any) => rapSheetRoutes(a, { authFromHeader: testAuthFromHeader }));
});

afterAll(async () => {
  await app?.close();
  await prisma.invite.deleteMany({ where: { createdBy: id.alice } }).catch(() => {});
  await (prisma as any).crewMember.deleteMany({ where: { crewId } }).catch(() => {});
  await (prisma as any).crew.deleteMany({ where: { id: crewId } }).catch(() => {});
  await prisma.notorietyEvent.deleteMany({ where: { userId: id.alice } }).catch(() => {});
  await prisma.user.deleteMany({ where: { id: { in: Object.values(id) } } }).catch(() => {});
  await prisma.$disconnect();
});

const save = (userId: string, payload: any) =>
  app.inject({ method: "PUT", url: "/rapsheet", headers: as(userId), payload });

describe("rap sheets", () => {
  it("files a sheet, keeping only the choices it offers", async () => {
    const r = await save(id.alice, {
      playstyles: ["Heists", "Racing", "Heists", "Hacking the mainframe"],
      hours: ["Late nights", "Weekends", "Mornings", "Evenings"],
      timezone: "America/Halifax",
      mic: "yes",
      lookingFor: "crew",
      motto: "  Never   met a heist\nI didn't like  ",
      psn: "NightAlice",
    });
    expect(r.statusCode).toBe(200);
    const s = r.json().sheet;
    expect(s).toMatchObject({
      filed: true,
      playstyles: ["Heists", "Racing"],
      hours: ["Late nights", "Weekends", "Mornings"],
      timezone: "America/Halifax",
      mic: "yes",
      lookingFor: "crew",
      motto: "Never met a heist I didn't like",
      handles: { psn: "NightAlice", xbox: null },
    });
  });

  it("drops what isn't a choice instead of refusing it, but refuses a PSN ID PSN wouldn't allow", async () => {
    const r = await save(id.alice, { mic: "loud", lookingFor: "trouble", timezone: "<script>" });
    expect(r.json().sheet).toMatchObject({ mic: "", lookingFor: "", timezone: "" });
    expect((await save(id.alice, { psn: "1nvalid id!" })).statusCode).toBe(400);
  });

  it("shows anyone the sheet, with rank, crew and priors, and nothing private", async () => {
    await save(id.alice, { playstyles: ["Heists"], psn: "NightAlice" });
    const r = await app.inject({ method: "GET", url: `/rapsheet/${NAME.toUpperCase()}` });
    expect(r.statusCode).toBe(200);
    const s = r.json().sheet;
    expect(s).toMatchObject({
      name: "Alice",
      username: NAME,
      caseNo: id.alice.slice(-8).toUpperCase(),
      rank: { title: "Enforcer", stars: 3 },
      crew: { id: crewId, tag: TAG, boss: true },
    });
    expect(s.priors.map((p: any) => p.id)).toEqual(["drop", "boss", "recruiter", "wanted"]);
    expect(s.priors.find((p: any) => p.id === "recruiter").detail).toBe("Brought 4 people in");
    expect(JSON.stringify(r.json())).not.toContain("@example.com");
  });

  it("gives filing a sheet its notoriety once", async () => {
    await new Promise((res) => setTimeout(res, 300));
    const n = await prisma.notorietyEvent.count({
      where: { userId: id.alice, action: "RAP_SHEET_FILED" },
    });
    expect(n).toBe(1);
  });

  it("has no sheet for a guest, and asks the signed-out to sign in", async () => {
    expect((await app.inject({ method: "GET", url: `/rapsheet/guest_${stamp}` })).statusCode).toBe(
      404,
    );
    expect((await save(id.guest, { playstyles: ["Heists"] })).statusCode).toBe(403);
    expect((await app.inject({ method: "GET", url: "/rapsheet/me" })).statusCode).toBe(401);
    expect(
      (await app.inject({ method: "GET", url: "/rapsheet/nobody-here-at-all" })).statusCode,
    ).toBe(404);
  });

  it("gives its owner the sheet and the choices to edit it with", async () => {
    const r = await app.inject({ method: "GET", url: "/rapsheet/me", headers: as(id.alice) });
    expect(r.statusCode).toBe(200);
    expect(r.json().choices.playstyles).toContain("Heists");
    expect(r.json().sheet.filed).toBe(true);
  });
});

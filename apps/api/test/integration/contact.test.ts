import { describe, it, expect, afterAll } from "vitest";
import supportRoutes from "../../src/routes/support";
import { buildTestApp, testAuthFromHeader } from "../helpers/buildTestApp";
import { prisma } from "../../src/lib/prisma";

// The contact form posted from the browser to FormSubmit, which went down
// (2026-11-03): every message failed and nothing was kept. Now Weered keeps
// each one in Ops (Bug Reports, kind CONTACT) whatever happens to the email.
const makeApp = () =>
  buildTestApp((app: any) =>
    supportRoutes(app, {
      authFromHeader: testAuthFromHeader,
      getGlobalRole: async () => "USER",
      canAccessStaff: () => false,
      globalAudit: async () => {},
    } as any),
  );

const stamp = Date.now().toString(36);
const mark = `itest-contact-${stamp}`;

afterAll(async () => {
  await prisma.bugReport.deleteMany({ where: { body: { contains: mark } } }).catch(() => {});
  await prisma.$disconnect();
});

describe("POST /contact", () => {
  it("keeps the message in Ops as kind CONTACT, signed in or not", async () => {
    const app = await makeApp();
    const r = await app.inject({
      method: "POST",
      url: "/contact",
      payload: {
        name: "Dana",
        email: "dana@example.com",
        message: `Do paid lobbies get custom emojis? ${mark}`,
      },
    });
    expect(r.statusCode).toBe(200);
    expect(r.json().ok).toBe(true);
    const row = await prisma.bugReport.findFirst({ where: { body: { contains: mark } } });
    expect(row?.category).toBe("CONTACT");
    expect(row?.page).toBe("/contact");
    expect(row?.userId).toBeNull();
    expect(row?.body.startsWith("Dana <dana@example.com>")).toBe(true);
  });

  it("refuses a bad email or an empty message, and keeps nothing", async () => {
    const app = await makeApp();
    const bad = await app.inject({
      method: "POST",
      url: "/contact",
      payload: { name: "X", email: "not-an-email", message: `hello there ${mark}-bad` },
    });
    expect(bad.statusCode).toBe(400);
    expect(bad.json().error).toBe("bad_email");
    const short = await app.inject({
      method: "POST",
      url: "/contact",
      payload: { name: "X", email: "x@example.com", message: "hi" },
    });
    expect(short.statusCode).toBe(400);
    expect(await prisma.bugReport.count({ where: { body: { contains: `${mark}-bad` } } })).toBe(0);
  });

  it("tells a bot that fills the hidden field it was sent, and keeps nothing", async () => {
    const app = await makeApp();
    const r = await app.inject({
      method: "POST",
      url: "/contact",
      payload: {
        name: "Bot",
        email: "bot@example.com",
        message: `buy now ${mark}-bot`,
        website: "https://spam.example",
      },
    });
    expect(r.statusCode).toBe(200);
    expect(await prisma.bugReport.count({ where: { body: { contains: `${mark}-bot` } } })).toBe(0);
  });

  it("is not something a member can file through the bug form", async () => {
    const app = await makeApp();
    const r = await app.inject({
      method: "POST",
      url: "/bugs",
      payload: { body: `pretend contact ${mark}-bug`, category: "CONTACT" },
    });
    expect(r.statusCode).toBe(200);
    const row = await prisma.bugReport.findFirst({ where: { body: { contains: `${mark}-bug` } } });
    expect(row?.category).toBe("BUG");
  });
});

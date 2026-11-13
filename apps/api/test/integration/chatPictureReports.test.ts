import { describe, it, expect, afterEach, afterAll } from "vitest";
import chatMediaRoutes from "../../src/routes/chatMedia";
import { buildTestApp, testToken, testAuthFromHeader } from "../helpers/buildTestApp";
import { prisma } from "../../src/lib/prisma";

// Reporting a picture in chat: three reports hide it until staff look. The
// count is the number of different accounts that reported it, and each report
// is a row in the staff queue (hardening pass, 2026-11-13).

function makeApp() {
  return buildTestApp((app: any) =>
    chatMediaRoutes(app, {
      authFromHeader: testAuthFromHeader,
      isStaff: (role?: string) => ["STAFF", "ADMIN", "GOD"].includes(String(role || "")),
    } as any),
  );
}

const users: string[] = [];
const pictures: string[] = [];

async function newUser(tag: string) {
  const stamp = Date.now() + "_" + Math.floor(performance.now()) + Math.floor(Math.random() * 1e6);
  const u = await prisma.user.create({
    data: { usernameKey: "itest_cpr_" + tag + "_" + stamp, name: tag },
    select: { id: true },
  });
  users.push(u.id);
  return u.id;
}
async function newPicture(uploaderId: string) {
  const name = Math.floor(Math.random() * 1e12)
    .toString(16)
    .padStart(20, "0")
    .slice(0, 20);
  const att = await prisma.chatAttachment.create({
    data: {
      uploaderId,
      roomId: "lobby",
      url: `/chat/media/${name}.webp`,
      thumbUrl: `/chat/media/${name}.t.webp`,
    },
    select: { id: true },
  });
  pictures.push(att.id);
  return att.id;
}
const report = (app: any, pictureId: string, userId: string) =>
  app.inject({
    method: "POST",
    url: `/chat/attachments/${pictureId}/report`,
    headers: { authorization: "Bearer " + testToken(userId) },
    payload: {},
  });
const picture = (id: string) =>
  prisma.chatAttachment.findUnique({ where: { id }, select: { status: true, reports: true } });

describe("reporting a picture in chat", () => {
  afterEach(async () => {
    if (users.length)
      await prisma.report.deleteMany({ where: { reporterId: { in: users } } }).catch(() => {});
    if (pictures.length)
      await prisma.chatAttachment.deleteMany({ where: { id: { in: pictures } } }).catch(() => {});
    if (users.length)
      await prisma.user.deleteMany({ where: { id: { in: users } } }).catch(() => {});
    users.length = 0;
    pictures.length = 0;
  });
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("one account reporting three times counts once and hides nothing", async () => {
    const app = await makeApp();
    const uploader = await newUser("uploader");
    const one = await newUser("one");
    const id = await newPicture(uploader);
    for (let i = 0; i < 3; i++) {
      const r = await report(app, id, one);
      expect(r.statusCode).toBe(200);
      expect(r.json().status).toBe("ACTIVE");
    }
    expect(await picture(id)).toEqual({ status: "ACTIVE", reports: 1 });
    expect(await prisma.report.count({ where: { context: `attachment:${id}` } })).toBe(1);
    await app.close();
  });

  it("three different accounts hide it, and staff get a report naming the uploader", async () => {
    const app = await makeApp();
    const uploader = await newUser("uploader");
    const id = await newPicture(uploader);
    const reporters = [await newUser("a"), await newUser("b"), await newUser("c")];
    const seen: string[] = [];
    for (const who of reporters) seen.push((await report(app, id, who)).json().status);
    expect(seen).toEqual(["ACTIVE", "ACTIVE", "HIDDEN"]);
    expect(await picture(id)).toEqual({ status: "HIDDEN", reports: 3 });

    const rows = await prisma.report.findMany({ where: { context: `attachment:${id}` } });
    expect(rows).toHaveLength(3);
    expect(rows.every((r) => r.targetType === "USER" && r.targetId === uploader)).toBe(true);
    expect(rows[0].bodySnapshot).toMatch(/\/chat\/media\/[a-f0-9]{20}\.webp$/);
    await app.close();
  });

  it("the uploader reporting their own picture adds nothing", async () => {
    const app = await makeApp();
    const uploader = await newUser("uploader");
    const id = await newPicture(uploader);
    const r = await report(app, id, uploader);
    expect(r.statusCode).toBe(200);
    expect(await picture(id)).toEqual({ status: "ACTIVE", reports: 0 });
    await app.close();
  });

  it("asks for a signed-in account", async () => {
    const app = await makeApp();
    const uploader = await newUser("uploader");
    const id = await newPicture(uploader);
    const r = await app.inject({
      method: "POST",
      url: `/chat/attachments/${id}/report`,
      payload: {},
    });
    expect(r.statusCode).toBe(401);
    await app.close();
  });
});

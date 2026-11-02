import { describe, it, expect, beforeAll, afterAll } from "vitest";
import staffRoutes from "../../src/routes/staff";
import supportRoutes from "../../src/routes/support";
import socialRoutes from "../../src/routes/social";
import { prisma } from "../../src/lib/prisma";
import { bannedMessage } from "../../src/lib/banAppeal";
import { canAccessStaff, canAssignRoles } from "../../src/lib/lobbyAuth";
import { buildTestApp, testAuthFromHeader, testToken } from "../helpers/buildTestApp";

// Ops rebuild, part 2 (2026-11-02): one role ladder, the board's delete rule,
// an audit log that keeps every action, the Reports desk, and appeals that
// tell the person the outcome.
const stamp = Date.now().toString(36);
const id: Record<string, string> = {};
const audit = async (action: string, targetId: string) =>
  prisma.globalAudit.findFirst({ where: { action, targetId } });
let app: any;
let msgId = "";

beforeAll(async () => {
  const people: [string, string][] = [
    ["god", "GOD"],
    ["admin", "ADMIN"],
    ["staff", "STAFF"],
    ["support", "SUPPORT"],
    ["member", "USER"],
    ["other", "USER"],
  ];
  for (const [k, globalRole] of people) {
    const u = await prisma.user.create({
      data: { usernameKey: `itest_ps_${k}_${stamp}`, name: `ps ${k}`, globalRole } as any,
      select: { id: true },
    });
    id[k] = u.id;
  }
  msgId = `itest-msg-${stamp}`;
  await prisma.room.create({ data: { id: `itest-room-${stamp}`, name: "ps room" } });
  await prisma.roomMessage.create({
    data: {
      id: msgId,
      roomId: `itest-room-${stamp}`,
      userId: id.other,
      userName: "ps other",
      body: "rude words",
    },
  });

  const target: any = {
    authFromHeader: testAuthFromHeader,
    getGlobalRole: async (uid: string) =>
      (await prisma.user.findUnique({ where: { id: uid }, select: { globalRole: true } }))
        ?.globalRole ?? "USER",
    canAccessStaff,
    canAssignRoles,
    rooms: new Map(),
    send: () => {},
    broadcast: () => {},
    publishState: () => {},
    findSocketsByUser: () => [],
    getWss: () => ({ clients: new Set() }),
    globalAudit: async (
      actorId: string,
      actorName: string,
      action: string,
      targetId?: string,
      targetName?: string,
      meta?: any,
    ) => {
      await prisma.globalAudit.create({
        data: {
          actorId,
          actorName,
          action,
          targetId: targetId ?? null,
          targetName: targetName ?? null,
          meta: meta ?? null,
        },
      });
    },
  };
  const opts = new Proxy(target, {
    get: (t: any, p: string) => (p in t ? t[p] : () => Promise.resolve()),
  });
  app = await buildTestApp(async (a: any) => {
    await staffRoutes(a, opts);
    await supportRoutes(a, opts);
    await socialRoutes(a, opts);
  });
});

afterAll(async () => {
  await app?.close();
  const ids = Object.values(id);
  await prisma.roomMessage.deleteMany({ where: { id: msgId } }).catch(() => {});
  await prisma.room.deleteMany({ where: { id: `itest-room-${stamp}` } }).catch(() => {});
  await prisma.report.deleteMany({ where: { reporterId: { in: ids } } }).catch(() => {});
  await prisma.staffPost.deleteMany({ where: { authorId: { in: ids } } }).catch(() => {});
  await prisma.banAppeal.deleteMany({ where: { userId: { in: ids } } }).catch(() => {});
  await prisma.bugReport.deleteMany({ where: { body: { contains: stamp } } }).catch(() => {});
  await prisma.notification.deleteMany({ where: { userId: { in: ids } } }).catch(() => {});
  await prisma.globalAudit.deleteMany({ where: { actorId: { in: ids } } }).catch(() => {});
  await prisma.user.deleteMany({ where: { id: { in: ids } } }).catch(() => {});
  await prisma.$disconnect();
});

const as = (who: string) => ({ authorization: `Bearer ${testToken(id[who])}` });
const call = (who: string, method: string, url: string, payload?: any) =>
  app.inject({ method, url, headers: as(who), ...(payload ? { payload } : {}) });
const role = async (who: string) =>
  (await prisma.user.findUnique({ where: { id: id[who] }, select: { globalRole: true } }))
    ?.globalRole;

describe("the role ladder on the server", () => {
  it("lets staff make support, and nothing higher", async () => {
    expect(
      (await call("staff", "POST", `/staff/users/${id.member}/role`, { role: "SUPPORT" }))
        .statusCode,
    ).toBe(200);
    expect(await role("member")).toBe("SUPPORT");
    const up = await call("staff", "POST", `/staff/users/${id.member}/role`, { role: "ADMIN" });
    expect(up.statusCode).toBe(403);
    expect(await role("member")).toBe("SUPPORT");
    await call("staff", "POST", `/staff/users/${id.member}/role`, { role: "USER" });
  });

  it("keeps staff from changing each other, and anyone from changing themselves", async () => {
    expect(
      (await call("admin", "POST", `/staff/users/${id.staff}/role`, { role: "USER" })).statusCode,
    ).toBe(403);
    expect(
      (await call("staff", "POST", `/staff/users/${id.admin}/role`, { role: "USER" })).statusCode,
    ).toBe(403);
    expect(
      (await call("god", "POST", `/staff/users/${id.god}/role`, { role: "USER" })).json().error,
    ).toBe("cannot_change_self");
    expect(await role("staff")).toBe("STAFF");
  });

  it("lets support kick a member but not staff", async () => {
    expect((await call("support", "POST", `/staff/users/${id.member}/kick`)).statusCode).toBe(200);
    expect((await call("support", "POST", `/staff/users/${id.staff}/kick`)).statusCode).toBe(403);
  });
});

describe("the board", () => {
  it("lets support delete their own post, not anyone's, and records it", async () => {
    const mine = (
      await call("support", "POST", "/staff/board", { body: `support note ${stamp}` })
    ).json().post;
    const theirs = (
      await call("staff", "POST", "/staff/board", { body: `staff note ${stamp}` })
    ).json().post;
    expect((await call("support", "DELETE", `/staff/board/${theirs.id}`)).statusCode).toBe(403);
    expect((await call("support", "DELETE", `/staff/board/${mine.id}`)).statusCode).toBe(200);
    // A board post isn't a person: this entry used to fail to save.
    expect(await audit("board_delete", mine.id)).toBeTruthy();
    expect((await call("staff", "DELETE", `/staff/board/${theirs.id}`)).statusCode).toBe(200);
  });
});

describe("the Reports desk", () => {
  it("refuses a report about something that doesn't exist", async () => {
    const r = await call("member", "POST", "/reports", {
      targetType: "USER",
      targetId: "no-such-user",
      reason: "SPAM",
    });
    expect(r.statusCode).toBe(404);
  });

  it("names a message's author and room, and removes the message", async () => {
    const filed = await call("member", "POST", "/reports", {
      targetType: "MESSAGE",
      targetId: msgId,
      reason: "HARASSMENT",
    });
    expect(filed.statusCode).toBe(200);
    const list = (await call("support", "GET", "/staff/reports?status=OPEN")).json().reports;
    const row = list.find((x: any) => x.id === filed.json().id);
    expect(row.target).toMatchObject({
      exists: true,
      roomId: `itest-room-${stamp}`,
      person: { id: id.other },
    });

    expect((await call("support", "POST", `/staff/messages/${msgId}/delete`)).statusCode).toBe(200);
    const m = await prisma.roomMessage.findUnique({ where: { id: msgId } });
    expect(m?.deletedAt).toBeTruthy();
    expect(m?.body).toBe("");
    expect(await audit("message_delete", msgId)).toBeTruthy();

    await call("support", "POST", `/staff/reports/${row.id}/action`, {
      status: "ACTIONED",
      did: "message_removed",
    });
    const done = await audit("report_actioned", row.id);
    expect((done?.meta as any)?.did).toBe("message_removed");
  });
});

describe("ban appeals", () => {
  async function ban(who: string, reason: string) {
    await prisma.user.update({ where: { id: id[who] }, data: { banned: true, banReason: reason } });
  }

  it("keeps the ban's reason, tells an approved person, and records it", async () => {
    await ban("member", "spam bots");
    const a = await prisma.banAppeal.create({
      data: { userId: id.member, reason: "It was my cousin, I promise." },
    });
    expect(
      (
        await call("support", "POST", `/staff/ban-appeals/${a.id}/review`, {
          decision: "APPROVED",
          note: "Welcome back",
        })
      ).statusCode,
    ).toBe(200);
    expect((await prisma.banAppeal.findUnique({ where: { id: a.id } }))?.banReason).toBe(
      "spam bots",
    );
    expect((await prisma.user.findUnique({ where: { id: id.member } }))?.banned).toBe(false);
    const n = await prisma.notification.findFirst({ where: { userId: id.member, type: "SYSTEM" } });
    expect(n?.body).toBe("Welcome back");
    expect(await audit("appeal_approved", id.member)).toBeTruthy();
  });

  it("tells a denied person at sign-in, with the note and when they may appeal again", async () => {
    await ban("other", "threats");
    const a = await prisma.banAppeal.create({
      data: { userId: id.other, reason: "Please let me back in now." },
    });
    await call("support", "POST", `/staff/ban-appeals/${a.id}/review`, {
      decision: "DENIED",
      note: "Not this time",
    });
    const text = await bannedMessage(id.other);
    expect(text).toContain("Your appeal was denied.");
    expect(text).toContain('Staff said: "Not this time"');
    expect(text).toMatch(/You can appeal again after/);
  });
});

describe("bug reports", () => {
  it("reopen, and closing is recorded", async () => {
    const b = await prisma.bugReport.create({ data: { body: `broken thing ${stamp}` } });
    await call("support", "POST", `/staff/bugs/${b.id}/close`, { note: "fixed" });
    expect(await audit("bug_close", b.id)).toBeTruthy();
    expect((await call("support", "POST", `/staff/bugs/${b.id}/reopen`)).statusCode).toBe(200);
    expect((await prisma.bugReport.findUnique({ where: { id: b.id } }))?.status).toBe("OPEN");
  });
});

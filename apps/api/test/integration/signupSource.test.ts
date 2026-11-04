import { describe, it, expect, afterAll } from "vitest";
import signupSourceRoutes, { cleanRef } from "../../src/routes/signupSource";
import { buildTestApp, testToken, testAuthFromHeader } from "../helpers/buildTestApp";
import { prisma } from "../../src/lib/prisma";

// Where a new account came from (2026-11-04): the outreach's measure. Only a
// new account takes a source, and only once.
const created: string[] = [];
async function newUser(tag: string, extra: any = {}): Promise<string> {
  const stamp = Date.now() + "_" + Math.floor(Math.random() * 1e6);
  const u = await prisma.user.create({
    data: { usernameKey: "itest_src_" + tag + "_" + stamp, name: tag, ...extra },
    select: { id: true },
  });
  created.push(u.id);
  return u.id;
}
const makeApp = () =>
  buildTestApp((app: any) => signupSourceRoutes(app, { authFromHeader: testAuthFromHeader }));
const post = (app: any, uid: string, ref: unknown) =>
  app.inject({
    method: "POST",
    url: "/profile/source",
    headers: { authorization: "Bearer " + testToken(uid) },
    payload: { ref },
  });
const sourceOf = async (id: string) =>
  (await prisma.user.findUnique({ where: { id }, select: { signupSource: true } }))?.signupSource;

afterAll(async () => {
  if (created.length)
    await prisma.user.deleteMany({ where: { id: { in: created } } }).catch(() => {});
});

describe("POST /profile/source", () => {
  it("keeps the first source of a new account, and only that", async () => {
    const app = await makeApp();
    const uid = await newUser("fresh");
    expect((await post(app, uid, "Sept-Organizers")).json()).toEqual({ ok: true, saved: true });
    expect((await post(app, uid, "reddit")).json()).toEqual({ ok: true, saved: false });
    expect(await sourceOf(uid)).toBe("sept-organizers");
    await app.close();
  });

  it("leaves an older account alone and refuses junk", async () => {
    const app = await makeApp();
    const old = await newUser("old", { createdAt: new Date(Date.now() - 5 * 86400_000) });
    expect((await post(app, old, "accounts")).json().saved).toBe(false);
    expect(await sourceOf(old)).toBeNull();
    expect((await post(app, old, "<b>x</b>")).statusCode).toBe(400);
    expect(cleanRef("a".repeat(41))).toBeNull();
    await app.close();
  });
});

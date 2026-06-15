import { describe, it, expect, afterEach, afterAll } from "vitest";
import forumRoutes from "../../src/routes/forum";
import { buildTestApp, testToken, testAuthFromHeader } from "../helpers/buildTestApp";
import { prisma } from "../../src/lib/prisma";

async function makeApp() {
  return buildTestApp((app: any) =>
    forumRoutes(app, {
      authFromHeader: testAuthFromHeader,
      getGlobalRole: async () => "USER",
      canAccessStaff: () => false,
      getLobbyRole: async () => null,
      resolveMentions: async () => [],
      createNotification: async () => {},
    } as any),
  );
}

const posts: string[] = [];
const users: string[] = [];
async function newUser(tag: string) {
  const stamp = Date.now() + "_" + Math.floor(performance.now());
  const u = await prisma.user.create({
    data: { usernameKey: "itest_forum_" + tag + "_" + stamp, name: tag },
    select: { id: true },
  });
  users.push(u.id);
  return u.id;
}

describe("forum - create post + comment", () => {
  afterEach(async () => {
    for (const p of posts) {
      await prisma.forumComment.deleteMany({ where: { postId: p } }).catch(() => {});
      await prisma.forumSubscription.deleteMany({ where: { postId: p } }).catch(() => {});
    }
    if (posts.length)
      await prisma.forumPost.deleteMany({ where: { id: { in: posts } } }).catch(() => {});
    if (users.length)
      await prisma.user.deleteMany({ where: { id: { in: users } } }).catch(() => {});
    posts.length = 0;
    users.length = 0;
  });
  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function createPost(uid: string) {
    const app = await makeApp();
    const r = await app.inject({
      method: "POST",
      url: "/forum/posts",
      headers: { authorization: `Bearer ${testToken(uid)}` },
      payload: { title: "Hello", body: "World body" },
    });
    const id = r.json().post?.id ?? r.json().id;
    if (id) posts.push(id);
    return { app, r, id };
  }

  it("creates a post (author auto-subscribed), then comments on it", async () => {
    const uid = await newUser("author");
    const { app, r, id } = await createPost(uid);
    expect(r.statusCode).toBe(200);
    expect(id).toBeTruthy();
    const dbPost = await prisma.forumPost.findUnique({ where: { id } });
    expect(dbPost?.title).toBe("Hello");

    const c = await app.inject({
      method: "POST",
      url: `/forum/posts/${id}/comments`,
      headers: { authorization: `Bearer ${testToken(uid)}` },
      payload: { body: "first comment" },
    });
    expect(c.statusCode).toBe(200);
    expect(await prisma.forumComment.count({ where: { postId: id } })).toBe(1);
    await app.close();
  });

  it("rejects no-auth (401) and empty title/body (400)", async () => {
    const app = await makeApp();
    const uid = await newUser("val");
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/forum/posts",
          payload: { title: "t", body: "b" },
        })
      ).statusCode,
    ).toBe(401);
    const bad = await app.inject({
      method: "POST",
      url: "/forum/posts",
      headers: { authorization: `Bearer ${testToken(uid)}` },
      payload: { title: "", body: "" },
    });
    expect(bad.statusCode).toBe(400);
    await app.close();
  });

  it("comment: 404 on missing post, 403 on a locked post", async () => {
    const uid = await newUser("cmt");
    const missing = await makeApp();
    const m = await missing.inject({
      method: "POST",
      url: "/forum/posts/nope/comments",
      headers: { authorization: `Bearer ${testToken(uid)}` },
      payload: { body: "x" },
    });
    expect(m.statusCode).toBe(404);
    await missing.close();

    const { app, id } = await createPost(uid);
    await prisma.forumPost.update({ where: { id }, data: { locked: true } });
    const locked = await app.inject({
      method: "POST",
      url: `/forum/posts/${id}/comments`,
      headers: { authorization: `Bearer ${testToken(uid)}` },
      payload: { body: "blocked?" },
    });
    expect(locked.statusCode).toBe(403);
    await app.close();
  });
});

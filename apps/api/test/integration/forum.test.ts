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

  it("every list of posts carries each post's card: its opening words and picture", async () => {
    // James 2026-11-08: the forum with expanded "Thumbnail and previews".
    const uid = await newUser("cards");
    const app = await makeApp();
    const auth = { authorization: `Bearer ${testToken(uid)}` };
    const pic = "https://api.weered.ca/forum-img/itest-1794170998957-0123456789abcdef.webp";
    const made = await app.inject({
      method: "POST",
      url: "/forum/posts",
      headers: auth,
      payload: { title: "Cards", body: `![banner](${pic})\n\nThe streets got a **remodel**.` },
    });
    const id = made.json().post?.id;
    posts.push(id);
    await app.inject({ method: "POST", url: `/forum/posts/${id}/bookmark`, headers: auth });

    for (const url of [
      "/forum/posts?sort=new&limit=50",
      "/forum/me/bookmarks",
      "/forum/me/subscriptions",
    ]) {
      const listed = (await app.inject({ method: "GET", url, headers: auth }))
        .json()
        .posts.find((p: any) => p.id === id);
      expect(listed, url).toMatchObject({ preview: "The streets got a remodel.", image: pic });
    }
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

describe("forum - Hot on a quiet board", () => {
  it("still lists posts older than 30 days, after the recent ones, and keeps old pins on top", async () => {
    const stamp = Date.now();
    const owner = await prisma.user.create({
      data: { usernameKey: "itest_forum_hot_" + stamp, name: "hot" },
      select: { id: true },
    });
    const lobbyId = "itest-hot-" + stamp;
    await prisma.lobby.create({ data: { id: lobbyId, name: lobbyId, ownerId: owner.id } });
    const day = 24 * 60 * 60 * 1000;
    const mk = (title: string, ageDays: number, pinned = false) =>
      prisma.forumPost.create({
        data: {
          title,
          body: title,
          authorId: owner.id,
          lobbyId,
          pinned,
          createdAt: new Date(Date.now() - ageDays * day),
        } as any,
        select: { id: true },
      });
    try {
      await mk("old", 200);
      await mk("old pin", 120, true);
      await mk("recent", 2);
      const app = await makeApp();
      const r = await app.inject({
        method: "GET",
        url: `/forum/posts?sort=hot&lobbyId=${lobbyId}`,
      });
      expect(r.statusCode).toBe(200);
      const titles = (r.json().posts || []).map((p: any) => p.title);
      expect(titles).toEqual(["old pin", "recent", "old"]);
      await app.close();
    } finally {
      await prisma.forumPost.deleteMany({ where: { lobbyId } }).catch(() => {});
      await prisma.lobby.delete({ where: { id: lobbyId } }).catch(() => {});
      await prisma.user.delete({ where: { id: owner.id } }).catch(() => {});
    }
  });
});

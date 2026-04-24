import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";
import { LobbyRole } from "@prisma/client";

// /forum/* — community discussion threads. Posts (BUG_REPORT, FEATURE_REQUEST,
// DISCUSSION, ANNOUNCEMENT) with reddit-style hot/new/top sort, comments,
// up/downvotes, and lobby-scoped or global threads. Mod controls (pin/lock/
// delete) check global staff role + lobby owner/mod tier. ANNOUNCEMENT is
// gated to staff or lobby owner; everyone else gets demoted to DISCUSSION.
type Opts = {
  authFromHeader: (h?: string) => { id: string; name: string } | null;
  getGlobalRole: (userId: string) => Promise<string | null>;
  canAccessStaff: (role: string | null) => boolean;
  getLobbyRole: (userId: string, lobbyId: string) => Promise<LobbyRole | null>;
  resolveMentions: (text: string, actorId: string) => Promise<{ id: string }[]>;
  createNotification: (opts: any) => Promise<any>;
};

export default async function forumRoutes(app: FastifyInstance, opts: Opts) {
  const { authFromHeader, getGlobalRole, canAccessStaff, getLobbyRole, resolveMentions, createNotification } = opts;

async function enrichForumAuthors(authorIds: string[]): Promise<Record<string, any>> {
  if (!authorIds.length) return {};
  const users = await prisma.user.findMany({
    where: { id: { in: [...new Set(authorIds)] } },
    select: { id: true, name: true, avatar: true, avatarColor: true, tier: true, globalRole: true },
  });
  const map: Record<string, any> = {};
  for (const u of users) map[u.id] = u;
  return map;
}

// Forum mod check: global staff OR lobby owner/mod
async function canModForumPost(userId: string, post: { lobbyId: string | null; authorId: string }): Promise<{ canDelete: boolean; canLock: boolean; canPin: boolean; canAnnounce: boolean }> {
  const globalRole = await getGlobalRole(userId);
  if (canAccessStaff(globalRole)) return { canDelete: true, canLock: true, canPin: true, canAnnounce: true };
  // Author can delete own posts
  const isAuthor = post.authorId === userId;
  if (!post.lobbyId) return { canDelete: isAuthor, canLock: false, canPin: false, canAnnounce: false };
  // Check lobby role
  const lobbyRole = await getLobbyRole(userId, post.lobbyId);
  const isOwner = lobbyRole === LobbyRole.OWNER;
  const isMod = lobbyRole === LobbyRole.MOD || isOwner;
  return {
    canDelete: isAuthor || isMod,
    canLock: isMod,
    canPin: isOwner || canAccessStaff(globalRole),
    canAnnounce: isOwner || canAccessStaff(globalRole),
  };
}

// GET /forum/posts — list posts (paginated, sorted, filtered)
app.get("/forum/posts", async (req, reply) => {
  const sort = String((req as any).query?.sort || "hot").toLowerCase();
  const cat = String((req as any).query?.category || "").toUpperCase();
  const limit = Math.min(Number((req as any).query?.limit) || 25, 50);
  const cursor = String((req as any).query?.cursor || "");

  const u = authFromHeader((req as any).headers?.authorization);

  const lobbyId = String((req as any).query?.lobbyId || "").trim() || undefined;

  const where: any = {};
  if (lobbyId) where.lobbyId = lobbyId;
  if (cat && ["BUG_REPORT", "FEATURE_REQUEST", "DISCUSSION", "ANNOUNCEMENT"].includes(cat)) {
    where.category = cat;
  }
  if (cursor) where.createdAt = { lt: new Date(cursor) };

  let posts: any[];
  if (sort === "top") {
    posts = await prisma.forumPost.findMany({ where, orderBy: [{ pinned: "desc" }, { score: "desc" }, { createdAt: "desc" }], take: limit });
  } else if (sort === "new") {
    posts = await prisma.forumPost.findMany({ where, orderBy: [{ pinned: "desc" }, { createdAt: "desc" }], take: limit });
  } else {
    // Hot: fetch recent, score in JS
    posts = await prisma.forumPost.findMany({ where, orderBy: [{ createdAt: "desc" }], take: 100 });
    posts.sort((a: any, b: any) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      const ha = a.score / Math.pow((Date.now() - new Date(a.createdAt).getTime()) / 3600000 + 2, 1.5);
      const hb = b.score / Math.pow((Date.now() - new Date(b.createdAt).getTime()) / 3600000 + 2, 1.5);
      return hb - ha;
    });
    posts = posts.slice(0, limit);
  }

  const authorMap = await enrichForumAuthors(posts.map((p: any) => p.authorId));
  let myVotes: Record<string, number> = {};
  if (u) {
    const votes = await prisma.forumVote.findMany({ where: { userId: u.id, postId: { in: posts.map((p: any) => p.id) } } });
    for (const v of votes) if (v.postId) myVotes[v.postId] = v.value;
  }

  const out = posts.map((p: any) => ({
    ...p,
    body: p.body.slice(0, 200),
    author: authorMap[p.authorId] || null,
    myVote: myVotes[p.id] || 0,
  }));

  const nextCursor = posts.length === limit ? posts[posts.length - 1].createdAt.toISOString() : null;
  return reply.send({ ok: true, posts: out, nextCursor });
});

// POST /forum/posts — create post
app.post("/forum/posts", async (req, reply) => {
  const u = authFromHeader((req as any).headers?.authorization);
  if (!u) return reply.code(401).send({ error: "Unauthorized" });
  const { title, body, category, lobbyId } = (req as any).body || {};
  if (!title?.trim() || !body?.trim()) return reply.code(400).send({ error: "Title and body required" });
  if (title.trim().length > 200) return reply.code(400).send({ error: "Title too long" });
  if (body.trim().length > 10000) return reply.code(400).send({ error: "Body too long" });

  let cat = String(category || "DISCUSSION").toUpperCase();
  if (!["BUG_REPORT", "FEATURE_REQUEST", "DISCUSSION", "ANNOUNCEMENT"].includes(cat)) cat = "DISCUSSION";
  if (cat === "ANNOUNCEMENT") {
    const globalRole = await getGlobalRole(u.id);
    let canAnnounce = canAccessStaff(globalRole);
    if (!canAnnounce && lobbyId) {
      const lr = await getLobbyRole(u.id, String(lobbyId).trim());
      canAnnounce = lr === LobbyRole.OWNER;
    }
    if (!canAnnounce) cat = "DISCUSSION";
  }

  const user = await prisma.user.findUnique({ where: { id: u.id }, select: { name: true } });
  const validLobbyId = lobbyId ? String(lobbyId).trim() : null;
  const post = await prisma.forumPost.create({
    data: { title: title.trim(), body: body.trim(), category: cat as any, authorId: u.id, authorName: user?.name || "Unknown", lobbyId: validLobbyId },
  });
  // @mentions in post body
  (async () => {
    try {
      const mentioned = await resolveMentions(String(body || ""), u.id);
      for (const m of mentioned) {
        createNotification({
          userId: m.id,
          type: "MENTION",
          title: `${user?.name || u.name} mentioned you in a forum post`,
          body: String(title).slice(0, 120),
          actorId: u.id,
          actorName: user?.name || u.name,
          actionUrl: `/forum/${post.id}`,
        }).catch(() => {});
      }
    } catch {}
  })();
  return reply.send({ ok: true, post });
});

// GET /forum/posts/:postId — single post + comments
app.get("/forum/posts/:postId", async (req, reply) => {
  const postId = String((req as any).params?.postId || "");
  const u = authFromHeader((req as any).headers?.authorization);

  const post = await prisma.forumPost.findUnique({ where: { id: postId }, include: { comments: { orderBy: { createdAt: "asc" } } } });
  if (!post) return reply.code(404).send({ error: "Post not found" });

  const allAuthorIds = [post.authorId, ...post.comments.map(c => c.authorId)];
  const authorMap = await enrichForumAuthors(allAuthorIds);

  let myPostVote = 0;
  let myCommentVotes: Record<string, number> = {};
  if (u) {
    const pv = await prisma.forumVote.findFirst({ where: { userId: u.id, postId } });
    if (pv) myPostVote = pv.value;
    const cvs = await prisma.forumVote.findMany({ where: { userId: u.id, commentId: { in: post.comments.map(c => c.id) } } });
    for (const v of cvs) if (v.commentId) myCommentVotes[v.commentId] = v.value;
  }

  // Check mod permissions (global staff + lobby owner/mod)
  const modPerms = u ? await canModForumPost(u.id, post) : { canDelete: false, canLock: false, canPin: false, canAnnounce: false };
  const isMod = modPerms.canLock || modPerms.canPin;

  return reply.send({
    ok: true,
    post: { ...post, comments: undefined, author: authorMap[post.authorId] || null, myVote: myPostVote },
    comments: post.comments.map(c => ({ ...c, author: authorMap[c.authorId] || null, myVote: myCommentVotes[c.id] || 0 })),
    isMod,
    modPerms,
  });
});

// POST /forum/posts/:postId/vote — upvote/downvote post
app.post("/forum/posts/:postId/vote", async (req, reply) => {
  const u = authFromHeader((req as any).headers?.authorization);
  if (!u) return reply.code(401).send({ error: "Unauthorized" });
  const postId = String((req as any).params?.postId || "");
  const value = Number((req as any).body?.value || 0);
  if (![1, -1, 0].includes(value)) return reply.code(400).send({ error: "Invalid vote" });

  const existing = await prisma.forumVote.findFirst({ where: { userId: u.id, postId } });
  const oldValue = existing?.value || 0;
  const diff = value - oldValue;

  if (value === 0 && existing) {
    await prisma.forumVote.delete({ where: { id: existing.id } });
  } else if (existing) {
    await prisma.forumVote.update({ where: { id: existing.id }, data: { value } });
  } else if (value !== 0) {
    await prisma.forumVote.create({ data: { userId: u.id, postId, value } });
  }
  if (diff !== 0) {
    await prisma.forumPost.update({ where: { id: postId }, data: { score: { increment: diff } } });
  }

  const post = await prisma.forumPost.findUnique({ where: { id: postId }, select: { score: true } });
  return reply.send({ ok: true, score: post?.score || 0 });
});

// POST /forum/posts/:postId/comments — add comment
app.post("/forum/posts/:postId/comments", async (req, reply) => {
  const u = authFromHeader((req as any).headers?.authorization);
  if (!u) return reply.code(401).send({ error: "Unauthorized" });
  const postId = String((req as any).params?.postId || "");
  const { body } = (req as any).body || {};
  if (!body?.trim()) return reply.code(400).send({ error: "Comment body required" });
  if (body.trim().length > 5000) return reply.code(400).send({ error: "Comment too long" });

  const post = await prisma.forumPost.findUnique({ where: { id: postId } });
  if (!post) return reply.code(404).send({ error: "Post not found" });
  if (post.locked) return reply.code(403).send({ error: "Post is locked" });

  const user = await prisma.user.findUnique({ where: { id: u.id }, select: { name: true } });
  const comment = await prisma.forumComment.create({
    data: { postId, authorId: u.id, authorName: user?.name || "Unknown", body: body.trim() },
  });
  await prisma.forumPost.update({ where: { id: postId }, data: { commentCount: { increment: 1 } } });

  // @mentions in comment body + notify post author (if not me)
  (async () => {
    try {
      const notifiedIds = new Set<string>();
      const mentioned = await resolveMentions(String(body || ""), u.id);
      for (const m of mentioned) {
        if (notifiedIds.has(m.id)) continue;
        notifiedIds.add(m.id);
        createNotification({
          userId: m.id,
          type: "MENTION",
          title: `${user?.name || u.name} mentioned you in a forum thread`,
          body: String(body).slice(0, 120),
          actorId: u.id,
          actorName: user?.name || u.name,
          actionUrl: `/forum/${postId}`,
        }).catch(() => {});
      }
    } catch {}
  })();

  const authorMap = await enrichForumAuthors([u.id]);
  return reply.send({ ok: true, comment: { ...comment, author: authorMap[u.id] || null, myVote: 0 } });
});

// POST /forum/comments/:commentId/vote — upvote/downvote comment
app.post("/forum/comments/:commentId/vote", async (req, reply) => {
  const u = authFromHeader((req as any).headers?.authorization);
  if (!u) return reply.code(401).send({ error: "Unauthorized" });
  const commentId = String((req as any).params?.commentId || "");
  const value = Number((req as any).body?.value || 0);
  if (![1, -1, 0].includes(value)) return reply.code(400).send({ error: "Invalid vote" });

  const existing = await prisma.forumVote.findFirst({ where: { userId: u.id, commentId } });
  const oldValue = existing?.value || 0;
  const diff = value - oldValue;

  if (value === 0 && existing) {
    await prisma.forumVote.delete({ where: { id: existing.id } });
  } else if (existing) {
    await prisma.forumVote.update({ where: { id: existing.id }, data: { value } });
  } else if (value !== 0) {
    await prisma.forumVote.create({ data: { userId: u.id, commentId, value } });
  }
  if (diff !== 0) {
    await prisma.forumComment.update({ where: { id: commentId }, data: { score: { increment: diff } } });
  }

  const comment = await prisma.forumComment.findUnique({ where: { id: commentId }, select: { score: true } });
  return reply.send({ ok: true, score: comment?.score || 0 });
});

// PATCH /forum/posts/:postId — pin/lock (lobby mod/owner or global staff)
app.patch("/forum/posts/:postId", async (req, reply) => {
  const u = authFromHeader((req as any).headers?.authorization);
  if (!u) return reply.code(401).send({ error: "Unauthorized" });

  const postId = String((req as any).params?.postId || "");
  const existing = await prisma.forumPost.findUnique({ where: { id: postId } });
  if (!existing) return reply.code(404).send({ error: "Post not found" });

  const perms = await canModForumPost(u.id, existing);
  const { pinned, locked } = (req as any).body || {};
  const data: any = {};
  if (typeof pinned === "boolean") {
    if (!perms.canPin) return reply.code(403).send({ error: "Only lobby owners and staff can pin" });
    data.pinned = pinned;
  }
  if (typeof locked === "boolean") {
    if (!perms.canLock) return reply.code(403).send({ error: "Forbidden" });
    data.locked = locked;
  }

  const post = await prisma.forumPost.update({ where: { id: postId }, data });
  return reply.send({ ok: true, post });
});

// DELETE /forum/posts/:postId — delete post (mod or author)
app.delete("/forum/posts/:postId", async (req, reply) => {
  const u = authFromHeader((req as any).headers?.authorization);
  if (!u) return reply.code(401).send({ error: "Unauthorized" });
  const postId = String((req as any).params?.postId || "");
  const post = await prisma.forumPost.findUnique({ where: { id: postId } });
  if (!post) return reply.code(404).send({ error: "Post not found" });

  const perms = await canModForumPost(u.id, post);
  if (!perms.canDelete) return reply.code(403).send({ error: "Forbidden" });

  await prisma.forumPost.delete({ where: { id: postId } });
  return reply.send({ ok: true });
});

// DELETE /forum/comments/:commentId — delete comment (lobby mod/owner, global staff, or author)
app.delete("/forum/comments/:commentId", async (req, reply) => {
  const u = authFromHeader((req as any).headers?.authorization);
  if (!u) return reply.code(401).send({ error: "Unauthorized" });
  const commentId = String((req as any).params?.commentId || "");
  const comment = await prisma.forumComment.findUnique({ where: { id: commentId } });
  if (!comment) return reply.code(404).send({ error: "Comment not found" });

  // Check via the parent post's lobbyId
  const parentPost = await prisma.forumPost.findUnique({ where: { id: comment.postId }, select: { lobbyId: true, authorId: true } });
  const perms = await canModForumPost(u.id, { lobbyId: parentPost?.lobbyId || null, authorId: comment.authorId });
  if (!perms.canDelete) return reply.code(403).send({ error: "Forbidden" });

  await prisma.forumComment.delete({ where: { id: commentId } });
  await prisma.forumPost.update({ where: { id: comment.postId }, data: { commentCount: { decrement: 1 } } });
  return reply.send({ ok: true });
});
}

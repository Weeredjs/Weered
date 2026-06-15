import type { FastifyInstance } from "fastify";
import { existsSync, mkdirSync, writeFileSync, readFileSync } from "fs";
import { join } from "path";
import { createHash } from "crypto";
import sharp from "sharp";
import { prisma } from "../lib/prisma";
import { z } from "zod";
import { LobbyRole } from "@prisma/client";
import { applyAutoModSideEffects, fileAutoModReport } from "./forum-mod";

const FORUM_UPLOAD_DIR = join(process.cwd(), "uploads", "forum");
if (!existsSync(FORUM_UPLOAD_DIR)) mkdirSync(FORUM_UPLOAD_DIR, { recursive: true });
const SITE_BASE = process.env.NEXT_PUBLIC_API_BASE || "https://api.weered.ca";
const FORUM_MAX_DIM = 1200;
const COMMENT_MAX_DEPTH = 8;

function decodeForumDataUrl(dataUrl: string): Buffer | null {
  const m = String(dataUrl || "").match(/^data:image\/(png|jpeg|jpg|webp|gif);base64,(.+)$/);
  if (!m) return null;
  return Buffer.from(m[2], "base64");
}

type Opts = {
  authFromHeader: (h?: string) => { id: string; name: string } | null;
  getGlobalRole: (userId: string) => Promise<string | null>;
  canAccessStaff: (role: string | null) => boolean;
  getLobbyRole: (userId: string, lobbyId: string) => Promise<LobbyRole | null>;
  resolveMentions: (text: string, actorId: string) => Promise<{ id: string }[]>;
  createNotification: (opts: any) => Promise<any>;
};

export default async function forumRoutes(app: FastifyInstance, opts: Opts) {
  const {
    authFromHeader,
    getGlobalRole,
    canAccessStaff,
    getLobbyRole,
    resolveMentions,
    createNotification,
  } = opts;

  async function enrichForumAuthors(authorIds: string[]): Promise<Record<string, any>> {
    if (!authorIds.length) return {};
    const users = await prisma.user.findMany({
      where: { id: { in: [...new Set(authorIds)] } },
      select: {
        id: true,
        name: true,
        avatar: true,
        avatarColor: true,
        tier: true,
        globalRole: true,
      },
    });
    const map: Record<string, any> = {};
    for (const u of users) map[u.id] = u;
    return map;
  }

  async function canModForumPost(
    userId: string,
    post: { lobbyId: string | null; authorId: string },
  ): Promise<{ canDelete: boolean; canLock: boolean; canPin: boolean; canAnnounce: boolean }> {
    const globalRole = await getGlobalRole(userId);
    if (canAccessStaff(globalRole))
      return { canDelete: true, canLock: true, canPin: true, canAnnounce: true };
    const isAuthor = post.authorId === userId;
    if (!post.lobbyId)
      return { canDelete: isAuthor, canLock: false, canPin: false, canAnnounce: false };
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

  app.get("/forum/posts", async (req, reply) => {
    const sort = String((req as any).query?.sort || "hot").toLowerCase();
    const cat = String((req as any).query?.category || "").toUpperCase();
    const sectionId = String((req as any).query?.sectionId || "").trim() || undefined;
    const limit = Math.min(Number((req as any).query?.limit) || 25, 50);
    const cursor = String((req as any).query?.cursor || "");

    const u = authFromHeader((req as any).headers?.authorization);

    const lobbyId = String((req as any).query?.lobbyId || "").trim() || undefined;

    const where: any = {};
    if (lobbyId) where.lobbyId = lobbyId;
    if (sectionId) where.sectionId = sectionId;
    if (cat && ["BUG_REPORT", "FEATURE_REQUEST", "DISCUSSION", "ANNOUNCEMENT"].includes(cat)) {
      where.category = cat;
    }
    if (cursor && sort !== "hot") where.createdAt = { lt: new Date(cursor) };

    let viewerIsMod = false;
    if (u) {
      const role = await getGlobalRole(u.id);
      if (canAccessStaff(role)) viewerIsMod = true;
      else if (lobbyId) {
        const lr = await getLobbyRole(u.id, lobbyId);
        if (lr === LobbyRole.OWNER || lr === LobbyRole.MOD) viewerIsMod = true;
      }
    }
    if (!viewerIsMod) where.removedAt = null;

    let posts: any[];
    if (sort === "top") {
      posts = await prisma.forumPost.findMany({
        where,
        orderBy: [{ pinned: "desc" }, { score: "desc" }, { createdAt: "desc" }],
        take: limit,
      });
    } else if (sort === "new") {
      posts = await prisma.forumPost.findMany({
        where,
        orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
        take: limit,
      });
    } else {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const hotWhere = { ...where, createdAt: { gte: thirtyDaysAgo } };
      const candidates = await prisma.forumPost.findMany({
        where: hotWhere,
        orderBy: [{ createdAt: "desc" }],
        take: 200,
      });
      const REDDIT_EPOCH = 1134028003;
      const scored = candidates.map((p: any) => {
        const net = p.score || 0;
        const order = Math.log10(Math.max(Math.abs(net), 1));
        const sign = net > 0 ? 1 : net < 0 ? -1 : 0;
        const seconds = Math.floor(new Date(p.createdAt).getTime() / 1000) - REDDIT_EPOCH;
        const hot = order * sign + seconds / 45000;
        return { post: p, hot };
      });
      scored.sort((a, b) => {
        if (a.post.pinned && !b.post.pinned) return -1;
        if (!a.post.pinned && b.post.pinned) return 1;
        return b.hot - a.hot;
      });
      posts = scored.slice(0, limit).map((x) => x.post);
    }

    const authorMap = await enrichForumAuthors(posts.map((p: any) => p.authorId));
    const myVotes: Record<string, number> = {};
    const myBookmarks: Record<string, true> = {};
    if (u) {
      const votes = await prisma.forumVote.findMany({
        where: { userId: u.id, postId: { in: posts.map((p: any) => p.id) } },
      });
      for (const v of votes) if (v.postId) myVotes[v.postId] = v.value;
      const bms = await prisma.forumBookmark.findMany({
        where: { userId: u.id, postId: { in: posts.map((p: any) => p.id) } },
      });
      for (const b of bms) myBookmarks[b.postId] = true;
    }

    const out = posts.map((p: any) => ({
      ...p,
      body: p.removedAt ? "[removed by mod]" : p.body.slice(0, 200),
      author: authorMap[p.authorId] || null,
      myVote: myVotes[p.id] || 0,
      myBookmarked: !!myBookmarks[p.id],
    }));

    const nextCursor =
      posts.length === limit ? posts[posts.length - 1].createdAt.toISOString() : null;
    return reply.send({ ok: true, posts: out, nextCursor });
  });

  app.post(
    "/forum/posts",
    {
      schema: {
        tags: ["forum"],
        body: z
          .object({
            title: z.string().min(1),
            body: z.string().min(1),
            category: z.string().optional(),
            lobbyId: z.string().optional(),
            sectionId: z.string().optional(),
            tags: z.any().optional(),
          })
          .passthrough(),
      },
    },
    async (req, reply) => {
      const u = authFromHeader((req as any).headers?.authorization);
      if (!u) return reply.code(401).send({ error: "Unauthorized" });
      const { title, body, category, lobbyId, sectionId, tags } = (req as any).body || {};
      if (!title?.trim() || !body?.trim())
        return reply.code(400).send({ error: "Title and body required" });
      if (title.trim().length > 200) return reply.code(400).send({ error: "Title too long" });
      if (body.trim().length > 10000) return reply.code(400).send({ error: "Body too long" });

      let cleanTags: string[] = [];
      if (Array.isArray(tags)) {
        cleanTags = tags
          .filter((t: any) => typeof t === "string")
          .map((t: string) => t.trim())
          .filter(Boolean)
          .slice(0, 8)
          .map((t) => t.slice(0, 24));
      }

      let validSectionId: string | null = null;
      if (sectionId) {
        const sec = await prisma.forumSection.findUnique({ where: { id: String(sectionId) } });
        if (!sec) return reply.code(400).send({ error: "Invalid section" });
        if (lobbyId && sec.lobbyId !== String(lobbyId).trim())
          return reply.code(400).send({ error: "Section does not belong to lobby" });
        if (sec.postsOnly) {
          const gr = await getGlobalRole(u.id);
          let allowed = canAccessStaff(gr);
          if (!allowed) {
            const lr = await getLobbyRole(u.id, sec.lobbyId);
            allowed = lr === LobbyRole.OWNER || lr === LobbyRole.MOD;
          }
          if (!allowed) return reply.code(403).send({ error: "This section is mod-only" });
        }
        validSectionId = sec.id;
      }

      let cat = String(category || "DISCUSSION").toUpperCase();
      if (!["BUG_REPORT", "FEATURE_REQUEST", "DISCUSSION", "ANNOUNCEMENT"].includes(cat))
        cat = "DISCUSSION";
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

      const automod = await applyAutoModSideEffects(validLobbyId, {
        kind: "POST",
        title: title.trim(),
        body: body.trim(),
        authorId: u.id,
      });
      if (automod.blocked)
        return reply
          .code(400)
          .send({ error: "automod_blocked", reason: automod.reason, rule: automod.ruleName });

      const data: any = {
        title: title.trim(),
        body: body.trim(),
        category: cat as any,
        authorId: u.id,
        authorName: user?.name || "Unknown",
        lobbyId: validLobbyId,
        sectionId: validSectionId,
        tags: cleanTags as any,
      };
      if (automod.sideEffect?.removedAt) {
        data.removedAt = automod.sideEffect.removedAt;
        data.removedById = automod.sideEffect.removedById;
        data.removeReason = automod.sideEffect.removeReason;
      }
      if (automod.sideEffect?.tagsPatch) {
        data.tags = automod.sideEffect.tagsPatch;
      }
      const post = await prisma.forumPost.create({ data });
      if (automod.action === "REPORT") {
        fileAutoModReport({ kind: "POST", id: post.id }, automod.ruleName, automod.reason).catch(
          () => {},
        );
      }
      try {
        await prisma.forumSubscription.create({ data: { userId: u.id, postId: post.id } });
      } catch {}
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
    },
  );

  app.get("/forum/posts/:postId", async (req, reply) => {
    const postId = String((req as any).params?.postId || "");
    const u = authFromHeader((req as any).headers?.authorization);

    const post = await prisma.forumPost.findUnique({ where: { id: postId } });
    if (!post) return reply.code(404).send({ error: "Post not found" });

    const comments = await prisma.forumComment.findMany({
      where: { postId },
      orderBy: [{ score: "desc" }, { createdAt: "desc" }],
    });

    const allAuthorIds = [post.authorId, ...comments.map((c) => c.authorId)];
    const authorMap = await enrichForumAuthors(allAuthorIds);

    let myPostVote = 0;
    const myCommentVotes: Record<string, number> = {};
    let myBookmarked = false;
    let mySubscribed = false;
    if (u) {
      const pv = await prisma.forumVote.findFirst({ where: { userId: u.id, postId } });
      if (pv) myPostVote = pv.value;
      if (comments.length) {
        const cvs = await prisma.forumVote.findMany({
          where: { userId: u.id, commentId: { in: comments.map((c) => c.id) } },
        });
        for (const v of cvs) if (v.commentId) myCommentVotes[v.commentId] = v.value;
      }
      const bm = await prisma.forumBookmark.findFirst({ where: { userId: u.id, postId } });
      myBookmarked = !!bm;
      const sub = await prisma.forumSubscription.findFirst({ where: { userId: u.id, postId } });
      mySubscribed = !!sub;
    }

    const subscriberCount = await prisma.forumSubscription.count({ where: { postId } });

    const modPerms = u
      ? await canModForumPost(u.id, post)
      : { canDelete: false, canLock: false, canPin: false, canAnnounce: false };
    const isMod = modPerms.canLock || modPerms.canPin;

    type CNode = any;
    const map = new Map<string, CNode>();
    for (const c of comments) {
      const isRemoved = !!c.removedAt;
      const authorMatch = !!u && c.authorId === u.id;
      const bodyVisible = !isRemoved || isMod || authorMatch;
      map.set(c.id, {
        id: c.id,
        postId: c.postId,
        parentId: c.parentId,
        depth: c.depth,
        path: c.path,
        authorId: bodyVisible ? c.authorId : null,
        authorName: bodyVisible ? c.authorName : "",
        body: bodyVisible ? c.body : "",
        score: c.score,
        createdAt: c.createdAt,
        removed: isRemoved,
        author: bodyVisible ? authorMap[c.authorId] || null : null,
        myVote: myCommentVotes[c.id] || 0,
        children: [] as CNode[],
      });
    }
    const roots: CNode[] = [];
    for (const c of comments) {
      const node = map.get(c.id)!;
      if (c.parentId && map.has(c.parentId)) {
        map.get(c.parentId)!.children.push(node);
      } else {
        roots.push(node);
      }
    }
    function sortTree(nodes: CNode[]) {
      nodes.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
      for (const n of nodes) sortTree(n.children);
    }
    sortTree(roots);

    const postBody =
      post.removedAt && !isMod && post.authorId !== u?.id ? "[removed by mod]" : post.body;

    return reply.send({
      ok: true,
      post: {
        ...post,
        body: postBody,
        author: authorMap[post.authorId] || null,
        myVote: myPostVote,
        myBookmarked,
        mySubscribed,
        _count: { subscriptions: subscriberCount },
      },
      comments: roots,
      isMod,
      modPerms,
    });
  });

  app.post(
    "/forum/posts/:postId/vote",
    {
      schema: { tags: ["forum"], params: z.object({ postId: z.string().min(1) }) },
    },
    async (req, reply) => {
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
        await prisma.forumPost.update({
          where: { id: postId },
          data: { score: { increment: diff } },
        });
      }

      const post = await prisma.forumPost.findUnique({
        where: { id: postId },
        select: { score: true },
      });
      return reply.send({ ok: true, score: post?.score || 0 });
    },
  );

  app.post(
    "/forum/posts/:postId/comments",
    {
      schema: {
        tags: ["forum"],
        params: z.object({ postId: z.string().min(1) }),
        body: z.object({ body: z.string().min(1), parentId: z.string().optional() }).passthrough(),
      },
    },
    async (req, reply) => {
      const u = authFromHeader((req as any).headers?.authorization);
      if (!u) return reply.code(401).send({ error: "Unauthorized" });
      const postId = String((req as any).params?.postId || "");
      const { body, parentId } = (req as any).body || {};
      if (!body?.trim()) return reply.code(400).send({ error: "Comment body required" });
      if (body.trim().length > 5000) return reply.code(400).send({ error: "Comment too long" });

      const post = await prisma.forumPost.findUnique({ where: { id: postId } });
      if (!post) return reply.code(404).send({ error: "Post not found" });
      if (post.locked) return reply.code(403).send({ error: "Post is locked" });

      let depth = 0;
      let path = "";
      let parent: any = null;
      if (parentId) {
        parent = await prisma.forumComment.findUnique({ where: { id: String(parentId) } });
        if (!parent) return reply.code(404).send({ error: "Parent comment not found" });
        if (parent.postId !== postId)
          return reply.code(400).send({ error: "Parent belongs to different post" });
        if ((parent.depth || 0) >= COMMENT_MAX_DEPTH - 1)
          return reply.code(400).send({ error: "max_depth_reached" });
        depth = (parent.depth || 0) + 1;
        path = (parent.path || "") + parent.id + "/";
      }

      const user = await prisma.user.findUnique({ where: { id: u.id }, select: { name: true } });

      const automod = await applyAutoModSideEffects(post.lobbyId, {
        kind: "COMMENT",
        body: body.trim(),
        authorId: u.id,
      });
      if (automod.blocked)
        return reply
          .code(400)
          .send({ error: "automod_blocked", reason: automod.reason, rule: automod.ruleName });

      const cdata: any = {
        postId,
        authorId: u.id,
        authorName: user?.name || "Unknown",
        body: body.trim(),
        parentId: parentId ? String(parentId) : null,
        depth,
        path,
      };
      if (automod.sideEffect?.removedAt) {
        cdata.removedAt = automod.sideEffect.removedAt;
        cdata.removedById = automod.sideEffect.removedById;
        cdata.removeReason = automod.sideEffect.removeReason;
      }
      const comment = await prisma.forumComment.create({ data: cdata });
      await prisma.forumPost.update({
        where: { id: postId },
        data: { commentCount: { increment: 1 } },
      });
      if (automod.action === "REPORT") {
        fileAutoModReport(
          { kind: "COMMENT", id: comment.id },
          automod.ruleName,
          automod.reason,
        ).catch(() => {});
      }

      (async () => {
        try {
          const notifiedIds = new Set<string>();
          const replierName = user?.name || u.name;
          const titleTrim = post.title.length > 40 ? post.title.slice(0, 40) + "..." : post.title;
          const bodyTrim = String(body).trim().slice(0, 200);
          const meta = {
            kind: "forum_reply",
            postId,
            commentId: comment.id,
            replierId: u.id,
            replierName,
          };

          const subs = await prisma.forumSubscription.findMany({
            where: { postId },
            select: { userId: true },
          });
          for (const s of subs) {
            if (s.userId === u.id) continue;
            if (notifiedIds.has(s.userId)) continue;
            notifiedIds.add(s.userId);
            createNotification({
              userId: s.userId,
              type: "FORUM_REPLY",
              title: `${replierName} replied to '${titleTrim}'`,
              body: bodyTrim,
              actorId: u.id,
              actorName: replierName,
              actionUrl: `/forum/${postId}`,
              meta,
            }).catch(() => {});
          }

          const mentioned = await resolveMentions(String(body || ""), u.id);
          for (const m of mentioned) {
            if (notifiedIds.has(m.id)) continue;
            notifiedIds.add(m.id);
            createNotification({
              userId: m.id,
              type: "MENTION",
              title: `${replierName} mentioned you in a forum thread`,
              body: bodyTrim,
              actorId: u.id,
              actorName: replierName,
              actionUrl: `/forum/${postId}`,
            }).catch(() => {});
          }
        } catch {}
      })();

      const authorMap = await enrichForumAuthors([u.id]);
      return reply.send({
        ok: true,
        comment: {
          ...comment,
          author: authorMap[u.id] || null,
          myVote: 0,
          removed: !!comment.removedAt,
          children: [],
        },
      });
    },
  );

  app.post(
    "/forum/comments/:commentId/vote",
    {
      schema: { tags: ["forum"], params: z.object({ commentId: z.string().min(1) }) },
    },
    async (req, reply) => {
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
        await prisma.forumComment.update({
          where: { id: commentId },
          data: { score: { increment: diff } },
        });
      }

      const comment = await prisma.forumComment.findUnique({
        where: { id: commentId },
        select: { score: true },
      });
      return reply.send({ ok: true, score: comment?.score || 0 });
    },
  );

  app.patch(
    "/forum/posts/:postId",
    {
      schema: { tags: ["forum"], params: z.object({ postId: z.string().min(1) }) },
    },
    async (req, reply) => {
      const u = authFromHeader((req as any).headers?.authorization);
      if (!u) return reply.code(401).send({ error: "Unauthorized" });

      const postId = String((req as any).params?.postId || "");
      const existing = await prisma.forumPost.findUnique({ where: { id: postId } });
      if (!existing) return reply.code(404).send({ error: "Post not found" });

      const perms = await canModForumPost(u.id, existing);
      const { pinned, locked } = (req as any).body || {};
      const data: any = {};
      if (typeof pinned === "boolean") {
        if (!perms.canPin)
          return reply.code(403).send({ error: "Only lobby owners and staff can pin" });
        data.pinned = pinned;
      }
      if (typeof locked === "boolean") {
        if (!perms.canLock) return reply.code(403).send({ error: "Forbidden" });
        data.locked = locked;
      }

      const post = await prisma.forumPost.update({ where: { id: postId }, data });
      return reply.send({ ok: true, post });
    },
  );

  app.delete(
    "/forum/posts/:postId",
    {
      schema: { tags: ["forum"], params: z.object({ postId: z.string().min(1) }) },
    },
    async (req, reply) => {
      const u = authFromHeader((req as any).headers?.authorization);
      if (!u) return reply.code(401).send({ error: "Unauthorized" });
      const postId = String((req as any).params?.postId || "");
      const post = await prisma.forumPost.findUnique({ where: { id: postId } });
      if (!post) return reply.code(404).send({ error: "Post not found" });

      const perms = await canModForumPost(u.id, post);
      if (!perms.canDelete) return reply.code(403).send({ error: "Forbidden" });

      await prisma.forumPost.delete({ where: { id: postId } });
      return reply.send({ ok: true });
    },
  );

  app.delete(
    "/forum/comments/:commentId",
    {
      schema: { tags: ["forum"], params: z.object({ commentId: z.string().min(1) }) },
    },
    async (req, reply) => {
      const u = authFromHeader((req as any).headers?.authorization);
      if (!u) return reply.code(401).send({ error: "Unauthorized" });
      const commentId = String((req as any).params?.commentId || "");
      const reason = String((req as any).body?.reason || "");
      const comment = await prisma.forumComment.findUnique({ where: { id: commentId } });
      if (!comment) return reply.code(404).send({ error: "Comment not found" });
      if (comment.removedAt) return reply.send({ ok: true });

      const parentPost = await prisma.forumPost.findUnique({
        where: { id: comment.postId },
        select: { lobbyId: true, authorId: true },
      });
      const perms = await canModForumPost(u.id, {
        lobbyId: parentPost?.lobbyId || null,
        authorId: comment.authorId,
      });
      if (!perms.canDelete) return reply.code(403).send({ error: "Forbidden" });

      await prisma.forumComment.update({
        where: { id: commentId },
        data: { removedAt: new Date(), removedById: u.id, removeReason: reason || null },
      });
      await prisma.forumPost.update({
        where: { id: comment.postId },
        data: { commentCount: { decrement: 1 } },
      });
      return reply.send({ ok: true });
    },
  );

  app.post(
    "/forum/posts/:postId/bookmark",
    {
      schema: { tags: ["forum"], params: z.object({ postId: z.string().min(1) }) },
    },
    async (req, reply) => {
      const u = authFromHeader((req as any).headers?.authorization);
      if (!u) return reply.code(401).send({ error: "Unauthorized" });
      const postId = String((req as any).params?.postId || "");
      const post = await prisma.forumPost.findUnique({
        where: { id: postId },
        select: { id: true },
      });
      if (!post) return reply.code(404).send({ error: "Post not found" });
      try {
        await prisma.forumBookmark.upsert({
          where: { userId_postId: { userId: u.id, postId } },
          update: {},
          create: { userId: u.id, postId },
        });
      } catch {}
      return reply.send({ ok: true, bookmarked: true });
    },
  );

  app.delete(
    "/forum/posts/:postId/bookmark",
    {
      schema: { tags: ["forum"], params: z.object({ postId: z.string().min(1) }) },
    },
    async (req, reply) => {
      const u = authFromHeader((req as any).headers?.authorization);
      if (!u) return reply.code(401).send({ error: "Unauthorized" });
      const postId = String((req as any).params?.postId || "");
      await prisma.forumBookmark.deleteMany({ where: { userId: u.id, postId } });
      return reply.send({ ok: true, bookmarked: false });
    },
  );

  app.get("/forum/me/bookmarks", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ error: "Unauthorized" });
    const limit = Math.min(Number((req as any).query?.limit) || 50, 100);
    const offset = Math.max(0, Number((req as any).query?.offset) || 0);

    const bms = await prisma.forumBookmark.findMany({
      where: { userId: u.id },
      orderBy: { createdAt: "desc" },
      skip: offset,
      take: limit,
    });
    if (!bms.length) return reply.send({ ok: true, posts: [], total: 0 });

    const postIds = bms.map((b: any) => b.postId);
    const posts = await prisma.forumPost.findMany({
      where: { id: { in: postIds } },
      include: {
        lobby: { select: { id: true, name: true } },
        section: { select: { id: true, name: true } },
      },
    });
    const postMap = new Map(posts.map((p: any) => [p.id, p]));
    const authorMap = await enrichForumAuthors(posts.map((p: any) => p.authorId));
    const total = await prisma.forumBookmark.count({ where: { userId: u.id } });

    const out = bms
      .map((b: any) => {
        const p: any = postMap.get(b.postId);
        if (!p) return null;
        return {
          ...p,
          body: p.removedAt ? "[removed by mod]" : p.body.slice(0, 200),
          author: authorMap[p.authorId] || null,
          myVote: 0,
          myBookmarked: true,
          bookmarkedAt: b.createdAt,
        };
      })
      .filter((x: any) => x);

    return reply.send({ ok: true, posts: out, total });
  });

  app.post(
    "/forum/posts/:postId/subscribe",
    {
      schema: { tags: ["forum"], params: z.object({ postId: z.string().min(1) }) },
    },
    async (req, reply) => {
      const u = authFromHeader((req as any).headers?.authorization);
      if (!u) return reply.code(401).send({ error: "Unauthorized" });
      const postId = String((req as any).params?.postId || "");
      const post = await prisma.forumPost.findUnique({
        where: { id: postId },
        select: { id: true },
      });
      if (!post) return reply.code(404).send({ error: "Post not found" });
      try {
        await prisma.forumSubscription.upsert({
          where: { userId_postId: { userId: u.id, postId } },
          update: {},
          create: { userId: u.id, postId },
        });
      } catch {}
      const count = await prisma.forumSubscription.count({ where: { postId } });
      return reply.send({ ok: true, subscribed: true, subscriberCount: count });
    },
  );

  app.delete(
    "/forum/posts/:postId/subscribe",
    {
      schema: { tags: ["forum"], params: z.object({ postId: z.string().min(1) }) },
    },
    async (req, reply) => {
      const u = authFromHeader((req as any).headers?.authorization);
      if (!u) return reply.code(401).send({ error: "Unauthorized" });
      const postId = String((req as any).params?.postId || "");
      await prisma.forumSubscription.deleteMany({ where: { userId: u.id, postId } });
      const count = await prisma.forumSubscription.count({ where: { postId } });
      return reply.send({ ok: true, subscribed: false, subscriberCount: count });
    },
  );

  app.get("/forum/me/subscriptions", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ error: "Unauthorized" });
    const subs = await prisma.forumSubscription.findMany({
      where: { userId: u.id },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    if (!subs.length) return reply.send({ ok: true, posts: [] });

    const postIds = subs.map((s: any) => s.postId);
    const posts = await prisma.forumPost.findMany({ where: { id: { in: postIds } } });
    const lastComments = await prisma.forumComment.groupBy({
      by: ["postId"],
      where: { postId: { in: postIds }, removedAt: null },
      _max: { createdAt: true },
    });
    const lastMap = new Map(lastComments.map((c: any) => [c.postId, c._max.createdAt]));
    const authorMap = await enrichForumAuthors(posts.map((p: any) => p.authorId));

    const out = posts.map((p: any) => ({
      ...p,
      body: p.removedAt ? "[removed by mod]" : p.body.slice(0, 200),
      author: authorMap[p.authorId] || null,
      lastCommentAt: lastMap.get(p.id) || null,
    }));

    return reply.send({ ok: true, posts: out });
  });

  app.post("/forum/uploads", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ error: "Unauthorized" });
    const dataUrl = String((req as any).body?.dataUrl || "");
    const raw = decodeForumDataUrl(dataUrl);
    if (!raw) return reply.code(400).send({ error: "Invalid image data" });
    if (raw.length > 12 * 1024 * 1024) return reply.code(400).send({ error: "File too large" });

    try {
      let pipeline = sharp(raw, { failOn: "none" }).rotate();
      pipeline = pipeline.resize({
        width: FORUM_MAX_DIM,
        height: FORUM_MAX_DIM,
        fit: "inside",
        withoutEnlargement: true,
      });
      let out = await pipeline.webp({ quality: 80 }).toBuffer();
      if (out.length > 1_000_000) {
        out = await sharp(raw, { failOn: "none" })
          .rotate()
          .resize({
            width: FORUM_MAX_DIM,
            height: FORUM_MAX_DIM,
            fit: "inside",
            withoutEnlargement: true,
          })
          .webp({ quality: 65 })
          .toBuffer();
      }
      const hash = createHash("sha256").update(out).digest("hex").slice(0, 16);
      const filename = `${u.id.slice(0, 8)}-${Date.now()}-${hash}.webp`;
      writeFileSync(join(FORUM_UPLOAD_DIR, filename), out);
      return reply.send({ ok: true, url: `${SITE_BASE}/forum-img/${filename}`, filename });
    } catch (e: any) {
      return reply.code(500).send({ error: "Upload failed", detail: String(e?.message || e) });
    }
  });

  app.get("/forum-img/:filename", async (req, reply) => {
    const fn = String((req as any).params?.filename || "").replace(/[^a-zA-Z0-9._-]/g, "");
    if (!fn) return reply.code(400).send("bad request");
    const fp = join(FORUM_UPLOAD_DIR, fn);
    if (!existsSync(fp)) return reply.code(404).send("not found");
    const data = readFileSync(fp);
    reply.header("Content-Type", "image/webp");
    reply.header("Cache-Control", "public, max-age=31536000, immutable");
    return reply.send(data);
  });

  const SLUG_RE = /^[a-z0-9-]{1,30}$/;

  async function canModSectionLobby(userId: string, lobbyId: string): Promise<boolean> {
    const gr = await getGlobalRole(userId);
    if (canAccessStaff(gr)) return true;
    const lr = await getLobbyRole(userId, lobbyId);
    return lr === LobbyRole.OWNER || lr === LobbyRole.MOD;
  }

  app.get("/forum/sections", async (req, reply) => {
    const lobbyId = String((req as any).query?.lobbyId || "").trim();
    if (!lobbyId) return reply.code(400).send({ error: "lobbyId required" });

    const sections = await prisma.forumSection.findMany({
      where: { lobbyId },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      include: {
        _count: { select: { posts: { where: { removedAt: null } } } },
      },
    });

    const out = sections.map((s: any) => ({
      id: s.id,
      lobbyId: s.lobbyId,
      slug: s.slug,
      name: s.name,
      description: s.description,
      color: s.color,
      icon: s.icon,
      order: s.order,
      postsOnly: s.postsOnly,
      postCount: s._count?.posts ?? 0,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    }));
    return reply.send({ ok: true, sections: out });
  });

  app.post(
    "/forum/sections",
    {
      schema: { tags: ["forum"] },
    },
    async (req, reply) => {
      const u = authFromHeader((req as any).headers?.authorization);
      if (!u) return reply.code(401).send({ error: "Unauthorized" });
      const { lobbyId, slug, name, description, color, icon, order, postsOnly } =
        (req as any).body || {};
      if (!lobbyId || !slug || !name)
        return reply.code(400).send({ error: "lobbyId, slug, name required" });
      const lid = String(lobbyId).trim();
      const s = String(slug).trim().toLowerCase();
      if (!SLUG_RE.test(s))
        return reply.code(400).send({ error: "Invalid slug (a-z0-9- only, 1-30 chars)" });
      if (!(await canModSectionLobby(u.id, lid)))
        return reply.code(403).send({ error: "Forbidden" });

      const dup = await prisma.forumSection.findUnique({
        where: { lobbyId_slug: { lobbyId: lid, slug: s } },
      });
      if (dup) return reply.code(409).send({ error: "Slug already in use for this lobby" });

      const section = await prisma.forumSection.create({
        data: {
          lobbyId: lid,
          slug: s,
          name: String(name).trim().slice(0, 60),
          description: String(description || "").slice(0, 280),
          color: color ? String(color).slice(0, 16) : null,
          icon: icon ? String(icon).slice(0, 32) : null,
          order: Number.isFinite(Number(order)) ? Number(order) : 0,
          postsOnly: !!postsOnly,
        },
      });
      return reply.send({ ok: true, section });
    },
  );

  app.patch(
    "/forum/sections/:id",
    {
      schema: { tags: ["forum"], params: z.object({ id: z.string().min(1) }) },
    },
    async (req, reply) => {
      const u = authFromHeader((req as any).headers?.authorization);
      if (!u) return reply.code(401).send({ error: "Unauthorized" });
      const id = String((req as any).params?.id || "");
      const existing = await prisma.forumSection.findUnique({ where: { id } });
      if (!existing) return reply.code(404).send({ error: "Section not found" });
      if (!(await canModSectionLobby(u.id, existing.lobbyId)))
        return reply.code(403).send({ error: "Forbidden" });

      const body = (req as any).body || {};
      const data: any = {};
      if (typeof body.slug === "string") {
        const s = body.slug.trim().toLowerCase();
        if (!SLUG_RE.test(s)) return reply.code(400).send({ error: "Invalid slug" });
        if (s !== existing.slug) {
          const dup = await prisma.forumSection.findUnique({
            where: { lobbyId_slug: { lobbyId: existing.lobbyId, slug: s } },
          });
          if (dup) return reply.code(409).send({ error: "Slug already in use for this lobby" });
        }
        data.slug = s;
      }
      if (typeof body.name === "string") data.name = body.name.trim().slice(0, 60);
      if (typeof body.description === "string") data.description = body.description.slice(0, 280);
      if (typeof body.color === "string" || body.color === null)
        data.color = body.color ? String(body.color).slice(0, 16) : null;
      if (typeof body.icon === "string" || body.icon === null)
        data.icon = body.icon ? String(body.icon).slice(0, 32) : null;
      if (Number.isFinite(Number(body.order))) data.order = Number(body.order);
      if (typeof body.postsOnly === "boolean") data.postsOnly = body.postsOnly;

      const section = await prisma.forumSection.update({ where: { id }, data });
      return reply.send({ ok: true, section });
    },
  );

  app.delete(
    "/forum/sections/:id",
    {
      schema: { tags: ["forum"], params: z.object({ id: z.string().min(1) }) },
    },
    async (req, reply) => {
      const u = authFromHeader((req as any).headers?.authorization);
      if (!u) return reply.code(401).send({ error: "Unauthorized" });
      const id = String((req as any).params?.id || "");
      const force = String((req as any).query?.force || "") === "true";
      const existing = await prisma.forumSection.findUnique({ where: { id } });
      if (!existing) return reply.code(404).send({ error: "Section not found" });
      if (!(await canModSectionLobby(u.id, existing.lobbyId)))
        return reply.code(403).send({ error: "Forbidden" });

      const postCount = await prisma.forumPost.count({ where: { sectionId: id, removedAt: null } });
      if (postCount > 0 && !force) {
        return reply
          .code(409)
          .send({ error: "Section has posts. Pass ?force=true to confirm.", postCount });
      }

      await prisma.forumSection.delete({ where: { id } });
      return reply.send({ ok: true, postCount });
    },
  );

  app.post(
    "/forum/sections/reorder",
    {
      schema: { tags: ["forum"] },
    },
    async (req, reply) => {
      const u = authFromHeader((req as any).headers?.authorization);
      if (!u) return reply.code(401).send({ error: "Unauthorized" });
      const { lobbyId, order } = (req as any).body || {};
      if (!lobbyId || !Array.isArray(order))
        return reply.code(400).send({ error: "lobbyId + order[] required" });
      const lid = String(lobbyId).trim();
      if (!(await canModSectionLobby(u.id, lid)))
        return reply.code(403).send({ error: "Forbidden" });

      const ids = order.map((o: any) => String(o?.id || "")).filter(Boolean);
      const owned = await prisma.forumSection.findMany({
        where: { id: { in: ids }, lobbyId: lid },
        select: { id: true },
      });
      const ownedSet = new Set(owned.map((s) => s.id));

      await prisma.$transaction(
        order
          .filter(
            (o: any) => ownedSet.has(String(o?.id || "")) && Number.isFinite(Number(o?.order)),
          )
          .map((o: any) =>
            prisma.forumSection.update({
              where: { id: String(o.id) },
              data: { order: Number(o.order) },
            }),
          ),
      );

      return reply.send({ ok: true, updated: ownedSet.size });
    },
  );

  app.get("/forum/search", async (req, reply) => {
    const q = String((req as any).query?.q || "").trim();
    if (!q || q.length < 2)
      return reply.send({ ok: true, query: q, results: { posts: [], comments: [] } });
    const lobbyId = String((req as any).query?.lobbyId || "").trim() || null;
    const type = String((req as any).query?.type || "all").toLowerCase();
    const limit = Math.min(Math.max(Number((req as any).query?.limit) || 20, 1), 20);
    const wantPosts = type === "all" || type === "posts";
    const wantComments = type === "all" || type === "comments";

    let posts: any[] = [];
    let comments: any[] = [];

    if (wantPosts) {
      if (lobbyId) {
        posts = await prisma.$queryRaw<any[]>`
        SELECT p.id, p.title, p."authorId", p."authorName", p."lobbyId", p."sectionId",
               p.score, p."commentCount", p."createdAt", p.pinned, p.locked,
               LEFT(p.body, 240) AS snippet,
               ts_rank(p."searchVector", plainto_tsquery('english', ${q})) AS rank
        FROM "ForumPost" p
        WHERE p."searchVector" @@ plainto_tsquery('english', ${q})
          AND p."removedAt" IS NULL
          AND p."lobbyId" = ${lobbyId}
        ORDER BY rank DESC, p."createdAt" DESC
        LIMIT ${limit}
      `;
      } else {
        posts = await prisma.$queryRaw<any[]>`
        SELECT p.id, p.title, p."authorId", p."authorName", p."lobbyId", p."sectionId",
               p.score, p."commentCount", p."createdAt", p.pinned, p.locked,
               LEFT(p.body, 240) AS snippet,
               ts_rank(p."searchVector", plainto_tsquery('english', ${q})) AS rank
        FROM "ForumPost" p
        WHERE p."searchVector" @@ plainto_tsquery('english', ${q})
          AND p."removedAt" IS NULL
        ORDER BY rank DESC, p."createdAt" DESC
        LIMIT ${limit}
      `;
      }
    }

    if (wantComments) {
      if (lobbyId) {
        comments = await prisma.$queryRaw<any[]>`
        SELECT c.id, c."postId", c."authorId", c."authorName", c.score, c."createdAt",
               LEFT(c.body, 240) AS snippet,
               p.title AS "postTitle", p."lobbyId", p."sectionId",
               ts_rank(c."searchVector", plainto_tsquery('english', ${q})) AS rank
        FROM "ForumComment" c
        JOIN "ForumPost" p ON p.id = c."postId"
        WHERE c."searchVector" @@ plainto_tsquery('english', ${q})
          AND c."removedAt" IS NULL
          AND p."removedAt" IS NULL
          AND p."lobbyId" = ${lobbyId}
        ORDER BY rank DESC, c."createdAt" DESC
        LIMIT ${limit}
      `;
      } else {
        comments = await prisma.$queryRaw<any[]>`
        SELECT c.id, c."postId", c."authorId", c."authorName", c.score, c."createdAt",
               LEFT(c.body, 240) AS snippet,
               p.title AS "postTitle", p."lobbyId", p."sectionId",
               ts_rank(c."searchVector", plainto_tsquery('english', ${q})) AS rank
        FROM "ForumComment" c
        JOIN "ForumPost" p ON p.id = c."postId"
        WHERE c."searchVector" @@ plainto_tsquery('english', ${q})
          AND c."removedAt" IS NULL
          AND p."removedAt" IS NULL
        ORDER BY rank DESC, c."createdAt" DESC
        LIMIT ${limit}
      `;
      }
    }

    const authorIds = [...posts.map((p) => p.authorId), ...comments.map((c) => c.authorId)];
    const authorMap = await enrichForumAuthors(authorIds);

    return reply.send({
      ok: true,
      query: q,
      results: {
        posts: posts.map((p) => ({
          ...p,
          rank: Number(p.rank),
          author: authorMap[p.authorId] || null,
        })),
        comments: comments.map((c) => ({
          ...c,
          rank: Number(c.rank),
          author: authorMap[c.authorId] || null,
        })),
      },
    });
  });
}

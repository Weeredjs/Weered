import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";
import { LobbyRole, ForumReportReason, ForumReportStatus, ForumModActionKind, ForumAutoModKind, ForumAutoModAction } from "@prisma/client";

// /forum/* moderation surface — reports, mod actions audit log, automod rules.
// Slice C of the Tier 2 forum upgrade. Companion to routes/forum.ts.
type Opts = {
  authFromHeader: (h?: string) => { id: string; name: string } | null;
  getGlobalRole: (userId: string) => Promise<string | null>;
  canAccessStaff: (role: string | null) => boolean;
  getLobbyRole: (userId: string, lobbyId: string) => Promise<LobbyRole | null>;
};

const REPORT_REASONS = ["SPAM", "HARASSMENT", "HATE_SPEECH", "NSFW", "MISINFORMATION", "OFF_TOPIC", "OTHER"];
const REPORT_STATUSES = ["PENDING", "REVIEWED", "ACTIONED", "DISMISSED"];
const AUTOMOD_KINDS = ["REGEX_FILTER", "KARMA_MIN", "ACCOUNT_AGE_MIN", "LINK_BLOCK", "WORD_BLOCK"];
const AUTOMOD_ACTIONS = ["REPORT", "REMOVE", "SHADOW_REMOVE", "REQUIRE_REVIEW"];

// Sentinel reporterId for automod-generated reports. Falls back to env override
// or first staff user. Resolved lazily and cached per-process.
let _automodReporterId: string | null = null;
async function getAutomodReporterId(): Promise<string> {
  if (_automodReporterId) return _automodReporterId;
  const fromEnv = process.env.AUTOMOD_USER_ID;
  if (fromEnv) {
    const u = await prisma.user.findUnique({ where: { id: fromEnv }, select: { id: true } });
    if (u) { _automodReporterId = u.id; return u.id; }
  }
  // Fall back to any staff user; if none, the first user. The reporterId column
  // is non-nullable so something has to go there.
  const staff = await prisma.user.findFirst({ where: { globalRole: { in: ["FOUNDER", "ADMIN", "STAFF", "MOD"] as any } }, select: { id: true } });
  if (staff) { _automodReporterId = staff.id; return staff.id; }
  const any = await prisma.user.findFirst({ select: { id: true } });
  if (any) { _automodReporterId = any.id; return any.id; }
  throw new Error("no_user_for_automod_reporter");
}

// Shared mod-permission check: global staff, lobby OWNER, or lobby MOD.
async function isLobbyModOrStaff(userId: string, lobbyId: string | null, opts: Opts): Promise<{ ok: boolean; isOwner: boolean; isStaff: boolean }> {
  const role = await opts.getGlobalRole(userId);
  if (opts.canAccessStaff(role)) return { ok: true, isOwner: false, isStaff: true };
  if (!lobbyId) return { ok: false, isOwner: false, isStaff: false };
  const lr = await opts.getLobbyRole(userId, lobbyId);
  const isOwner = lr === LobbyRole.OWNER;
  const isMod = lr === LobbyRole.MOD || isOwner;
  return { ok: isMod, isOwner, isStaff: false };
}
async function isLobbyOwnerOrStaff(userId: string, lobbyId: string, opts: Opts): Promise<boolean> {
  const role = await opts.getGlobalRole(userId);
  if (opts.canAccessStaff(role)) return true;
  const lr = await opts.getLobbyRole(userId, lobbyId);
  return lr === LobbyRole.OWNER;
}

// Insert a row into the audit log. Wraps prisma.create so callers don't have to
// remember the field shape.
export async function recordModAction(lobbyId: string | null, modId: string, kind: ForumModActionKind, targetType: "POST" | "COMMENT" | "USER", targetId: string, reason: string, meta: any = {}) {
  try {
    return await prisma.forumModAction.create({
      data: { lobbyId: lobbyId || null, modId, kind, targetType, targetId, reason: reason || "", meta: meta || {} },
    });
  } catch {
    return null;
  }
}

// Run all enabled rules in a lobby against new content. Returns {blocked, action,
// ruleId, reason}. Caller decides whether to short-circuit (REMOVE) or commit
// the content with side-effects (SHADOW_REMOVE / REQUIRE_REVIEW / REPORT).
export async function runAutoMod(lobbyId: string | null, content: { kind: "POST" | "COMMENT"; title?: string; body: string; authorId: string }): Promise<{ blocked: boolean; action?: ForumAutoModAction; ruleId?: string; ruleName?: string; reason?: string }> {
  if (!lobbyId) return { blocked: false };
  let rules: any[] = [];
  try {
    rules = await prisma.forumAutoModRule.findMany({ where: { lobbyId, enabled: true } });
  } catch { return { blocked: false }; }
  if (!rules.length) return { blocked: false };

  const text = `${content.title || ""} ${content.body || ""}`;
  const lowerText = text.toLowerCase();

  let user: { id: string; createdAt: Date } | null = null;
  async function getUser() {
    if (user) return user;
    user = await prisma.user.findUnique({ where: { id: content.authorId }, select: { id: true, createdAt: true } });
    return user;
  }

  for (const rule of rules) {
    const cfg = (rule.config as any) || {};
    let trigger = false;
    let reason = "";
    try {
      if (rule.kind === ForumAutoModKind.REGEX_FILTER) {
        const pattern = String(cfg.pattern || "");
        if (!pattern) continue;
        const flags = String(cfg.flags || "i");
        const re = new RegExp(pattern, flags);
        if (re.test(text)) { trigger = true; reason = `regex match: ${pattern}`; }
      } else if (rule.kind === ForumAutoModKind.WORD_BLOCK) {
        const words: string[] = Array.isArray(cfg.words) ? cfg.words : [];
        for (const w of words) {
          const lw = String(w || "").toLowerCase().trim();
          if (lw && lowerText.includes(lw)) { trigger = true; reason = `blocked word: ${lw}`; break; }
        }
      } else if (rule.kind === ForumAutoModKind.LINK_BLOCK) {
        const allowed: string[] = Array.isArray(cfg.allowedDomains) ? cfg.allowedDomains.map((d: any) => String(d).toLowerCase()) : [];
        const urlRe = /https?:\/\/([^\s/]+)/gi;
        let m: RegExpExecArray | null;
        while ((m = urlRe.exec(text)) !== null) {
          const host = String(m[1] || "").toLowerCase();
          const ok = allowed.some(d => host === d || host.endsWith("." + d));
          if (!ok) { trigger = true; reason = `disallowed link host: ${host}`; break; }
        }
      } else if (rule.kind === ForumAutoModKind.KARMA_MIN) {
        const min = Number(cfg.min || 0);
        const agg = await prisma.forumPost.aggregate({ where: { lobbyId, authorId: content.authorId }, _sum: { score: true } });
        const cAgg = await prisma.forumComment.aggregate({ where: { authorId: content.authorId, post: { lobbyId } }, _sum: { score: true } });
        const total = (agg._sum.score || 0) + (cAgg._sum.score || 0);
        if (total < min) { trigger = true; reason = `lobby karma ${total} < ${min}`; }
      } else if (rule.kind === ForumAutoModKind.ACCOUNT_AGE_MIN) {
        const minDays = Number(cfg.minDays || 0);
        const u = await getUser();
        if (u) {
          const ageDays = (Date.now() - u.createdAt.getTime()) / 86400000;
          if (ageDays < minDays) { trigger = true; reason = `account age ${ageDays.toFixed(1)}d < ${minDays}d`; }
        }
      }
    } catch { /* rule errors are non-fatal */ }

    if (trigger) {
      return { blocked: rule.action === ForumAutoModAction.REMOVE, action: rule.action, ruleId: rule.id, ruleName: rule.name, reason };
    }
  }
  return { blocked: false };
}

// Periodically unlock posts whose tags.unlockAt has passed. Called from the
// worker tick in apps/api/src/index.ts.
export async function autoModTick() {
  try {
    const now = new Date();
    // Posts have a JSON `tags` field. Filter at JS level since JSON path queries
    // are awkward across providers; cap the scan to locked posts only.
    const locked = await prisma.forumPost.findMany({ where: { locked: true }, select: { id: true, lobbyId: true, tags: true } });
    for (const p of locked) {
      const t: any = p.tags;
      const ua = t && typeof t === "object" ? t.unlockAt : null;
      if (ua && new Date(ua).getTime() <= now.getTime()) {
        await prisma.forumPost.update({ where: { id: p.id }, data: { locked: false, tags: { ...t, unlockAt: null } as any } });
        await recordModAction(p.lobbyId || null, "system", "POST_UNLOCK", "POST", p.id, "scheduled auto-unlock", { auto: true });
      }
    }
  } catch {}
}

export default async function forumModRoutes(app: FastifyInstance, opts: Opts) {
  const { authFromHeader } = opts;

  // POST /forum/reports — anyone authed can file a report
  app.post("/forum/reports", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ error: "unauthorized" });
    const { postId, commentId, reason, detail } = (req as any).body || {};
    const pid = postId ? String(postId).trim() : "";
    const cid = commentId ? String(commentId).trim() : "";
    if ((!pid && !cid) || (pid && cid)) return reply.code(400).send({ error: "must_specify_one_target" });
    if (!REPORT_REASONS.includes(String(reason || ""))) return reply.code(400).send({ error: "invalid_reason" });

    if (pid) {
      const exists = await prisma.forumPost.findUnique({ where: { id: pid }, select: { id: true } });
      if (!exists) return reply.code(404).send({ error: "post_not_found" });
    } else {
      const exists = await prisma.forumComment.findUnique({ where: { id: cid }, select: { id: true } });
      if (!exists) return reply.code(404).send({ error: "comment_not_found" });
    }

    const dupe = await prisma.forumReport.findFirst({
      where: { reporterId: u.id, ...(pid ? { postId: pid } : { commentId: cid }) },
      select: { id: true },
    });
    if (dupe) return reply.code(400).send({ error: "already_reported" });

    const report = await prisma.forumReport.create({
      data: {
        postId: pid || null,
        commentId: cid || null,
        reporterId: u.id,
        reason: reason as ForumReportReason,
        detail: String(detail || "").slice(0, 2000),
      },
    });
    return reply.send({ ok: true, report });
  });

  // GET /forum/reports — staff or lobby mod
  app.get("/forum/reports", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ error: "unauthorized" });
    const lobbyId = String((req as any).query?.lobbyId || "").trim() || null;
    const status = String((req as any).query?.status || "PENDING").toUpperCase();
    const limit = Math.min(Number((req as any).query?.limit) || 50, 200);

    const perm = await isLobbyModOrStaff(u.id, lobbyId, opts);
    if (!perm.ok) return reply.code(403).send({ error: "forbidden" });

    const where: any = {};
    if (REPORT_STATUSES.includes(status)) where.status = status;
    // Lobby filter applied via post.lobbyId or comment.post.lobbyId
    if (lobbyId) {
      where.OR = [
        { post: { lobbyId } },
        { comment: { post: { lobbyId } } },
      ];
    }

    const rows = await prisma.forumReport.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        post: { select: { id: true, title: true, body: true, authorId: true, authorName: true, lobbyId: true, removedAt: true, locked: true } },
        comment: { select: { id: true, postId: true, body: true, authorId: true, authorName: true, removedAt: true } },
      },
    });
    const reporterIds = [...new Set(rows.map(r => r.reporterId))];
    const reporters = await prisma.user.findMany({ where: { id: { in: reporterIds } }, select: { id: true, name: true } });
    const repMap: Record<string, string> = {};
    for (const r of reporters) repMap[r.id] = r.name;
    const out = rows.map(r => ({ ...r, reporterName: repMap[r.reporterId] || "Unknown" }));
    return reply.send({ ok: true, reports: out });
  });

  // PATCH /forum/reports/:id — staff or lobby mod transitions a report
  app.patch("/forum/reports/:id", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ error: "unauthorized" });
    const id = String((req as any).params?.id || "");
    const { status, actionTaken } = (req as any).body || {};
    if (!REPORT_STATUSES.includes(String(status))) return reply.code(400).send({ error: "invalid_status" });

    const existing = await prisma.forumReport.findUnique({
      where: { id },
      include: { post: { select: { lobbyId: true } }, comment: { select: { post: { select: { lobbyId: true } } } } },
    });
    if (!existing) return reply.code(404).send({ error: "not_found" });
    const lobbyId = existing.post?.lobbyId || existing.comment?.post?.lobbyId || null;
    const perm = await isLobbyModOrStaff(u.id, lobbyId, opts);
    if (!perm.ok) return reply.code(403).send({ error: "forbidden" });

    const updated = await prisma.forumReport.update({
      where: { id },
      data: {
        status: status as ForumReportStatus,
        actionTaken: actionTaken ? String(actionTaken).slice(0, 500) : existing.actionTaken,
        reviewedById: u.id,
        reviewedAt: new Date(),
      },
    });
    return reply.send({ ok: true, report: updated });
  });

  // POST /forum/posts/:id/remove — soft-delete a post
  app.post("/forum/posts/:id/remove", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ error: "unauthorized" });
    const id = String((req as any).params?.id || "");
    const reason = String((req as any).body?.reason || "");
    const post = await prisma.forumPost.findUnique({ where: { id }, select: { id: true, lobbyId: true } });
    if (!post) return reply.code(404).send({ error: "not_found" });
    const perm = await isLobbyModOrStaff(u.id, post.lobbyId, opts);
    if (!perm.ok) return reply.code(403).send({ error: "forbidden" });
    await prisma.forumPost.update({ where: { id }, data: { removedAt: new Date(), removedById: u.id, removeReason: reason.slice(0, 500) } });
    await recordModAction(post.lobbyId, u.id, "POST_REMOVE", "POST", id, reason);
    return reply.send({ ok: true });
  });

  // POST /forum/posts/:id/restore
  app.post("/forum/posts/:id/restore", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ error: "unauthorized" });
    const id = String((req as any).params?.id || "");
    const post = await prisma.forumPost.findUnique({ where: { id }, select: { id: true, lobbyId: true } });
    if (!post) return reply.code(404).send({ error: "not_found" });
    const perm = await isLobbyModOrStaff(u.id, post.lobbyId, opts);
    if (!perm.ok) return reply.code(403).send({ error: "forbidden" });
    await prisma.forumPost.update({ where: { id }, data: { removedAt: null, removedById: null, removeReason: null } });
    await recordModAction(post.lobbyId, u.id, "POST_RESTORE", "POST", id, "");
    return reply.send({ ok: true });
  });

  // POST /forum/posts/:id/lock — accepts optional unlockAt ISO for scheduled unlock
  app.post("/forum/posts/:id/lock", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ error: "unauthorized" });
    const id = String((req as any).params?.id || "");
    const reason = String((req as any).body?.reason || "");
    const unlockAtRaw = (req as any).body?.unlockAt;
    let unlockAt: Date | null = null;
    if (unlockAtRaw) {
      const d = new Date(unlockAtRaw);
      if (!isNaN(d.getTime())) unlockAt = d;
    }
    const post = await prisma.forumPost.findUnique({ where: { id }, select: { id: true, lobbyId: true, tags: true } });
    if (!post) return reply.code(404).send({ error: "not_found" });
    const perm = await isLobbyModOrStaff(u.id, post.lobbyId, opts);
    if (!perm.ok) return reply.code(403).send({ error: "forbidden" });
    const tags = (post.tags && typeof post.tags === "object" ? post.tags : {}) as any;
    const newTags = { ...tags, unlockAt: unlockAt ? unlockAt.toISOString() : null };
    await prisma.forumPost.update({ where: { id }, data: { locked: true, tags: newTags } });
    await recordModAction(post.lobbyId, u.id, "POST_LOCK", "POST", id, reason, { unlockAt: newTags.unlockAt });
    return reply.send({ ok: true });
  });

  // POST /forum/posts/:id/unlock
  app.post("/forum/posts/:id/unlock", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ error: "unauthorized" });
    const id = String((req as any).params?.id || "");
    const post = await prisma.forumPost.findUnique({ where: { id }, select: { id: true, lobbyId: true, tags: true } });
    if (!post) return reply.code(404).send({ error: "not_found" });
    const perm = await isLobbyModOrStaff(u.id, post.lobbyId, opts);
    if (!perm.ok) return reply.code(403).send({ error: "forbidden" });
    const tags = (post.tags && typeof post.tags === "object" ? post.tags : {}) as any;
    await prisma.forumPost.update({ where: { id }, data: { locked: false, tags: { ...tags, unlockAt: null } } });
    await recordModAction(post.lobbyId, u.id, "POST_UNLOCK", "POST", id, "");
    return reply.send({ ok: true });
  });

  // POST /forum/posts/:id/pin — body.pinned=false unpins
  app.post("/forum/posts/:id/pin", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ error: "unauthorized" });
    const id = String((req as any).params?.id || "");
    const pinned = (req as any).body?.pinned !== false;
    const post = await prisma.forumPost.findUnique({ where: { id }, select: { id: true, lobbyId: true } });
    if (!post) return reply.code(404).send({ error: "not_found" });
    const perm = await isLobbyModOrStaff(u.id, post.lobbyId, opts);
    if (!perm.ok) return reply.code(403).send({ error: "forbidden" });
    // Pin requires owner/staff; mods cannot pin
    if (!perm.isOwner && !perm.isStaff) {
      const role = await opts.getGlobalRole(u.id);
      if (!opts.canAccessStaff(role)) return reply.code(403).send({ error: "forbidden" });
    }
    await prisma.forumPost.update({ where: { id }, data: { pinned } });
    await recordModAction(post.lobbyId, u.id, pinned ? "POST_PIN" : "POST_UNPIN", "POST", id, "");
    return reply.send({ ok: true, pinned });
  });

  // POST /forum/comments/:id/remove — mod or author
  app.post("/forum/comments/:id/remove", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ error: "unauthorized" });
    const id = String((req as any).params?.id || "");
    const reason = String((req as any).body?.reason || "");
    const c = await prisma.forumComment.findUnique({ where: { id }, select: { id: true, authorId: true, postId: true } });
    if (!c) return reply.code(404).send({ error: "not_found" });
    const post = await prisma.forumPost.findUnique({ where: { id: c.postId }, select: { lobbyId: true } });
    let allowed = c.authorId === u.id;
    if (!allowed) {
      const perm = await isLobbyModOrStaff(u.id, post?.lobbyId || null, opts);
      allowed = perm.ok;
    }
    if (!allowed) return reply.code(403).send({ error: "forbidden" });
    await prisma.forumComment.update({ where: { id }, data: { removedAt: new Date(), removedById: u.id, removeReason: reason.slice(0, 500) } });
    await recordModAction(post?.lobbyId || null, u.id, "COMMENT_REMOVE", "COMMENT", id, reason);
    return reply.send({ ok: true });
  });

  // POST /forum/comments/:id/restore — mod only
  app.post("/forum/comments/:id/restore", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ error: "unauthorized" });
    const id = String((req as any).params?.id || "");
    const c = await prisma.forumComment.findUnique({ where: { id }, select: { id: true, postId: true } });
    if (!c) return reply.code(404).send({ error: "not_found" });
    const post = await prisma.forumPost.findUnique({ where: { id: c.postId }, select: { lobbyId: true } });
    const perm = await isLobbyModOrStaff(u.id, post?.lobbyId || null, opts);
    if (!perm.ok) return reply.code(403).send({ error: "forbidden" });
    await prisma.forumComment.update({ where: { id }, data: { removedAt: null, removedById: null, removeReason: null } });
    await recordModAction(post?.lobbyId || null, u.id, "COMMENT_RESTORE", "COMMENT", id, "");
    return reply.send({ ok: true });
  });

  // GET /forum/mod-actions — audit log
  app.get("/forum/mod-actions", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ error: "unauthorized" });
    const lobbyId = String((req as any).query?.lobbyId || "").trim() || null;
    const modId = String((req as any).query?.modId || "").trim() || null;
    const limit = Math.min(Number((req as any).query?.limit) || 50, 200);
    const perm = await isLobbyModOrStaff(u.id, lobbyId, opts);
    if (!perm.ok) return reply.code(403).send({ error: "forbidden" });
    const where: any = {};
    if (lobbyId) where.lobbyId = lobbyId;
    if (modId) where.modId = modId;
    const rows = await prisma.forumModAction.findMany({ where, orderBy: { createdAt: "desc" }, take: limit });
    const modIds = [...new Set(rows.map(r => r.modId))];
    const mods = await prisma.user.findMany({ where: { id: { in: modIds } }, select: { id: true, name: true } });
    const mmap: Record<string, string> = {};
    for (const m of mods) mmap[m.id] = m.name;
    return reply.send({ ok: true, actions: rows.map(r => ({ ...r, modName: mmap[r.modId] || (r.modId === "system" ? "system" : "Unknown") })) });
  });

  // GET /forum/automod — list rules in a lobby (mod-gated)
  app.get("/forum/automod", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ error: "unauthorized" });
    const lobbyId = String((req as any).query?.lobbyId || "").trim();
    if (!lobbyId) return reply.code(400).send({ error: "lobbyId_required" });
    const perm = await isLobbyModOrStaff(u.id, lobbyId, opts);
    if (!perm.ok) return reply.code(403).send({ error: "forbidden" });
    const rules = await prisma.forumAutoModRule.findMany({ where: { lobbyId }, orderBy: { createdAt: "desc" } });
    return reply.send({ ok: true, rules });
  });

  // POST /forum/automod — owner or staff only
  app.post("/forum/automod", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ error: "unauthorized" });
    const { lobbyId, name, kind, config, action, enabled } = (req as any).body || {};
    if (!lobbyId || typeof lobbyId !== "string") return reply.code(400).send({ error: "lobbyId_required" });
    if (!name || typeof name !== "string") return reply.code(400).send({ error: "name_required" });
    if (!AUTOMOD_KINDS.includes(String(kind))) return reply.code(400).send({ error: "invalid_kind" });
    if (!AUTOMOD_ACTIONS.includes(String(action))) return reply.code(400).send({ error: "invalid_action" });
    const isOwner = await isLobbyOwnerOrStaff(u.id, lobbyId, opts);
    if (!isOwner) return reply.code(403).send({ error: "forbidden" });
    const cfg = validateAutoModConfig(kind, config);
    if (cfg.error) return reply.code(400).send({ error: cfg.error });
    const rule = await prisma.forumAutoModRule.create({
      data: { lobbyId, name: String(name).slice(0, 100), kind: kind as ForumAutoModKind, config: cfg.value as any, action: action as ForumAutoModAction, enabled: enabled !== false, createdById: u.id },
    });
    return reply.send({ ok: true, rule });
  });

  // PATCH /forum/automod/:id
  app.patch("/forum/automod/:id", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ error: "unauthorized" });
    const id = String((req as any).params?.id || "");
    const existing = await prisma.forumAutoModRule.findUnique({ where: { id } });
    if (!existing) return reply.code(404).send({ error: "not_found" });
    const isOwner = await isLobbyOwnerOrStaff(u.id, existing.lobbyId, opts);
    if (!isOwner) return reply.code(403).send({ error: "forbidden" });
    const body = (req as any).body || {};
    const data: any = {};
    if (typeof body.name === "string") data.name = body.name.slice(0, 100);
    if (typeof body.enabled === "boolean") data.enabled = body.enabled;
    if (body.action && AUTOMOD_ACTIONS.includes(body.action)) data.action = body.action;
    if (body.kind && AUTOMOD_KINDS.includes(body.kind)) data.kind = body.kind;
    if (body.config !== undefined) {
      const cfg = validateAutoModConfig(data.kind || existing.kind, body.config);
      if (cfg.error) return reply.code(400).send({ error: cfg.error });
      data.config = cfg.value as any;
    }
    const rule = await prisma.forumAutoModRule.update({ where: { id }, data });
    return reply.send({ ok: true, rule });
  });

  // DELETE /forum/automod/:id
  app.delete("/forum/automod/:id", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ error: "unauthorized" });
    const id = String((req as any).params?.id || "");
    const existing = await prisma.forumAutoModRule.findUnique({ where: { id } });
    if (!existing) return reply.code(404).send({ error: "not_found" });
    const isOwner = await isLobbyOwnerOrStaff(u.id, existing.lobbyId, opts);
    if (!isOwner) return reply.code(403).send({ error: "forbidden" });
    await prisma.forumAutoModRule.delete({ where: { id } });
    return reply.send({ ok: true });
  });
}

// Lightweight per-kind config validator. Returns {value} on success, {error} on
// failure. Extracted so create + patch share the rules.
function validateAutoModConfig(kind: string, raw: any): { value?: any; error?: string } {
  const cfg = raw && typeof raw === "object" ? raw : {};
  if (kind === "REGEX_FILTER") {
    const pattern = String(cfg.pattern || "");
    if (!pattern) return { error: "pattern_required" };
    try { new RegExp(pattern, String(cfg.flags || "i")); } catch { return { error: "invalid_regex" }; }
    return { value: { pattern, flags: String(cfg.flags || "i") } };
  }
  if (kind === "WORD_BLOCK") {
    const words = Array.isArray(cfg.words) ? cfg.words.map((w: any) => String(w || "").trim()).filter(Boolean) : [];
    if (!words.length) return { error: "words_required" };
    return { value: { words } };
  }
  if (kind === "LINK_BLOCK") {
    const allowedDomains = Array.isArray(cfg.allowedDomains) ? cfg.allowedDomains.map((d: any) => String(d || "").trim().toLowerCase()).filter(Boolean) : [];
    return { value: { allowedDomains } };
  }
  if (kind === "KARMA_MIN") {
    const min = Number(cfg.min);
    if (!isFinite(min)) return { error: "min_required" };
    return { value: { min } };
  }
  if (kind === "ACCOUNT_AGE_MIN") {
    const minDays = Number(cfg.minDays);
    if (!isFinite(minDays) || minDays < 0) return { error: "minDays_required" };
    return { value: { minDays } };
  }
  return { error: "unknown_kind" };
}

// Helper exported for forum.ts to apply automod side-effects after creating
// content. Returns the new fields to merge into the create-data, or null if
// caller should reject the create entirely.
export async function applyAutoModSideEffects(lobbyId: string | null, content: { kind: "POST" | "COMMENT"; title?: string; body: string; authorId: string }): Promise<{ blocked: boolean; ruleId?: string; ruleName?: string; reason?: string; action?: ForumAutoModAction; sideEffect?: { removedAt?: Date; removedById?: string; removeReason?: string; tagsPatch?: any } }> {
  const result = await runAutoMod(lobbyId, content);
  if (!result.action) return { blocked: false };
  if (result.action === ForumAutoModAction.REMOVE) {
    return { blocked: true, ruleId: result.ruleId, ruleName: result.ruleName, reason: result.reason, action: result.action };
  }
  if (result.action === ForumAutoModAction.SHADOW_REMOVE) {
    const reporterId = await getAutomodReporterId().catch(() => null);
    return {
      blocked: false, ruleId: result.ruleId, ruleName: result.ruleName, reason: result.reason, action: result.action,
      sideEffect: { removedAt: new Date(), removedById: reporterId || content.authorId, removeReason: `Auto-mod: ${result.ruleName || ""}` },
    };
  }
  if (result.action === ForumAutoModAction.REQUIRE_REVIEW) {
    return {
      blocked: false, ruleId: result.ruleId, ruleName: result.ruleName, reason: result.reason, action: result.action,
      sideEffect: { tagsPatch: { requiresReview: true, automodRuleId: result.ruleId, automodReason: result.reason } },
    };
  }
  // REPORT: file a report against the new content (caller fills in target id
  // post-create via fileAutoModReport).
  return { blocked: false, ruleId: result.ruleId, ruleName: result.ruleName, reason: result.reason, action: result.action };
}

// Called by forum.ts after a POST/COMMENT is created when automod returned
// REPORT — wires the report row to the actual target id.
export async function fileAutoModReport(target: { kind: "POST" | "COMMENT"; id: string }, ruleName: string | undefined, reason: string | undefined) {
  try {
    const reporterId = await getAutomodReporterId();
    await prisma.forumReport.create({
      data: {
        postId: target.kind === "POST" ? target.id : null,
        commentId: target.kind === "COMMENT" ? target.id : null,
        reporterId,
        reason: ForumReportReason.OTHER,
        detail: `Auto-mod: ${ruleName || ""}${reason ? ` — ${reason}` : ""}`.slice(0, 2000),
      },
    });
  } catch {}
}

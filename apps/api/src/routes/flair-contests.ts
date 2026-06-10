import type { FastifyInstance } from "fastify";
import { isStaffUser as sharedIsStaffUser } from "../lib/isStaffUser";
import { existsSync, mkdirSync, writeFileSync, readFileSync, unlinkSync } from "fs";
import { join } from "path";
import sharp from "sharp";
import { prisma } from "../lib/prisma";
import { grantFlairToUser, mintFlairItem } from "../lib/flair";

type Opts = {
  authFromHeader: (h?: string) => { id: string; name?: string; globalRole?: string } | null;
  awardNotoriety?: (userId: string, action: string) => Promise<number | null>;
  getGlobalRole?: (userId: string) => Promise<string>;
  canAccessStaff?: (role?: string | null) => boolean;
  getLobbyRole?: (userId: string, lobbyId: string) => Promise<"OWNER" | "MOD" | "MEMBER" | null>;
  broadcastToLobby?: (lobbyId: string, event: any) => void;
  createNotification?: (opts: {
    userId: string; type: string; title: string;
    body?: string; actionUrl?: string;
    actorId?: string; actorName?: string; meta?: any;
  }) => Promise<any>;
};

const FLAIR_DIR = join(process.cwd(), "uploads", "flair-contests");
if (!existsSync(FLAIR_DIR)) mkdirSync(FLAIR_DIR, { recursive: true });

const SITE_BASE = process.env.NEXT_PUBLIC_API_BASE || "https://api.weered.ca";

const MAX_DIM = 1200;
const VALID_KINDS = new Set(["BADGE", "BANNER", "NAMEPLATE"]);
const VALID_STATUSES = new Set(["SUBMISSIONS", "VOTING", "COMPLETED", "CANCELED"]);

function decodeDataUrl(dataUrl: string): { ext: string; buffer: Buffer } | null {
  const m = String(dataUrl || "").match(/^data:image\/(png|jpeg|jpg|webp|gif);base64,(.+)$/);
  if (!m) return null;
  const ext = m[1] === "jpeg" ? "jpg" : m[1];
  return { ext, buffer: Buffer.from(m[2], "base64") };
}

async function processSubmissionImage(
  raw: Buffer,
  userId: string,
  contestId: string,
): Promise<{ url: string; filename: string; dominantColor: string; width: number; height: number }> {
  const ts = Date.now();
  const filename = `${contestId}-${userId}-${ts}.webp`;
  const fullPath = join(FLAIR_DIR, filename);

  let pipeline = sharp(raw, { failOn: "none" }).rotate();
  pipeline = pipeline.resize({ width: MAX_DIM, height: MAX_DIM, fit: "inside", withoutEnlargement: true });

  let out = await pipeline.webp({ quality: 80 }).toBuffer();
  if (out.length > 1_000_000) {
    out = await sharp(raw, { failOn: "none" })
      .rotate()
      .resize({ width: MAX_DIM, height: MAX_DIM, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 65 })
      .toBuffer();
  }
  writeFileSync(fullPath, out);

  const meta = await sharp(out).metadata();
  let dominantColor = "#1a1810";
  try {
    const stats = await sharp(out).stats();
    const c = (stats as any).dominant;
    if (c && typeof c.r === "number") {
      const toHex = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
      dominantColor = `#${toHex(c.r)}${toHex(c.g)}${toHex(c.b)}`;
    }
  } catch {}

  return {
    url: `${SITE_BASE}/flair-contests-img/${filename}`,
    filename,
    dominantColor,
    width: meta.width || MAX_DIM,
    height: meta.height || MAX_DIM,
  };
}

function filenameFromUrl(url: string): string | null {
  const m = String(url || "").match(/\/flair-contests-img\/([a-zA-Z0-9._-]+)$/);
  return m ? m[1] : null;
}

export default async function flairContestsRoutes(app: FastifyInstance, opts: Opts) {
  const { authFromHeader, getGlobalRole, canAccessStaff, getLobbyRole, broadcastToLobby, createNotification } = opts;

  const isStaffUser = (userId: string) => sharedIsStaffUser(userId, getGlobalRole, canAccessStaff);

  async function canManageContest(userId: string, contest: { lobbyId: string | null; createdById: string }): Promise<boolean> {
    if (await isStaffUser(userId)) return true;
    if (contest.createdById === userId) return true;
    if (contest.lobbyId && getLobbyRole) {
      const r = await getLobbyRole(userId, contest.lobbyId);
      if (r === "OWNER" || r === "MOD") return true;
    }
    return false;
  }

  app.get("/flair-contests", async (req, reply) => {
    const q = (req as any).query || {};
    const lobbyId = q.lobbyId ? String(q.lobbyId) : null;
    const statusFilter = q.status ? (Array.isArray(q.status) ? q.status : [q.status]).map(String).filter((s: string) => VALID_STATUSES.has(s)) : null;
    const where: any = {};
    if (lobbyId) where.lobbyId = lobbyId;
    if (statusFilter && statusFilter.length > 0) where.status = { in: statusFilter };

    const contests = await (prisma as any).flairContest.findMany({
      where,
      include: { _count: { select: { submissions: true } } },
      orderBy: [{ status: "asc" }, { voteClosesAt: "desc" }],
      take: 100,
    });

    const order: Record<string, number> = { SUBMISSIONS: 0, VOTING: 1, COMPLETED: 2, CANCELED: 3 };
    contests.sort((a: any, b: any) => {
      const oa = order[a.status] ?? 9;
      const ob = order[b.status] ?? 9;
      if (oa !== ob) return oa - ob;
      if (a.status === "SUBMISSIONS") return new Date(a.submissionClosesAt).getTime() - new Date(b.submissionClosesAt).getTime();
      if (a.status === "VOTING") return new Date(a.voteClosesAt).getTime() - new Date(b.voteClosesAt).getTime();
      return new Date(b.voteClosesAt).getTime() - new Date(a.voteClosesAt).getTime();
    });

    const u = authFromHeader((req as any).headers?.authorization);
    let mySubByContest: Record<string, any> = {};
    let myVoteByContest: Record<string, any> = {};
    if (u && contests.length > 0) {
      const ids = contests.map((c: any) => c.id);
      const subs = await (prisma as any).flairSubmission.findMany({
        where: { contestId: { in: ids }, userId: u.id },
        select: { id: true, contestId: true, imageUrl: true, caption: true, voteCount: true },
      });
      for (const s of subs) mySubByContest[s.contestId] = s;
      const votes = await (prisma as any).flairVote.findMany({
        where: { contestId: { in: ids }, voterId: u.id },
        select: { id: true, contestId: true, submissionId: true },
      });
      for (const v of votes) myVoteByContest[v.contestId] = v;
    }

    const enriched = contests.map((c: any) => ({
      ...c,
      mySubmission: mySubByContest[c.id] || null,
      myVote: myVoteByContest[c.id] || null,
    }));

    return reply.send({ ok: true, contests: enriched });
  });

  app.get("/flair-contests/:id", async (req, reply) => {
    const id = String((req as any).params?.id || "");
    const c = await (prisma as any).flairContest.findUnique({ where: { id } });
    if (!c) return reply.code(404).send({ ok: false, error: "not_found" });

    const submissions = await (prisma as any).flairSubmission.findMany({
      where: { contestId: id },
      orderBy: c.status === "COMPLETED" ? [{ voteCount: "desc" }, { createdAt: "asc" }] : [{ createdAt: "asc" }],
    });

    const userIds = Array.from(new Set(submissions.map((s: any) => s.userId)));
    const users = userIds.length > 0
      ? await prisma.user.findMany({ where: { id: { in: userIds as string[] } }, select: { id: true, name: true, avatar: true, avatarColor: true } })
      : [];
    const uById: Record<string, any> = {};
    for (const usr of users) uById[usr.id] = usr;

    const u = authFromHeader((req as any).headers?.authorization);
    let myVote: any = null;
    let mySubmission: any = null;
    if (u) {
      myVote = await (prisma as any).flairVote.findUnique({
        where: { contestId_voterId: { contestId: id, voterId: u.id } },
      }).catch(() => null);
      mySubmission = submissions.find((s: any) => s.userId === u.id) || null;
    }

    let rewardFlair: any = null;
    if (c.rewardFlairId) {
      rewardFlair = await (prisma as any).flairItem.findUnique({
        where: { id: c.rewardFlairId },
        select: { id: true, slug: true, name: true, kind: true, imageUrl: true, rarity: true, createdById: true },
      });
    }

    const submissionsOut = submissions.map((s: any) => ({
      ...s,
      author: uById[s.userId] || { id: s.userId, name: "Unknown" },
      voteCount: c.status === "SUBMISSIONS" ? undefined : s.voteCount,
    }));

    return reply.send({
      ok: true,
      contest: { ...c, submissions: submissionsOut, mySubmission, myVote, rewardFlair },
    });
  });

  app.post("/flair-contests", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });

    const body: any = (req as any).body || {};
    const lobbyId = body.lobbyId ? String(body.lobbyId) : null;

    let allowed = await isStaffUser(u.id);
    if (!allowed && lobbyId && getLobbyRole) {
      const r = await getLobbyRole(u.id, lobbyId);
      if (r === "OWNER" || r === "MOD") allowed = true;
    }
    if (!allowed) return reply.code(403).send({ ok: false, error: "forbidden" });

    const title = String(body.title || "").trim().slice(0, 120);
    if (title.length < 3) return reply.code(400).send({ ok: false, error: "title_too_short" });
    const description = String(body.description || "").slice(0, 2000);
    const theme = String(body.theme || "").slice(0, 200);
    const kind = String(body.kind || "BANNER").toUpperCase();
    if (!VALID_KINDS.has(kind)) return reply.code(400).send({ ok: false, error: "bad_kind" });

    const submissionOpensAt = new Date(body.submissionOpensAt);
    const submissionClosesAt = new Date(body.submissionClosesAt);
    const voteOpensAt = new Date(body.voteOpensAt);
    const voteClosesAt = new Date(body.voteClosesAt);
    for (const d of [submissionOpensAt, submissionClosesAt, voteOpensAt, voteClosesAt]) {
      if (isNaN(d.getTime())) return reply.code(400).send({ ok: false, error: "bad_date" });
    }
    if (!(submissionOpensAt < submissionClosesAt && submissionClosesAt <= voteOpensAt && voteOpensAt < voteClosesAt)) {
      return reply.code(400).send({ ok: false, error: "bad_date_order" });
    }

    const contest = await (prisma as any).flairContest.create({
      data: {
        lobbyId, title, description, theme, kind,
        status: "SUBMISSIONS",
        submissionOpensAt, submissionClosesAt, voteOpensAt, voteClosesAt,
        createdById: u.id,
      },
    });

    if (broadcastToLobby && lobbyId) {
      try { broadcastToLobby(lobbyId, { type: "flair-contest:created", contestId: contest.id, title }); } catch {}
    }

    return reply.send({ ok: true, contest });
  });

  app.patch("/flair-contests/:id", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const id = String((req as any).params?.id || "");
    const c = await (prisma as any).flairContest.findUnique({ where: { id } });
    if (!c) return reply.code(404).send({ ok: false, error: "not_found" });
    if (!(await canManageContest(u.id, c))) return reply.code(403).send({ ok: false, error: "forbidden" });

    const body: any = (req as any).body || {};
    const data: any = {};
    if (typeof body.title === "string") {
      const t = body.title.trim().slice(0, 120);
      if (t.length < 3) return reply.code(400).send({ ok: false, error: "title_too_short" });
      data.title = t;
    }
    if (typeof body.description === "string") data.description = String(body.description).slice(0, 2000);
    if (typeof body.theme === "string") data.theme = String(body.theme).slice(0, 200);
    if (typeof body.status === "string" && VALID_STATUSES.has(body.status)) data.status = body.status;
    for (const k of ["submissionOpensAt", "submissionClosesAt", "voteOpensAt", "voteClosesAt"]) {
      if (body[k]) {
        const d = new Date(body[k]);
        if (isNaN(d.getTime())) return reply.code(400).send({ ok: false, error: `bad_${k}` });
        data[k] = d;
      }
    }
    const merged = { ...c, ...data };
    const ordered =
      new Date(merged.submissionOpensAt) < new Date(merged.submissionClosesAt) &&
      new Date(merged.submissionClosesAt) <= new Date(merged.voteOpensAt) &&
      new Date(merged.voteOpensAt) < new Date(merged.voteClosesAt);
    if (!ordered) return reply.code(400).send({ ok: false, error: "bad_date_order" });

    const updated = await (prisma as any).flairContest.update({ where: { id }, data });
    return reply.send({ ok: true, contest: updated });
  });

  app.delete("/flair-contests/:id", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const id = String((req as any).params?.id || "");
    const c = await (prisma as any).flairContest.findUnique({
      where: { id },
      include: { _count: { select: { submissions: true } } },
    });
    if (!c) return reply.code(404).send({ ok: false, error: "not_found" });
    if (!(await canManageContest(u.id, c))) return reply.code(403).send({ ok: false, error: "forbidden" });

    if (c._count.submissions > 0) {
      const updated = await (prisma as any).flairContest.update({ where: { id }, data: { status: "CANCELED" } });
      return reply.send({ ok: true, canceled: true, contest: updated });
    }
    await (prisma as any).flairContest.delete({ where: { id } });
    return reply.send({ ok: true, deleted: true });
  });

  app.post("/flair-contests/:id/submissions", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const id = String((req as any).params?.id || "");
    const c = await (prisma as any).flairContest.findUnique({ where: { id } });
    if (!c) return reply.code(404).send({ ok: false, error: "not_found" });
    if (c.status !== "SUBMISSIONS") return reply.code(400).send({ ok: false, error: "submissions_closed" });
    if (new Date() > new Date(c.submissionClosesAt)) return reply.code(400).send({ ok: false, error: "submissions_closed" });

    const body: any = (req as any).body || {};
    const caption = String(body.caption || "").slice(0, 280);
    const dataUrl = String(body.image || body.imageDataUrl || "");
    const decoded = decodeDataUrl(dataUrl);
    if (!decoded) return reply.code(400).send({ ok: false, error: "bad_image_format" });
    if (decoded.buffer.length > 8 * 1024 * 1024) {
      return reply.code(400).send({ ok: false, error: "image_too_large" });
    }

    let processed: { url: string; filename: string; dominantColor: string; width: number; height: number };
    try {
      processed = await processSubmissionImage(decoded.buffer, u.id, id);
    } catch (e: any) {
      console.error("[flair-contests] image processing failed:", e?.message || e);
      return reply.code(400).send({ ok: false, error: "image_processing_failed" });
    }

    const existing = await (prisma as any).flairSubmission.findUnique({
      where: { contestId_userId: { contestId: id, userId: u.id } },
    });

    let submission: any;
    if (existing) {
      const oldName = filenameFromUrl(existing.imageUrl);
      if (oldName) {
        try { unlinkSync(join(FLAIR_DIR, oldName)); } catch {}
      }
      submission = await (prisma as any).flairSubmission.update({
        where: { id: existing.id },
        data: { imageUrl: processed.url, caption },
      });
    } else {
      submission = await (prisma as any).flairSubmission.create({
        data: { contestId: id, userId: u.id, imageUrl: processed.url, caption },
      });
    }

    if (broadcastToLobby && c.lobbyId) {
      try { broadcastToLobby(c.lobbyId, { type: "flair-contest:submission", contestId: id, submissionId: submission.id, userId: u.id }); } catch {}
    }

    return reply.send({ ok: true, submission });
  });

  app.delete("/flair-contests/:id/submissions/:submissionId", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const id = String((req as any).params?.id || "");
    const sid = String((req as any).params?.submissionId || "");
    const c = await (prisma as any).flairContest.findUnique({ where: { id } });
    if (!c) return reply.code(404).send({ ok: false, error: "not_found" });
    if (c.status !== "SUBMISSIONS") return reply.code(400).send({ ok: false, error: "submissions_closed" });
    const s = await (prisma as any).flairSubmission.findUnique({ where: { id: sid } });
    if (!s || s.contestId !== id) return reply.code(404).send({ ok: false, error: "not_found" });
    const isAuthor = s.userId === u.id;
    const isManager = await canManageContest(u.id, c);
    if (!isAuthor && !isManager) return reply.code(403).send({ ok: false, error: "forbidden" });

    const oldName = filenameFromUrl(s.imageUrl);
    if (oldName) {
      try { unlinkSync(join(FLAIR_DIR, oldName)); } catch {}
    }
    await (prisma as any).flairSubmission.delete({ where: { id: sid } });
    return reply.send({ ok: true });
  });

  app.post("/flair-contests/:id/votes", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const id = String((req as any).params?.id || "");
    const c = await (prisma as any).flairContest.findUnique({ where: { id } });
    if (!c) return reply.code(404).send({ ok: false, error: "not_found" });
    if (c.status !== "VOTING") return reply.code(400).send({ ok: false, error: "voting_closed" });

    const body: any = (req as any).body || {};
    const submissionId = String(body.submissionId || "");
    const target = await (prisma as any).flairSubmission.findUnique({ where: { id: submissionId } });
    if (!target || target.contestId !== id) return reply.code(404).send({ ok: false, error: "submission_not_found" });

    const existing = await (prisma as any).flairVote.findUnique({
      where: { contestId_voterId: { contestId: id, voterId: u.id } },
    });

    if (existing && existing.submissionId === submissionId) {
      return reply.send({ ok: true, vote: existing, changed: false });
    }

    if (existing) {
      await prisma.$transaction([
        (prisma as any).flairVote.update({
          where: { id: existing.id },
          data: { submissionId },
        }),
        (prisma as any).flairSubmission.update({
          where: { id: existing.submissionId },
          data: { voteCount: { decrement: 1 } },
        }),
        (prisma as any).flairSubmission.update({
          where: { id: submissionId },
          data: { voteCount: { increment: 1 } },
        }),
      ]);
    } else {
      await prisma.$transaction([
        (prisma as any).flairVote.create({
          data: { contestId: id, submissionId, voterId: u.id },
        }),
        (prisma as any).flairSubmission.update({
          where: { id: submissionId },
          data: { voteCount: { increment: 1 } },
        }),
      ]);
    }

    const v = await (prisma as any).flairVote.findUnique({
      where: { contestId_voterId: { contestId: id, voterId: u.id } },
    });
    return reply.send({ ok: true, vote: v, changed: true });
  });

  app.delete("/flair-contests/:id/votes", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const id = String((req as any).params?.id || "");
    const existing = await (prisma as any).flairVote.findUnique({
      where: { contestId_voterId: { contestId: id, voterId: u.id } },
    });
    if (!existing) return reply.send({ ok: true, removed: false });
    await prisma.$transaction([
      (prisma as any).flairVote.delete({ where: { id: existing.id } }),
      (prisma as any).flairSubmission.update({
        where: { id: existing.submissionId },
        data: { voteCount: { decrement: 1 } },
      }),
    ]);
    return reply.send({ ok: true, removed: true });
  });

  app.post("/flair-contests/:id/finalize", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const id = String((req as any).params?.id || "");
    const c = await (prisma as any).flairContest.findUnique({ where: { id } });
    if (!c) return reply.code(404).send({ ok: false, error: "not_found" });
    if (!(await canManageContest(u.id, c))) return reply.code(403).send({ ok: false, error: "forbidden" });
    if (c.status !== "VOTING") return reply.code(400).send({ ok: false, error: "not_in_voting" });
    if (new Date() < new Date(c.voteClosesAt)) return reply.code(400).send({ ok: false, error: "voting_still_open" });

    const result = await finalizeContest(id);
    if (!result.ok) return reply.code(400).send({ ok: false, error: result.error });
    return reply.send({ ok: true, contest: result.contest, rewardFlair: result.rewardFlair });
  });

  app.get("/flair-contests-img/:filename", async (req, reply) => {
    const fn = String((req as any).params?.filename || "").replace(/[^a-zA-Z0-9._-]/g, "");
    if (!fn) return reply.code(400).send("bad request");
    const fp = join(FLAIR_DIR, fn);
    if (!existsSync(fp)) return reply.code(404).send("not found");
    const data = readFileSync(fp);
    reply.header("Content-Type", "image/webp");
    reply.header("Cache-Control", "public, max-age=31536000, immutable");
    return reply.send(data);
  });

  async function finalizeContest(contestId: string): Promise<
    { ok: true; contest: any; rewardFlair: any } | { ok: false; error: string }
  > {
    const c = await (prisma as any).flairContest.findUnique({ where: { id: contestId } });
    if (!c) return { ok: false, error: "not_found" };
    if (c.status !== "VOTING") return { ok: false, error: "not_in_voting" };

    const submissions = await (prisma as any).flairSubmission.findMany({
      where: { contestId },
      orderBy: [{ voteCount: "desc" }, { createdAt: "asc" }],
    });

    if (submissions.length === 0) {
      const updated = await (prisma as any).flairContest.update({ where: { id: contestId }, data: { status: "CANCELED" } });
      return { ok: true, contest: updated, rewardFlair: null };
    }

    const winner = submissions[0];
    const winnerUser = await prisma.user.findUnique({ where: { id: winner.userId }, select: { id: true, name: true } });

    let rewardFlair: any = null;
    try {
      rewardFlair = await mintFlairItem(prisma as any, {
        slug: `contest-${contestId}-winner-${winner.userId}`,
        name: `${c.title} Winner`,
        description: `Winning ${String(c.kind).toLowerCase()} from "${c.title}". Designed by ${winnerUser?.name || "an artist"}.`,
        kind: c.kind as any,
        imageUrl: winner.imageUrl,
        rarity: "EPIC",
        source: "CONTEST",
        sourceRefId: contestId,
        createdById: winner.userId,
      });
      await grantFlairToUser(prisma as any, winner.userId, rewardFlair.id, `contest:${contestId}`);
    } catch (e: any) {
      console.error("[flair-contests] mint/grant failed:", e?.message || e);
    }

    const updated = await (prisma as any).flairContest.update({
      where: { id: contestId },
      data: {
        status: "COMPLETED",
        winnerSubmissionId: winner.id,
        rewardFlairId: rewardFlair?.id ?? null,
      },
    });

    if (createNotification && winnerUser) {
      try {
        await createNotification({
          userId: winnerUser.id,
          type: "flair_contest_won",
          title: `You won "${c.title}"`,
          body: rewardFlair ? "Your design was minted as flair and added to your inventory." : "Your design won the contest.",
          actionUrl: c.lobbyId ? `/lobby/${c.lobbyId}` : "/",
          meta: { contestId, submissionId: winner.id, flairItemId: rewardFlair?.id ?? null },
        });
      } catch {}
    }

    if (broadcastToLobby && c.lobbyId) {
      try { broadcastToLobby(c.lobbyId, { type: "flair-contest:completed", contestId, winnerUserId: winner.userId }); } catch {}
    }

    return { ok: true, contest: updated, rewardFlair };
  }

  (opts as any).__finalizeContest = finalizeContest;
}

export async function tickContestStates(prismaClient: any, opts: {
  mintFlairItem: typeof mintFlairItem;
  grantFlairToUser: typeof grantFlairToUser;
  createNotification?: (o: any) => Promise<any>;
  broadcastToLobby?: (lobbyId: string, event: any) => void;
}) {
  const now = new Date();
  try {
    const ready = await prismaClient.flairContest.findMany({
      where: { status: "SUBMISSIONS", submissionClosesAt: { lte: now } },
      take: 50,
    });
    for (const c of ready) {
      try {
        await prismaClient.flairContest.update({ where: { id: c.id }, data: { status: "VOTING" } });
        if (opts.broadcastToLobby && c.lobbyId) {
          try { opts.broadcastToLobby(c.lobbyId, { type: "flair-contest:voting-open", contestId: c.id }); } catch {}
        }
      } catch (e: any) {
        console.error("[flair-contests] tick submissions→voting failed:", c.id, e?.message || e);
      }
    }
  } catch (e: any) {
    console.error("[flair-contests] tick query (submissions) failed:", e?.message || e);
  }

  try {
    const ending = await prismaClient.flairContest.findMany({
      where: { status: "VOTING", voteClosesAt: { lte: now } },
      take: 20,
    });
    for (const c of ending) {
      try {
        const subs = await prismaClient.flairSubmission.findMany({
          where: { contestId: c.id },
          orderBy: [{ voteCount: "desc" }, { createdAt: "asc" }],
        });
        if (subs.length === 0) {
          await prismaClient.flairContest.update({ where: { id: c.id }, data: { status: "CANCELED" } });
          continue;
        }
        const winner = subs[0];
        const winnerUser = await prismaClient.user.findUnique({ where: { id: winner.userId }, select: { id: true, name: true } });
        let rewardFlair: any = null;
        try {
          rewardFlair = await opts.mintFlairItem(prismaClient, {
            slug: `contest-${c.id}-winner-${winner.userId}`,
            name: `${c.title} Winner`,
            description: `Winning ${String(c.kind).toLowerCase()} from "${c.title}". Designed by ${winnerUser?.name || "an artist"}.`,
            kind: c.kind,
            imageUrl: winner.imageUrl,
            rarity: "EPIC",
            source: "CONTEST",
            sourceRefId: c.id,
            createdById: winner.userId,
          });
          await opts.grantFlairToUser(prismaClient, winner.userId, rewardFlair.id, `contest:${c.id}`);
        } catch (e: any) {
          console.error("[flair-contests] tick mint/grant failed:", c.id, e?.message || e);
        }
        await prismaClient.flairContest.update({
          where: { id: c.id },
          data: {
            status: "COMPLETED",
            winnerSubmissionId: winner.id,
            rewardFlairId: rewardFlair?.id ?? null,
          },
        });
        if (opts.createNotification && winnerUser) {
          try {
            await opts.createNotification({
              userId: winnerUser.id,
              type: "flair_contest_won",
              title: `You won "${c.title}"`,
              body: rewardFlair ? "Your design was minted as flair and added to your inventory." : "Your design won the contest.",
              actionUrl: c.lobbyId ? `/lobby/${c.lobbyId}` : "/",
              meta: { contestId: c.id, submissionId: winner.id, flairItemId: rewardFlair?.id ?? null },
            });
          } catch {}
        }
        if (opts.broadcastToLobby && c.lobbyId) {
          try { opts.broadcastToLobby(c.lobbyId, { type: "flair-contest:completed", contestId: c.id, winnerUserId: winner.userId }); } catch {}
        }
      } catch (e: any) {
        console.error("[flair-contests] tick voting→completed failed:", c.id, e?.message || e);
      }
    }
  } catch (e: any) {
    console.error("[flair-contests] tick query (voting) failed:", e?.message || e);
  }
}

export function startFlairContestTick(prismaClient: any, opts: {
  mintFlairItem: typeof mintFlairItem;
  grantFlairToUser: typeof grantFlairToUser;
  createNotification?: (o: any) => Promise<any>;
  broadcastToLobby?: (lobbyId: string, event: any) => void;
  intervalMs?: number;
}): { stop: () => void } {
  const interval = opts.intervalMs || 60_000;
  const t = setInterval(() => {
    tickContestStates(prismaClient, opts).catch((e) => console.error("[flair-contests] tick error:", e?.message || e));
  }, interval);
  tickContestStates(prismaClient, opts).catch(() => {});
  return { stop: () => clearInterval(t) };
}

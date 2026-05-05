import type { FastifyInstance } from "fastify";
import { PrismaClient, Prisma } from "@prisma/client";
import { existsSync, mkdirSync, writeFileSync, readFileSync } from "fs";
import { join } from "path";
import sharp from "sharp";

type Opts = {
  authFromHeader: (h?: string) => { id: string; name?: string } | null;
  awardNotoriety?: (userId: string, action: string) => Promise<void>;
  broadcastToLobby?: (lobbyId: string, event: any) => void;
  canAccessStaff?: (role?: string | null) => boolean;
  getGlobalRole?: (userId: string) => Promise<string | null>;
};

const prisma = new PrismaClient();

const BUILDS_DIR = join(process.cwd(), "uploads", "builds");
if (!existsSync(BUILDS_DIR)) mkdirSync(BUILDS_DIR, { recursive: true });

const SITE_BASE = process.env.NEXT_PUBLIC_API_BASE || "https://api.weered.ca";

const MAX_IMAGES_PER_BUILD = 3;
const MAX_BUILDS_PER_USER = 30;
const TITLE_MAX = 80;
const DESC_MAX = 4000;
const COMMENT_MAX = 500;
const TAG_MAX = 8;
const PRIMARY_MAX_DIM = 1920;
const THUMB_MAX_W = 600;
const THUMB_MAX_H = 400;

const VALID_BIOMES = new Set(["PLAINS","COAST","CLIFFS","SWAMP","CAVE","MOUNTAIN","ISLAND"]);
const VALID_BUILD_TYPES = new Set(["SHIP","DOCK","FORTRESS","TAVERN","HIDEOUT","OUTPOST","BRIDGE","MISC"]);
const VALID_DIFFICULTIES = new Set(["BEGINNER","INTERMEDIATE","ADVANCED","MASTERWORK"]);
const VALID_SHIP_CLASSES = new Set(["SLOOP","BRIG","GALLEON","FRIGATE"]);
const VALID_REPORT_REASONS = new Set(["SPAM","NSFW","THEFT","OFFENSIVE","OTHER"]);

// Slug from title — lowercase, kebab-case, append short random suffix.
function slugify(title: string): string {
  const base = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "build";
  const suffix = Math.random().toString(36).slice(2, 7);
  return `${base}-${suffix}`;
}

// Per-user upload throttle (1 build / 5 min)
const uploadCooldown = new Map<string, number>();
const UPLOAD_COOLDOWN_MS = 5 * 60 * 1000;

// Decode dataURL → buffer.
function decodeDataUrl(dataUrl: string): { ext: string; buffer: Buffer } | null {
  const m = dataUrl.match(/^data:image\/(png|jpeg|jpg|webp|gif);base64,(.+)$/);
  if (!m) return null;
  const ext = m[1] === "jpeg" ? "jpg" : m[1];
  return { ext, buffer: Buffer.from(m[2], "base64") };
}

// Process a single uploaded image: rotate from EXIF, resize, WebP-convert,
// generate thumbnail, extract dominant color. Writes to disk and returns
// the metadata to embed in the build record.
async function processBuildImage(
  raw: Buffer,
  userId: string,
  buildId: string,
  index: number,
  opts: { watermark?: boolean; watermarkText?: string } = {}
): Promise<{ url: string; thumbUrl: string; width: number; height: number; dominantColor: string; order: number }> {
  const ts = Date.now();
  const baseName = `${userId}-${buildId}-${index}-${ts}`;
  const fullName = `${baseName}.webp`;
  const thumbName = `thumb-${baseName}.webp`;
  const fullPath = join(BUILDS_DIR, fullName);
  const thumbPath = join(BUILDS_DIR, thumbName);

  // Auto-rotate from EXIF, then resize + convert. Hard cap 1MB by re-encoding
  // at lower quality if needed (rare; q80 + WebP usually well under 1MB at 1920).
  let pipeline = sharp(raw, { failOn: "none" }).rotate();
  const meta = await pipeline.metadata();
  const inW = meta.width || PRIMARY_MAX_DIM;
  const inH = meta.height || PRIMARY_MAX_DIM;

  // Resize maintaining aspect, fit inside box
  pipeline = pipeline.resize({
    width: PRIMARY_MAX_DIM,
    height: PRIMARY_MAX_DIM,
    fit: "inside",
    withoutEnlargement: true,
  });

  // Optional watermark composite — small text bottom-right, low opacity
  if (opts.watermark && opts.watermarkText) {
    const text = opts.watermarkText.replace(/[<>]/g, "").slice(0, 40);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="40">
      <text x="595" y="28" text-anchor="end"
            font-family="ui-monospace, monospace" font-size="18" font-weight="700"
            fill="white" fill-opacity="0.5"
            stroke="black" stroke-opacity="0.5" stroke-width="0.5"
            paint-order="stroke">${text}</text>
    </svg>`;
    try {
      pipeline = pipeline.composite([{ input: Buffer.from(svg), gravity: "southeast" }]);
    } catch {}
  }

  let outputBuffer = await pipeline.webp({ quality: 80 }).toBuffer();
  // Hard cap 1MB — re-encode at lower quality if oversized
  if (outputBuffer.length > 1_000_000) {
    outputBuffer = await sharp(raw, { failOn: "none" })
      .rotate()
      .resize({ width: PRIMARY_MAX_DIM, height: PRIMARY_MAX_DIM, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 65 })
      .toBuffer();
  }
  writeFileSync(fullPath, outputBuffer);

  // Thumbnail (600x400 inside, q70)
  const thumbBuffer = await sharp(raw, { failOn: "none" })
    .rotate()
    .resize({ width: THUMB_MAX_W, height: THUMB_MAX_H, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 70 })
    .toBuffer();
  writeFileSync(thumbPath, thumbBuffer);

  // Get final width/height of the primary
  const finalMeta = await sharp(outputBuffer).metadata();
  const width = finalMeta.width || inW;
  const height = finalMeta.height || inH;

  // Extract dominant color via Sharp's stats() — average of all pixels
  // works well as a placeholder hint; getDominant() exists on the channels
  // stat so we use that.
  let dominantColor = "#1a1810";
  try {
    const stats = await sharp(outputBuffer).stats();
    const c = (stats as any).dominant;
    if (c && typeof c.r === "number") {
      const toHex = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
      dominantColor = `#${toHex(c.r)}${toHex(c.g)}${toHex(c.b)}`;
    }
  } catch {}

  return {
    url: `${SITE_BASE}/builds/${fullName}`,
    thumbUrl: `${SITE_BASE}/builds/${thumbName}`,
    width,
    height,
    dominantColor,
    order: index,
  };
}

// Sanitize a free-form tags array
function sanitizeTags(input: any): string[] {
  if (!Array.isArray(input)) return [];
  const out: string[] = [];
  for (const raw of input) {
    if (typeof raw !== "string") continue;
    const t = raw.trim().toLowerCase().replace(/[^a-z0-9 -]/g, "").slice(0, 24);
    if (t && !out.includes(t)) out.push(t);
    if (out.length >= TAG_MAX) break;
  }
  return out;
}

export default async function windroseBuildsRoutes(app: FastifyInstance, opts: Opts) {
  const { authFromHeader, awardNotoriety, broadcastToLobby, canAccessStaff, getGlobalRole } = opts;

  // ── POST /windrose/builds ─────────────────────────────────────────────
  app.post("/windrose/builds", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });

    // Throttle
    const now = Date.now();
    const last = uploadCooldown.get(u.id) || 0;
    if (now - last < UPLOAD_COOLDOWN_MS) {
      return reply.code(429).send({
        ok: false, error: "rate_limited",
        retryAfterMs: UPLOAD_COOLDOWN_MS - (now - last),
      });
    }

    const body: any = (req as any).body || {};
    const title = String(body.title || "").trim().slice(0, TITLE_MAX);
    if (title.length < 3) return reply.code(400).send({ ok: false, error: "title_too_short" });

    const description = String(body.description || "").slice(0, DESC_MAX);
    const biome = body.biome ? String(body.biome).toUpperCase() : null;
    if (biome && !VALID_BIOMES.has(biome)) return reply.code(400).send({ ok: false, error: "bad_biome" });
    const buildType = body.buildType ? String(body.buildType).toUpperCase() : null;
    if (buildType && !VALID_BUILD_TYPES.has(buildType)) return reply.code(400).send({ ok: false, error: "bad_build_type" });
    const difficulty = body.difficulty ? String(body.difficulty).toUpperCase() : null;
    if (difficulty && !VALID_DIFFICULTIES.has(difficulty)) return reply.code(400).send({ ok: false, error: "bad_difficulty" });
    let shipClass: string | null = body.shipClass ? String(body.shipClass).toUpperCase() : null;
    if (shipClass && (!VALID_SHIP_CLASSES.has(shipClass) || buildType !== "SHIP")) shipClass = null;
    const tags = sanitizeTags(body.tags);
    const partsCount = body.partsCount && Number.isFinite(Number(body.partsCount))
      ? Math.max(0, Math.min(100_000, Math.floor(Number(body.partsCount))))
      : null;
    const inGameLocation = body.inGameLocation ? String(body.inGameLocation).slice(0, 60) : null;
    const watermarked = !!body.watermarked;

    // Per-user count cap
    const existingCount = await (prisma as any).windroseBuild.count({ where: { authorId: u.id } });
    if (existingCount >= MAX_BUILDS_PER_USER) {
      return reply.code(403).send({ ok: false, error: "build_limit", message: `Build limit reached (${MAX_BUILDS_PER_USER}). Delete an old one first.` });
    }

    // Images
    const rawImages: any[] = Array.isArray(body.images) ? body.images.slice(0, MAX_IMAGES_PER_BUILD) : [];
    if (rawImages.length === 0) return reply.code(400).send({ ok: false, error: "no_images" });

    // Generate slug + temp build id for filenames
    const slug = slugify(title);

    // Process images first (before DB insert, so we can fail clean if Sharp errors)
    const processed: any[] = [];
    for (let i = 0; i < rawImages.length; i++) {
      const decoded = decodeDataUrl(String(rawImages[i] || ""));
      if (!decoded) return reply.code(400).send({ ok: false, error: "bad_image_format", index: i });
      if (decoded.buffer.length > 8 * 1024 * 1024) {
        return reply.code(400).send({ ok: false, error: "image_too_large", index: i, message: "Each upload must be under 8MB before compression." });
      }
      try {
        const meta = await processBuildImage(
          decoded.buffer, u.id, slug, i,
          watermarked ? { watermark: true, watermarkText: `${u.name || "weered"} · weered.ca` } : {}
        );
        processed.push(meta);
      } catch (e: any) {
        console.error("[windrose-builds] image processing failed:", e?.message || e);
        return reply.code(400).send({ ok: false, error: "image_processing_failed", index: i });
      }
    }

    const primary = processed[0];
    const created = await (prisma as any).windroseBuild.create({
      data: {
        slug,
        title,
        description: description || null,
        authorId: u.id,
        images: processed,
        thumbnailUrl: primary.thumbUrl,
        primaryColor: primary.dominantColor,
        biome,
        buildType,
        difficulty,
        shipClass,
        tags,
        partsCount,
        inGameLocation,
        watermarked,
      },
    });

    uploadCooldown.set(u.id, now);
    if (awardNotoriety) await awardNotoriety(u.id, "WINDROSE_BUILD_POSTED").catch(() => {});

    if (broadcastToLobby) {
      try {
        broadcastToLobby("windrose", {
          type: "windrose:build:posted",
          buildId: created.id,
          slug: created.slug,
          title: created.title,
          userId: u.id,
          userName: u.name,
          biome,
          buildType,
          ts: Date.now(),
        });
      } catch {}
    }

    return reply.send({ ok: true, build: created });
  });

  // ── GET /windrose/builds ──────────────────────────────────────────────
  app.get("/windrose/builds", async (req, reply) => {
    const q = (req as any).query || {};
    const biome = q.biome ? String(q.biome).toUpperCase() : null;
    const buildType = q.buildType ? String(q.buildType).toUpperCase() : null;
    const sort = String(q.sort || "top");
    const search = String(q.q || "").slice(0, 60).trim();
    const limit = Math.max(1, Math.min(60, parseInt(q.limit) || 24));
    const offset = Math.max(0, parseInt(q.offset) || 0);
    const authorId = q.authorId ? String(q.authorId) : null;

    const where: any = { moderationStatus: "APPROVED" };
    if (biome && VALID_BIOMES.has(biome)) where.biome = biome;
    if (buildType && VALID_BUILD_TYPES.has(buildType)) where.buildType = buildType;
    if (authorId) where.authorId = authorId;
    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }

    let orderBy: any = [{ upvotes: "desc" }, { createdAt: "desc" }];
    if (sort === "new") orderBy = [{ createdAt: "desc" }];
    else if (sort === "views") orderBy = [{ views: "desc" }, { createdAt: "desc" }];
    else if (sort === "rising") {
      // Approximate "rising": recent + upvotes per hour
      orderBy = [{ createdAt: "desc" }];
    }

    const [items, total] = await Promise.all([
      (prisma as any).windroseBuild.findMany({
        where,
        orderBy,
        skip: offset,
        take: limit,
        select: {
          id: true, slug: true, title: true, thumbnailUrl: true, primaryColor: true,
          biome: true, buildType: true, difficulty: true, shipClass: true,
          upvotes: true, downvotes: true, views: true, saveCount: true,
          featured: true, createdAt: true,
          author: { select: { id: true, name: true, avatar: true, avatarColor: true } },
          images: true,
        },
      }),
      (prisma as any).windroseBuild.count({ where }),
    ]);

    // Pull primary image dimensions for masonry layout
    const enriched = items.map((b: any) => {
      const imgs: any[] = Array.isArray(b.images) ? b.images : [];
      const primary = imgs[0] || null;
      return {
        ...b,
        images: undefined, // strip — not needed in list view
        primaryWidth: primary?.width || null,
        primaryHeight: primary?.height || null,
        imageCount: imgs.length,
      };
    });

    return reply.send({ ok: true, builds: enriched, total, limit, offset });
  });

  // ── GET /windrose/builds/featured ─────────────────────────────────────
  app.get("/windrose/builds/featured", async (_req, reply) => {
    const items = await (prisma as any).windroseBuild.findMany({
      where: { featured: true, moderationStatus: "APPROVED" },
      orderBy: [{ featuredAt: "desc" }, { upvotes: "desc" }],
      take: 8,
      select: {
        id: true, slug: true, title: true, thumbnailUrl: true, primaryColor: true,
        biome: true, buildType: true, upvotes: true,
        author: { select: { id: true, name: true, avatar: true, avatarColor: true } },
        images: true,
      },
    });
    const enriched = items.map((b: any) => {
      const imgs: any[] = Array.isArray(b.images) ? b.images : [];
      const primary = imgs[0] || null;
      return {
        ...b, images: undefined,
        primaryWidth: primary?.width || null,
        primaryHeight: primary?.height || null,
      };
    });
    return reply.send({ ok: true, builds: enriched });
  });

  // ── GET /windrose/builds/:slug ────────────────────────────────────────
  app.get("/windrose/builds/:slug", async (req, reply) => {
    const slug = String((req as any).params?.slug || "");
    if (!slug) return reply.code(400).send({ ok: false, error: "missing_slug" });
    const u = authFromHeader((req as any).headers?.authorization);

    const b = await (prisma as any).windroseBuild.findUnique({
      where: { slug },
      include: {
        author: { select: { id: true, name: true, avatar: true, avatarColor: true, steamId: true, tier: true, globalRole: true } },
      },
    });
    if (!b || (b.moderationStatus === "REMOVED" && !u)) return reply.code(404).send({ ok: false, error: "not_found" });

    // Increment views (fire and forget; don't double-count author's own views)
    if (!u || u.id !== b.authorId) {
      (prisma as any).windroseBuild.update({ where: { id: b.id }, data: { views: { increment: 1 } } }).catch(() => {});
    }

    // My vote + my save (if authed)
    let myVote = 0;
    let mySave = false;
    if (u) {
      const [v, s] = await Promise.all([
        (prisma as any).windroseBuildVote.findUnique({ where: { buildId_userId: { buildId: b.id, userId: u.id } } }),
        (prisma as any).windroseBuildSave.findUnique({ where: { buildId_userId: { buildId: b.id, userId: u.id } } }),
      ]);
      myVote = v?.value || 0;
      mySave = !!s;
    }

    return reply.send({ ok: true, build: b, myVote, mySave });
  });

  // ── GET /windrose/builds/:slug/comments ───────────────────────────────
  app.get("/windrose/builds/:slug/comments", async (req, reply) => {
    const slug = String((req as any).params?.slug || "");
    const b = await (prisma as any).windroseBuild.findUnique({ where: { slug }, select: { id: true } });
    if (!b) return reply.code(404).send({ ok: false, error: "not_found" });
    const items = await (prisma as any).windroseBuildComment.findMany({
      where: { buildId: b.id },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { user: { select: { id: true, name: true, avatar: true, avatarColor: true } } },
    });
    return reply.send({ ok: true, comments: items });
  });

  // ── POST /windrose/builds/:slug/comment ───────────────────────────────
  app.post("/windrose/builds/:slug/comment", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const slug = String((req as any).params?.slug || "");
    const b = await (prisma as any).windroseBuild.findUnique({ where: { slug }, select: { id: true, authorId: true } });
    if (!b) return reply.code(404).send({ ok: false, error: "not_found" });
    const body: any = (req as any).body || {};
    const text = String(body.body || "").trim().slice(0, COMMENT_MAX);
    if (text.length < 1) return reply.code(400).send({ ok: false, error: "empty" });
    const c = await (prisma as any).windroseBuildComment.create({
      data: { buildId: b.id, userId: u.id, body: text },
      include: { user: { select: { id: true, name: true, avatar: true, avatarColor: true } } },
    });
    return reply.send({ ok: true, comment: c });
  });

  // ── POST /windrose/builds/:slug/vote ──────────────────────────────────
  app.post("/windrose/builds/:slug/vote", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const slug = String((req as any).params?.slug || "");
    const b = await (prisma as any).windroseBuild.findUnique({ where: { slug }, select: { id: true, authorId: true } });
    if (!b) return reply.code(404).send({ ok: false, error: "not_found" });
    if (b.authorId === u.id) return reply.code(400).send({ ok: false, error: "self_vote" });

    const body: any = (req as any).body || {};
    const value = Math.max(-1, Math.min(1, parseInt(body.value)));
    if (value === 0) {
      await (prisma as any).windroseBuildVote.deleteMany({ where: { buildId: b.id, userId: u.id } });
    } else {
      await (prisma as any).windroseBuildVote.upsert({
        where: { buildId_userId: { buildId: b.id, userId: u.id } },
        update: { value },
        create: { buildId: b.id, userId: u.id, value },
      });
    }

    // Recompute denormalized counts
    const [up, down] = await Promise.all([
      (prisma as any).windroseBuildVote.count({ where: { buildId: b.id, value: 1 } }),
      (prisma as any).windroseBuildVote.count({ where: { buildId: b.id, value: -1 } }),
    ]);
    await (prisma as any).windroseBuild.update({
      where: { id: b.id },
      data: { upvotes: up, downvotes: down },
    });

    if (value === 1 && awardNotoriety) await awardNotoriety(b.authorId, "WINDROSE_BUILD_UPVOTED").catch(() => {});

    return reply.send({ ok: true, upvotes: up, downvotes: down, myVote: value });
  });

  // ── POST /windrose/builds/:slug/save ──────────────────────────────────
  app.post("/windrose/builds/:slug/save", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const slug = String((req as any).params?.slug || "");
    const b = await (prisma as any).windroseBuild.findUnique({ where: { slug }, select: { id: true } });
    if (!b) return reply.code(404).send({ ok: false, error: "not_found" });

    const existing = await (prisma as any).windroseBuildSave.findUnique({
      where: { buildId_userId: { buildId: b.id, userId: u.id } },
    });
    if (existing) {
      await (prisma as any).windroseBuildSave.delete({ where: { id: existing.id } });
    } else {
      await (prisma as any).windroseBuildSave.create({ data: { buildId: b.id, userId: u.id } });
    }
    const count = await (prisma as any).windroseBuildSave.count({ where: { buildId: b.id } });
    await (prisma as any).windroseBuild.update({ where: { id: b.id }, data: { saveCount: count } });
    return reply.send({ ok: true, saved: !existing, saveCount: count });
  });

  // ── POST /windrose/builds/:slug/feature ─ (staff only) ────────────────
  app.post("/windrose/builds/:slug/feature", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    if (!getGlobalRole || !canAccessStaff) return reply.code(500).send({ ok: false, error: "staff_check_unavailable" });
    const role = await getGlobalRole(u.id);
    if (!canAccessStaff(role)) return reply.code(403).send({ ok: false, error: "forbidden" });

    const slug = String((req as any).params?.slug || "");
    const body: any = (req as any).body || {};
    const featured = !!body.featured;
    const updated = await (prisma as any).windroseBuild.update({
      where: { slug },
      data: { featured, featuredAt: featured ? new Date() : null },
    });
    return reply.send({ ok: true, build: updated });
  });

  // ── POST /windrose/builds/:slug/report ────────────────────────────────
  app.post("/windrose/builds/:slug/report", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const slug = String((req as any).params?.slug || "");
    const b = await (prisma as any).windroseBuild.findUnique({ where: { slug }, select: { id: true } });
    if (!b) return reply.code(404).send({ ok: false, error: "not_found" });
    const body: any = (req as any).body || {};
    const reason = String(body.reason || "OTHER").toUpperCase();
    if (!VALID_REPORT_REASONS.has(reason)) return reply.code(400).send({ ok: false, error: "bad_reason" });
    const note = body.note ? String(body.note).slice(0, 500) : null;
    await (prisma as any).windroseBuildReport.create({
      data: { buildId: b.id, userId: u.id, reason, note },
    });
    return reply.send({ ok: true });
  });

  // ── DELETE /windrose/builds/:slug ─ (author or staff) ─────────────────
  app.delete("/windrose/builds/:slug", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const slug = String((req as any).params?.slug || "");
    const b = await (prisma as any).windroseBuild.findUnique({ where: { slug }, select: { id: true, authorId: true } });
    if (!b) return reply.code(404).send({ ok: false, error: "not_found" });
    let isStaff = false;
    if (getGlobalRole && canAccessStaff) {
      const role = await getGlobalRole(u.id);
      isStaff = canAccessStaff(role);
    }
    if (b.authorId !== u.id && !isStaff) return reply.code(403).send({ ok: false, error: "forbidden" });
    await (prisma as any).windroseBuild.delete({ where: { id: b.id } });
    return reply.send({ ok: true });
  });

  // ── GET /builds/:filename ─ static-style image serving ────────────────
  app.get("/builds/:filename", async (req, reply) => {
    const filename = String((req as any).params?.filename || "").replace(/[^a-zA-Z0-9._-]/g, "");
    if (!filename) return reply.code(400).send("bad request");
    const filepath = join(BUILDS_DIR, filename);
    if (!existsSync(filepath)) return reply.code(404).send("not found");
    const data = readFileSync(filepath);
    reply.header("Content-Type", "image/webp");
    reply.header("Cache-Control", "public, max-age=31536000, immutable");
    return reply.send(data);
  });
}

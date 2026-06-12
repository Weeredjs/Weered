import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";
import sharp from "sharp";
import * as fs from "fs";
import * as path from "path";
import crypto from "crypto";

// Chat image attachments. Gated by notoriety/tier, re-encoded to WebP
// (strips EXIF + kills polyglots), perceptual-hashed against a permanent
// block ledger, optionally ML-screened server-side, thumbnailed, and
// expiring for free-tier uploads.

const UP_DIR = path.join(process.cwd(), "uploads", "chat");
const MAX_BYTES = 8 * 1024 * 1024;
const MAX_DIM = 2048;
const THUMB_DIM = 640;
const MIN_NOTORIETY = Number(process.env.MEDIA_MIN_NOTORIETY || 100);
const TRUST_NOTORIETY = Number(process.env.MEDIA_TRUST_NOTORIETY || 1000);
const FREE_TTL_DAYS = Number(process.env.MEDIA_FREE_TTL_DAYS || 7);
const PAID_TIERS = new Set(["INDICTED", "FELON", "KINGPIN"]);
const AUTO_HIDE_REPORTS = 3;

function ensureDir() {
  try { fs.mkdirSync(UP_DIR, { recursive: true }); } catch {}
}

// 64-bit dHash from a 9x8 grayscale render — survives re-encodes/resizes.
async function dHash(buf: Buffer): Promise<string> {
  const raw = await sharp(buf).grayscale().resize(9, 8, { fit: "fill" }).raw().toBuffer();
  let bits = "";
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      bits += raw[y * 9 + x] < raw[y * 9 + x + 1] ? "1" : "0";
    }
  }
  return BigInt("0b" + bits).toString(16).padStart(16, "0");
}

function hamming(a: string, b: string): number {
  if (a.length !== 16 || b.length !== 16) return 64;
  let x = BigInt("0x" + a) ^ BigInt("0x" + b);
  let n = 0;
  while (x) { n += Number(x & 1n); x >>= 1n; }
  return n;
}

// Optional server-side ML screen (NSFW_SCREEN=1 + model on disk). The
// client screens first; this catches direct-API uploads. Fails open with
// a log line — the hash ledger and gates still hold.
let _nsfw: any = null;
async function screenImage(webp: Buffer): Promise<{ ok: boolean; label?: string }> {
  if (process.env.NSFW_SCREEN !== "1") return { ok: true };
  try {
    if (!_nsfw) {
      const tf = await import("@tensorflow/tfjs");
      const nsfwjs = await import("nsfwjs");
      _nsfw = { tf, model: await (nsfwjs as any).load() }; // nsfwjs 4.x bundles the model
    }
    const { tf, model } = _nsfw;
    const raw = await sharp(webp).resize(224, 224, { fit: "fill" }).removeAlpha().raw().toBuffer();
    const input = tf.tensor3d(new Uint8Array(raw), [224, 224, 3], "int32");
    const preds: { className: string; probability: number }[] = await model.classify(input);
    input.dispose();
    const bad = preds.find(p => (p.className === "Porn" || p.className === "Hentai") && p.probability > 0.7);
    if (bad) return { ok: false, label: bad.className };
    return { ok: true };
  } catch (e: any) {
    console.warn("[media] screen unavailable:", e?.message || e);
    return { ok: true };
  }
}

type Opts = {
  authFromHeader: (h?: string) => { id: string } | null;
  isStaff: (role?: string) => boolean;
  createNotification?: (opts: any) => Promise<any>;
};

export default async function chatMediaRoutes(app: FastifyInstance, opts: Opts) {
  const { authFromHeader, isStaff, createNotification } = opts;
  ensureDir();

  // Eligibility — the attach button asks this to render lock state.
  app.get("/chat/media/eligibility", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false });
    const user: any = await prisma.user.findUnique({
      where: { id: u.id },
      select: { notoriety: true, tier: true, mediaBannedUntil: true } as any,
    });
    if (!user) return reply.code(401).send({ ok: false });
    const banned = user.mediaBannedUntil && new Date(user.mediaBannedUntil).getTime() > Date.now();
    const paid = PAID_TIERS.has(String(user.tier));
    const allowed = !banned && (paid || user.notoriety >= MIN_NOTORIETY);
    return reply.send({
      ok: true, allowed,
      banned: !!banned,
      bannedUntil: user.mediaBannedUntil || null,
      notoriety: user.notoriety,
      required: MIN_NOTORIETY,
      trusted: paid || user.notoriety >= TRUST_NOTORIETY,
      permanent: paid,
    });
  });

  // Upload — base64 data-URL body (same convention as avatar uploads).
  app.post("/chat/upload", { bodyLimit: 16 * 1024 * 1024 }, async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const user: any = await prisma.user.findUnique({
      where: { id: u.id },
      select: { notoriety: true, tier: true, mediaBannedUntil: true } as any,
    });
    if (!user) return reply.code(401).send({ ok: false, error: "unauthorized" });
    if (user.mediaBannedUntil && new Date(user.mediaBannedUntil).getTime() > Date.now()) {
      return reply.code(403).send({ ok: false, error: "media_banned", until: user.mediaBannedUntil });
    }
    const paid = PAID_TIERS.has(String(user.tier));
    if (!paid && user.notoriety < MIN_NOTORIETY) {
      return reply.code(403).send({ ok: false, error: "locked", notoriety: user.notoriety, required: MIN_NOTORIETY });
    }

    const body: any = (req as any).body || {};
    const dataUrl = String(body.image || "");
    const roomId = String(body.roomId || "").slice(0, 120);
    const m = dataUrl.match(/^data:image\/(png|jpeg|jpg|webp|gif|avif);base64,(.+)$/);
    if (!m) return reply.code(400).send({ ok: false, error: "bad_image" });
    let buf: Buffer;
    try { buf = Buffer.from(m[2], "base64"); } catch { return reply.code(400).send({ ok: false, error: "bad_image" }); }
    if (buf.length > MAX_BYTES) return reply.code(413).send({ ok: false, error: "too_large", maxBytes: MAX_BYTES });

    let full: Buffer, thumb: Buffer, meta: sharp.Metadata;
    try {
      const img = sharp(buf, { animated: false }).rotate(); // bakes EXIF orientation, then EXIF is dropped by re-encode
      meta = await img.metadata();
      full = await img.resize(MAX_DIM, MAX_DIM, { fit: "inside", withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
      thumb = await sharp(buf).rotate().resize(THUMB_DIM, THUMB_DIM, { fit: "inside", withoutEnlargement: true }).webp({ quality: 74 }).toBuffer();
    } catch {
      return reply.code(400).send({ ok: false, error: "bad_image" });
    }

    const phash = await dHash(full).catch(() => "");
    if (phash) {
      const blocked = await (prisma as any).blockedImageHash.findMany({ select: { phash: true } });
      const hit = blocked.find((b: any) => hamming(b.phash, phash) <= 4);
      if (hit) {
        await (prisma as any).user.update({
          where: { id: u.id },
          data: { mediaBannedUntil: new Date(Date.now() + 90 * 86400_000) } as any,
        }).catch(() => {});
        console.warn(`[media] blocked-hash reupload by ${u.id} (${phash})`);
        return reply.code(403).send({ ok: false, error: "blocked_content" });
      }
    }

    const screen = await screenImage(full);
    if (!screen.ok) return reply.code(403).send({ ok: false, error: "failed_screen" });

    const id = crypto.randomBytes(10).toString("hex");
    const fname = `${id}.webp`, tname = `${id}.t.webp`;
    ensureDir();
    fs.writeFileSync(path.join(UP_DIR, fname), full);
    fs.writeFileSync(path.join(UP_DIR, tname), thumb);

    const outMeta = await sharp(full).metadata();
    const trusted = paid || user.notoriety >= TRUST_NOTORIETY;
    const expiresAt = paid ? null : new Date(Date.now() + FREE_TTL_DAYS * 86400_000);
    const att = await (prisma as any).chatAttachment.create({
      data: {
        uploaderId: u.id, roomId,
        url: `/chat/media/${fname}`, thumbUrl: `/chat/media/${tname}`,
        width: outMeta.width || 0, height: outMeta.height || 0,
        bytes: full.length, phash, trusted, expiresAt,
      },
    });
    return reply.send({
      ok: true,
      attachment: { id: att.id, url: att.url, thumbUrl: att.thumbUrl, w: att.width, h: att.height, trusted, expiresAt },
    });
  });

  // Serving — webp only, no sniffing, immutable (filenames are random ids).
  app.get("/chat/media/:file", async (req, reply) => {
    const file = String((req as any).params?.file || "");
    if (!/^[a-f0-9]{20}(\.t)?\.webp$/.test(file)) return reply.code(404).send();
    const fp = path.join(UP_DIR, file);
    if (!fs.existsSync(fp)) return reply.code(404).send();
    reply.header("Content-Type", "image/webp");
    reply.header("X-Content-Type-Options", "nosniff");
    reply.header("Cache-Control", "public, max-age=31536000, immutable");
    reply.header("Content-Disposition", "inline");
    return reply.send(fs.createReadStream(fp));
  });

  // Report — auto-hides at threshold pending staff review.
  app.post("/chat/attachments/:id/report", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false });
    const id = String((req as any).params?.id || "");
    const att = await (prisma as any).chatAttachment.findUnique({ where: { id } });
    if (!att || att.status === "REMOVED") return reply.code(404).send({ ok: false });
    const updated = await (prisma as any).chatAttachment.update({
      where: { id },
      data: { reports: { increment: 1 }, ...(att.reports + 1 >= AUTO_HIDE_REPORTS && att.status === "ACTIVE" ? { status: "HIDDEN" } : {}) },
    });
    return reply.send({ ok: true, status: updated.status });
  });

  // Staff queue + removal. Removal: files deleted, hash permanently
  // blocked, uploader notoriety slashed + media-banned 30d.
  app.get("/staff/attachments", async (req, reply) => {
    const u: any = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false });
    const me: any = await prisma.user.findUnique({ where: { id: u.id }, select: { globalRole: true } });
    if (!isStaff(me?.globalRole)) return reply.code(403).send({ ok: false });
    const rows = await (prisma as any).chatAttachment.findMany({
      where: { status: { in: ["HIDDEN", "ACTIVE"] }, reports: { gt: 0 } },
      orderBy: [{ status: "desc" }, { reports: "desc" }],
      take: 50,
    });
    return reply.send({ ok: true, attachments: rows });
  });

  app.post("/staff/attachments/:id/remove", async (req, reply) => {
    const u: any = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false });
    const me: any = await prisma.user.findUnique({ where: { id: u.id }, select: { globalRole: true } });
    if (!isStaff(me?.globalRole)) return reply.code(403).send({ ok: false });
    const id = String((req as any).params?.id || "");
    const att = await (prisma as any).chatAttachment.findUnique({ where: { id } });
    if (!att) return reply.code(404).send({ ok: false });

    for (const rel of [att.url, att.thumbUrl]) {
      const f = String(rel || "").split("/").pop() || "";
      if (/^[a-f0-9]{20}(\.t)?\.webp$/.test(f)) { try { fs.unlinkSync(path.join(UP_DIR, f)); } catch {} }
    }
    await (prisma as any).chatAttachment.update({ where: { id }, data: { status: "REMOVED" } });
    if (att.phash) {
      await (prisma as any).blockedImageHash.upsert({
        where: { phash: att.phash },
        create: { phash: att.phash, reason: `staff-removed ${id}` },
        update: {},
      }).catch(() => {});
    }
    const SLASH = 500;
    await (prisma as any).user.update({
      where: { id: att.uploaderId },
      data: { notoriety: { decrement: SLASH }, mediaBannedUntil: new Date(Date.now() + 30 * 86400_000) } as any,
    }).catch(() => {});
    await (prisma as any).notorietyEvent.create({
      data: { userId: att.uploaderId, action: "MEDIA_VIOLATION", points: -SLASH },
    }).catch(() => {});
    if (createNotification) {
      await createNotification({
        userId: att.uploaderId, type: "SYSTEM",
        title: "Upload removed",
        body: `Your upload broke house rules. −${SLASH} notoriety. Media privileges revoked for 30 days.`,
      }).catch(() => {});
    }
    return reply.send({ ok: true });
  });

  // Expiry sweep — free-tier images age out; DB rows + hashes are kept.
  const sweep = async () => {
    try {
      const stale = await (prisma as any).chatAttachment.findMany({
        where: { status: { in: ["ACTIVE", "HIDDEN"] }, expiresAt: { not: null, lt: new Date() } },
        take: 500,
      });
      for (const att of stale) {
        for (const rel of [att.url, att.thumbUrl]) {
          const f = String(rel || "").split("/").pop() || "";
          if (/^[a-f0-9]{20}(\.t)?\.webp$/.test(f)) { try { fs.unlinkSync(path.join(UP_DIR, f)); } catch {} }
        }
        await (prisma as any).chatAttachment.update({ where: { id: att.id }, data: { status: "EXPIRED" } }).catch(() => {});
      }
      if (stale.length) console.log(`[media] expired ${stale.length} attachments`);
    } catch (e: any) { console.warn("[media] sweep error:", e?.message || e); }
  };
  setTimeout(sweep, 60_000);
  setInterval(sweep, 12 * 3600_000);
}

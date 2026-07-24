import sharp from "sharp";
import { prisma } from "./prisma";
import { log, swallow } from "./logger";

// Shared image moderation — the same pipeline chat attachments use, so
// avatars and banners get identical treatment: a sanitizing re-encode
// (strips EXIF, kills polyglots), a perceptual-hash ban ledger, and an
// optional server-side NSFW screen. These primitives live here as the
// single source of truth; chatMedia and uploads both import them.

// 64-bit dHash from a 9x8 grayscale render — survives re-encodes/resizes.
export async function dHash(buf: Buffer): Promise<string> {
  const raw = await sharp(buf).grayscale().resize(9, 8, { fit: "fill" }).raw().toBuffer();
  let bits = "";
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      bits += raw[y * 9 + x] < raw[y * 9 + x + 1] ? "1" : "0";
    }
  }
  return BigInt("0b" + bits)
    .toString(16)
    .padStart(16, "0");
}

export function hamming(a: string, b: string): number {
  if (a.length !== 16 || b.length !== 16) return 64;
  let x = BigInt("0x" + a) ^ BigInt("0x" + b);
  let n = 0;
  while (x) {
    n += Number(x & 1n);
    x >>= 1n;
  }
  return n;
}

// Optional server-side ML screen (NSFW_SCREEN=1 + model on disk). The client
// screens first; this catches direct-API uploads that bypass it. Fails open
// with a log line — the hash ledger and gates still hold.
let _nsfw: any = null;
export async function screenImage(webp: Buffer): Promise<{ ok: boolean; label?: string }> {
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
    const bad = preds.find(
      (p) => (p.className === "Porn" || p.className === "Hentai") && p.probability > 0.7,
    );
    if (bad) return { ok: false, label: bad.className };
    return { ok: true };
  } catch (e: any) {
    log.warn("[img] screen unavailable:", e?.message || e);
    return { ok: true };
  }
}

// Is this perceptual hash within Hamming-4 of anything on the permanent ban ledger?
export async function isHashBlocked(phash: string): Promise<boolean> {
  if (!phash) return false;
  const blocked = await prisma.blockedImageHash.findMany({ select: { phash: true } });
  return blocked.some((b: any) => hamming(b.phash, phash) <= 4);
}

export type ProfileImageResult =
  | { ok: true; webp: Buffer; phash: string; width: number; height: number }
  | { ok: false; code: number; error: string; message: string };

// Full moderation for a profile image (avatar/banner). Re-encodes to a
// sanitized WebP, hash-bans (media-banning the uploader on a ledger hit,
// matching chat behavior), then NSFW-screens. Returns the sanitized buffer
// to store — callers must never persist the raw upload.
export async function moderateProfileImage(
  buf: Buffer,
  opts: { userId: string; maxDim?: number; square?: boolean; quality?: number },
): Promise<ProfileImageResult> {
  const maxDim = opts.maxDim ?? 512;
  let webp: Buffer;
  try {
    const img = sharp(buf, { animated: false }).rotate(); // bake EXIF orientation, then drop EXIF on re-encode
    const resized = opts.square
      ? img.resize(maxDim, maxDim, { fit: "cover", position: "attention", withoutEnlargement: true })
      : img.resize(maxDim, maxDim, { fit: "inside", withoutEnlargement: true });
    webp = await resized.webp({ quality: opts.quality ?? 82 }).toBuffer();
  } catch {
    return { ok: false, code: 400, error: "bad_image", message: "That image could not be processed." };
  }

  const phash = await dHash(webp).catch(() => "");
  if (phash && (await isHashBlocked(phash))) {
    await prisma.user
      .update({
        where: { id: opts.userId },
        data: { mediaBannedUntil: new Date(Date.now() + 90 * 86400_000) } as any,
      })
      .catch(swallow);
    log.warn(`[img] blocked-hash reupload by ${opts.userId} (${phash})`);
    return { ok: false, code: 403, error: "blocked_content", message: "That image can't be used." };
  }

  const screen = await screenImage(webp);
  if (!screen.ok) {
    return { ok: false, code: 403, error: "failed_screen", message: "That image can't be used." };
  }

  const meta = await sharp(webp).metadata();
  return { ok: true, webp, phash, width: meta.width || 0, height: meta.height || 0 };
}

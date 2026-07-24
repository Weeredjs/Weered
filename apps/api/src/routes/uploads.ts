import { log, swallow } from "../lib/logger";
import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";
import { join } from "path";
import { existsSync, mkdirSync, writeFileSync, unlinkSync } from "fs";
import { moderateProfileImage } from "../lib/imageModeration";

type Opts = {
  authFromHeader: (h?: string) => { id: string; name?: string } | null;
  awardNotoriety: (userId: string, action: string) => Promise<number | null>;
  canAccessStaff: (role: any) => boolean;
  onAvatarChanged?: (userId: string, avatarUrl: string) => void;
};

export default async function uploadsRoutes(app: FastifyInstance, opts: Opts) {
  const { authFromHeader, awardNotoriety, canAccessStaff, onAvatarChanged } = opts;
  const AVATAR_DIR = join(process.cwd(), "uploads", "avatars");
  if (!existsSync(AVATAR_DIR)) mkdirSync(AVATAR_DIR, { recursive: true });
  const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
  const SITE_BASE = process.env.NEXT_PUBLIC_API_BASE || "https://api.weered.ca";

  app.post("/profile/avatar/upload", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ error: "unauthorized" });

    // Custom avatars are free for every user, from signup. The only gate is a
    // standing media-ban (earned by a prior violation). Safety is handled by
    // moderation below, not by tier.
    const dbUser: any = await prisma.user.findUnique({
      where: { id: u.id },
      select: { avatar: true, mediaBannedUntil: true } as any,
    });
    if (dbUser?.mediaBannedUntil && new Date(dbUser.mediaBannedUntil).getTime() > Date.now()) {
      return reply
        .code(403)
        .send({ error: "media_banned", message: "Your upload privileges are suspended." });
    }

    const body: any = (req as any).body || {};
    const dataUrl = body.image;
    if (!dataUrl || typeof dataUrl !== "string") {
      return reply.code(400).send({ error: "missing_image" });
    }

    const match = dataUrl.match(/^data:image\/(png|jpeg|jpg|webp|gif);base64,(.+)$/);
    if (!match) {
      return reply
        .code(400)
        .send({ error: "invalid_format", message: "Image must be PNG, JPEG, WebP, or GIF." });
    }

    const buffer = Buffer.from(match[2], "base64");
    if (buffer.length > AVATAR_MAX_BYTES) {
      return reply.code(400).send({ error: "too_large", message: "Image must be under 2MB." });
    }

    // Sanitizing re-encode + hash-ban + NSFW screen. We store mod.webp, never
    // the raw upload.
    const mod = await moderateProfileImage(buffer, { userId: u.id, square: true, maxDim: 512 });
    if (!mod.ok) {
      return reply.code(mod.code).send({ error: mod.error, message: mod.message });
    }

    try {
      const filename = `${u.id}-${Date.now()}.webp`;
      writeFileSync(join(AVATAR_DIR, filename), mod.webp);

      // Keep one uploaded avatar per user: best-effort delete the previous one.
      const prev = String(dbUser?.avatar || "");
      const prevWasCustom = prev.startsWith(`${SITE_BASE}/avatars/`);
      if (prevWasCustom) {
        const prevName = prev.split("/").pop() || "";
        if (prevName && prevName !== filename && /^[a-zA-Z0-9._-]+\.(webp|png|jpe?g|gif)$/.test(prevName)) {
          try {
            unlinkSync(join(AVATAR_DIR, prevName));
          } catch (e) {
            swallow(e);
          }
        }
      }

      const avatarUrl = `${SITE_BASE}/avatars/${filename}`;
      await prisma.user.update({ where: { id: u.id }, data: { avatar: avatarUrl } });

      // Award only on the first switch to a custom avatar — no farming by re-upload.
      if (!prevWasCustom) awardNotoriety(u.id, "AVATAR_SET").catch(swallow);

      onAvatarChanged?.(u.id, avatarUrl);
      return reply.send({ ok: true, avatar: avatarUrl });
    } catch (e) {
      log.error("[avatar upload]", e);
      return reply.code(500).send({ error: "upload_failed" });
    }
  });

  app.get("/avatars/:filename", async (req, reply) => {
    const filename = String((req as any).params?.filename || "").replaceAll(/[^a-zA-Z0-9._-]/g, "");
    if (!filename) return reply.code(400).send("bad request");
    const filepath = join(AVATAR_DIR, filename);
    if (!existsSync(filepath)) return reply.code(404).send("not found");

    const ext = filename.split(".").pop()?.toLowerCase();
    const mime =
      ext === "png"
        ? "image/png"
        : ext === "webp"
          ? "image/webp"
          : ext === "gif"
            ? "image/gif"
            : "image/jpeg";

    const { readFileSync } = await import("fs");
    const data = readFileSync(filepath);
    reply.header("Content-Type", mime);
    reply.header("Cache-Control", "public, max-age=31536000, immutable");
    return reply.send(data);
  });

  const BANNER_DIR = join(process.cwd(), "uploads", "banners");
  if (!existsSync(BANNER_DIR)) mkdirSync(BANNER_DIR, { recursive: true });
  const BANNER_MAX_BYTES = 4 * 1024 * 1024;

  app.post("/profile/banner/upload", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ error: "unauthorized" });

    // Banner stays a tier perk (Indicted+), but now gets the same moderation
    // as avatars — it was previously an unmoderated hole.
    const dbUser: any = await prisma.user.findUnique({
      where: { id: u.id },
      select: { tier: true, bannerUrl: true, mediaBannedUntil: true } as any,
    });
    const tier = String(dbUser?.tier ?? "INNOCENT").toUpperCase();
    if (tier === "INNOCENT") {
      return reply.code(403).send({
        error: "tier_required",
        message: "Custom banner uploads require Indicted tier or higher.",
      });
    }
    if (dbUser?.mediaBannedUntil && new Date(dbUser.mediaBannedUntil).getTime() > Date.now()) {
      return reply
        .code(403)
        .send({ error: "media_banned", message: "Your upload privileges are suspended." });
    }

    const body: any = (req as any).body || {};
    const dataUrl = body.image;
    if (!dataUrl || typeof dataUrl !== "string")
      return reply.code(400).send({ error: "missing_image" });

    const match = dataUrl.match(/^data:image\/(png|jpeg|jpg|webp|gif);base64,(.+)$/);
    if (!match)
      return reply
        .code(400)
        .send({ error: "invalid_format", message: "Image must be PNG, JPEG, WebP, or GIF." });

    const buffer = Buffer.from(match[2], "base64");
    if (buffer.length > BANNER_MAX_BYTES)
      return reply.code(400).send({ error: "too_large", message: "Image must be under 4MB." });

    const mod = await moderateProfileImage(buffer, { userId: u.id, square: false, maxDim: 1600 });
    if (!mod.ok) return reply.code(mod.code).send({ error: mod.error, message: mod.message });

    try {
      const filename = `${u.id}-${Date.now()}.webp`;
      writeFileSync(join(BANNER_DIR, filename), mod.webp);

      const prev = String(dbUser?.bannerUrl || "");
      if (prev.startsWith(`${SITE_BASE}/banners/`)) {
        const prevName = prev.split("/").pop() || "";
        if (prevName && prevName !== filename && /^[a-zA-Z0-9._-]+\.(webp|png|jpe?g|gif)$/.test(prevName)) {
          try {
            unlinkSync(join(BANNER_DIR, prevName));
          } catch (e) {
            swallow(e);
          }
        }
      }

      const bannerUrl = `${SITE_BASE}/banners/${filename}`;
      await prisma.user.update({ where: { id: u.id }, data: { bannerUrl } as any });
      return reply.send({ ok: true, bannerUrl });
    } catch (e) {
      log.error("[banner upload]", e);
      return reply.code(500).send({ error: "upload_failed" });
    }
  });

  app.post("/lobbies/upload-image", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ error: "unauthorized" });
    const dbUser = await prisma.user.findUnique({
      where: { id: u.id },
      select: { tier: true, globalRole: true },
    });
    const tier = String(dbUser?.tier ?? "INNOCENT").toUpperCase();
    const isStaff = canAccessStaff(dbUser?.globalRole as any);
    if (tier === "INNOCENT" && !isStaff) {
      return reply.code(403).send({
        error: "tier_required",
        message: "Lobby branding requires Indicted tier or higher.",
      });
    }
    const body: any = (req as any).body || {};
    const dataUrl = body.image;
    if (!dataUrl || typeof dataUrl !== "string")
      return reply.code(400).send({ error: "missing_image" });
    const match = dataUrl.match(/^data:image\/(png|jpeg|jpg|webp|gif|svg\+xml);base64,(.+)$/);
    if (!match)
      return reply
        .code(400)
        .send({ error: "invalid_format", message: "Image must be PNG, JPEG, WebP, GIF, or SVG." });
    const ext =
      match[1] === "jpeg" || match[1] === "jpg" ? "jpg" : match[1] === "svg+xml" ? "svg" : match[1];
    const buffer = Buffer.from(match[2], "base64");
    if (buffer.length > BANNER_MAX_BYTES)
      return reply.code(400).send({ error: "too_large", message: "Image must be under 4MB." });
    try {
      const kind =
        String(body.kind || "img")
          .replaceAll(/[^a-z]/g, "")
          .slice(0, 8) || "img";
      const filename = `lobby-${kind}-${u.id}-${Date.now()}.${ext}`;
      const filepath = join(BANNER_DIR, filename);
      writeFileSync(filepath, buffer);
      const url = `${SITE_BASE}/banners/${filename}`;
      return reply.send({ ok: true, url });
    } catch (e) {
      log.error("[lobby image upload]", e);
      return reply.code(500).send({ error: "upload_failed" });
    }
  });

  app.get("/banners/:filename", async (req, reply) => {
    const filename = String((req as any).params?.filename || "").replaceAll(/[^a-zA-Z0-9._-]/g, "");
    if (!filename) return reply.code(400).send("bad request");
    const filepath = join(BANNER_DIR, filename);
    if (!existsSync(filepath)) return reply.code(404).send("not found");
    const ext = filename.split(".").pop()?.toLowerCase();
    const mime =
      ext === "png"
        ? "image/png"
        : ext === "webp"
          ? "image/webp"
          : ext === "gif"
            ? "image/gif"
            : "image/jpeg";
    const { readFileSync } = await import("fs");
    const data = readFileSync(filepath);
    reply.header("Content-Type", mime);
    reply.header("Cache-Control", "public, max-age=31536000, immutable");
    return reply.send(data);
  });
}

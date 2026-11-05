import { log, swallow } from "../lib/logger";
import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";
import { ownsUploadName } from "../lib/ownImages";
import { join } from "path";
import { existsSync, mkdirSync, writeFileSync, unlinkSync } from "fs";
import { moderateProfileImage } from "../lib/imageModeration";
import { canFloatPicture } from "../lib/tiers";

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

  // Write a moderated WebP, best-effort delete the user's previous file of the
  // same kind (one per user), and return its public URL. Shared by the avatar
  // and banner routes.
  const persistImage = (
    dir: string,
    subpath: string,
    prevUrl: string,
    webp: Buffer,
    uid: string,
  ): string => {
    const filename = `${uid}-${Date.now()}.webp`;
    writeFileSync(join(dir, filename), webp);
    // Only ever their own previous file (lib/ownImages.ts): the old address
    // used to be whatever they'd saved, so it could name someone else's.
    if (prevUrl.startsWith(`${SITE_BASE}/${subpath}/`)) {
      const prevName = prevUrl.split("/").pop() || "";
      if (prevName && prevName !== filename && ownsUploadName(prevName, uid)) {
        try {
          unlinkSync(join(dir, prevName));
        } catch (e) {
          swallow(e);
        }
      }
    }
    return `${SITE_BASE}/${subpath}/${filename}`;
  };

  app.post(
    "/profile/avatar/upload",
    { bodyLimit: 8 * 1024 * 1024, config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (req, reply) => {
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
        const prevWasCustom = String(dbUser?.avatar || "").startsWith(`${SITE_BASE}/avatars/`);
        const avatarUrl = persistImage(
          AVATAR_DIR,
          "avatars",
          String(dbUser?.avatar || ""),
          mod.webp,
          u.id,
        );
        await prisma.user.update({ where: { id: u.id }, data: { avatar: avatarUrl } });

        // Award only on the first switch to a custom avatar — no farming by re-upload.
        if (!prevWasCustom) awardNotoriety(u.id, "AVATAR_SET").catch(swallow);

        onAvatarChanged?.(u.id, avatarUrl);
        return reply.send({ ok: true, avatar: avatarUrl });
      } catch (e) {
        log.error("[avatar upload]", e);
        return reply.code(500).send({ error: "upload_failed" });
      }
    },
  );

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
    // ?format=png: a 256px PNG copy, made once and kept beside the original, for
    // link previews (web app/rap/[name]/opengraph-image.tsx): their renderer
    // reads PNG and JPEG, not the webp that uploads are kept in.
    if (String((req as any).query?.format || "") === "png" && ext !== "png") {
      const pngPath = `${filepath}.png`;
      try {
        if (!existsSync(pngPath)) {
          const sharp = (await import("sharp")).default;
          await sharp(filepath).resize(256, 256, { fit: "cover" }).png().toFile(pngPath);
        }
        reply.header("Content-Type", "image/png");
        reply.header("Cache-Control", "public, max-age=31536000, immutable");
        return reply.send(readFileSync(pngPath));
      } catch (e) {
        swallow(e);
      }
    }
    const data = readFileSync(filepath);
    reply.header("Content-Type", mime);
    reply.header("Cache-Control", "public, max-age=31536000, immutable");
    return reply.send(data);
  });

  const BANNER_DIR = join(process.cwd(), "uploads", "banners");
  if (!existsSync(BANNER_DIR)) mkdirSync(BANNER_DIR, { recursive: true });
  const BANNER_MAX_BYTES = 4 * 1024 * 1024;

  app.post(
    "/profile/banner/upload",
    { bodyLimit: 8 * 1024 * 1024, config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (req, reply) => {
      const u = authFromHeader((req as any).headers?.authorization);
      if (!u) return reply.code(401).send({ error: "unauthorized" });

      // A profile banner is account flair, free for everyone since 2026-11-02
      // (it was Indicted+). It gets the same moderation as avatars.
      const dbUser: any = await prisma.user.findUnique({
        where: { id: u.id },
        select: { bannerUrl: true, mediaBannedUntil: true } as any,
      });
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
        const bannerUrl = persistImage(
          BANNER_DIR,
          "banners",
          String(dbUser?.bannerUrl || ""),
          mod.webp,
          u.id,
        );
        await prisma.user.update({ where: { id: u.id }, data: { bannerUrl } as any });
        return reply.send({ ok: true, bannerUrl });
      } catch (e) {
        log.error("[banner upload]", e);
        return reply.code(500).send({ error: "upload_failed" });
      }
    },
  );

  // A crew's logo and banner, uploaded by its leader (James 2026-11-05: "I can
  // only change the colors"). The profile banner's pipeline and bans; the files
  // are named for the crew (lib/ownImages.ts crewImageOk), so a new one
  // replaces the old file.
  app.post(
    "/crews/:crewId/image",
    { bodyLimit: 8 * 1024 * 1024, config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (req, reply) => {
      const u = authFromHeader((req as any).headers?.authorization);
      if (!u) return reply.code(401).send({ error: "unauthorized" });
      const body: any = (req as any).body || {};
      const kind = body.kind === "logo" || body.kind === "banner" ? (body.kind as string) : null;
      if (!kind) return reply.code(400).send({ error: "bad_kind" });
      const crewId = String((req.params as any)?.crewId || "");
      const crew = await prisma.crew.findUnique({
        where: { id: crewId },
        select: { id: true, ownerId: true, logoUrl: true, bannerUrl: true },
      });
      if (!crew) return reply.code(404).send({ error: "not_found" });
      if (crew.ownerId !== u.id)
        return reply.code(403).send({
          error: "leader_only",
          message: "Only the crew's leader can change its pictures.",
        });
      const me: any = await prisma.user.findUnique({
        where: { id: u.id },
        select: { mediaBannedUntil: true } as any,
      });
      if (me?.mediaBannedUntil && new Date(me.mediaBannedUntil).getTime() > Date.now())
        return reply
          .code(403)
          .send({ error: "media_banned", message: "Your upload privileges are suspended." });

      const match = String(body.image || "").match(
        /^data:image\/(png|jpeg|jpg|webp|gif);base64,(.+)$/,
      );
      if (!match)
        return reply
          .code(400)
          .send({ error: "invalid_format", message: "Image must be PNG, JPEG, WebP, or GIF." });
      const buffer = Buffer.from(match[2], "base64");
      if (buffer.length > BANNER_MAX_BYTES)
        return reply.code(400).send({ error: "too_large", message: "Image must be under 4MB." });

      const logo = kind === "logo";
      const mod = await moderateProfileImage(buffer, {
        userId: u.id,
        square: logo,
        maxDim: logo ? 512 : 1600,
      });
      if (!mod.ok) return reply.code(mod.code).send({ error: mod.error, message: mod.message });
      try {
        const field = logo ? "logoUrl" : "bannerUrl";
        const url = persistImage(
          BANNER_DIR,
          "banners",
          String(crew[field] || ""),
          mod.webp,
          `crew-${crew.id}-${kind}`,
        );
        const updated = await prisma.crew.update({
          where: { id: crew.id },
          data: { [field]: url },
        });
        return reply.send({ ok: true, url, crew: updated });
      } catch (e) {
        log.error("[crew image upload]", e);
        return reply.code(500).send({ error: "upload_failed" });
      }
    },
  );

  app.post(
    "/lobbies/upload-image",
    { bodyLimit: 8 * 1024 * 1024, config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (req, reply) => {
      const u = authFromHeader((req as any).headers?.authorization);
      if (!u) return reply.code(401).send({ error: "unauthorized" });
      // Lobbies are free since 2026-11-02, so their branding is too (it was
      // Indicted+). Same moderation and upload bans as every other picture.
      const dbUser = await prisma.user.findUnique({
        where: { id: u.id },
        select: { mediaBannedUntil: true },
      });
      if (dbUser?.mediaBannedUntil && new Date(dbUser.mediaBannedUntil).getTime() > Date.now()) {
        return reply
          .code(403)
          .send({ error: "media_banned", message: "Your upload privileges are suspended." });
      }
      const body: any = (req as any).body || {};
      const dataUrl = body.image;
      if (!dataUrl || typeof dataUrl !== "string")
        return reply.code(400).send({ error: "missing_image" });
      // Same pipeline as the profile banner above (audit 2026-09-27): the upload
      // used to be written to disk as sent, keeping its metadata, accepting SVG
      // and skipping the ban-hash and NSFW checks every other public image gets.
      // It is now re-encoded to WebP by moderateProfileImage and stored as that.
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
        const kind =
          String(body.kind || "img")
            .replaceAll(/[^a-z]/g, "")
            .slice(0, 8) || "img";
        const filename = `lobby-${kind}-${u.id}-${Date.now()}.webp`;
        const filepath = join(BANNER_DIR, filename);
        writeFileSync(filepath, mod.webp);
        const url = `${SITE_BASE}/banners/${filename}`;
        return reply.send({ ok: true, url });
      } catch (e) {
        log.error("[lobby image upload]", e);
        return reply.code(500).send({ error: "upload_failed" });
      }
    },
  );

  // The picture that floats by in your look's symbol effect ("Change the snow
  // to my logo", James 2026-11-04): small, square, moderated like an avatar,
  // one per person. Saving it into the look is the client's (uiPrefs.fxImage).
  const SYMBOL_DIR = join(process.cwd(), "uploads", "symbols");
  if (!existsSync(SYMBOL_DIR)) mkdirSync(SYMBOL_DIR, { recursive: true });
  const SYMBOL_MAX_BYTES = 1024 * 1024;

  app.post(
    "/profile/symbol/upload",
    { bodyLimit: 4 * 1024 * 1024, config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (req, reply) => {
      const u = authFromHeader((req as any).headers?.authorization);
      if (!u) return reply.code(401).send({ error: "unauthorized" });
      const dbUser: any = await prisma.user.findUnique({
        where: { id: u.id },
        select: { tier: true, globalRole: true, uiPrefs: true, mediaBannedUntil: true } as any,
      });
      if (!canFloatPicture(dbUser?.tier) && !canAccessStaff(dbUser?.globalRole)) {
        return reply
          .code(402)
          .send({ error: "plan_required", message: "Your own picture is Indicted and up." });
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
      if (buffer.length > SYMBOL_MAX_BYTES)
        return reply.code(400).send({ error: "too_large", message: "Image must be under 1MB." });
      const mod = await moderateProfileImage(buffer, { userId: u.id, square: true, maxDim: 128 });
      if (!mod.ok) return reply.code(mod.code).send({ error: mod.error, message: mod.message });
      try {
        const prev = String(dbUser?.uiPrefs?.fxImage || "");
        const url = persistImage(SYMBOL_DIR, "symbols", prev, mod.webp, u.id);
        return reply.send({ ok: true, url });
      } catch (e) {
        log.error("[symbol upload]", e);
        return reply.code(500).send({ error: "upload_failed" });
      }
    },
  );

  app.get("/symbols/:filename", async (req, reply) => {
    const filename = String((req as any).params?.filename || "").replaceAll(/[^a-zA-Z0-9._-]/g, "");
    if (!filename.endsWith(".webp")) return reply.code(400).send("bad request");
    const filepath = join(SYMBOL_DIR, filename);
    if (!existsSync(filepath)) return reply.code(404).send("not found");
    const { readFileSync } = await import("fs");
    reply.header("Content-Type", "image/webp");
    reply.header("Cache-Control", "public, max-age=31536000, immutable");
    return reply.send(readFileSync(filepath));
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

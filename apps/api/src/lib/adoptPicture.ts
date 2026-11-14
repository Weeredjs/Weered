import { createHash } from "crypto";
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from "fs";
import { join } from "path";
import { fetchSafe } from "./ssrfGuard";
import { screenUpload } from "./imageModeration";
import { swallow } from "./logger";

/**
 * A picture linked from another site, copied onto Weered (James 2026-11-13:
 * "Anything we are linking you might as well migrate").
 *
 * A lobby logo or banner, a room picture or a sign-in profile picture used to
 * be stored as the other site's address. Every visitor's browser then asked
 * that site for it (telling it who looked), the picture never went through the
 * screen uploads go through, and it broke or changed whenever the other site
 * did. Now the picture is fetched once, from the server, through fetchSafe,
 * screened like an upload (screenUpload: media ban, blocked pictures, NSFW),
 * re-made as webp and stored here. What is saved is our own address.
 *
 * Our own addresses and site paths pass through untouched.
 */

const SITE_BASE = process.env.NEXT_PUBLIC_API_BASE || "https://api.weered.ca";
const MAX_BYTES = 10 * 1024 * 1024;

export type PictureKind = "avatars" | "banners";

/** An address on another site (not a path here, not weered.ca or a subdomain). */
export function isOutsidePicture(url: unknown): url is string {
  if (typeof url !== "string") return false;
  const s = url.trim();
  if (!/^https?:\/\//i.test(s)) return false;
  try {
    const host = new URL(s).hostname.toLowerCase();
    return !(host === "weered.ca" || host.endsWith(".weered.ca"));
  } catch {
    return false;
  }
}

/** An id as it can appear in a file name: itself when it is plain, else a hash. */
export function fileSafeId(id: string): string {
  return /^[A-Za-z0-9_-]{1,64}$/.test(id)
    ? id
    : createHash("sha1").update(id).digest("hex").slice(0, 16);
}

/** DiceBear draws SVG, which the screen does not take; it draws PNG too. */
function rasterAddress(url: string): string {
  const u = new URL(url);
  if (u.hostname === "api.dicebear.com") u.pathname = u.pathname.replace(/\/svg$/, "/png");
  return u.toString();
}

async function readBytes(res: Response): Promise<Buffer | null> {
  const declared = Number(res.headers.get("content-length") || 0);
  if (declared > MAX_BYTES) return null;
  if (!res.body) return null;
  const reader = res.body.getReader();
  const parts: Uint8Array[] = [];
  let n = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    n += value.byteLength;
    if (n > MAX_BYTES) {
      reader.cancel().catch(swallow);
      return null;
    }
    parts.push(value);
  }
  return Buffer.concat(parts);
}

export type AdoptResult =
  | { ok: true; url: string | null; copied: boolean }
  | { ok: false; error: string; message: string; code: number };

/**
 * Copy an outside picture in, or pass our own address through.
 * - `name`: the file name's start (avatars must be `<userId>`, the shape
 *   lib/ownImages.ts accepts); a time is added.
 * - `uploaderId`: whose upload it counts as (their media ban applies, and a
 *   blocked picture bans them as an upload would).
 * - `replacing`: the address being replaced; if it is our copy under the same
 *   name, that file is removed.
 */
export async function adoptPicture(
  url: string | null | undefined,
  o: {
    kind: PictureKind;
    name: string;
    uploaderId: string;
    maxDim: number;
    square?: boolean;
    replacing?: string | null;
  },
): Promise<AdoptResult> {
  if (url == null || url === "") return { ok: true, url: url ?? null, copied: false };
  if (!isOutsidePicture(url)) return { ok: true, url, copied: false };
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(o.name)) throw new Error("bad_picture_name");

  const refuse = (message: string, error = "picture_unreachable", code = 400): AdoptResult => ({
    ok: false,
    error,
    message,
    code,
  });

  let buf: Buffer | null;
  try {
    const res = await fetchSafe(
      rasterAddress(url.trim()),
      {
        headers: {
          accept: "image/avif,image/webp,image/png,image/jpeg,image/gif;q=0.9,*/*;q=0.5",
          "user-agent": "Mozilla/5.0 (compatible; WeeredBot/1.0; +https://weered.ca)",
        },
      },
      12_000,
      { webPortsOnly: true },
    );
    if (!res.ok) return refuse("That picture could not be fetched. Upload it instead.");
    buf = await readBytes(res);
  } catch {
    return refuse("That picture could not be fetched. Upload it instead.");
  }
  if (!buf) return refuse("That picture is too large (10 MB at most).", "too_large");

  const mod = await screenUpload(buf, {
    userId: o.uploaderId,
    maxDim: o.maxDim,
    square: o.square,
  });
  if (!mod.ok) return { ok: false, error: mod.error, message: mod.message, code: mod.code };

  const dir = join(process.cwd(), "uploads", o.kind);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const filename = `${o.name}-${Date.now()}.webp`;
  writeFileSync(join(dir, filename), mod.webp);

  // The old copy goes only when it was ours under exactly this name.
  const mine = `${SITE_BASE}/${o.kind}/${o.name}-`;
  if (o.replacing && o.replacing.startsWith(mine)) {
    const prev = o.replacing.slice(`${SITE_BASE}/${o.kind}/`.length);
    // Exactly `<name>-<time>.webp`: lobby "x" must never match lobby "x-logo"'s file.
    const tail = prev.slice(o.name.length + 1);
    if (prev.startsWith(`${o.name}-`) && /^\d+\.webp$/.test(tail) && prev !== filename) {
      try {
        unlinkSync(join(dir, prev));
      } catch (e) {
        swallow(e);
      }
    }
  }
  return { ok: true, url: `${SITE_BASE}/${o.kind}/${filename}`, copied: true };
}

/** File-name starts for each picture slot. */
export const pictureName = {
  lobby: (id: string, slot: "logo" | "banner") => `lobby-${fileSafeId(id)}-${slot}`,
  room: (id: string, slot: "icon" | "banner") => `room-${fileSafeId(id)}-${slot}`,
  flair: (id: string) => `flair-${fileSafeId(id)}`,
  event: (lobbyId: string) => `event-${fileSafeId(lobbyId)}`,
  challenge: (scopeId: string) => `challenge-${fileSafeId(scopeId)}`,
  badge: () => "badge",
};

/** Sizes: logos and icons square-ish at 512, banners wide at 1600. */
export const pictureSize = {
  logo: { maxDim: 512 },
  icon: { maxDim: 512 },
  banner: { maxDim: 1600 },
  avatar: { maxDim: 512, square: true },
};

/**
 * A profile picture from sign-in (Google, Discord) copied in, in the
 * background. Written only if the account still has that same address, so a
 * picture the person changed in the meantime is never overwritten. If the copy
 * fails the link stays; the next sign-in tries again.
 */
export async function adoptAvatarSoon(userId: string): Promise<void> {
  const { prisma } = await import("./prisma");
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { avatar: true } });
  const before = u?.avatar;
  if (!isOutsidePicture(before)) return;
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(userId)) return;
  const got = await adoptPicture(before, {
    kind: "avatars",
    name: userId,
    uploaderId: userId,
    ...pictureSize.avatar,
  });
  if (!got.ok || !got.copied) return;
  await prisma.user.updateMany({
    where: { id: userId, avatar: before },
    data: { avatar: got.url },
  });
}

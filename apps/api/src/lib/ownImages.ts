/**
 * The pictures a person may set as their avatar or banner by address (red
 * team 2026-11-01, findings 16 and 17). Any string used to go in, so an account
 * could show an outside image and skip the re-encode, the ban hashes and the
 * NSFW screen the upload routes run, or name someone else's uploaded file and
 * have the next upload delete it. Now the address must be:
 * - their own upload (the upload routes name files `<their id>-<time>.webp`);
 * - one of Weered's own pictures (a /brand/ path);
 * - what they already have (a Google or Discord picture from sign-up); or
 * - nothing, to clear it.
 */
const SITE_BASE = process.env.NEXT_PUBLIC_API_BASE || "https://api.weered.ca";

export function ownImageOk(
  kind: "avatars" | "banners",
  url: string,
  uid: string,
  current?: string | null,
): boolean {
  const s = url.trim();
  if (!s) return true;
  if (current && s === current) return true;
  if (/^\/brand\/[a-zA-Z0-9/_.-]+\.(svg|png|webp|jpe?g)$/.test(s) && !s.includes("..")) return true;
  const own = `${SITE_BASE}/${kind}/${uid}-`;
  return s.startsWith(own) && /^\d+\.webp$/.test(s.slice(own.length));
}

/** A crew's logo or banner by address: the same rule for crews (2026-11-05,
 *  when crews got their own uploads). Its own upload (`POST /crews/:id/image`
 *  names files `crew-<id>-logo|banner-<time>.webp`), a /brand/ picture, what it
 *  already has, or nothing. Any other address skipped moderation. */
export function crewImageOk(url: string, crewId: string, current?: string | null): boolean {
  const s = url.trim();
  if (!s) return true;
  if (current && s === current) return true;
  if (/^\/brand\/[a-zA-Z0-9/_.-]+\.(svg|png|webp|jpe?g)$/.test(s) && !s.includes("..")) return true;
  const own = `${SITE_BASE}/banners/crew-${crewId}-`;
  return !!crewId && s.startsWith(own) && /^(logo|banner)-\d+\.webp$/.test(s.slice(own.length));
}

/** May the upload routes delete this previous file? Only the uploader's own. */
export function ownsUploadName(name: string, uid: string): boolean {
  return (
    !!uid && name.startsWith(`${uid}-`) && /^[a-zA-Z0-9._-]+\.(webp|png|jpe?g|gif)$/.test(name)
  );
}

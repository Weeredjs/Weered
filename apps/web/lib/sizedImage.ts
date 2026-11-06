/** Our uploads through the site's image resizer (sharp, and a fraction of the
 *  size): weered.ca's hosts, which next.config's remotePatterns allow.
 *  Everything else as it is: other hosts (the resizer refuses hosts it
 *  doesn't list), our own /brand files (already sized, and Home's lobby cards
 *  load them the same way) and SVGs (the resizer refuses those too). `w` must
 *  be one of Next's sizes (16-384 for small images, 640 and up for wide ones). */
export function sizedImage(src: string | null | undefined, w = 640): string {
  if (!src) return "";
  if (src.startsWith("/")) return src;
  try {
    const u = new URL(src);
    if (u.hostname !== "weered.ca" && !u.hostname.endsWith(".weered.ca")) return src;
    if (/\.svg$/i.test(u.pathname)) return src;
  } catch {
    return "";
  }
  return `/_next/image?url=${encodeURIComponent(src)}&w=${w}&q=75`;
}

/** A picture that didn't load steps aside, so what's behind it shows instead
 *  of a broken-image mark. */
export const hideBroken = (e: { currentTarget: HTMLImageElement }) => {
  e.currentTarget.style.visibility = "hidden";
};

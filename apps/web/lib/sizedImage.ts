/** Our pictures through the site's image resizer (sharp, and a fraction of the
 *  size): weered.ca's hosts, which next.config's remotePatterns allow, and our
 *  own files under /brand. Those were left alone as "already sized", and they
 *  aren't: the built-in lobbies' banners are 1.5 to 2 MB PNGs and some logos
 *  are 700 KB shown at 38 px, so opening Downtown downloaded about 23 MB
 *  (measured 2026-11-12). Through the resizer the same banner is 13 KB.
 *  Left as they are: other hosts (the resizer refuses hosts it doesn't list),
 *  SVGs and GIFs (it refuses or flattens those), and a local path with a query
 *  (the resizer wants those declared). `w` must be one of Next's sizes (16-384
 *  for small images, 640 and up for wide ones). */
const RASTER = /\.(png|jpe?g|webp|avif)$/i;

export function sizedImage(src: string | null | undefined, w = 640): string {
  if (!src) return "";
  if (src.startsWith("/")) {
    if (src.startsWith("//") || src.startsWith("/_next/") || !RASTER.test(src)) return src;
    return `/_next/image?url=${encodeURIComponent(src)}&w=${w}&q=75`;
  }
  try {
    const u = new URL(src);
    if (u.hostname !== "weered.ca" && !u.hostname.endsWith(".weered.ca")) return src;
    if (/\.(svg|gif)$/i.test(u.pathname)) return src;
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

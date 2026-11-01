/**
 * A lobby's colours and links end up inside other people's pages: the /map
 * pins, cards, banners. They used to be stored as any string, and the map built
 * its pins by pasting them into HTML, so a lobby name or logo address could run
 * script for every visitor (red team 2026-11-01, finding 5). A colour is
 * #rrggbb; a link is https (a website may also be http) or a path on this site.
 */
const HEX = /^#[0-9a-f]{6}$/i;

export function isSafeLink(v: string, allowHttp = false): boolean {
  const s = v.trim();
  if (!s) return true;
  if (s.length > 500 || /[\s"'<>\`]/.test(s)) return false;
  if (s.startsWith("/")) return !s.startsWith("//");
  try {
    const p = new URL(s).protocol;
    return p === "https:" || (allowHttp && p === "http:");
  } catch {
    return false;
  }
}

/** What's wrong with these branding values, if anything; empty clears. */
export function brandProblem(b: {
  accentColor?: unknown;
  logoUrl?: unknown;
  bannerUrl?: unknown;
  websiteUrl?: unknown;
}): string | null {
  const c = b.accentColor;
  if (c != null && c !== "" && !(typeof c === "string" && HEX.test(c)))
    return "Colours are written like #7c3aed.";
  for (const k of ["logoUrl", "bannerUrl", "websiteUrl"] as const) {
    const v = b[k];
    if (v != null && !(typeof v === "string" && isSafeLink(v, k === "websiteUrl")))
      return "Links must start with https://.";
  }
  return null;
}

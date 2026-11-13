/**
 * What the forum list shows of a post before it's opened (James 2026-11-08:
 * the forum with expanded "Thumbnail and previews", as Reddit's card view): the
 * post's first picture and its opening words without the markdown.
 *
 * The picture must be one Weered keeps, a forum upload (POST /forum/uploads
 * names them `<id>-<time>-<hash>.webp`) or a /brand/ picture, so a list of posts
 * never loads anything from an outside address. A post can still show an outside
 * picture once it's opened, as before.
 */
const SITE_BASE = process.env.NEXT_PUBLIC_API_BASE || "https://api.weered.ca";
const IMAGE = /!\[[^\]]*\]\(([^)\s]+)\)/g;

export function forumImage(body: string): string | null {
  const uploads = `${SITE_BASE}/forum-img/`;
  for (const m of String(body || "").matchAll(IMAGE)) {
    const url = m[1];
    if (url.startsWith(uploads) && /^[a-zA-Z0-9_-]+\.webp$/.test(url.slice(uploads.length)))
      return url;
    if (/^\/brand\/[a-zA-Z0-9/_.-]+\.(svg|png|webp|jpe?g)$/.test(url) && !url.includes(".."))
      return url;
  }
  return null;
}

/** A post's text as every list of posts sends it: the start of its body, and
 *  the card's preview. A removed post shows neither. */
export function listedBody(p: { body: string; removedAt?: Date | string | null }) {
  if (p.removedAt) return { body: "[removed by mod]", preview: "", image: null };
  return { body: p.body.slice(0, 200), preview: forumExcerpt(p.body), image: forumImage(p.body) };
}

/** The post's words as plain text, cut at a word near `max`. */
export function forumExcerpt(body: string, max = 240): string {
  // The start of the post is all a preview needs. Every list of posts runs
  // these patterns on every post in it, and several of them slow down with the
  // square of what they're given: a crafted 10,000-character post would have
  // slowed every list it appeared in.
  const text = String(body || "")
    .slice(0, 4000)
    .replace(/```[\s\S]*?(```|$)/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/`([^`]*)`/g, "$1")
    // A heading or list item ends as a sentence, so it doesn't run into the next.
    .replace(/^[ \t]*(?:#{1,3}|[-*+]|\d+\.)[ \t]+(.*?)[ \t]*$/gm, (_, line: string) =>
      /[.!?:;…]$/.test(line.replace(/[*_]+$/, "")) ? line : `${line}.`,
    )
    .replace(/^[ \t]*>[ \t]?/gm, "")
    .replace(/\*\*([^*]+)\*\*|__([^_]+)__/g, "$1$2")
    .replace(/(^|[^*\w])\*([^*\s][^*]*?)\*(?![*\w])/g, "$1$2")
    .replace(/(^|[^_\w])_([^_\s][^_]*?)_(?![_\w])/g, "$1$2")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s.,;:!?-]+$/, "")}…`;
}

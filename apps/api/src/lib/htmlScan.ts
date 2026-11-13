// Reading tags out of a page or a feed that a stranger's server wrote.
//
// Every function here looks at each character a fixed number of times. The
// patterns they replace ("<meta[^>]*>", "<title[^>]*>([\s\S]*?)</title>",
// "<(item|entry)...[\s\S]*?</\1>") rescan to the end of the text from every
// opening that has no close, so a page of "<meta " with no ">" held the API's
// one thread for seconds per request, and a feed of "<title>" for minutes
// (fan-out audit, 2026-11-13). htmlScan.test.ts times them on exactly those
// pages.

export const TAG_MAX = 8192;
const NAME_CH = /[a-zA-Z_:.-]/;
const SPACE_CH = /\s/;

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Every `<name ...>` tag, whole, in order. A tag longer than tagMax is passed
 * over. The next ">" is found once and reused for every opening before it, so
 * a page with thousands of openings and no ">" costs one scan, not thousands.
 */
export function findTags(
  html: string,
  name: string,
  opts: { limit?: number; tagMax?: number; unclosed?: boolean } = {},
): string[] {
  const limit = opts.limit ?? 500;
  const tagMax = opts.tagMax ?? TAG_MAX;
  const open = new RegExp(`<${escapeRe(name)}(?=[\\s/>]|$)`, "gi");
  const out: string[] = [];
  let gt = -1;
  let m: RegExpExecArray | null;
  while (out.length < limit && (m = open.exec(html))) {
    const start = m.index;
    if (gt < start) {
      gt = html.indexOf(">", start);
      if (gt < 0) {
        // A filter that must not be dodged also wants a last tag left open.
        if (opts.unclosed) out.push(html.slice(start, start + tagMax));
        break;
      }
    }
    if (gt - start <= tagMax) out.push(html.slice(start, gt + 1));
  }
  return out;
}

/**
 * What is inside the first `<name ...>...</name>`, at most max characters, or
 * undefined. One forward scan for the opening, one for its ">", one for the
 * close.
 */
export function firstInner(html: string, name: string, max = 2000): string | undefined {
  const open = new RegExp(`<${escapeRe(name)}(?=[\\s/>])`, "i").exec(html);
  if (!open) return undefined;
  const gt = html.indexOf(">", open.index);
  if (gt < 0) return undefined;
  if (html[gt - 1] === "/") return "";
  const close = new RegExp(`</${escapeRe(name)}\\s*>`, "gi");
  close.lastIndex = gt + 1;
  const c = close.exec(html);
  if (!c) return undefined;
  return html.slice(gt + 1, Math.min(c.index, gt + 1 + max));
}

/**
 * Whole `<item>...</item>` / `<entry>...</entry>` blocks, in order, at most
 * limit of them and blockMax characters each. The next close is found once
 * and reused, as findTags does with ">".
 */
export function elementBlocks(
  xml: string,
  names: string[],
  opts: { limit?: number; blockMax?: number } = {},
): string[] {
  const limit = opts.limit ?? 30;
  const blockMax = opts.blockMax ?? 64 * 1024;
  const alt = names.map(escapeRe).join("|");
  const open = new RegExp(`<(?:${alt})(?=[\\s>])`, "gi");
  const close = new RegExp(`</(?:${alt})\\s*>`, "gi");
  const out: string[] = [];
  let end = -1;
  let m: RegExpExecArray | null;
  while (out.length < limit && (m = open.exec(xml))) {
    const start = m.index;
    if (end <= start) {
      close.lastIndex = start;
      const c = close.exec(xml);
      if (!c) break;
      end = c.index + c[0].length;
    }
    if (end - start <= blockMax) out.push(xml.slice(start, end));
    open.lastIndex = Math.max(open.lastIndex, end);
  }
  return out;
}

/**
 * A tag's attributes, read in one pass. (Moved here from lib/embedCheck.ts;
 * red team 2026-11-01, finding 6.) A tag is cut at TAG_MAX.
 */
export function tagAttrs(tag: string): Record<string, string> {
  const out: Record<string, string> = {};
  const s = tag.length > TAG_MAX ? tag.slice(0, TAG_MAX) : tag;
  let i = 1;
  while (i < s.length && !SPACE_CH.test(s[i]) && s[i] !== ">" && s[i] !== "/") i++;
  while (i < s.length) {
    while (i < s.length && !NAME_CH.test(s[i])) {
      if (s[i] === ">") return out;
      i++;
    }
    const start = i;
    while (i < s.length && NAME_CH.test(s[i])) i++;
    const name = s.slice(start, i).toLowerCase();
    let j = i;
    while (j < s.length && SPACE_CH.test(s[j])) j++;
    if (s[j] !== "=") continue;
    j++;
    while (j < s.length && SPACE_CH.test(s[j])) j++;
    const q = s[j];
    if (q === '"' || q === "'") {
      const close = s.indexOf(q, j + 1);
      if (close < 0) return out;
      out[name] = s.slice(j + 1, close);
      i = close + 1;
    } else {
      const v = j;
      while (j < s.length && !SPACE_CH.test(s[j]) && s[j] !== '"' && s[j] !== "'" && s[j] !== ">")
        j++;
      if (j > v) out[name] = s.slice(v, j);
      i = Math.max(j, i);
    }
  }
  return out;
}

/** The start of a response's body as text, at most maxBytes, then stop reading. */
export async function readCapped(
  res: Response,
  maxBytes: number,
  stopAt?: RegExp,
): Promise<string> {
  if (!res.body) return "";
  const reader = res.body.getReader();
  const dec = new TextDecoder("utf-8");
  let out = "";
  let n = 0;
  try {
    while (n < maxBytes) {
      const { done, value } = await reader.read();
      if (done) break;
      n += value.byteLength;
      const chunk = dec.decode(value, { stream: true });
      out += chunk;
      // Only the new text and a short overlap are searched for the stop mark.
      if (stopAt && stopAt.test(out.slice(Math.max(0, out.length - chunk.length - 16)))) break;
    }
  } finally {
    reader.cancel().catch(() => {});
  }
  return out.length > maxBytes ? out.slice(0, maxBytes) : out;
}

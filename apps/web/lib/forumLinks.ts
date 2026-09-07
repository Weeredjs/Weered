// Which links in a post are worth an unfurl card.
//
// The card goes UNDER the body rather than replacing the link inline, which is
// what chat clients do and what people expect: the sentence still reads, and
// the preview is an extra. Only a URL sitting on a line of its own qualifies —
// a link used mid-sentence is a citation, not something the author is showing
// you, and turning every one of those into a banner makes a thread unreadable.

/** Our own uploaded images already render as images; never unfurl those. */
const SELF_IMAGE = /\/forum-img\//;

export function previewUrls(body: string, max = 2): string[] {
  const src = String(body || "");
  if (!src) return [];

  // Strip anything already carrying its own presentation: fenced code, inline
  // code, and markdown image/link syntax (whose URL is deliberately not bare).
  const stripped = src
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`[^`]*`/g, "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[[^\]]*\]\([^)]*\)/g, "");

  const out: string[] = [];
  const seen = new Set<string>();
  for (const line of stripped.split("\n")) {
    const t = line.trim();
    if (!/^https?:\/\/\S+$/.test(t)) continue;
    // Trailing punctuation is nearly always sentence punctuation, not path.
    const url = t.replace(/[).,;!?]+$/, "");
    if (SELF_IMAGE.test(url)) continue;
    if (seen.has(url)) continue;
    seen.add(url);
    out.push(url);
    if (out.length >= max) break;
  }
  return out;
}

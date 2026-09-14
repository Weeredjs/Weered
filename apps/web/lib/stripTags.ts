// Remove HTML tags, looped until the string stops changing, so a tag rebuilt by
// removing an inner one ("<scr<script>ipt>") can't survive a single pass.
// Mirrors apps/api/src/lib/htmlText.ts; entity decoding stays with each caller.

export function stripTags(html: string): string {
  let prev: string;
  let out = html;
  do {
    prev = out;
    out = stripTagsOnce(out);
  } while (out !== prev);
  return out;
}

// One pass, as a scan instead of a regex: the old /<(script|style)[\s\S]*?<\/\1>/ rescanned
// to the end of the input from every unclosed "<script", which is quadratic on hostile feeds.
// Each tag, and each whole <script>/<style> block, becomes a single space.
function stripTagsOnce(html: string): string {
  const low = html.toLowerCase();
  const unclosed = new Set<string>(); // a closer missing once is missing for the rest
  let out = "";
  let i = 0;
  for (;;) {
    const lt = html.indexOf("<", i);
    if (lt < 0) return out + html.slice(i);
    out += html.slice(i, lt);
    let end = -1;
    for (const tag of ["script", "style"]) {
      if (end >= 0 || unclosed.has(tag) || !low.startsWith(`<${tag}`, lt)) continue;
      const close = low.indexOf(`</${tag}>`, lt);
      if (close < 0) unclosed.add(tag);
      else end = close + tag.length + 3;
    }
    if (end < 0) {
      const gt = html.indexOf(">", lt + 1);
      if (gt < 0) return out + html.slice(lt);
      end = gt + 1;
    }
    out += " ";
    i = end;
  }
}

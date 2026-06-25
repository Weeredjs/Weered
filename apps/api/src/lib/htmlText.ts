// Convert an HTML fragment to plain text. The order here is deliberate — it fixes real bugs
// and satisfies CodeQL's double-escaping / incomplete-sanitization queries:
//   1. Strip tags FIRST, looped until the string stops changing, so a tag reconstructed by
//      removing an inner one (e.g. "<scr<script>ipt>") can't survive a single pass.
//   2. THEN decode entities, decoding "&amp;" LAST — decoding it earlier double-unescapes,
//      turning "&amp;lt;" into "<" instead of leaving the literal text "&lt;".

export function stripTags(html: string): string {
  let prev: string;
  let out = html;
  do {
    prev = out;
    out = out.replaceAll(/<(script|style)[\s\S]*?<\/\1>/gi, " ").replaceAll(/<[^>]*>/g, " ");
  } while (out !== prev);
  return out;
}

export function decodeEntities(s: string): string {
  return s
    .replaceAll(/&lt;/g, "<")
    .replaceAll(/&gt;/g, ">")
    .replaceAll(/&quot;/g, '"')
    .replaceAll(/&apos;/g, "'")
    .replaceAll(/&nbsp;/g, " ")
    .replaceAll(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(Number.parseInt(h, 16)))
    .replaceAll(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replaceAll(/&amp;/g, "&"); // must be last
}

export function htmlToText(html: string): string {
  return decodeEntities(stripTags(html)).replaceAll(/\s+/g, " ").trim();
}

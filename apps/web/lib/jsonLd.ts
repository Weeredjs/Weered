// JSON for a <script type="application/ld+json"> block.
//
// JSON.stringify does not escape "<", so a string holding "</script>" closed
// the tag and whatever followed ran as script on weered.ca. Forum titles, LFG
// posts and lobby names all reach these blocks, so any member could plant it:
// proven 2026-09-27 with a forum post title of `</script><script>...`.
//
// Each of <, > and & becomes a JSON unicode escape (backslash, u, 4 hex digits).
// A JSON parser reads back the same characters, and the HTML tokenizer is left
// nothing to end the element on. The line and paragraph separators (U+2028,
// U+2029) are escaped too, since older parsers treat them as line terminators.
//
// The set is built from char codes on purpose: a literal U+2028 inside a regex
// literal is a syntax error, and escape sequences in this file have been
// silently decoded by tooling before.
const UNSAFE = new RegExp("[<>&" + String.fromCharCode(0x2028, 0x2029) + "]", "g");

export function safeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(
    UNSAFE,
    (c) => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"),
  );
}

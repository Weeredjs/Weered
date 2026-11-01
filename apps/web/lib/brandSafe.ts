// A lobby's colour and pictures come from its owner, so anything that puts them
// into a style or an address checks them first (red team 2026-11-01, finding 5).

/** #rrggbb, or the fallback. */
export function safeAccent(c: unknown, fallback = "#d4920a"): string {
  return typeof c === "string" && /^#[0-9a-f]{6}$/i.test(c) ? c : fallback;
}

/** An https address or a path on this site, percent-encoded; "" otherwise. */
export function safeImage(u: unknown): string {
  if (typeof u !== "string" || !u.trim()) return "";
  const s = u.trim();
  try {
    if (s.startsWith("/") && !s.startsWith("//")) {
      const x = new URL(s, "https://site.invalid");
      return x.origin === "https://site.invalid" ? x.pathname + x.search : "";
    }
    const x = new URL(s);
    return x.protocol === "https:" ? x.href : "";
  } catch {
    return "";
  }
}

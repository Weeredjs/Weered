// A lobby's colour and pictures come from its owner, so anything that puts them
// into a style or an address checks them first (red team 2026-11-01, finding 5).

/** #rrggbb, or the fallback. */
export function safeAccent(c: unknown, fallback = "#d4920a"): string {
  return typeof c === "string" && /^#[0-9a-f]{6}$/i.test(c) ? c : fallback;
}

/** Text that reads on this colour: near-black on a light accent, white on a dark one. */
export function onAccent(hex: string): string {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return "#fff";
  const [r, g, b] = [m[1], m[2], m[3]].map((x) => {
    const c = parseInt(x, 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4 ? "#0b0b0f" : "#fff";
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

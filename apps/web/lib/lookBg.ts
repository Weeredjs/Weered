// A paid member's background (James 2026-11-02; the API decides who has one:
// api lib/lookBg.ts). "c:#rrggbb" one colour, "g:#rrggbb,#rrggbb" two as a
// gradient, "banner" their banner picture. Drawn on their ID card, profile,
// the card people open from their name, and their row in presence and friends
// lists. A row is a light wash so the name stays readable; a card is fuller,
// with a picture darkened under the text.

export type LookBg =
  | { kind: "colour"; a: string }
  | { kind: "gradient"; a: string; b: string }
  | { kind: "banner" };

export function parseLookBg(v: unknown): LookBg | null {
  const s = String(v || "").toLowerCase();
  let m = /^c:(#[0-9a-f]{6})$/.exec(s);
  if (m) return { kind: "colour", a: m[1] };
  m = /^g:(#[0-9a-f]{6}),(#[0-9a-f]{6})$/.exec(s);
  if (m) return { kind: "gradient", a: m[1], b: m[2] };
  return s === "banner" ? { kind: "banner" } : null;
}

/** A banner address safe inside url(""): ours, or https, nothing that ends it. */
const safeBanner = (u: unknown) => {
  const s = String(u || "");
  return /^(\/|https:\/\/)[^\s"'()\\<>]+$/.test(s) ? s : null;
};

/** The CSS background for a row or a card, or null when there's none. */
export function lookBgCss(v: unknown, bannerUrl: unknown, place: "row" | "card"): string | null {
  const bg = parseLookBg(v);
  if (!bg) return null;
  const row = place === "row";
  if (bg.kind === "colour")
    return row
      ? `linear-gradient(90deg, ${bg.a}66 0%, ${bg.a}1f 100%)`
      : `linear-gradient(160deg, ${bg.a}cc 0%, ${bg.a}4d 100%)`;
  if (bg.kind === "gradient")
    return row
      ? `linear-gradient(90deg, ${bg.a}73 0%, ${bg.b}33 100%)`
      : `linear-gradient(135deg, ${bg.a}d9 0%, ${bg.b}a6 100%)`;
  const url = safeBanner(bannerUrl);
  if (!url) return null;
  return row
    ? `linear-gradient(90deg, rgba(7,6,15,.35), rgba(7,6,15,.72)), url("${url}") center / cover no-repeat`
    : `linear-gradient(180deg, rgba(7,6,15,.2), rgba(7,6,15,.78)), url("${url}") center / cover no-repeat`;
}

/** Props for an element that wears it: the class (styles/56-looks.css makes it
 *  outrank theme and lobby-skin backgrounds) and the CSS variable it reads. */
export function lookBgProps(
  v: unknown,
  bannerUrl: unknown,
  place: "row" | "card",
): { className: string; style: Record<string, string> } | null {
  const css = lookBgCss(v, bannerUrl, place);
  return css ? { className: "weered-look-bg", style: { ["--look-bg" as string]: css } } : null;
}

/** Can this account pick one? (The API checks again.) */
export const mayPickLookBg = (me: { tier?: unknown; globalRole?: unknown } | null | undefined) =>
  ["INDICTED", "FELON", "CONDEMNED", "KINGPIN"].includes(String(me?.tier || "").toUpperCase()) ||
  ["STAFF", "ADMIN", "GOD"].includes(String(me?.globalRole || "").toUpperCase());

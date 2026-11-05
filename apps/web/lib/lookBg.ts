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

/** Where it's drawn: a list row, a card (the ID card, a profile header), or a
 *  tall panel (the card people open from a name). */
export type LookPlace = "row" | "card" | "panel";

/** The CSS background for a row, a card or a panel, or null when there's none.
 *  A banner covers a row or a card, but a tall panel would blow a wide banner
 *  up several times over (James 2026-11-05: "All stretched out"), so there it
 *  is a strip across the top that fades into the panel. */
export function lookBgCss(v: unknown, bannerUrl: unknown, place: LookPlace): string | null {
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
  if (place === "panel")
    return `linear-gradient(180deg, rgba(12,12,20,.15) 0px, rgba(12,12,20,.55) 60px, rgba(12,12,20,.97) 150px), url("${url}") center top / 100% auto no-repeat rgb(12,12,20)`;
  return row
    ? `linear-gradient(90deg, rgba(7,6,15,.35), rgba(7,6,15,.72)), url("${url}") center / cover no-repeat`
    : `linear-gradient(180deg, rgba(7,6,15,.2), rgba(7,6,15,.78)), url("${url}") center / cover no-repeat`;
}

/** Props for an element that wears it: the class (styles/56-looks.css makes it
 *  outrank theme and lobby-skin backgrounds) and the CSS variable it reads. */
export function lookBgProps(
  v: unknown,
  bannerUrl: unknown,
  place: LookPlace,
): { className: string; style: Record<string, string> } | null {
  const css = lookBgCss(v, bannerUrl, place);
  return css ? { className: "weered-look-bg", style: { ["--look-bg" as string]: css } } : null;
}

/** Can this account pick one? (The API checks again.) Medics (SUPPORT) wear
 *  one too: a look, not a power (James 2026-11-05, the admin account). */
export const mayPickLookBg = (me: { tier?: unknown; globalRole?: unknown } | null | undefined) =>
  ["INDICTED", "FELON", "CONDEMNED", "KINGPIN"].includes(String(me?.tier || "").toUpperCase()) ||
  ["SUPPORT", "STAFF", "ADMIN", "GOD"].includes(String(me?.globalRole || "").toUpperCase());

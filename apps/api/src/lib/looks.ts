// A member's look (James 2026-10-31: "We are going to need way more profile
// customization. Even the colors for the avatar frame and name effect."): the
// name effect and avatar frame, a preset by its key or one of their own.
//
// Both stay plain strings on User (nameEffect, avatarFrame), so every place
// that already carries them (presence, friends, chat) carries the new ones
// unchanged. Their own is written compactly:
//   name:  "c:<#hex>[,<#hex>[,<#hex>]]:<g0|g1>:<none|shimmer|pulse>"
//   frame: "c:<#hex>[,<#hex>[,<#hex>]]:<ring|double|glow|dashed|cycle|pulse>"
// The web reads them in apps/web/lib/looks.ts (a test keeps the lists equal).

export const NAME_PRESETS = [
  "gold",
  "fire",
  "ice",
  "toxic",
  "royal",
  "rainbow",
  "neon",
  "sunset",
  "ocean",
  "chrome",
  "blood",
  "mint",
  "void",
  "gilded",
] as const;
export const FRAME_PRESETS = [
  "gold",
  "flames",
  "crystal",
  "neon",
  "circuit",
  "ember",
  "frost",
  "void",
  "holo",
  "blood",
  "mint",
] as const;
export const NAME_MOTIONS = ["none", "shimmer", "pulse"] as const;
export const FRAME_STYLES = ["ring", "double", "glow", "dashed", "cycle", "pulse"] as const;

const HEX = /^#[0-9a-f]{6}$/i;

function colorsOf(v: unknown): string[] | null {
  const list = (Array.isArray(v) ? v : String(v ?? "").split(","))
    .map((c) => String(c).trim().toLowerCase())
    .filter(Boolean);
  if (!list.length || list.length > 3 || !list.every((c) => HEX.test(c))) return null;
  return list;
}

/** A name effect as saved: null for none, a preset key, or "c:…". Anything
 *  else is undefined (refused). Takes the saved string or {colors, glow, motion}. */
export function cleanNameEffect(v: unknown): string | null | undefined {
  if (v === null || v === "none" || v === "") return null;
  if (typeof v === "string" && (NAME_PRESETS as readonly string[]).includes(v)) return v;
  let colors: string[] | null = null;
  let glow = false;
  let motion: string = "none";
  if (typeof v === "string" && v.startsWith("c:")) {
    const [, c, g, m] = v.split(":");
    colors = colorsOf(c);
    glow = g === "g1";
    motion = m || "none";
  } else if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    colors = colorsOf(o.colors);
    glow = o.glow === true;
    motion = String(o.motion || "none");
  }
  if (!colors || !(NAME_MOTIONS as readonly string[]).includes(motion)) return undefined;
  return `c:${colors.join(",")}:${glow ? "g1" : "g0"}:${motion}`;
}

/** An avatar frame as saved: null for none, a preset key, or "c:…". */
export function cleanFrame(v: unknown): string | null | undefined {
  if (v === null || v === "none" || v === "") return null;
  if (typeof v === "string" && (FRAME_PRESETS as readonly string[]).includes(v)) return v;
  let colors: string[] | null = null;
  let style = "ring";
  if (typeof v === "string" && v.startsWith("c:")) {
    const [, c, s] = v.split(":");
    colors = colorsOf(c);
    style = s || "ring";
  } else if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    colors = colorsOf(o.colors);
    style = String(o.style || "ring");
  }
  if (!colors || !(FRAME_STYLES as readonly string[]).includes(style)) return undefined;
  return `c:${colors.join(",")}:${style}`;
}

// A member's look: the name effect and avatar frame (api lib/looks.ts saves
// them). A preset is its key and draws through its CSS class
// (styles/80-chrome-min.css, styles/56-looks.css); their own is "c:…" and
// draws through the same classes with CSS variables:
//   name:  "c:<#hex>[,<#hex>[,<#hex>]]:<g0|g1>:<none|shimmer|pulse>"
//   frame: "c:<#hex>[,<#hex>[,<#hex>]]:<ring|double|glow|dashed|cycle|pulse>"
import type React from "react";

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

export type NameMotion = (typeof NAME_MOTIONS)[number];
export type FrameStyle = (typeof FRAME_STYLES)[number];
export type NameLook = { colors: string[]; glow: boolean; motion: NameMotion };
export type FrameLook = { colors: string[]; style: FrameStyle };

const HEX = /^#[0-9a-f]{6}$/i;
const colorsOf = (s: string) => {
  const list = s.split(",").filter((c) => HEX.test(c));
  return list.length ? list.slice(0, 3) : null;
};

/** Their own name effect, or null when it's none or a preset. */
export function parseName(effect?: string | null): NameLook | null {
  if (!effect || !effect.startsWith("c:")) return null;
  const [, c, g, m] = effect.split(":");
  const colors = colorsOf(c || "");
  if (!colors) return null;
  return {
    colors,
    glow: g === "g1",
    motion: (NAME_MOTIONS as readonly string[]).includes(m) ? (m as NameMotion) : "none",
  };
}
export function parseFrame(frame?: string | null): FrameLook | null {
  if (!frame || !frame.startsWith("c:")) return null;
  const [, c, s] = frame.split(":");
  const colors = colorsOf(c || "");
  if (!colors) return null;
  return {
    colors,
    style: (FRAME_STYLES as readonly string[]).includes(s) ? (s as FrameStyle) : "ring",
  };
}
export const encodeName = (l: NameLook) =>
  `c:${l.colors.slice(0, 3).join(",")}:${l.glow ? "g1" : "g0"}:${l.motion}`;
export const encodeFrame = (l: FrameLook) => `c:${l.colors.slice(0, 3).join(",")}:${l.style}`;

type Fx = { className?: string; style?: React.CSSProperties };

/** What a name with this effect gets: a class, and for their own, its colours. */
export function nameFx(effect?: string | null): Fx {
  if (!effect) return {};
  const own = parseName(effect);
  if (!own)
    return (NAME_PRESETS as readonly string[]).includes(effect)
      ? { className: `weered-name-${effect}` }
      : {};
  const c = own.colors;
  // Always a gradient: the name is painted as a background image (one colour
  // is a gradient of itself).
  const stops =
    c.length === 1 && own.motion !== "shimmer"
      ? [c[0], c[0]]
      : [...c, ...(own.motion === "shimmer" ? [c.length === 1 ? "#ffffff" : c[0]] : [])];
  const paint = `linear-gradient(90deg, ${stops.join(", ")})`;
  return {
    className:
      "weered-name-custom" +
      (own.glow ? " is-glow" : "") +
      (own.motion !== "none" ? ` is-${own.motion}` : ""),
    style: { "--nfx": paint, "--nglow": `${c[0]}cc` } as React.CSSProperties,
  };
}

/** The rings a frame of their own draws (box-shadow), by style. */
function frameShadow(f: FrameLook): string {
  const [a, b = f.colors[0], c] = f.colors;
  const gap = "0 0 0 3px #0b0b10";
  switch (f.style) {
    case "double":
      return c
        ? `0 0 0 2px ${a}, 0 0 0 4px ${b}, 0 0 0 6px ${c}`
        : `0 0 0 2px #0b0b10, 0 0 0 4px ${a}, 0 0 0 6px ${b}`;
    case "glow":
    case "pulse":
    case "cycle":
      return `${gap}, 0 0 0 5px ${a}, 0 0 18px ${b}`;
    case "dashed":
      return "none";
    default:
      return c ? `0 0 0 2px ${a}, 0 0 0 4px ${b}, 0 0 0 6px ${c}` : `${gap}, 0 0 0 5px ${a}`;
  }
}

export function frameFx(frame?: string | null): Fx {
  if (!frame) return {};
  const own = parseFrame(frame);
  if (!own)
    return (FRAME_PRESETS as readonly string[]).includes(frame)
      ? { className: `weered-frame-${frame}` }
      : {};
  const [a, b = own.colors[0], c = b] = own.colors;
  return {
    className: `weered-frame-custom is-${own.style}`,
    style: { "--ffx": frameShadow(own), "--fc1": a, "--fc2": b, "--fc3": c } as React.CSSProperties,
  };
}

/** The user corner draws its frame as a ring behind the avatar (styles
 *  80-chrome-min.css, data-uc-frame): their own one's fill and glow. */
export function cornerFrameVars(frame?: string | null): Record<string, string> | null {
  const own = parseFrame(frame);
  if (!own) return null;
  const c = own.colors;
  return {
    "--uc-ffx": c.length === 1 ? c[0] : `linear-gradient(135deg, ${c.join(", ")})`,
    "--uc-fglow": `${c[c.length - 1]}99`,
  };
}

/** A look's name for the picker. */
export const LOOK_LABEL: Record<string, string> = {
  none: "None",
  gold: "Gold",
  fire: "Fire",
  ice: "Ice",
  toxic: "Toxic",
  royal: "Royal",
  rainbow: "Rainbow",
  neon: "Neon",
  sunset: "Sunset",
  ocean: "Ocean",
  chrome: "Chrome",
  blood: "Blood",
  mint: "Mint",
  void: "Void",
  gilded: "Gilded",
  flames: "Flames",
  crystal: "Crystal",
  circuit: "Circuit",
  ember: "Ember",
  frost: "Frost",
  holo: "Holo",
};

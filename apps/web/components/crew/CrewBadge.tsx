// The crew badge (James 2026-11-08: "The crew badge should be a small decorative
// rectangle"): the crew's tag on a little enamel plate in the crew's colour, with
// darker end caps and the corners its leader picked (rounded, square or pill).
// It is how a crew's tag is drawn wherever it sits beside a name: chat, the
// member list, the ID card, the name card, friends, the rails and the crew page,
// and the crew editor previews exactly this. The crew's logo is its picture,
// never its badge (in chat it used to be squeezed into a 13px square).
import React from "react";
import { onAccent, safeAccent } from "../../lib/brandSafe";

export type CrewLook = {
  tag?: string | null;
  name?: string | null;
  accentColor?: string | null;
  tagShape?: string | null;
};

// Moves a #rrggbb colour toward black (to 0) or white (to 255) by t.
function mix(hex: string, to: number, t: number): string {
  const n = parseInt(hex.slice(1), 16);
  return (
    "#" +
    [n >> 16, (n >> 8) & 255, n & 255]
      .map((v) =>
        Math.round(v + (to - v) * t)
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}

/** The plate's look at a given height in px. */
export function crewBadgeStyle(crew: CrewLook, size: number): React.CSSProperties {
  // A crew without a colour wears the crew editor's default.
  const a = safeAccent(crew.accentColor, "#7c3aed");
  const ink = onAccent(a);
  const light = ink !== "#fff";
  const band = Math.max(2, Math.round(size * 0.16));
  const cap = mix(a, 0, 0.3);
  const radius =
    crew.tagShape === "square"
      ? 0
      : crew.tagShape === "pill"
        ? size
        : Math.max(2, Math.round(size * 0.2));
  const background = [
    `linear-gradient(90deg, ${cap} 0 ${band}px, transparent ${band}px calc(100% - ${band}px), ${cap} calc(100% - ${band}px))`,
    `linear-gradient(180deg, ${mix(a, 255, 0.26)} 0%, ${a} 50%, ${mix(a, 0, 0.2)} 100%)`,
  ].join(", ");
  const edge = mix(a, 0, 0.45);
  const shadow = `inset 0 0 0 1px rgba(255,255,255,${light ? 0.35 : 0.16}), inset 0 1px 0 rgba(255,255,255,.4), 0 1px 2px rgba(0,0,0,.4)`;
  return {
    // Also as variables: styles/56-looks.css keeps them where a theme or the
    // minimal chrome strips fills and corners (the way a member's own look stays).
    ["--cb-bg" as string]: background,
    ["--cb-edge" as string]: edge,
    ["--cb-radius" as string]: `${radius}px`,
    ["--cb-shadow" as string]: shadow,
    ["--cb-ink" as string]: ink,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    boxSizing: "border-box",
    height: size,
    minWidth: Math.round(size * 1.7),
    padding: `0 ${Math.max(3, Math.round(size * 0.3)) + band}px`,
    borderRadius: radius,
    background,
    border: `1px solid ${edge}`,
    boxShadow: shadow,
    color: ink,
    fontFamily: "var(--font-barlow), 'Barlow Condensed', sans-serif",
    fontSize: Math.max(8, Math.round(size * 0.8)),
    fontWeight: 700,
    fontStyle: "normal",
    lineHeight: 1,
    letterSpacing: ".06em",
    textTransform: "uppercase",
    textShadow: light ? "0 1px 0 rgba(255,255,255,.45)" : "0 1px 0 rgba(0,0,0,.4)",
    whiteSpace: "nowrap",
    flexShrink: 0,
    verticalAlign: "middle",
  };
}

export default function CrewBadge({
  crew,
  size = 13,
  style,
}: {
  crew: CrewLook;
  /** Height in px; the letters scale with it. */
  size?: number;
  style?: React.CSSProperties;
}) {
  const tag = String(crew.tag || "")
    .trim()
    .toUpperCase();
  const label = [String(crew.name || "").trim(), tag && `[${tag}]`].filter(Boolean).join(" ");
  return (
    <span
      className="weered-crew-badge"
      title={label ? `Crew: ${label}` : "Crew"}
      style={{ ...crewBadgeStyle(crew, size), ...style }}
    >
      {tag}
    </span>
  );
}

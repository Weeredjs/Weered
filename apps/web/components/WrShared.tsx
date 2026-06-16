"use client";
import { API, authHeaders, apiFetch } from "../lib/apiClient";
export { API, authHeaders, apiFetch };

export const PAL = {
  abyss: "#0e1826",
  stormDeep: "#19283e",
  stormMid: "#243752",
  stormFoam: "#2e4363",
  brass: "#c9a066",
  brassHi: "#e8c48a",
  brassLow: "#8a6b3e",
  verdigris: "#4a8a9d",
  parchment: "#e4d4b0",
  parchDim: "#a89775",
  sea: "#3a7488",
  blood: "#a33d3d",
  ink: "#0a1220",
};

export const WR_FONT_DISPLAY = `"Pirata One", "Cinzel Decorative", "Luminari", "Georgia", serif`;
export const WR_FONT_SERIF = `"Cormorant Garamond", "EB Garamond", "Crimson Pro", "Palatino Linotype", Georgia, serif`;
export const WR_FONT_MONO = `"DM Mono", "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace`;

export const S = {
  shell: {
    display: "flex",
    flexDirection: "column" as const,
    background: `
      radial-gradient(ellipse 120% 80% at 50% -10%, ${PAL.stormFoam}90 0%, transparent 55%),
      radial-gradient(ellipse 80% 60% at 20% 110%, ${PAL.sea}25 0%, transparent 60%),
      linear-gradient(180deg, ${PAL.stormDeep} 0%, ${PAL.abyss} 100%)
    `,
    color: PAL.parchment,
    fontFamily: WR_FONT_SERIF,
    position: "relative" as const,
  },
  plaque: {
    padding: "18px 22px 14px",
    borderBottom: `1px solid ${PAL.brass}30`,
    background: `linear-gradient(180deg, ${PAL.stormMid} 0%, ${PAL.stormDeep} 100%)`,
    position: "relative" as const,
  },
  tabBar: {
    display: "flex",
    gap: 2,
    padding: "0 18px",
    alignItems: "flex-end",
    flexWrap: "wrap" as const,
    background: `linear-gradient(180deg, ${PAL.stormDeep} 0%, ${PAL.abyss} 100%)`,
    borderBottom: `1px solid ${PAL.brass}25`,
  },
  body: {
    padding: "22px 22px 28px",
    position: "relative" as const,
  },
  card: {
    borderRadius: 0,
    border: `1px solid ${PAL.brass}35`,
    background: `linear-gradient(180deg, ${PAL.stormMid}c0 0%, ${PAL.stormDeep}e0 100%)`,
    padding: "16px 18px",
    position: "relative" as const,
  },
  btn: {
    padding: "8px 16px",
    borderRadius: 2,
    border: `1px solid ${PAL.brass}55`,
    background: `linear-gradient(180deg, ${PAL.stormMid} 0%, ${PAL.abyss} 100%)`,
    color: PAL.brassHi,
    fontFamily: WR_FONT_SERIF,
    fontSize: 12,
    letterSpacing: "1.5px",
    textTransform: "uppercase" as const,
    fontWeight: 600,
    cursor: "pointer",
    transition: "all .15s",
  },
  btnPrimary: {
    padding: "10px 20px",
    borderRadius: 2,
    border: `1px solid ${PAL.brassHi}`,
    background: `linear-gradient(180deg, ${PAL.brass} 0%, ${PAL.brassLow} 100%)`,
    color: PAL.abyss,
    fontFamily: WR_FONT_DISPLAY,
    fontSize: 14,
    letterSpacing: "2px",
    textTransform: "uppercase" as const,
    fontWeight: 700,
    cursor: "pointer",
    transition: "all .15s",
    boxShadow: `0 0 0 1px ${PAL.brassLow}, 0 4px 18px ${PAL.brass}30`,
  },
  input: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 2,
    border: `1px solid ${PAL.brass}35`,
    background: `${PAL.ink}a0`,
    fontFamily: WR_FONT_MONO,
    fontSize: 13,
    color: PAL.parchment,
    outline: "none",
    boxSizing: "border-box" as const,
  },
  label: {
    fontFamily: WR_FONT_SERIF,
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: "3px",
    textTransform: "uppercase" as const,
    color: PAL.brass,
    opacity: 0.75,
  },
  title: {
    fontFamily: WR_FONT_DISPLAY,
    fontSize: 32,
    letterSpacing: "0.5px",
    color: PAL.brassHi,
    lineHeight: 1,
    textShadow: `0 2px 12px ${PAL.brass}40`,
  },
};

export function SailMark({
  size = 56,
  color = PAL.brassHi,
  glow = true,
}: {
  size?: number;
  color?: string;
  glow?: boolean;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      style={{ filter: glow ? `drop-shadow(0 0 10px ${color}55)` : "none", color }}
    >
      <path d="M32 10 Q 56 40 92 64 L 34 72 Z" fill="currentColor" />
      <rect x="22" y="82" width="70" height="6" rx="1" fill="currentColor" />
    </svg>
  );
}

export function CompassRose({
  size = 72,
  color = PAL.brass,
  glow = true,
}: {
  size?: number;
  color?: string;
  glow?: boolean;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      style={{ filter: glow ? `drop-shadow(0 0 8px ${color}55)` : "none" }}
    >
      <circle cx="50" cy="50" r="48" fill="none" stroke={color} strokeWidth="0.6" opacity="0.5" />
      <circle cx="50" cy="50" r="44" fill="none" stroke={color} strokeWidth="0.4" opacity="0.3" />
      <path d="M50 4 L53 47 L50 50 L47 47 Z" fill={color} opacity="0.95" />
      <path d="M50 96 L53 53 L50 50 L47 53 Z" fill={color} opacity="0.55" />
      <path d="M96 50 L53 53 L50 50 L53 47 Z" fill={color} opacity="0.75" />
      <path d="M4 50 L47 53 L50 50 L47 47 Z" fill={color} opacity="0.75" />
      <path d="M82 18 L53 47 L50 50 L52 45 Z" fill={color} opacity="0.4" />
      <path d="M18 18 L47 47 L50 50 L48 45 Z" fill={color} opacity="0.4" />
      <path d="M82 82 L53 53 L50 50 L52 55 Z" fill={color} opacity="0.4" />
      <path d="M18 82 L47 53 L50 50 L48 55 Z" fill={color} opacity="0.4" />
      <circle cx="50" cy="50" r="3.5" fill={PAL.abyss} stroke={color} strokeWidth="0.8" />
      <text
        x="50"
        y="12"
        fill={color}
        fontSize="8"
        fontFamily={WR_FONT_DISPLAY}
        textAnchor="middle"
        opacity="0.9"
      >
        N
      </text>
      <text
        x="50"
        y="94"
        fill={color}
        fontSize="6"
        fontFamily={WR_FONT_DISPLAY}
        textAnchor="middle"
        opacity="0.6"
      >
        S
      </text>
      <text
        x="92"
        y="53"
        fill={color}
        fontSize="6"
        fontFamily={WR_FONT_DISPLAY}
        textAnchor="middle"
        opacity="0.7"
      >
        E
      </text>
      <text
        x="8"
        y="53"
        fill={color}
        fontSize="6"
        fontFamily={WR_FONT_DISPLAY}
        textAnchor="middle"
        opacity="0.7"
      >
        W
      </text>
    </svg>
  );
}

export function BrassDivider({
  width = "100%",
  ornament = true,
}: {
  width?: string | number;
  ornament?: boolean;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, width, margin: "14px 0" }}>
      <div
        style={{
          flex: 1,
          height: 1,
          background: `linear-gradient(90deg, transparent, ${PAL.brass}80, transparent)`,
        }}
      />
      {ornament && (
        <svg width="14" height="14" viewBox="0 0 14 14" style={{ flexShrink: 0 }}>
          <path d="M7 1 L9 7 L7 13 L5 7 Z" fill={PAL.brass} opacity="0.8" />
          <circle cx="7" cy="7" r="1" fill={PAL.brassHi} />
        </svg>
      )}
      <div
        style={{
          flex: 1,
          height: 1,
          background: `linear-gradient(90deg, transparent, ${PAL.brass}80, transparent)`,
        }}
      />
    </div>
  );
}

export function Rivet({ size = 8 }: { size?: number }) {
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: `radial-gradient(circle at 30% 30%, ${PAL.brassHi}, ${PAL.brassLow})`,
        boxShadow: `inset 0 1px 2px ${PAL.ink}, 0 1px 2px ${PAL.ink}`,
        display: "inline-block",
        flexShrink: 0,
      }}
    />
  );
}

export function SkullIcon({ size = 14, color = PAL.brass }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M12 2 C7 2 4 6 4 10 C4 13 5 15 7 16 L7 19 L9 19 L9 21 L15 21 L15 19 L17 19 L17 16 C19 15 20 13 20 10 C20 6 17 2 12 2 Z"
        fill={color}
        opacity="0.85"
      />
      <circle cx="9" cy="10" r="1.6" fill={PAL.abyss} />
      <circle cx="15" cy="10" r="1.6" fill={PAL.abyss} />
      <path
        d="M10 14 L12 16 L14 14"
        stroke={PAL.abyss}
        strokeWidth="1"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}

export const TABS = [
  { id: "flagship" as const, label: "Flagship" },
  { id: "logbook" as const, label: "Logbook" },
  { id: "log" as const, label: "Sea Tales" },
  { id: "crew" as const, label: "Crew Finder" },
  { id: "bounties" as const, label: "Bounties" },
  { id: "ports" as const, label: "Ports of Call" },
  { id: "mods" as const, label: "Mods" },
  { id: "streams" as const, label: "Streams" },
  { id: "about" as const, label: "About" },
];
export type TabId = (typeof TABS)[number]["id"];

export const SLIM_TAB_IDS: TabId[] = ["logbook", "bounties", "ports", "mods"];

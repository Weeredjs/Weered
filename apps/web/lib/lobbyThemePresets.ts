// Theme presets for Design mode and the create-lobby composer. Each preset is
// art (pure CSS, so nothing to host or license), an accent, a swatch row, a
// default ambient effect and a display font. Picking one sets the accent and
// effect; the owner can override either afterwards.
import type { EffectId, FontId } from "./lobbyLayout";

export type ThemePreset = {
  id: string;
  name: string;
  tagline: string;
  accent: string;
  swatches: string[];
  /** Background art painted behind the lobby, and on the preset's card. */
  art: string;
  /** Tint over the lobby body so text stays readable on the art. */
  veil: string;
  effect: EffectId;
  font: FontId;
};

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: "midnight",
    name: "Midnight",
    tagline: "Weered's own. Deep violet.",
    accent: "#7c3aed",
    swatches: ["#7c3aed", "#a78bfa", "#5800e5", "#c084fc", "#312e81"],
    art: "radial-gradient(120% 80% at 80% -10%, #4c1d95 0%, transparent 55%), radial-gradient(90% 70% at 0% 110%, #312e81 0%, transparent 60%), #0b0716",
    veil: "rgba(11,7,22,.72)",
    effect: "stars",
    font: "default",
  },
  {
    id: "neon-arcade",
    name: "Neon Arcade",
    tagline: "Synthwave grid, cabinet glow.",
    accent: "#ff2bd6",
    swatches: ["#ff2bd6", "#00e5ff", "#ffe600", "#7b2cff", "#ff6b00"],
    art: "linear-gradient(transparent 62%, rgba(255,43,214,.35) 62.4%, transparent 63%), repeating-linear-gradient(90deg, rgba(0,229,255,.18) 0 1px, transparent 1px 64px), repeating-linear-gradient(0deg, rgba(0,229,255,.12) 0 1px, transparent 1px 48px), radial-gradient(60% 50% at 50% 62%, #ff2bd655 0%, transparent 70%), linear-gradient(#12001f, #2a0040 60%, #0a0014)",
    veil: "rgba(10,0,20,.70)",
    effect: "fireflies",
    font: "display",
  },
  {
    id: "deep-space",
    name: "Deep Space",
    tagline: "Nebula, starfield, long hauls.",
    accent: "#38bdf8",
    swatches: ["#38bdf8", "#818cf8", "#f472b6", "#22d3ee", "#0f172a"],
    art: "radial-gradient(50% 40% at 75% 30%, #6d28d955 0%, transparent 70%), radial-gradient(40% 35% at 25% 70%, #0ea5e944 0%, transparent 70%), radial-gradient(30% 25% at 60% 85%, #f472b633 0%, transparent 70%), #02030a",
    veil: "rgba(2,3,10,.62)",
    effect: "stars",
    font: "default",
  },
  {
    id: "felt-table",
    name: "Felt Table",
    tagline: "Card-room green, brass trim.",
    accent: "#2e7d4f",
    swatches: ["#2e7d4f", "#c9a227", "#7f1d1d", "#f5f0e1", "#14532d"],
    art: "radial-gradient(80% 70% at 50% 40%, #1f6b43 0%, #0f3d26 65%, #08261a 100%)",
    veil: "rgba(6,28,18,.66)",
    effect: "none",
    font: "serif",
  },
  {
    id: "ironclad",
    name: "Ironclad",
    tagline: "Olive drab, stencil, front lines.",
    accent: "#a3b14b",
    swatches: ["#a3b14b", "#d97706", "#57534e", "#e7e5e4", "#3f4a1f"],
    art: "repeating-linear-gradient(45deg, rgba(255,255,255,.025) 0 12px, transparent 12px 24px), radial-gradient(70% 60% at 30% 20%, #4d5a24 0%, transparent 70%), #1b1f12",
    veil: "rgba(20,23,12,.70)",
    effect: "embers",
    font: "stencil",
  },
  {
    id: "frostbite",
    name: "Frostbite",
    tagline: "Glacier blue, cold open.",
    accent: "#7dd3fc",
    swatches: ["#7dd3fc", "#e0f2fe", "#60a5fa", "#a5b4fc", "#0c4a6e"],
    art: "radial-gradient(70% 60% at 20% 0%, #0c4a6e 0%, transparent 70%), radial-gradient(60% 50% at 100% 100%, #1e3a8a 0%, transparent 70%), linear-gradient(#06131f, #0a1d2e)",
    veil: "rgba(6,19,31,.62)",
    effect: "snow",
    font: "rounded",
  },
  {
    id: "inferno",
    name: "Inferno",
    tagline: "Lava light, raid night.",
    accent: "#f97316",
    swatches: ["#f97316", "#ef4444", "#facc15", "#7f1d1d", "#1c0a05"],
    art: "radial-gradient(90% 60% at 50% 120%, #ea580c88 0%, transparent 60%), radial-gradient(60% 40% at 10% 100%, #b91c1c66 0%, transparent 70%), linear-gradient(#0d0503, #1c0a05)",
    veil: "rgba(13,5,3,.64)",
    effect: "embers",
    font: "display",
  },
  {
    id: "terminal",
    name: "Terminal",
    tagline: "Phosphor green on black.",
    accent: "#22c55e",
    swatches: ["#22c55e", "#86efac", "#facc15", "#0f172a", "#052e16"],
    art: "repeating-linear-gradient(0deg, rgba(34,197,94,.06) 0 1px, transparent 1px 3px), radial-gradient(80% 70% at 50% 50%, #052e16 0%, #010604 75%)",
    veil: "rgba(1,6,4,.66)",
    effect: "matrix",
    font: "mono",
  },
  {
    id: "sakura",
    name: "Sakura",
    tagline: "Blossom pink, slow evenings.",
    accent: "#f472b6",
    swatches: ["#f472b6", "#fbcfe8", "#c084fc", "#fde68a", "#4a1d34"],
    art: "radial-gradient(60% 50% at 85% 10%, #be185d66 0%, transparent 70%), radial-gradient(50% 40% at 10% 90%, #7e22ce55 0%, transparent 70%), linear-gradient(#1a0b14, #24101c)",
    veil: "rgba(26,11,20,.66)",
    effect: "petals",
    font: "rounded",
  },
  {
    id: "high-seas",
    name: "High Seas",
    tagline: "Navy, brass, salt spray.",
    accent: "#14b8a6",
    swatches: ["#14b8a6", "#d4a373", "#0ea5e9", "#f1f5f9", "#0b2239"],
    art: "repeating-radial-gradient(ellipse 120px 40px at 50% 100%, rgba(20,184,166,.08) 0 2px, transparent 2px 24px), radial-gradient(70% 60% at 50% 0%, #0b3a5b 0%, transparent 70%), linear-gradient(#04121f, #071b2c)",
    veil: "rgba(4,18,31,.64)",
    effect: "bubbles",
    font: "serif",
  },
  {
    id: "gold-rush",
    name: "Gold Rush",
    tagline: "Black and gold. Esports stage.",
    accent: "#eab308",
    swatches: ["#eab308", "#fde047", "#a16207", "#f8fafc", "#0a0a0a"],
    art: "linear-gradient(115deg, transparent 40%, rgba(234,179,8,.12) 50%, transparent 60%), radial-gradient(70% 60% at 50% -10%, #3f2f05 0%, transparent 70%), #070605",
    veil: "rgba(7,6,5,.66)",
    effect: "fireflies",
    font: "display",
  },
  {
    id: "toxic",
    name: "Toxic",
    tagline: "Radioactive lime, wasteland.",
    accent: "#a3e635",
    swatches: ["#a3e635", "#facc15", "#22d3ee", "#365314", "#0b0f05"],
    art: "radial-gradient(50% 40% at 70% 80%, #4d7c0f66 0%, transparent 70%), repeating-linear-gradient(-45deg, rgba(163,230,53,.05) 0 18px, transparent 18px 36px), #0b0f05",
    veil: "rgba(11,15,5,.66)",
    effect: "bubbles",
    font: "stencil",
  },
];

export const PRESET_BY_ID: Record<string, ThemePreset> = Object.fromEntries(
  THEME_PRESETS.map((p) => [p.id, p]),
);

export const FONT_STACK: Record<FontId, string> = {
  default: "inherit",
  display: "'Impact', 'Haettenschweiler', 'Arial Narrow Bold', system-ui, sans-serif",
  serif: "'Georgia', 'Iowan Old Style', 'Palatino Linotype', serif",
  mono: "'Cascadia Code', 'JetBrains Mono', 'Consolas', ui-monospace, monospace",
  rounded: "'Nunito', 'Varela Round', 'Segoe UI', system-ui, sans-serif",
  stencil: "'Stencil', 'Bahnschrift', 'Arial Black', system-ui, sans-serif",
};

export const FONT_LABEL: Record<FontId, string> = {
  default: "Weered",
  display: "Poster",
  serif: "Classic",
  mono: "Terminal",
  rounded: "Soft",
  stencil: "Stencil",
};

export const EFFECT_LABEL: Record<EffectId, string> = {
  none: "None",
  stars: "Starfield",
  snow: "Snow",
  embers: "Embers",
  rain: "Rain",
  petals: "Petals",
  bubbles: "Bubbles",
  fireflies: "Fireflies",
  matrix: "Code rain",
};

/** Extra swatches for the custom row, beyond the preset's own. */
export const SWATCH_WHEEL = [
  "#ef4444",
  "#f97316",
  "#f59e0b",
  "#eab308",
  "#84cc16",
  "#22c55e",
  "#10b981",
  "#14b8a6",
  "#06b6d4",
  "#0ea5e9",
  "#3b82f6",
  "#6366f1",
  "#8b5cf6",
  "#a855f7",
  "#d946ef",
  "#ec4899",
  "#f43f5e",
  "#e5e7eb",
];

"use client";

// Design mode's theme dock: presets with art, accent, atmosphere, type, entrance.
import React from "react";
import type { EffectId, EntranceId, FontId, LobbyLayout } from "../../lib/lobbyLayout";
import {
  EFFECT_LABEL,
  FONT_LABEL,
  FONT_STACK,
  PRESET_BY_ID,
  SWATCH_WHEEL,
  SYMBOL_PICKS,
  THEME_PRESETS,
} from "../../lib/lobbyThemePresets";
import { chip, label, panel } from "./designerKit";

// ── Theme dock ─────────────────────────────────────────────────────────────
export function ThemeDock({
  accent,
  layout,
  set,
  onPreset,
  onClose,
}: {
  accent: string;
  layout: LobbyLayout;
  set: (fn: (l: LobbyLayout) => LobbyLayout) => void;
  onPreset: (id: string) => void;
  onClose: () => void;
}) {
  const th = layout.theme;
  const preset = th.preset ? PRESET_BY_ID[th.preset] : null;
  const setTheme = (patch: Partial<LobbyLayout["theme"]>) =>
    set((l) => ({ ...l, theme: { ...l.theme, ...patch } }));
  const swatches = [...new Set([...(preset?.swatches || []), ...SWATCH_WHEEL])];
  const surprise = () => {
    const pr = THEME_PRESETS[Math.floor(Math.random() * THEME_PRESETS.length)];
    const effects = Object.keys(EFFECT_LABEL) as EffectId[];
    const fonts = Object.keys(FONT_LABEL) as FontId[];
    set((l) => ({
      ...l,
      theme: {
        ...l.theme,
        preset: pr.id,
        accent: pr.swatches[Math.floor(Math.random() * pr.swatches.length)],
        effect: effects[Math.floor(Math.random() * effects.length)],
        font: fonts[Math.floor(Math.random() * fonts.length)],
      },
    }));
  };
  return (
    <div
      style={{
        ...panel,
        left: 12,
        right: 12,
        bottom: 12,
        height: 204,
        padding: "12px 14px",
        display: "grid",
        gridTemplateColumns: "minmax(0, 1.6fr) minmax(0, 1fr)",
        gap: 16,
      }}
    >
      <div style={{ minWidth: 0, display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ ...label, margin: "0 0 8px" }}>Theme</div>
          <div style={{ display: "flex", gap: 6 }}>
            <button style={{ ...chip(false, accent), padding: "4px 10px" }} onClick={surprise}>
              🎲 Surprise me
            </button>
            <button style={{ ...chip(false, accent), padding: "4px 10px" }} onClick={onClose}>
              Hide
            </button>
          </div>
        </div>
        {/* Padding keeps the selected card's ring inside the scroller's clip box. */}
        <div
          style={{
            display: "flex",
            gap: 12,
            overflowX: "auto",
            padding: "5px 5px 8px",
            margin: "-5px -5px 0",
            flex: 1,
          }}
        >
          <button
            onClick={() => setTheme({ preset: undefined, effect: undefined, font: undefined })}
            style={presetCard(
              !th.preset,
              accent,
              "repeating-linear-gradient(45deg, #1f1f27 0 8px, #17171d 8px 16px)",
            )}
          >
            <span style={presetName}>Stock</span>
          </button>
          {THEME_PRESETS.map((pr) => (
            <button
              key={pr.id}
              onClick={() => onPreset(pr.id)}
              style={presetCard(th.preset === pr.id, pr.accent, pr.art)}
              title={pr.tagline}
            >
              <span style={{ display: "flex", gap: 3, position: "absolute", top: 8, left: 8 }}>
                {pr.swatches.slice(0, 4).map((s) => (
                  <i
                    key={s}
                    style={{
                      width: 9,
                      height: 9,
                      borderRadius: 99,
                      background: s,
                      display: "block",
                      border: "1px solid rgba(0,0,0,.4)",
                    }}
                  />
                ))}
              </span>
              <span style={{ ...presetName, fontFamily: FONT_STACK[pr.font] }}>{pr.name}</span>
            </button>
          ))}
        </div>
      </div>
      <div style={{ minWidth: 0, overflow: "auto" }}>
        <div style={{ ...label, margin: "0 0 6px" }}>Accent</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, alignItems: "center" }}>
          {swatches.slice(0, 20).map((s) => (
            <button
              key={s}
              onClick={() => setTheme({ accent: s })}
              aria-label={`Accent ${s}`}
              style={{
                width: 20,
                height: 20,
                borderRadius: 99,
                background: s,
                border: th.accent === s ? "2px solid #fff" : "1px solid rgba(0,0,0,.5)",
                boxShadow: th.accent === s ? `0 0 0 2px ${s}` : "none",
                cursor: "pointer",
              }}
            />
          ))}
          <input
            type="color"
            value={th.accent || accent}
            onChange={(e) => setTheme({ accent: e.target.value })}
            aria-label="Custom accent"
            style={{ width: 26, height: 22, border: "none", background: "none", padding: 0 }}
          />
        </div>
        <div style={{ ...label, margin: "10px 0 6px" }}>Atmosphere</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
          {(Object.keys(EFFECT_LABEL) as EffectId[]).map((e) => (
            <button
              key={e}
              style={{
                ...chip((th.effect || "none") === e, accent),
                padding: "4px 9px",
                fontSize: 11,
              }}
              onClick={() => setTheme({ effect: e })}
            >
              {EFFECT_LABEL[e]}
            </button>
          ))}
        </div>
        <div style={{ ...label, margin: "10px 0 6px" }}>Type · entrance · extras</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
          {(Object.keys(FONT_LABEL) as FontId[]).map((f) => (
            <button
              key={f}
              style={{
                ...chip((th.font || "default") === f, accent),
                padding: "4px 9px",
                fontSize: 11,
                fontFamily: FONT_STACK[f],
              }}
              onClick={() => setTheme({ font: f })}
            >
              {FONT_LABEL[f]}
            </button>
          ))}
          {(["none", "fade", "rise", "glitch"] as EntranceId[]).map((en) => (
            <button
              key={en}
              style={{
                ...chip((th.entrance || "none") === en, accent),
                padding: "4px 9px",
                fontSize: 11,
              }}
              onClick={() => setTheme({ entrance: en })}
            >
              {en === "none" ? "No entrance" : en[0].toUpperCase() + en.slice(1)}
            </button>
          ))}
          <button
            style={{ ...chip(!!th.sparkle, accent), padding: "4px 9px", fontSize: 11 }}
            onClick={() => setTheme({ sparkle: !th.sparkle })}
          >
            ✨ Cursor sparkle
          </button>
        </div>
        {th.effect === "symbol" && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              marginTop: 8,
              flexWrap: "wrap",
            }}
          >
            <input
              value={th.symbol ?? ""}
              placeholder="✦"
              maxLength={12}
              onChange={(e) => setTheme({ symbol: e.target.value })}
              aria-label="Your symbol"
              style={{
                width: 54,
                padding: "4px 6px",
                borderRadius: 8,
                border: "1px solid rgba(255,255,255,.14)",
                background: "rgba(0,0,0,.35)",
                color: "inherit",
                fontSize: 15,
                textAlign: "center",
              }}
            />
            {SYMBOL_PICKS.map((sym) => (
              <button
                key={sym}
                style={{ ...chip(th.symbol === sym, accent), padding: "2px 6px", fontSize: 14 }}
                onClick={() => setTheme({ symbol: sym })}
              >
                {sym}
              </button>
            ))}
          </div>
        )}
        {th.effect && th.effect !== "none" && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
            <span style={{ fontSize: 11, opacity: 0.6 }}>Intensity</span>
            <input
              type="range"
              min={0.2}
              max={1.5}
              step={0.1}
              value={th.intensity ?? 1}
              onChange={(e) => setTheme({ intensity: Number(e.target.value) })}
              style={{ flex: 1, accentColor: accent }}
              aria-label="Effect intensity"
            />
          </div>
        )}
      </div>
    </div>
  );
}

const presetCard = (on: boolean, accent: string, art: string): React.CSSProperties => ({
  position: "relative",
  flex: "0 0 132px",
  height: 104,
  borderRadius: 12,
  border: on ? `2px solid ${accent}` : "1px solid rgba(255,255,255,.12)",
  boxShadow: on ? `0 0 0 3px ${accent}44, 0 8px 22px ${accent}33` : "none",
  background: art,
  cursor: "pointer",
  overflow: "hidden",
  transition: "box-shadow .15s, border-color .15s",
});
const presetName: React.CSSProperties = {
  position: "absolute",
  left: 0,
  right: 0,
  bottom: 0,
  padding: "16px 10px 8px",
  background: "linear-gradient(transparent, rgba(0,0,0,.75))",
  color: "#fff",
  fontWeight: 900,
  fontSize: 13,
  textAlign: "left",
};

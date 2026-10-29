"use client";

// Step 3: make it yours. Preset cards painted with their own art, then accent,
// ambient effect (each chip runs the real effect, small), font and entrance.
import React from "react";
import LobbyAmbient from "../LobbyAmbient";
import type { EffectId, EntranceId, FontId } from "../../lib/lobbyLayout";
import {
  EFFECT_LABEL,
  FONT_LABEL,
  FONT_STACK,
  SWATCH_WHEEL,
  THEME_PRESETS,
  type ThemePreset,
} from "../../lib/lobbyThemePresets";
import { FAINT, MUTED, TEXT, alpha, labelStyle } from "./ui";

const EFFECTS = Object.keys(EFFECT_LABEL) as EffectId[];
const FONTS = Object.keys(FONT_LABEL) as FontId[];
// LobbyAmbient sizes its particle count by area, so a 100x58 chip would show
// one or two specks. These multipliers give each chip a readable sample.
const CHIP_INTENSITY: Record<EffectId, number> = {
  none: 1,
  stars: 20,
  snow: 30,
  embers: 30,
  rain: 22,
  petals: 50,
  bubbles: 50,
  fireflies: 60,
  matrix: 1.2,
};
const ENTRANCES: { id: EntranceId; name: string; hint: string }[] = [
  { id: "none", name: "None", hint: "Just there" },
  { id: "fade", name: "Fade", hint: "Soft in" },
  { id: "rise", name: "Rise", hint: "Floats up" },
  { id: "glitch", name: "Glitch", hint: "Signal lost" },
];

export type ThemeValue = {
  preset: string;
  accent: string;
  effect: EffectId;
  font: FontId;
  entrance: EntranceId;
  intensity: number;
};

function chip(on: boolean, accent: string): React.CSSProperties {
  return {
    borderRadius: 10,
    border: `1px solid ${on ? alpha(accent, 0.75) : "rgba(255,255,255,.09)"}`,
    background: on ? alpha(accent, 0.16) : "rgba(255,255,255,.03)",
    color: on ? TEXT : MUTED,
    cursor: "pointer",
    fontFamily: "inherit",
    boxShadow: on ? `0 0 18px ${alpha(accent, 0.25)}` : "none",
  };
}

export default function ThemePicker({
  value,
  onChange,
  onPreset,
  onReplayEntrance,
}: {
  value: ThemeValue;
  onChange: (p: Partial<ThemeValue>) => void;
  onPreset: (p: ThemePreset) => void;
  onReplayEntrance: () => void;
}) {
  const { accent } = value;
  const preset = THEME_PRESETS.find((p) => p.id === value.preset) || THEME_PRESETS[0];
  const swatches = Array.from(new Set([...preset.swatches, ...SWATCH_WHEEL]));

  return (
    <div>
      <div className="cz-presets" role="radiogroup" aria-label="Theme preset">
        {THEME_PRESETS.map((p) => {
          const on = p.id === value.preset;
          return (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={`${p.name}: ${p.tagline}`}
              className="cz-card"
              onClick={() => onPreset(p)}
              style={{
                position: "relative",
                height: 104,
                padding: 0,
                borderRadius: 14,
                overflow: "hidden",
                cursor: "pointer",
                textAlign: "left",
                background: p.art,
                border: `1px solid ${on ? p.accent : "rgba(255,255,255,.10)"}`,
                boxShadow: on
                  ? `0 0 0 2px ${alpha(p.accent, 0.55)}, 0 12px 30px ${alpha(p.accent, 0.3)}`
                  : "none",
                fontFamily: "inherit",
                minWidth: 0,
              }}
            >
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: "linear-gradient(180deg, transparent 30%, rgba(0,0,0,.65))",
                }}
              />
              <div style={{ position: "absolute", left: 10, right: 10, bottom: 9 }}>
                <div
                  style={{
                    fontFamily: FONT_STACK[p.font],
                    fontWeight: 900,
                    fontSize: 15,
                    color: "#fff",
                    letterSpacing: p.font === "display" ? "0.5px" : "-0.2px",
                    textShadow: "0 1px 8px rgba(0,0,0,.6)",
                  }}
                >
                  {p.name}
                </div>
                <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
                  {p.swatches.map((s) => (
                    <span
                      key={s}
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 99,
                        background: s,
                        border: "1px solid rgba(255,255,255,.35)",
                      }}
                    />
                  ))}
                </div>
              </div>
              {on && (
                <span
                  aria-hidden
                  style={{
                    position: "absolute",
                    top: 8,
                    right: 8,
                    fontSize: 10,
                    fontWeight: 900,
                    padding: "3px 7px",
                    borderRadius: 99,
                    background: p.accent,
                    color: "#000",
                    letterSpacing: ".5px",
                    animation: "cz-pop .3s both",
                  }}
                >
                  ON
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div style={{ fontSize: 12, color: FAINT, marginTop: 8 }}>
        {preset.name}: {preset.tagline} Sets the accent, effect and font. Change any of them below.
      </div>

      {/* Accent */}
      <div style={{ marginTop: 22 }}>
        <div style={labelStyle} id="cz-accent-l">
          Accent
        </div>
        <div
          role="radiogroup"
          aria-labelledby="cz-accent-l"
          style={{ display: "flex", flexWrap: "wrap", gap: 7, alignItems: "center" }}
        >
          {swatches.map((s, i) => {
            const on = s.toLowerCase() === accent.toLowerCase();
            return (
              <React.Fragment key={s}>
                {i === preset.swatches.length && (
                  <span
                    aria-hidden
                    style={{
                      width: 1,
                      height: 22,
                      background: "rgba(255,255,255,.12)",
                      margin: "0 3px",
                    }}
                  />
                )}
                <button
                  type="button"
                  role="radio"
                  aria-checked={on}
                  aria-label={`Accent ${s}`}
                  className="cz-chip"
                  onClick={() => onChange({ accent: s })}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 99,
                    background: s,
                    cursor: "pointer",
                    border: on ? "2px solid #fff" : "2px solid rgba(0,0,0,.4)",
                    boxShadow: on ? `0 0 0 2px ${s}, 0 0 16px ${s}` : "none",
                    padding: 0,
                  }}
                />
              </React.Fragment>
            );
          })}
          <label
            className="cz-chip"
            title="Any colour"
            style={{
              position: "relative",
              width: 28,
              height: 28,
              borderRadius: 99,
              cursor: "pointer",
              background:
                "conic-gradient(#ef4444, #f59e0b, #84cc16, #06b6d4, #6366f1, #d946ef, #ef4444)",
              border: "2px solid rgba(0,0,0,.4)",
              overflow: "hidden",
            }}
          >
            <input
              type="color"
              aria-label="Custom accent colour"
              value={/^#[0-9a-f]{6}$/i.test(accent) ? accent : "#7c3aed"}
              onChange={(e) => onChange({ accent: e.target.value })}
              style={{
                position: "absolute",
                inset: 0,
                opacity: 0,
                cursor: "pointer",
                width: "100%",
                height: "100%",
              }}
            />
          </label>
          <span
            style={{
              fontFamily: "ui-monospace, monospace",
              fontSize: 11,
              color: FAINT,
              marginLeft: 4,
            }}
          >
            {accent}
          </span>
        </div>
      </div>

      {/* Effect */}
      <div style={{ marginTop: 22 }}>
        <div style={labelStyle} id="cz-effect-l">
          Ambient effect
        </div>
        <div
          role="radiogroup"
          aria-labelledby="cz-effect-l"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))",
            gap: 8,
          }}
        >
          {EFFECTS.map((e) => {
            const on = e === value.effect;
            return (
              <button
                key={e}
                type="button"
                role="radio"
                aria-checked={on}
                className="cz-chip"
                onClick={() => onChange({ effect: e })}
                style={{
                  ...chip(on, accent),
                  position: "relative",
                  height: 58,
                  padding: 0,
                  overflow: "hidden",
                  background: on
                    ? `radial-gradient(80% 90% at 50% 100%, ${alpha(accent, 0.3)}, #07070c)`
                    : "#07070c",
                }}
              >
                <LobbyAmbient effect={e} accent={accent} intensity={CHIP_INTENSITY[e]} />
                <span
                  style={{
                    position: "absolute",
                    left: 8,
                    bottom: 6,
                    zIndex: 1,
                    fontSize: 11.5,
                    fontWeight: 800,
                    color: on ? "#fff" : "rgba(226,232,240,.8)",
                    textShadow: "0 1px 6px #000",
                  }}
                >
                  {EFFECT_LABEL[e]}
                </span>
              </button>
            );
          })}
        </div>
        {value.effect !== "none" && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
            <label htmlFor="cz-intensity" style={{ fontSize: 12, color: MUTED, fontWeight: 700 }}>
              Intensity
            </label>
            <input
              id="cz-intensity"
              type="range"
              min={0.2}
              max={1.5}
              step={0.1}
              value={value.intensity}
              onChange={(e) => onChange({ intensity: Number(e.target.value) })}
              style={{ flex: 1, maxWidth: 220, accentColor: accent }}
            />
            <span style={{ fontSize: 11, color: FAINT, fontFamily: "ui-monospace, monospace" }}>
              {value.intensity.toFixed(1)}×
            </span>
          </div>
        )}
      </div>

      {/* Font */}
      <div style={{ marginTop: 22 }}>
        <div style={labelStyle} id="cz-font-l">
          Heading font
        </div>
        <div
          role="radiogroup"
          aria-labelledby="cz-font-l"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))",
            gap: 8,
          }}
        >
          {FONTS.map((f) => {
            const on = f === value.font;
            return (
              <button
                key={f}
                type="button"
                role="radio"
                aria-checked={on}
                className="cz-chip"
                onClick={() => onChange({ font: f })}
                style={{ ...chip(on, accent), padding: "10px 8px", textAlign: "center" }}
              >
                <div
                  style={{
                    fontFamily: FONT_STACK[f],
                    fontSize: 22,
                    fontWeight: 800,
                    lineHeight: 1.1,
                    color: on ? accent : TEXT,
                  }}
                >
                  Aa
                </div>
                <div style={{ fontSize: 11, fontWeight: 700, marginTop: 4 }}>{FONT_LABEL[f]}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Entrance */}
      <div style={{ marginTop: 22 }}>
        <div style={labelStyle} id="cz-ent-l">
          Entrance
        </div>
        <div
          role="radiogroup"
          aria-labelledby="cz-ent-l"
          style={{ display: "flex", flexWrap: "wrap", gap: 8 }}
        >
          {ENTRANCES.map((en) => {
            const on = en.id === value.entrance;
            return (
              <button
                key={en.id}
                type="button"
                role="radio"
                aria-checked={on}
                className="cz-chip"
                onClick={() => {
                  onChange({ entrance: en.id });
                  onReplayEntrance();
                }}
                style={{ ...chip(on, accent), padding: "9px 14px", textAlign: "left" }}
              >
                <div style={{ fontSize: 13, fontWeight: 800 }}>{en.name}</div>
                <div style={{ fontSize: 10.5, color: FAINT }}>{en.hint}</div>
              </button>
            );
          })}
        </div>
        <div style={{ fontSize: 11.5, color: FAINT, marginTop: 6 }}>
          How the page arrives when someone opens your lobby. Watch the preview.
        </div>
      </div>
    </div>
  );
}

"use client";

import React from "react";

export type ModuleTab = { id: string; label: string; icon?: React.ReactNode };

const CLIP = "polygon(10px 0, 100% 0, calc(100% - 10px) 100%, 0 100%)";

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  let h = (hex || "").trim().replace(/^#/, "");
  if (h.length === 3)
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  const n = Number.parseInt(h, 16);
  if (h.length !== 6 || Number.isNaN(n)) return { r: 212, g: 175, b: 55 };
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export default function ModuleTabBar({
  tabs,
  active,
  onSelect,
  accent = "#d4af37",
}: {
  tabs: readonly ModuleTab[];
  active: string;
  onSelect: (id: string) => void;
  accent?: string;
}) {
  const { r, g, b } = hexToRgb(accent);
  const a = (alpha: number) => `rgba(${r},${g},${b},${alpha})`;

  const lr = Math.round(r + (255 - r) * 0.45);
  const lg = Math.round(g + (255 - g) * 0.45);
  const lb = Math.round(b + (255 - b) * 0.45);
  const lightText = `rgb(${lr},${lg},${lb})`;

  const dr = Math.round(r * 0.42),
    dg = Math.round(g * 0.42),
    db = Math.round(b * 0.42);
  const jamb = `linear-gradient(135deg, rgba(${dr},${dg},${db},.95) 0%, rgba(${Math.round(dr * 0.7)},${Math.round(dg * 0.7)},${Math.round(db * 0.7)},.92) 100%)`;

  const corona = `conic-gradient(from 12deg at 50% 55%, transparent 0 6deg, ${a(0.95)} 9deg, transparent 13deg 41deg, ${a(0.72)} 45deg, transparent 49deg 96deg, ${a(0.9)} 100deg, transparent 105deg 151deg, ${a(0.64)} 155deg, transparent 160deg 211deg, ${a(0.85)} 215deg, transparent 220deg 271deg, ${a(0.7)} 275deg, transparent 280deg 331deg, ${a(0.8)} 335deg, transparent 340deg 360deg)`;
  const crackMask =
    "conic-gradient(from 28deg at 50% 50%, #000 0deg, rgba(0,0,0,.28) 40deg, #000 92deg, rgba(0,0,0,.45) 150deg, #000 206deg, rgba(0,0,0,.3) 266deg, #000 320deg, rgba(0,0,0,.5) 360deg)";

  return (
    <div style={{ display: "flex", gap: 8, padding: "12px 12px", flexShrink: 0, flexWrap: "wrap" }}>
      <style>{`@keyframes wmtCorona{0%{opacity:.5;transform:rotate(0deg) scale(.98)}50%{opacity:.95;transform:rotate(7deg) scale(1.05)}100%{opacity:.5;transform:rotate(0deg) scale(.98)}}@keyframes wmtCrack{0%,100%{opacity:.8}50%{opacity:1}}`}</style>
      {tabs.map((t) => {
        const on = t.id === active;
        return (
          <span key={t.id} style={{ position: "relative", display: "inline-flex" }}>
            {on && (
              <>
                <span
                  aria-hidden
                  style={{
                    position: "absolute",
                    top: -18,
                    bottom: -18,
                    left: -22,
                    right: -22,
                    background: corona,
                    WebkitMaskImage:
                      "radial-gradient(ellipse at center, #000 8%, rgba(0,0,0,.6) 36%, transparent 72%)",
                    maskImage:
                      "radial-gradient(ellipse at center, #000 8%, rgba(0,0,0,.6) 36%, transparent 72%)",
                    filter: "blur(2.5px)",
                    animation: "wmtCorona 90s ease-in-out infinite",
                    pointerEvents: "none",
                    zIndex: 0,
                  }}
                />
                <span
                  aria-hidden
                  style={{
                    position: "absolute",
                    top: -3,
                    bottom: -3,
                    left: -3,
                    right: -3,
                    clipPath: CLIP,
                    background: a(0.95),
                    WebkitMaskImage: crackMask,
                    maskImage: crackMask,
                    animation: "wmtCrack 90s ease-in-out infinite",
                    pointerEvents: "none",
                    zIndex: 1,
                  }}
                />
                <span
                  aria-hidden
                  style={{
                    position: "absolute",
                    top: -1,
                    bottom: -1,
                    left: -1,
                    right: -1,
                    clipPath: CLIP,
                    background: jamb,
                    pointerEvents: "none",
                    zIndex: 2,
                  }}
                />
              </>
            )}
            <button
              onClick={() => onSelect(t.id)}
              style={{
                position: "relative",
                zIndex: 3,
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                padding: "8px 18px",
                border: "none",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
                fontFamily: "var(--font-rajdhani), 'Bank Gothic', 'Arial Narrow', sans-serif",
                letterSpacing: ".06em",
                textTransform: "uppercase",
                clipPath: CLIP,
                color: on ? lightText : "rgba(148,163,184,.6)",
                background: on ? "#0a0813" : "transparent",
                boxShadow: "none",
                transition: "color .15s",
                whiteSpace: "nowrap",
              }}
            >
              {t.icon}
              {t.label}
            </button>
          </span>
        );
      })}
    </div>
  );
}

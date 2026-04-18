"use client";

import React, { useEffect, useState } from "react";

const STORAGE_KEY = "weered:vertical:v1";
const SETTINGS_KEY = "weered:settings:v0";

type Vertical = {
  id: string;
  label: string;
  tagline: string;
  theme: string;
  emoji: string;
  accent: string;
};

const VERTICALS: Vertical[] = [
  { id: "gaming",    label: "Gaming",       tagline: "Lobbies, clans, game integrations.", theme: "ishimura",  emoji: "🎮", accent: "#f97316" },
  { id: "streaming", label: "Streamer",     tagline: "Live presence, overlays, chat.",      theme: "broadcast", emoji: "📡", accent: "#eab308" },
  { id: "business",  label: "Business",     tagline: "Editorial, professional, focused.",   theme: "press",     emoji: "📰", accent: "#c0a062" },
  { id: "social",    label: "Casual",       tagline: "Hang out, chat, discover.",           theme: "slate",     emoji: "👥", accent: "#5800E5" },
  { id: "creative",  label: "Creative",     tagline: "Writers, musicians, makers.",         theme: "stone",     emoji: "🎨", accent: "#a78bfa" },
  { id: "trading",   label: "Markets",      tagline: "Charts, paper-trading, crypto.",      theme: "zinc",      emoji: "📈", accent: "#22c55e" },
];

function hasSeen(): boolean {
  if (typeof window === "undefined") return true;
  try { return !!localStorage.getItem(STORAGE_KEY); } catch { return true; }
}

function applyVertical(v: Vertical) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ id: v.id, theme: v.theme, at: Date.now() }));
  } catch {}
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    parsed.theme = v.theme;
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(parsed));
  } catch {}
  try { document.documentElement.setAttribute("data-weered-theme", v.theme); } catch {}
  try { window.dispatchEvent(new CustomEvent("weered:theme:changed", { detail: { theme: v.theme } })); } catch {}
}

export default function VerticalPicker() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!hasSeen()) {
      const t = setTimeout(() => setOpen(true), 450);
      return () => clearTimeout(t);
    }
  }, []);

  if (!open) return null;

  function pick(v: Vertical) {
    applyVertical(v);
    setOpen(false);
  }

  function skip() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ id: "skipped", at: Date.now() })); } catch {}
    setOpen(false);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="What are you into?"
      onClick={(e) => { if (e.target === e.currentTarget) skip(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 9500,
        background: "rgba(5,5,10,.72)", backdropFilter: "blur(8px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        style={{
          width: "min(760px, 100%)",
          background: "var(--w-panel, rgba(18,18,26,.97))",
          border: "1px solid var(--w-border, rgba(255,255,255,.08))",
          borderRadius: 18,
          padding: "32px 28px 22px",
          boxShadow: "0 30px 80px rgba(0,0,0,.6)",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "2px", textTransform: "uppercase", color: "var(--w-muted, rgba(255,255,255,.35))", marginBottom: 8 }}>
            One quick thing
          </div>
          <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: "-0.5px", lineHeight: 1.2 }}>
            What are you into?
          </div>
          <div style={{ fontSize: 13, color: "var(--w-muted, rgba(255,255,255,.5))", marginTop: 8, maxWidth: 440, margin: "8px auto 0", lineHeight: 1.5 }}>
            Weered is one platform for a lot of audiences. Pick what fits — we&apos;ll dress up the rest to match.
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 10,
          }}
        >
          {VERTICALS.map(v => (
            <button
              key={v.id}
              type="button"
              onClick={() => pick(v)}
              style={{
                textAlign: "left",
                background: "rgba(255,255,255,.02)",
                border: `1px solid ${v.accent}22`,
                borderRadius: 12,
                padding: "16px 14px",
                color: "inherit",
                cursor: "pointer",
                fontFamily: "inherit",
                transition: "all .15s",
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = `${v.accent}55`;
                (e.currentTarget as HTMLElement).style.background = `${v.accent}08`;
                (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = `${v.accent}22`;
                (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,.02)";
                (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 22 }}>{v.emoji}</span>
                <span style={{ fontWeight: 800, fontSize: 14, letterSpacing: "-0.2px" }}>{v.label}</span>
              </div>
              <div style={{ fontSize: 11, color: "var(--w-muted, rgba(255,255,255,.45))", lineHeight: 1.4 }}>
                {v.tagline}
              </div>
              <div style={{
                marginTop: 4,
                fontSize: 9, fontFamily: "monospace", letterSpacing: ".5px",
                color: v.accent, textTransform: "uppercase", fontWeight: 700,
              }}>
                theme: {v.theme}
              </div>
            </button>
          ))}
        </div>

        <div style={{ marginTop: 20, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: 11, color: "var(--w-muted, rgba(255,255,255,.35))" }}>
            You can change this anytime in Profile &rarr; Themes.
          </div>
          <button
            type="button"
            onClick={skip}
            style={{
              background: "transparent",
              border: "1px solid var(--w-border, rgba(255,255,255,.08))",
              borderRadius: 8,
              padding: "7px 14px",
              color: "var(--w-muted, rgba(255,255,255,.55))",
              fontFamily: "inherit", fontSize: 12, fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Skip for now
          </button>
        </div>
      </div>
    </div>
  );
}

"use client";

import React, { useCallback, useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_BASE || "https://api.weered.ca";

export interface LobbySplashPalette {
  accent: string;      // primary brand color (e.g. #e8c48a brass for Windrose, #f58220 solar for Destiny)
  accentHi: string;    // brightened variant for button gradient top
  accentLow: string;   // darkened variant for button gradient bottom
  frame: string;       // card frame color (rgba usually)
  frameGlow: string;   // glow around card
  ink: string;         // button text color (usually near-black)
  pillBg: string;      // live-count pill background
  textDim: string;     // dimmer accent for labels
}

export interface LobbySplashLiveCount {
  endpoint: string;                           // "/windrose/live-players" etc.
  label: string;                              // "Sailing right now"
  suffix: string;                             // "pirates · Steam live"
  extractor?: (j: any) => number | null;      // default: j?.players
  position?: { top: string; right: string };  // default { top: 15%, right: 5% }
}

export interface LobbySplashProps {
  lobbyId: string;
  ogImage: string;                // "/brand/lobbies/windrose-og-v3.png"
  ariaLabel: string;              // "Welcome to the Windrose hub"
  cooldownDays?: number;          // default 7
  ctaLabel?: string;              // default "Enter the Hub →"
  liveCount?: LobbySplashLiveCount;
  palette: LobbySplashPalette;
  storageKey?: string;            // defaults to weered:<lobbyId>:splash:lastShownAt
  forceOpen?: boolean;            // preview/debug: bypass cooldown + don't persist dismiss
}

const WINDROSE_DEFAULT_EXTRACT = (j: any) => (j?.ok && typeof j?.players === "number" ? j.players : null);

export default function LobbySplash({
  lobbyId,
  ogImage,
  ariaLabel,
  cooldownDays = 7,
  ctaLabel = "Enter the Hub →",
  liveCount,
  palette,
  storageKey,
  forceOpen = false,
}: LobbySplashProps) {
  const [open, setOpen] = useState(forceOpen);
  const [closing, setClosing] = useState(false);
  const [count, setCount] = useState<number | null>(null);

  const key = storageKey || `weered:${lobbyId}:splash:lastShownAt`;
  const cooldownMs = cooldownDays * 24 * 60 * 60 * 1000;

  // Cooldown gate — skipped entirely when forceOpen is true
  useEffect(() => {
    if (forceOpen) { setOpen(true); return; }
    let cancelled = false;
    try {
      const raw = localStorage.getItem(key);
      const last = raw ? Number(raw) : 0;
      if (Number.isFinite(last) && Date.now() - last < cooldownMs) return;
    } catch { return; }
    const t = setTimeout(() => { if (!cancelled) setOpen(true); }, 220);
    return () => { cancelled = true; clearTimeout(t); };
  }, [key, cooldownMs, forceOpen]);

  // Live count fetch
  useEffect(() => {
    if (!open || !liveCount) return;
    let cancelled = false;
    const extract = liveCount.extractor || WINDROSE_DEFAULT_EXTRACT;
    fetch(`${API}${liveCount.endpoint}`).then(r => r.json()).then(j => {
      if (cancelled) return;
      const n = extract(j);
      if (typeof n === "number") setCount(n);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [open, liveCount]);

  const handleClose = useCallback(() => {
    if (!forceOpen) {
      try { localStorage.setItem(key, String(Date.now())); } catch {}
    }
    setClosing(true);
    setTimeout(() => setOpen(false), 260);
  }, [key, forceOpen]);

  // ESC dismiss
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") handleClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, handleClose]);

  if (!open) return null;

  return (
    <>
      <style>{`
        @keyframes lobby-splash-in {
          from { opacity: 0; transform: scale(0.985); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes lobby-count-in {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes lobby-count-pulse {
          0%, 100% { box-shadow: 0 0 18px ${palette.frameGlow}; }
          50%      { box-shadow: 0 0 32px ${palette.accent}99; }
        }
        @keyframes lobby-backdrop-pulse {
          0%, 100% { opacity: 0.38; transform: scale(1); }
          50%      { opacity: 0.56; transform: scale(1.04); }
        }
        @keyframes lobby-particle-drift {
          from { background-position: 0 0, 0 0, 0 0; }
          to   { background-position: 800px 400px, -800px 600px, 400px -800px; }
        }
        @keyframes lobby-ring-spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @media (prefers-reduced-motion: reduce) {
          .weered-lobby-splash-root,
          .weered-lobby-splash-inner,
          .weered-lobby-splash-count,
          .weered-lobby-splash-glow,
          .weered-lobby-splash-particles,
          .weered-lobby-splash-ring { animation: none !important; transition: none !important; }
        }
      `}</style>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        onClick={handleClose}
        className="weered-lobby-splash-root"
        style={{
          position: "fixed", inset: 0, zIndex: 9999,
          background: "rgba(3,5,10,0.92)",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: 40,
          opacity: closing ? 0 : 1,
          transition: "opacity 260ms ease",
          animation: !closing ? "lobby-splash-in 420ms cubic-bezier(0.2, 0.7, 0.2, 1)" : undefined,
          overflow: "hidden",
        }}
      >
        {/* Radial accent-colored glow behind the card — breathing pulse */}
        <div
          className="weered-lobby-splash-glow"
          aria-hidden
          style={{
            position: "absolute",
            top: "50%", left: "50%",
            width: "min(1400px, 120vw)", height: "min(1400px, 120vw)",
            transform: "translate(-50%, -50%)",
            background: `radial-gradient(circle at 50% 50%, ${palette.accent}38 0%, ${palette.accent}10 30%, transparent 65%)`,
            pointerEvents: "none",
            filter: "blur(24px)",
            animation: "lobby-backdrop-pulse 6s ease-in-out infinite",
          }}
        />

        {/* Drifting particle/star layer */}
        <div
          className="weered-lobby-splash-particles"
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: `
              radial-gradient(1.6px 1.6px at 18% 28%, ${palette.accent}90, transparent 2px),
              radial-gradient(1.2px 1.2px at 72% 44%, ${palette.accent}70, transparent 2px),
              radial-gradient(1.8px 1.8px at 42% 78%, ${palette.accent}85, transparent 2px)
            `,
            backgroundSize: "800px 800px, 800px 800px, 800px 800px",
            opacity: 0.5,
            pointerEvents: "none",
            animation: "lobby-particle-drift 90s linear infinite",
          }}
        />

        {/* Slow-rotating conic ring behind the card */}
        <div
          className="weered-lobby-splash-ring"
          aria-hidden
          style={{
            position: "absolute",
            top: "50%", left: "50%",
            width: "min(1180px, 110vw)", height: "min(1180px, 110vw)",
            transform: "translate(-50%, -50%)",
            background: `conic-gradient(from 0deg, transparent 0deg, ${palette.accent}22 40deg, transparent 80deg, transparent 180deg, ${palette.accent}18 220deg, transparent 260deg, transparent 360deg)`,
            pointerEvents: "none",
            filter: "blur(8px)",
            opacity: 0.55,
            animation: "lobby-ring-spin 40s linear infinite",
          }}
        />

        <div
          className="weered-lobby-splash-inner"
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "relative",
            maxWidth: 960, width: "100%",
            display: "flex", flexDirection: "column",
            alignItems: "center", gap: 22,
            zIndex: 1,
          }}
        >
          <div style={{
            position: "relative", width: "100%",
            borderRadius: 6, overflow: "hidden",
            boxShadow: `0 24px 70px rgba(0,0,0,0.65), 0 0 0 1px ${palette.frame}, 0 0 60px ${palette.frameGlow}`,
          }}>
            <img
              src={ogImage}
              alt={ariaLabel}
              style={{ width: "100%", height: "auto", display: "block" }}
            />
          </div>

          {/* Live count strip — sits between card and CTA, works for any card composition */}
          {count !== null && liveCount && (
            <div
              className="weered-lobby-splash-count"
              style={{
                display: "flex", alignItems: "center", gap: 18,
                padding: "12px 22px",
                background: palette.pillBg,
                border: `1px solid ${palette.accent}90`,
                borderRadius: 3,
                fontFamily: 'Georgia, "Times New Roman", serif',
                animation: "lobby-count-in 420ms ease 220ms both, lobby-count-pulse 2.6s ease-in-out 700ms infinite",
                backdropFilter: "blur(4px)",
                marginTop: -2,
              }}
            >
              <div style={{ textAlign: "left" }}>
                <div style={{ fontSize: 9, letterSpacing: 2.5, color: palette.textDim, textTransform: "uppercase", fontWeight: 700, marginBottom: 2 }}>
                  {liveCount.label}
                </div>
                <div style={{ fontSize: 10, color: palette.textDim, fontStyle: "italic", letterSpacing: 0.5 }}>
                  {liveCount.suffix}
                </div>
              </div>
              <div style={{
                fontSize: 38, color: palette.accent, lineHeight: 1, fontWeight: 700,
                fontVariantNumeric: "tabular-nums", letterSpacing: "-0.5px",
                paddingLeft: 18, borderLeft: `1px solid ${palette.accent}40`,
              }}>
                {count.toLocaleString()}
              </div>
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, marginTop: 4 }}>
            <button
              type="button"
              onClick={handleClose}
              style={{
                padding: "14px 36px",
                background: `linear-gradient(180deg, ${palette.accentHi} 0%, ${palette.accent} 45%, ${palette.accentLow} 100%)`,
                border: `1px solid ${palette.accentHi}`,
                color: palette.ink,
                fontFamily: 'Georgia, "Times New Roman", serif',
                fontSize: 14, fontWeight: 800,
                letterSpacing: 3, textTransform: "uppercase",
                borderRadius: 3, cursor: "pointer",
                boxShadow: `0 4px 20px ${palette.accent}58, inset 0 1px 0 rgba(255,255,255,0.25)`,
                transition: "transform 0.15s ease, box-shadow 0.15s ease",
              }}
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLElement;
                el.style.transform = "translateY(-1px)";
                el.style.boxShadow = `0 6px 26px ${palette.accent}80, inset 0 1px 0 rgba(255,255,255,0.3)`;
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLElement;
                el.style.transform = "translateY(0)";
                el.style.boxShadow = `0 4px 20px ${palette.accent}58, inset 0 1px 0 rgba(255,255,255,0.25)`;
              }}
            >
              {ctaLabel}
            </button>
            <div style={{ fontSize: 10, color: `${palette.accent}72`, letterSpacing: 1.5, fontFamily: 'Georgia, "Times New Roman", serif', textTransform: "uppercase" }}>
              click anywhere or press ESC
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// Shared palettes for known lobbies
export const WINDROSE_SPLASH_PALETTE: LobbySplashPalette = {
  accent:    "#e8c48a",
  accentHi:  "#f2d4a1",
  accentLow: "#8a6b3e",
  frame:     "rgba(232,196,138,0.35)",
  frameGlow: "rgba(232,196,138,0.28)",
  ink:       "#0a1424",
  pillBg:    "linear-gradient(180deg, rgba(14,24,38,0.95) 0%, rgba(10,18,32,0.95) 100%)",
  textDim:   "#a89775",
};

export const DESTINY_SPLASH_PALETTE: LobbySplashPalette = {
  accent:    "#f58220",  // solar orange
  accentHi:  "#ffb066",
  accentLow: "#a3530f",
  frame:     "rgba(245,130,32,0.40)",
  frameGlow: "rgba(245,130,32,0.30)",
  ink:       "#0a0a12",
  pillBg:    "linear-gradient(180deg, rgba(8,10,20,0.95) 0%, rgba(4,6,14,0.95) 100%)",
  textDim:   "#8a9bb0",
};

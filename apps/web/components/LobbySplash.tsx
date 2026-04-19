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
}

const WINDROSE_DEFAULT_EXTRACT = (j: any) => (j?.ok && typeof j?.players === "number" ? j.players : null);

export default function LobbySplash({
  lobbyId,
  ogImage,
  ariaLabel,
  cooldownDays = 7,
  ctaLabel = "Enter the Hub \u2192",
  liveCount,
  palette,
  storageKey,
}: LobbySplashProps) {
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [count, setCount] = useState<number | null>(null);

  const key = storageKey || `weered:${lobbyId}:splash:lastShownAt`;
  const cooldownMs = cooldownDays * 24 * 60 * 60 * 1000;

  // Cooldown gate
  useEffect(() => {
    let cancelled = false;
    try {
      const raw = localStorage.getItem(key);
      const last = raw ? Number(raw) : 0;
      if (Number.isFinite(last) && Date.now() - last < cooldownMs) return;
    } catch { return; }
    const t = setTimeout(() => { if (!cancelled) setOpen(true); }, 220);
    return () => { cancelled = true; clearTimeout(t); };
  }, [key, cooldownMs]);

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
    try { localStorage.setItem(key, String(Date.now())); } catch {}
    setClosing(true);
    setTimeout(() => setOpen(false), 260);
  }, [key]);

  // ESC dismiss
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") handleClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, handleClose]);

  if (!open) return null;

  const pos = liveCount?.position || { top: "15%", right: "5%" };

  return (
    <>
      <style>{`
        @keyframes lobby-splash-in {
          from { opacity: 0; transform: scale(0.985); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes lobby-count-in {
          from { opacity: 0; transform: translateX(14px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes lobby-count-pulse {
          0%, 100% { box-shadow: 0 0 18px ${palette.frameGlow}; }
          50%      { box-shadow: 0 0 28px ${palette.accent}80; }
        }
        @media (prefers-reduced-motion: reduce) {
          .weered-lobby-splash-root,
          .weered-lobby-splash-inner,
          .weered-lobby-splash-count { animation: none !important; transition: none !important; }
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
          background: "rgba(3,5,10,0.90)",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: 40,
          opacity: closing ? 0 : 1,
          transition: "opacity 260ms ease",
          animation: !closing ? "lobby-splash-in 420ms cubic-bezier(0.2, 0.7, 0.2, 1)" : undefined,
        }}
      >
        <div
          className="weered-lobby-splash-inner"
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "relative",
            maxWidth: 960, width: "100%",
            display: "flex", flexDirection: "column",
            alignItems: "center", gap: 22,
          }}
        >
          <div style={{
            position: "relative", width: "100%",
            borderRadius: 6, overflow: "hidden",
            boxShadow: `0 24px 70px rgba(0,0,0,0.65), 0 0 0 1px ${palette.frame}`,
          }}>
            <img
              src={ogImage}
              alt={ariaLabel}
              style={{ width: "100%", height: "auto", display: "block" }}
            />

            {count !== null && liveCount && (
              <div
                className="weered-lobby-splash-count"
                style={{
                  position: "absolute",
                  top: pos.top, right: pos.right,
                  padding: "12px 18px",
                  background: palette.pillBg,
                  border: `1px solid ${palette.accent}90`,
                  borderRadius: 3,
                  fontFamily: 'Georgia, "Times New Roman", serif',
                  textAlign: "center",
                  minWidth: 160,
                  animation: "lobby-count-in 400ms ease 200ms both, lobby-count-pulse 2.4s ease-in-out 600ms infinite",
                  backdropFilter: "blur(4px)",
                }}
              >
                <div style={{ fontSize: 9, letterSpacing: 2.5, color: palette.textDim, textTransform: "uppercase", fontWeight: 700, marginBottom: 4 }}>
                  {liveCount.label}
                </div>
                <div style={{ fontSize: 34, color: palette.accent, lineHeight: 1, fontWeight: 700, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.5px" }}>
                  {count.toLocaleString()}
                </div>
                <div style={{ fontSize: 9, color: palette.textDim, marginTop: 4, fontStyle: "italic", letterSpacing: 0.5 }}>
                  {liveCount.suffix}
                </div>
              </div>
            )}
          </div>

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

"use client";

import React, { useCallback, useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_BASE || "https://api.weered.ca";
const STORAGE_KEY = "weered:windrose:splash:lastShownAt";
const COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export default function WindroseSplash() {
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [count, setCount] = useState<number | null>(null);

  // Decide whether to show based on localStorage cooldown
  useEffect(() => {
    let cancelled = false;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const last = raw ? Number(raw) : 0;
      if (Number.isFinite(last) && Date.now() - last < COOLDOWN_MS) return;
    } catch { return; }
    // Tiny delay so the lobby chrome paints behind first — nicer entrance
    const t = setTimeout(() => { if (!cancelled) setOpen(true); }, 220);
    return () => { cancelled = true; clearTimeout(t); };
  }, []);

  // Pull live player count once the splash is visible
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetch(`${API}/windrose/live-players`).then(r => r.json()).then(j => {
      if (cancelled) return;
      if (j?.ok && typeof j.players === "number") setCount(j.players);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [open]);

  const handleClose = useCallback(() => {
    try { localStorage.setItem(STORAGE_KEY, String(Date.now())); } catch {}
    setClosing(true);
    const t = setTimeout(() => setOpen(false), 260);
    return () => clearTimeout(t);
  }, []);

  // ESC dismisses
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
        @keyframes windrose-splash-in {
          from { opacity: 0; transform: scale(0.985); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes windrose-count-in {
          from { opacity: 0; transform: translateX(14px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes windrose-count-pulse {
          0%, 100% { box-shadow: 0 0 18px rgba(232,196,138,0.28); }
          50%      { box-shadow: 0 0 28px rgba(232,196,138,0.45); }
        }
        @media (prefers-reduced-motion: reduce) {
          .weered-wr-splash-root,
          .weered-wr-splash-inner,
          .weered-wr-splash-count { animation: none !important; transition: none !important; }
        }
      `}</style>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Welcome to the Windrose hub"
        onClick={handleClose}
        className="weered-wr-splash-root"
        style={{
          position: "fixed", inset: 0, zIndex: 9999,
          background: "rgba(5,8,15,0.88)",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: 40,
          opacity: closing ? 0 : 1,
          transition: "opacity 260ms ease",
          animation: !closing ? "windrose-splash-in 420ms cubic-bezier(0.2, 0.7, 0.2, 1)" : undefined,
        }}
      >
        <div
          className="weered-wr-splash-inner"
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "relative",
            maxWidth: 960,
            width: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 22,
          }}
        >
          {/* Card + live overlay */}
          <div style={{ position: "relative", width: "100%", borderRadius: 6, overflow: "hidden", boxShadow: "0 24px 70px rgba(0,0,0,0.65), 0 0 0 1px rgba(232,196,138,0.35)" }}>
            <img
              src="/brand/lobbies/windrose-og-v3.png"
              alt="Windrose — unofficial community hub"
              style={{ width: "100%", height: "auto", display: "block" }}
            />

            {count !== null && (
              <div
                className="weered-wr-splash-count"
                style={{
                  position: "absolute",
                  top: "15%",
                  right: "5%",
                  padding: "12px 18px",
                  background: "linear-gradient(180deg, rgba(14,24,38,0.95) 0%, rgba(10,18,32,0.95) 100%)",
                  border: "1px solid rgba(232,196,138,0.55)",
                  borderRadius: 3,
                  fontFamily: 'Georgia, "Times New Roman", serif',
                  textAlign: "center",
                  minWidth: 160,
                  animation: "windrose-count-in 400ms ease 200ms both, windrose-count-pulse 2.4s ease-in-out 600ms infinite",
                  backdropFilter: "blur(4px)",
                }}
              >
                <div style={{ fontSize: 9, letterSpacing: 2.5, color: "#c9a066", textTransform: "uppercase", fontWeight: 700, marginBottom: 4 }}>
                  Sailing right now
                </div>
                <div style={{ fontSize: 34, color: "#e8c48a", lineHeight: 1, fontWeight: 700, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.5px" }}>
                  {count.toLocaleString()}
                </div>
                <div style={{ fontSize: 9, color: "#a89775", marginTop: 4, fontStyle: "italic", letterSpacing: 0.5 }}>
                  pirates · Steam live
                </div>
              </div>
            )}
          </div>

          {/* Enter button + hint */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, marginTop: 4 }}>
            <button
              type="button"
              onClick={handleClose}
              style={{
                padding: "14px 36px",
                background: "linear-gradient(180deg, #e8c48a 0%, #c9a066 45%, #8a6b3e 100%)",
                border: "1px solid #f2d4a1",
                color: "#0a1424",
                fontFamily: 'Georgia, "Times New Roman", serif',
                fontSize: 14,
                fontWeight: 800,
                letterSpacing: 3,
                textTransform: "uppercase",
                borderRadius: 3,
                cursor: "pointer",
                boxShadow: "0 4px 20px rgba(232,196,138,0.35), inset 0 1px 0 rgba(255,255,255,0.25)",
                transition: "transform 0.15s ease, box-shadow 0.15s ease",
              }}
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLElement;
                el.style.transform = "translateY(-1px)";
                el.style.boxShadow = "0 6px 26px rgba(232,196,138,0.5), inset 0 1px 0 rgba(255,255,255,0.3)";
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLElement;
                el.style.transform = "translateY(0)";
                el.style.boxShadow = "0 4px 20px rgba(232,196,138,0.35), inset 0 1px 0 rgba(255,255,255,0.25)";
              }}
            >
              Enter the Hub &rarr;
            </button>
            <div style={{ fontSize: 10, color: "rgba(232,196,138,0.45)", letterSpacing: 1.5, fontFamily: 'Georgia, "Times New Roman", serif', textTransform: "uppercase" }}>
              click anywhere or press ESC
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

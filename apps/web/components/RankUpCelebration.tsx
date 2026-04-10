"use client";

import React, { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";

const RANK_COLORS: Record<string, string> = {
  "Street Rat":   "#94A3B8",
  "Corner Boy":   "#60A5FA",
  "Hustler":      "#34D399",
  "Shot Caller":  "#FBBF24",
  "Enforcer":     "#F97316",
  "Made Man":     "#EF4444",
  "Underboss":    "#A78BFA",
  "Crime Lord":   "#E879F9",
  "Kingpin":      "#FDE68A",
};

function rankColor(rank: string): string {
  return RANK_COLORS[rank] || "#D4A017";
}

export default function RankUpCelebration() {
  const [show, setShow] = useState(false);
  const [data, setData] = useState<{ oldRank: string; newRank: string; score: number } | null>(null);
  const [phase, setPhase] = useState<"enter" | "hold" | "exit">("enter");

  const handleRankUp = useCallback((e: Event) => {
    const detail = (e as CustomEvent).detail;
    if (!detail?.newRank) return;
    setData(detail);
    setPhase("enter");
    setShow(true);

    // Hold for 4 seconds, then exit
    setTimeout(() => setPhase("hold"), 600);
    setTimeout(() => setPhase("exit"), 4000);
    setTimeout(() => { setShow(false); setData(null); }, 4800);
  }, []);

  useEffect(() => {
    window.addEventListener("weered:notoriety:rankup", handleRankUp);
    return () => window.removeEventListener("weered:notoriety:rankup", handleRankUp);
  }, [handleRankUp]);

  if (!show || !data || typeof document === "undefined") return null;

  const color = rankColor(data.newRank);

  const overlay = (
    <div style={{
      position: "fixed", inset: 0, zIndex: 99999,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      background: phase === "exit" ? "transparent" : "rgba(0,0,0,.85)",
      backdropFilter: phase === "exit" ? "none" : "blur(16px)",
      transition: "background 0.8s, backdrop-filter 0.8s",
      pointerEvents: "none",
    }}>
      {/* Radial glow */}
      <div style={{
        position: "absolute", inset: 0,
        background: `radial-gradient(circle at 50% 45%, ${color}25 0%, transparent 60%)`,
        opacity: phase === "enter" ? 0 : phase === "exit" ? 0 : 1,
        transition: "opacity 0.8s",
      }} />

      {/* Particle ring */}
      <div style={{
        position: "absolute", width: 300, height: 300,
        borderRadius: "50%",
        border: `2px solid ${color}40`,
        boxShadow: `0 0 60px ${color}20, inset 0 0 60px ${color}10`,
        opacity: phase === "hold" ? 1 : 0,
        transform: phase === "hold" ? "scale(1)" : "scale(0.5)",
        transition: "all 1s cubic-bezier(0.16,1,0.3,1)",
        animation: phase === "hold" ? "rankup-spin 8s linear infinite" : "none",
      }} />

      {/* Old rank (fades out) */}
      <div style={{
        fontSize: 14, fontWeight: 700, fontFamily: "monospace",
        letterSpacing: "2px", textTransform: "uppercase",
        color: "rgba(148,163,184,.5)",
        opacity: phase === "enter" ? 1 : 0,
        transform: phase === "enter" ? "translateY(0)" : "translateY(-20px)",
        transition: "all 0.6s ease",
        marginBottom: 8,
        position: "relative", zIndex: 2,
      }}>
        {data.oldRank}
      </div>

      {/* Arrow / divider */}
      <div style={{
        fontSize: 20, color: `${color}88`,
        opacity: phase === "hold" ? 1 : 0,
        transition: "opacity 0.4s",
        marginBottom: 8,
        position: "relative", zIndex: 2,
      }}>
        &#x2B07;
      </div>

      {/* New rank (big reveal) */}
      <div style={{
        fontSize: 42, fontWeight: 900,
        letterSpacing: "-1px",
        color: color,
        textShadow: `0 0 40px ${color}60, 0 0 80px ${color}30`,
        opacity: phase === "enter" ? 0 : phase === "exit" ? 0 : 1,
        transform: phase === "enter" ? "scale(0.7) translateY(20px)" : phase === "exit" ? "scale(1.1) translateY(-10px)" : "scale(1)",
        transition: "all 0.8s cubic-bezier(0.16,1,0.3,1)",
        position: "relative", zIndex: 2,
      }}>
        {data.newRank}
      </div>

      {/* Subtitle */}
      <div style={{
        marginTop: 12, fontSize: 13, fontFamily: "monospace",
        letterSpacing: "1px", color: "rgba(243,244,246,.45)",
        opacity: phase === "hold" ? 1 : 0,
        transition: "opacity 0.6s ease 0.3s",
        position: "relative", zIndex: 2,
      }}>
        {data.score?.toLocaleString()} NOTORIETY
      </div>

      {/* XP bar flash */}
      <div style={{
        marginTop: 20, width: 200, height: 4, borderRadius: 2,
        background: "rgba(255,255,255,.06)",
        overflow: "hidden",
        opacity: phase === "hold" ? 1 : 0,
        transition: "opacity 0.4s ease 0.5s",
        position: "relative", zIndex: 2,
      }}>
        <div style={{
          height: "100%", borderRadius: 2,
          background: `linear-gradient(90deg, #5800E5, ${color})`,
          width: phase === "hold" ? "100%" : "0%",
          transition: "width 2s ease-out 0.3s",
          boxShadow: `0 0 8px ${color}55`,
        }} />
      </div>

      <style>{`
        @keyframes rankup-spin {
          from { transform: scale(1) rotate(0deg); }
          to { transform: scale(1) rotate(360deg); }
        }
      `}</style>
    </div>
  );

  return createPortal(overlay, document.body);
}

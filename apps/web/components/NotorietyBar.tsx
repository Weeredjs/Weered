"use client";

import React, { useState, useEffect } from "react";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";

const RANKS = [
  { title: "Street Rat",   min: 0     },
  { title: "Corner Boy",   min: 100   },
  { title: "Hustler",      min: 300   },
  { title: "Shot Caller",  min: 500   },
  { title: "Enforcer",     min: 1000  },
  { title: "Made Man",     min: 1500  },
  { title: "Underboss",    min: 3000  },
  { title: "Crime Lord",   min: 5000  },
  { title: "Kingpin",      min: 10000 },
];

function getRank(score: number) {
  let rank = RANKS[0];
  for (const r of RANKS) {
    if (score >= r.min) rank = r;
  }
  const idx = RANKS.indexOf(rank);
  const next = idx < RANKS.length - 1 ? RANKS[idx + 1] : null;
  return { ...rank, next };
}

interface Props {
  score?: number;
  compact?: boolean;
  onClick?: () => void;
}

export default function NotorietyBar({ score: propScore, compact = false, onClick }: Props) {
  const [score, setScore] = useState(propScore ?? 0);
  const [loaded, setLoaded] = useState(propScore !== undefined);

  useEffect(() => {
    if (propScore !== undefined) { setScore(propScore); setLoaded(true); return; }

    let token = "";
    try { token = localStorage.getItem("weered_token") || ""; } catch {}
    if (!token) return;

    fetch(`${API}/notoriety/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(j => { if (j.ok) { setScore(j.score); setLoaded(true); } })
      .catch(() => {});
  }, [propScore]);

  useEffect(() => {
    function handleAward(e: Event) {
      const pts = (e as CustomEvent).detail?.points;
      if (typeof pts === "number") setScore(prev => prev + pts);
    }
    window.addEventListener("weered:notoriety:award", handleAward);
    return () => window.removeEventListener("weered:notoriety:award", handleAward);
  }, []);

  if (!loaded) return null;

  const rank = getRank(score);
  const progress = rank.next
    ? Math.min(1, (score - rank.min) / (rank.next.min - rank.min))
    : 1;

  if (compact) {
    return (
      <div
        onClick={onClick}
        style={{
          display: "flex", alignItems: "center", gap: 6,
          cursor: onClick ? "pointer" : "default",
          padding: "4px 0",
        }}
        title={`${score} XP — ${rank.title}${rank.next ? ` (${rank.next.min - score} to ${rank.next.title})` : ""}`}
      >
        <span style={{
          fontSize: 10, fontWeight: 800, color: "#D4A017",
          letterSpacing: "0.06em", fontFamily: "monospace",
        }}>
          ★ {score}
        </span>
        <div style={{
          flex: 1, height: 3, borderRadius: 2, minWidth: 40,
          background: "rgba(255,255,255,0.06)",
          overflow: "hidden",
        }}>
          <div style={{
            height: "100%", borderRadius: 2,
            background: "linear-gradient(90deg, #5800E5, #D4A017)",
            width: `${progress * 100}%`,
            transition: "width 0.6s ease",
          }} />
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      style={{
        padding: "10px 12px", borderRadius: 10,
        background: "rgba(88,0,229,0.06)",
        border: "1px solid rgba(88,0,229,0.15)",
        cursor: onClick ? "pointer" : "default",
        transition: "all 0.15s",
      }}
      onMouseEnter={e => {
        if (!onClick) return;
        e.currentTarget.style.background = "rgba(88,0,229,0.1)";
        e.currentTarget.style.borderColor = "rgba(88,0,229,0.3)";
      }}
      onMouseLeave={e => {
        if (!onClick) return;
        e.currentTarget.style.background = "rgba(88,0,229,0.06)";
        e.currentTarget.style.borderColor = "rgba(88,0,229,0.15)";
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{
            fontSize: 12, fontWeight: 900, color: "#D4A017",
            fontFamily: "monospace",
          }}>★</span>
          <span style={{
            fontSize: 12, fontWeight: 800, color: "rgba(243,244,246,0.9)",
            letterSpacing: "-0.2px",
          }}>
            {rank.title}
          </span>
        </div>
        <span style={{
          fontSize: 10, fontWeight: 700, color: "rgba(212,160,23,0.7)",
          fontFamily: "monospace",
        }}>
          {score.toLocaleString()} XP
        </span>
      </div>

      <div style={{
        height: 5, borderRadius: 3,
        background: "rgba(255,255,255,0.06)",
        overflow: "hidden",
      }}>
        <div style={{
          height: "100%", borderRadius: 3,
          background: "linear-gradient(90deg, #5800E5, #D4A017)",
          width: `${progress * 100}%`,
          transition: "width 0.6s ease",
          boxShadow: "0 0 8px rgba(212,160,23,0.3)",
        }} />
      </div>

      {rank.next && (
        <div style={{
          display: "flex", justifyContent: "space-between",
          marginTop: 4,
          fontSize: 9, color: "rgba(148,163,184,0.4)",
          fontFamily: "monospace",
        }}>
          <span>{rank.next.min - score} XP to {rank.next.title}</span>
          <span>{Math.round(progress * 100)}%</span>
        </div>
      )}
    </div>
  );
}

"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import StreamInterceptModal, { type StreamInfo } from "./StreamInterceptModal";
import { useWatchHere, consumePendingStream } from "../lib/useWatchHere";
import EmptyState from "./EmptyState";
import LoadingState from "./LoadingState";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";

function authHeaders(): Record<string, string> {
  try { const t = localStorage.getItem("weered_token") || ""; return t ? { Authorization: `Bearer ${t}` } : {}; } catch { return {}; }
}

async function apiFetch(path: string, opts?: RequestInit) {
  const r = await fetch(`${API}${path}`, { ...opts, headers: { "Content-Type": "application/json", ...authHeaders(), ...(opts?.headers || {}) } });
  return r.json();
}

// ═══ Windrose Palette ══════════════════════════════════════════════════════════

const PAL = {
  abyss:     "#0e1826",   // deepest shadow — visible dark blue, not black
  stormDeep: "#19283e",   // base — deep sea at dusk
  stormMid:  "#243752",   // mid — more life, lets brass pop
  stormFoam: "#2e4363",   // highlight — foam on the crest
  brass:     "#c9a066",
  brassHi:   "#e8c48a",
  brassLow:  "#8a6b3e",
  verdigris: "#4a8a9d",
  parchment: "#e4d4b0",   // warmer parchment
  parchDim:  "#a89775",
  sea:       "#3a7488",
  blood:     "#a33d3d",   // warmer, candle-lit pirate red
  ink:       "#0a1220",
};

// ═══ Styles ════════════════════════════════════════════════════════════════════

const WR_FONT_DISPLAY = `"Pirata One", "Cinzel Decorative", "Luminari", "Georgia", serif`;
const WR_FONT_SERIF   = `"Cormorant Garamond", "EB Garamond", "Crimson Pro", "Palatino Linotype", Georgia, serif`;
const WR_FONT_MONO    = `"DM Mono", "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace`;

const S = {
  shell: {
    display: "flex", flexDirection: "column" as const,
    background: `
      radial-gradient(ellipse 120% 80% at 50% -10%, ${PAL.stormFoam}90 0%, transparent 55%),
      radial-gradient(ellipse 80% 60% at 20% 110%, ${PAL.sea}25 0%, transparent 60%),
      linear-gradient(180deg, ${PAL.stormDeep} 0%, ${PAL.abyss} 100%)
    `,
    color: PAL.parchment,
    fontFamily: WR_FONT_SERIF,
    position: "relative" as const,
  },
  plaque: {
    padding: "18px 22px 14px",
    borderBottom: `1px solid ${PAL.brass}30`,
    background: `linear-gradient(180deg, ${PAL.stormMid} 0%, ${PAL.stormDeep} 100%)`,
    position: "relative" as const,
  },
  tabBar: {
    display: "flex", gap: 2, padding: "0 18px", alignItems: "flex-end",
    background: `linear-gradient(180deg, ${PAL.stormDeep} 0%, ${PAL.abyss} 100%)`,
    borderBottom: `1px solid ${PAL.brass}25`,
  },
  body: {
    padding: "22px 22px 28px",
    position: "relative" as const,
  },
  card: {
    borderRadius: 0,
    border: `1px solid ${PAL.brass}35`,
    background: `linear-gradient(180deg, ${PAL.stormMid}c0 0%, ${PAL.stormDeep}e0 100%)`,
    padding: "16px 18px",
    position: "relative" as const,
  },
  btn: {
    padding: "8px 16px",
    borderRadius: 2,
    border: `1px solid ${PAL.brass}55`,
    background: `linear-gradient(180deg, ${PAL.stormMid} 0%, ${PAL.abyss} 100%)`,
    color: PAL.brassHi,
    fontFamily: WR_FONT_SERIF,
    fontSize: 12,
    letterSpacing: "1.5px",
    textTransform: "uppercase" as const,
    fontWeight: 600,
    cursor: "pointer",
    transition: "all .15s",
  },
  btnPrimary: {
    padding: "10px 20px",
    borderRadius: 2,
    border: `1px solid ${PAL.brassHi}`,
    background: `linear-gradient(180deg, ${PAL.brass} 0%, ${PAL.brassLow} 100%)`,
    color: PAL.abyss,
    fontFamily: WR_FONT_DISPLAY,
    fontSize: 14,
    letterSpacing: "2px",
    textTransform: "uppercase" as const,
    fontWeight: 700,
    cursor: "pointer",
    transition: "all .15s",
    boxShadow: `0 0 0 1px ${PAL.brassLow}, 0 4px 18px ${PAL.brass}30`,
  },
  input: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 2,
    border: `1px solid ${PAL.brass}35`,
    background: `${PAL.ink}a0`,
    fontFamily: WR_FONT_MONO,
    fontSize: 13,
    color: PAL.parchment,
    outline: "none",
    boxSizing: "border-box" as const,
  },
  label: {
    fontFamily: WR_FONT_SERIF,
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: "3px",
    textTransform: "uppercase" as const,
    color: PAL.brass,
    opacity: 0.75,
  },
  title: {
    fontFamily: WR_FONT_DISPLAY,
    fontSize: 32,
    letterSpacing: "0.5px",
    color: PAL.brassHi,
    lineHeight: 1,
    textShadow: `0 2px 12px ${PAL.brass}40`,
  },
};

// ═══ SVG Ornaments ═════════════════════════════════════════════════════════════

function SailMark({ size = 56, color = PAL.brassHi, glow = true }: { size?: number; color?: string; glow?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" fill="none" style={{ filter: glow ? `drop-shadow(0 0 10px ${color}55)` : "none", color }}>
      <path d="M32 10 Q 56 40 92 64 L 34 72 Z" fill="currentColor" />
      <rect x="22" y="82" width="70" height="6" rx="1" fill="currentColor" />
    </svg>
  );
}

function CompassRose({ size = 72, color = PAL.brass, glow = true }: { size?: number; color?: string; glow?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ filter: glow ? `drop-shadow(0 0 8px ${color}55)` : "none" }}>
      {/* outer ring */}
      <circle cx="50" cy="50" r="48" fill="none" stroke={color} strokeWidth="0.6" opacity="0.5" />
      <circle cx="50" cy="50" r="44" fill="none" stroke={color} strokeWidth="0.4" opacity="0.3" />
      {/* cardinal rays (long) */}
      <path d="M50 4 L53 47 L50 50 L47 47 Z" fill={color} opacity="0.95" />
      <path d="M50 96 L53 53 L50 50 L47 53 Z" fill={color} opacity="0.55" />
      <path d="M96 50 L53 53 L50 50 L53 47 Z" fill={color} opacity="0.75" />
      <path d="M4 50 L47 53 L50 50 L47 47 Z" fill={color} opacity="0.75" />
      {/* intercardinal (short) */}
      <path d="M82 18 L53 47 L50 50 L52 45 Z" fill={color} opacity="0.4" />
      <path d="M18 18 L47 47 L50 50 L48 45 Z" fill={color} opacity="0.4" />
      <path d="M82 82 L53 53 L50 50 L52 55 Z" fill={color} opacity="0.4" />
      <path d="M18 82 L47 53 L50 50 L48 55 Z" fill={color} opacity="0.4" />
      {/* center */}
      <circle cx="50" cy="50" r="3.5" fill={PAL.abyss} stroke={color} strokeWidth="0.8" />
      {/* cardinal labels */}
      <text x="50" y="12" fill={color} fontSize="8" fontFamily={WR_FONT_DISPLAY} textAnchor="middle" opacity="0.9">N</text>
      <text x="50" y="94" fill={color} fontSize="6" fontFamily={WR_FONT_DISPLAY} textAnchor="middle" opacity="0.6">S</text>
      <text x="92" y="53" fill={color} fontSize="6" fontFamily={WR_FONT_DISPLAY} textAnchor="middle" opacity="0.7">E</text>
      <text x="8"  y="53" fill={color} fontSize="6" fontFamily={WR_FONT_DISPLAY} textAnchor="middle" opacity="0.7">W</text>
    </svg>
  );
}

function BrassDivider({ width = "100%", ornament = true }: { width?: string | number; ornament?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, width, margin: "14px 0" }}>
      <div style={{ flex: 1, height: 1, background: `linear-gradient(90deg, transparent, ${PAL.brass}80, transparent)` }} />
      {ornament && (
        <svg width="14" height="14" viewBox="0 0 14 14" style={{ flexShrink: 0 }}>
          <path d="M7 1 L9 7 L7 13 L5 7 Z" fill={PAL.brass} opacity="0.8" />
          <circle cx="7" cy="7" r="1" fill={PAL.brassHi} />
        </svg>
      )}
      <div style={{ flex: 1, height: 1, background: `linear-gradient(90deg, transparent, ${PAL.brass}80, transparent)` }} />
    </div>
  );
}

function Rivet({ size = 8 }: { size?: number }) {
  return (
    <span style={{
      width: size, height: size, borderRadius: "50%",
      background: `radial-gradient(circle at 30% 30%, ${PAL.brassHi}, ${PAL.brassLow})`,
      boxShadow: `inset 0 1px 2px ${PAL.ink}, 0 1px 2px ${PAL.ink}`,
      display: "inline-block", flexShrink: 0,
    }} />
  );
}

function SkullIcon({ size = 14, color = PAL.brass }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M12 2 C7 2 4 6 4 10 C4 13 5 15 7 16 L7 19 L9 19 L9 21 L15 21 L15 19 L17 19 L17 16 C19 15 20 13 20 10 C20 6 17 2 12 2 Z" fill={color} opacity="0.85" />
      <circle cx="9" cy="10" r="1.6" fill={PAL.abyss} />
      <circle cx="15" cy="10" r="1.6" fill={PAL.abyss} />
      <path d="M10 14 L12 16 L14 14" stroke={PAL.abyss} strokeWidth="1" fill="none" strokeLinecap="round" />
    </svg>
  );
}

// ═══ Tabs ═══════════════════════════════════════════════════════════════════════

const TABS = [
  { id: "flagship" as const, label: "Flagship" },
  { id: "log"      as const, label: "Captain's Log" },
  { id: "crew"     as const, label: "Crew Finder" },
  { id: "bounties" as const, label: "Bounties" },
  { id: "ports"    as const, label: "Ports of Call" },
  { id: "streams"  as const, label: "Streams" },
  { id: "about"    as const, label: "About" },
];
type TabId = typeof TABS[number]["id"];

// ═══ Live Player Counter ═══════════════════════════════════════════════════════

function LivePlayers() {
  const [count, setCount] = useState<number | null>(null);
  const [pulse, setPulse] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const j = await apiFetch("/windrose/live-players");
      if (j?.ok && typeof j.players === "number") {
        setCount(j.players);
        setErr(null);
        setPulse(true);
        setTimeout(() => setPulse(false), 1400);
      } else {
        setErr("Steam unreachable");
      }
    } catch { setErr("Steam unreachable"); }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [load]);

  const display = count === null ? "—" : count.toLocaleString();

  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      padding: "22px 24px", minWidth: 260,
      background: `linear-gradient(180deg, ${PAL.stormDeep}ff 0%, ${PAL.abyss}ff 100%)`,
      border: `2px solid ${PAL.brass}`,
      position: "relative",
      boxShadow: `inset 0 0 40px ${PAL.ink}80, 0 0 0 1px ${PAL.brassLow}, 0 12px 40px ${PAL.ink}`,
    }}>
      {/* corner rivets */}
      <span style={{ position: "absolute", top: 6, left: 6 }}><Rivet /></span>
      <span style={{ position: "absolute", top: 6, right: 6 }}><Rivet /></span>
      <span style={{ position: "absolute", bottom: 6, left: 6 }}><Rivet /></span>
      <span style={{ position: "absolute", bottom: 6, right: 6 }}><Rivet /></span>

      <div style={{ ...S.label, marginBottom: 4 }}>Pirates at Sea · Live</div>
      <div style={{
        fontFamily: WR_FONT_DISPLAY,
        fontSize: 64,
        lineHeight: 1,
        color: pulse ? PAL.brassHi : PAL.brass,
        textShadow: pulse ? `0 0 24px ${PAL.brassHi}88` : `0 0 12px ${PAL.brass}40`,
        transition: "all .4s",
        fontVariantNumeric: "tabular-nums",
        letterSpacing: "-1px",
      }}>
        {display}
      </div>
      <div style={{ fontSize: 11, color: PAL.parchDim, marginTop: 6, fontFamily: WR_FONT_MONO, letterSpacing: "0.5px" }}>
        {err ? err : "Steam · refreshes every 60s"}
      </div>
    </div>
  );
}

// ═══ Launch Milestones ═════════════════════════════════════════════════════════

function LaunchStats() {
  const [data, setData] = useState<any | null>(null);
  useEffect(() => {
    apiFetch("/windrose/launch").then(j => { if (j?.ok) setData(j); });
  }, []);

  const milestones = data?.milestones || [
    { label: "Units sold (48h)", value: "500,000", sub: "Early Access" },
    { label: "Peak CCU",          value: "~100,000", sub: "Launch week" },
    { label: "Review score",      value: "89%",      sub: "Positive" },
  ];

  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${milestones.length}, 1fr)`, gap: 12 }}>
      {milestones.map((m: any, i: number) => (
        <div key={i} style={{
          ...S.card,
          padding: "14px 16px",
          textAlign: "center",
          background: `linear-gradient(180deg, ${PAL.stormMid} 0%, ${PAL.stormDeep} 100%)`,
        }}>
          <div style={{ ...S.label, fontSize: 9, marginBottom: 4 }}>{m.label}</div>
          <div style={{ fontFamily: WR_FONT_DISPLAY, fontSize: 26, color: PAL.brassHi, lineHeight: 1, marginTop: 4 }}>
            {m.value}
          </div>
          <div style={{ fontSize: 10, color: PAL.parchDim, marginTop: 5, fontStyle: "italic" }}>
            {m.sub}
          </div>
        </div>
      ))}
    </div>
  );
}

// ═══ Tab: Flagship ═════════════════════════════════════════════════════════════

function FlagshipTab() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Hero row */}
      <div style={{ display: "flex", gap: 20, alignItems: "stretch" }}>
        <LivePlayers />
        <div style={{ ...S.card, flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "22px 24px" }}>
          <div style={{ ...S.label, marginBottom: 8 }}>Kraken Express · Age of Piracy</div>
          <div style={{ fontFamily: WR_FONT_DISPLAY, fontSize: 36, color: PAL.parchment, lineHeight: 1.1, letterSpacing: "0.5px" }}>
            Build. Sail. Survive the storm.
          </div>
          <div style={{ fontSize: 14, color: PAL.parchDim, marginTop: 10, lineHeight: 1.55, fontStyle: "italic", maxWidth: 520 }}>
            Solo or eight-deep with the crew. Procedural isles, soulslite combat, naval warfare, and boss fights that bite back. Published by Pocketpair.
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
            <a href="https://store.steampowered.com/app/3041230/Windrose/" target="_blank" rel="noopener noreferrer" style={{ ...S.btnPrimary, textDecoration: "none", display: "inline-block" }}>
              Open on Steam
            </a>
            <a href="https://playwindrose.com/" target="_blank" rel="noopener noreferrer" style={{ ...S.btn, textDecoration: "none", display: "inline-block" }}>
              playwindrose.com
            </a>
          </div>
        </div>
      </div>

      <BrassDivider />

      {/* Launch milestones */}
      <div>
        <div style={{ ...S.label, marginBottom: 10, textAlign: "center" }}>Launch Week · 2026-04-14</div>
        <LaunchStats />
      </div>

      <BrassDivider />

      {/* Live activity — chaos-bar stitch of bounties, crews, servers, flags */}
      <ActivityTicker />

      <BrassDivider />

      {/* Three-column: Inspiration / Systems / Platform */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
        <FeatureBlock icon="⚓" title="Soulslite Combat" body="Challenging bosses. Weighty swings. Parries that matter. Not a Souls clone — a Souls-lite. Takes inspiration from Black Flag." />
        <FeatureBlock icon="🌊" title="Naval & Exploration" body="Procedural open world. Build a galleon, captain a crew of eight, discover isles, and weather real-time storms." />
        <FeatureBlock icon="🏴‍☠️" title="PvE, Solo or Co-op" body="Fully playable offline. Self-hosted or dedicated servers. 8-player co-op. No forced PvP." />
      </div>
    </div>
  );
}

// ═══ Activity Ticker ═══════════════════════════════════════════════════════

type ActivityEvent = {
  id: string;
  kind: "bounty_post" | "bounty_settle" | "bounty_cancel" | "crew_publish" | "server_list" | "lfg_raise";
  ts: string;
  actor?: string | null;
  subject?: string | null;
  amount?: number | null;
  meta?: Record<string, any>;
};

function ActivityTicker() {
  const [events, setEvents] = useState<ActivityEvent[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  const load = useCallback(async () => {
    try {
      const j = await apiFetch("/windrose/activity");
      if (j?.ok && Array.isArray(j.events)) setEvents(j.events);
      else setEvents([]);
    } catch { setEvents([]); }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [load]);

  const shown = expanded ? (events || []) : (events || []).slice(0, 8);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#5db765", boxShadow: "0 0 8px #5db765", animation: "windrose-wave 1.2s ease-in-out infinite" }} />
        <span style={{ ...S.label, fontSize: 10 }}>On the Wire</span>
        <span style={{ flex: 1, height: 1, background: `linear-gradient(90deg, transparent, ${PAL.brass}40, transparent)` }} />
        <span style={{ fontFamily: WR_FONT_MONO, fontSize: 10, color: PAL.parchDim, letterSpacing: "0.5px" }}>
          last 14 days
        </span>
      </div>

      {loading ? (
        <div style={{ padding: "14px 18px", textAlign: "center", fontSize: 12, color: PAL.parchDim, fontStyle: "italic", ...S.card }}>
          Listening to the docks…
        </div>
      ) : !events || events.length === 0 ? (
        <div style={{ padding: "14px 18px", textAlign: "center", fontSize: 12, color: PAL.parchDim, fontStyle: "italic", ...S.card }}>
          Quiet harbour. Post a bounty or raise a flag to kick it off.
        </div>
      ) : (
        <>
          <div style={{ ...S.card, padding: "4px 0", display: "flex", flexDirection: "column" }}>
            {shown.map((e, i) => (
              <ActivityRow key={e.id} event={e} alt={i % 2 === 1} />
            ))}
          </div>
          {events.length > 8 && (
            <div style={{ textAlign: "center", marginTop: 10 }}>
              <button type="button" style={{ ...S.btn, fontSize: 10, padding: "5px 14px" }} onClick={() => setExpanded(v => !v)}>
                {expanded ? "Show less" : `Show all ${events.length}`}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ActivityRow({ event, alt }: { event: ActivityEvent; alt: boolean }) {
  const { glyph, color } = (() => {
    switch (event.kind) {
      case "bounty_post":    return { glyph: "☠", color: PAL.blood };
      case "bounty_settle":  return { glyph: "⚔", color: "#5db765" };
      case "bounty_cancel":  return { glyph: "✕", color: PAL.parchDim };
      case "crew_publish":   return { glyph: "⚑", color: PAL.brassHi };
      case "server_list":    return { glyph: "⚓", color: PAL.verdigris };
      case "lfg_raise":      return { glyph: "🏴", color: PAL.brass };
      default:               return { glyph: "·", color: PAL.parchDim };
    }
  })();

  const line = (() => {
    const amt = (event.amount || 0).toLocaleString();
    const actor = event.actor || "someone";
    const subject = event.subject || "…";
    switch (event.kind) {
      case "bounty_post":
        return <><strong style={{ color: PAL.parchment, fontStyle: "normal" }}>{actor}</strong> put <span style={{ color: PAL.brassHi, fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>{amt} Paper</span> on <strong style={{ color: PAL.blood, fontStyle: "normal" }}>{subject}</strong></>;
      case "bounty_settle":
        return <><strong style={{ color: PAL.parchment, fontStyle: "normal" }}>{actor}</strong> delivered on <strong style={{ color: PAL.blood, fontStyle: "normal" }}>{subject}</strong> · <span style={{ color: "#5db765", fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>{amt} Paper</span></>;
      case "bounty_cancel":
        return <><strong style={{ color: PAL.parchment, fontStyle: "normal" }}>{actor}</strong> pulled their bounty on <strong style={{ color: PAL.parchDim, fontStyle: "normal" }}>{subject}</strong></>;
      case "crew_publish":
        return <><strong style={{ color: PAL.brassHi, fontStyle: "normal" }}>{subject}</strong>{event.meta?.tag ? <span style={{ color: PAL.brass, fontFamily: WR_FONT_MONO, fontSize: 11 }}> [{event.meta.tag}]</span> : null} hoisted their colors{event.meta?.recruiting ? <span style={{ color: "#5db765" }}> · recruiting</span> : null}</>;
      case "server_list":
        return <><strong style={{ color: PAL.parchment, fontStyle: "normal" }}>{subject}</strong> dropped anchor on the list{event.meta?.region ? <span style={{ color: PAL.parchDim }}> · {event.meta.region}</span> : null}{event.meta?.framework ? <span style={{ color: PAL.brass, fontSize: 11 }}> · {event.meta.framework}</span> : null}</>;
      case "lfg_raise":
        return <><strong style={{ color: PAL.parchment, fontStyle: "normal" }}>{actor}</strong> raised a flag{event.meta?.slots ? <span style={{ color: PAL.brass }}> · need {event.meta.slots}</span> : null}{subject && subject !== "a run" ? <span style={{ color: PAL.parchDim }}> · {subject}</span> : null}</>;
    }
  })();

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: "8px 14px",
      background: alt ? "rgba(255,255,255,0.015)" : "transparent",
      borderBottom: `1px solid ${PAL.brass}10`,
      fontSize: 13,
      lineHeight: 1.4,
    }}>
      <span style={{
        width: 20, height: 20, flexShrink: 0,
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        fontSize: 14, color,
      }}>{glyph}</span>
      <div style={{ flex: 1, minWidth: 0, color: PAL.parchment, fontStyle: "italic", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {line}
      </div>
      <span style={{ fontFamily: WR_FONT_MONO, fontSize: 10, color: PAL.parchDim, flexShrink: 0, letterSpacing: "0.5px" }}>
        {timeAgo(event.ts)}
      </span>
    </div>
  );
}

function FeatureBlock({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <div style={{ ...S.card, display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 20 }}>{icon}</span>
        <span style={{ fontFamily: WR_FONT_DISPLAY, fontSize: 16, color: PAL.brassHi, letterSpacing: "0.5px" }}>
          {title}
        </span>
      </div>
      <div style={{ fontSize: 13, color: PAL.parchDim, lineHeight: 1.5 }}>{body}</div>
    </div>
  );
}

// ═══ Tab: Captain's Log (news) ═════════════════════════════════════════════════

function LogTab() {
  const [items, setItems] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [recap, setRecap] = useState<{ summary: string; period: string; generatedAt: string; stats: any } | null>(null);
  const [recapLoading, setRecapLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    apiFetch("/windrose/news").then(j => {
      if (j?.ok && Array.isArray(j.news)) setItems(j.news);
      else setItems([]);
      setLoading(false);
    });
    // The Operator's weekly recap — independent fetch so it shows even
    // when Steam news is slow or empty.
    setRecapLoading(true);
    apiFetch("/windrose/captains-log").then(j => {
      if (j?.ok && j.summary) setRecap({ summary: j.summary, period: j.period, generatedAt: j.generatedAt, stats: j.stats });
      setRecapLoading(false);
    }).catch(() => setRecapLoading(false));
  }, []);

  const nothingAtAll = !loading && !recapLoading && (!items || items.length === 0) && !recap;
  if (nothingAtAll) {
    return <EmptyState icon="📜" title="The log is empty" hint="No dispatches yet. Check back after the storm passes." />;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* The Operator's weekly recap — sits above Steam news */}
      <OperatorRecap recap={recap} loading={recapLoading} />

      {loading ? (
        <LoadingState label="Loading dispatches..." />
      ) : !items || items.length === 0 ? null : (items.map((n, i) => (
        <article key={n.id || i} style={{ ...S.card, padding: "18px 22px" }}>
          {/* wax seal corner */}
          <span style={{
            position: "absolute", top: -6, left: 18,
            width: 14, height: 14, borderRadius: "50%",
            background: `radial-gradient(circle at 30% 30%, ${PAL.blood}ee, #5b1919)`,
            boxShadow: `inset 0 -1px 2px #300, 0 2px 4px ${PAL.ink}`,
          }} />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <div style={{ ...S.label, fontSize: 9 }}>
              {n.feedlabel || "Kraken Express"}
              {" · "}
              {n.date ? new Date(n.date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : ""}
            </div>
            <div style={{ fontFamily: WR_FONT_MONO, fontSize: 10, color: PAL.parchDim, opacity: 0.6 }}>
              {String(i + 1).padStart(3, "0")}
            </div>
          </div>
          <h3 style={{ fontFamily: WR_FONT_DISPLAY, fontSize: 22, color: PAL.brassHi, margin: "2px 0 8px", lineHeight: 1.2, letterSpacing: "0.3px" }}>
            {n.title || "Untitled dispatch"}
          </h3>
          <p style={{ fontSize: 14, color: PAL.parchment, lineHeight: 1.65, margin: 0, fontStyle: "italic", opacity: 0.85 }}>
            {stripBB(n.contents || "").slice(0, 340)}{(n.contents || "").length > 340 ? "…" : ""}
          </p>
          {n.url && (
            <div style={{ marginTop: 12 }}>
              <a href={n.url} target="_blank" rel="noopener noreferrer" style={{ ...S.btn, textDecoration: "none", display: "inline-block" }}>
                Read dispatch →
              </a>
            </div>
          )}
        </article>
      )))}
    </div>
  );
}

function OperatorRecap({ recap, loading }: {
  recap: { summary: string; period: string; generatedAt: string; stats: any } | null;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div style={{
        ...S.card,
        padding: "22px 26px",
        background: `radial-gradient(ellipse 80% 60% at 30% 0%, rgba(212,160,23,0.12) 0%, transparent 60%), linear-gradient(180deg, ${PAL.stormMid} 0%, ${PAL.stormDeep} 100%)`,
        borderColor: "rgba(212,160,23,0.45)",
        display: "flex", alignItems: "center", gap: 14,
      }}>
        <div style={{
          width: 42, height: 42, borderRadius: "50%",
          background: "radial-gradient(circle at 30% 30%, #e8c48a, #8a6b3e)",
          display: "flex", alignItems: "center", justifyContent: "center",
          border: "2px solid rgba(212,160,23,0.6)",
          fontSize: 18,
        }}>
          🤖
        </div>
        <div>
          <div style={{ ...S.label, fontSize: 9, color: "rgba(212,160,23,0.9)" }}>The Operator is writing</div>
          <div style={{ fontSize: 13, color: PAL.parchDim, fontStyle: "italic", marginTop: 3 }}>
            Compiling the week's dispatches…
          </div>
        </div>
      </div>
    );
  }
  if (!recap) return null;

  const when = (() => {
    try {
      const d = new Date(recap.generatedAt);
      return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
    } catch { return ""; }
  })();

  return (
    <div style={{
      ...S.card,
      padding: "22px 26px",
      background: `radial-gradient(ellipse 90% 70% at 20% 0%, rgba(212,160,23,0.14) 0%, transparent 60%), linear-gradient(180deg, ${PAL.stormMid} 0%, ${PAL.stormDeep} 100%)`,
      borderColor: "rgba(212,160,23,0.45)",
      position: "relative",
    }}>
      {/* Operator identity row */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 12 }}>
        <div style={{
          width: 44, height: 44, borderRadius: "50%",
          background: "radial-gradient(circle at 30% 30%, #e8c48a, #8a6b3e)",
          display: "flex", alignItems: "center", justifyContent: "center",
          border: "2px solid rgba(212,160,23,0.6)",
          boxShadow: "0 0 18px rgba(212,160,23,0.25), inset 0 -2px 4px rgba(0,0,0,0.3)",
          fontSize: 20, flexShrink: 0,
        }}>
          🤖
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={{ fontFamily: WR_FONT_DISPLAY, fontSize: 18, color: "rgba(212,160,23,0.95)", letterSpacing: "0.5px" }}>
              The Operator
            </span>
            <span style={{ fontSize: 9, fontFamily: WR_FONT_MONO, color: PAL.parchDim, letterSpacing: "1.5px", textTransform: "uppercase", padding: "2px 7px", background: "rgba(212,160,23,0.08)", border: "1px solid rgba(212,160,23,0.3)" }}>
              AI · Weekly Recap
            </span>
          </div>
          <div style={{ fontSize: 11, color: PAL.parchDim, marginTop: 3, fontStyle: "italic" }}>
            {recap.period}{when ? ` · compiled ${when}` : ""}
          </div>
        </div>
      </div>

      {/* Recap body */}
      <div style={{
        fontSize: 14,
        color: PAL.parchment,
        lineHeight: 1.7,
        fontFamily: WR_FONT_SERIF,
        whiteSpace: "pre-wrap",
        borderLeft: "2px solid rgba(212,160,23,0.4)",
        paddingLeft: 14,
        marginLeft: 4,
      }}>
        {recap.summary}
      </div>

      {/* Stat strip */}
      {recap.stats && (
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 16, paddingTop: 14, borderTop: `1px solid ${PAL.brass}20` }}>
          <RecapStat label="Bounties posted" value={recap.stats.bountiesPosted} />
          <RecapStat label="Bounties settled" value={recap.stats.bountiesSettled} />
          <RecapStat label="Crews active" value={recap.stats.crewsActive} />
          <RecapStat label="New servers" value={recap.stats.serversNew} />
          <RecapStat label="Flags raised" value={recap.stats.lfgPosts} />
        </div>
      )}
    </div>
  );
}

function RecapStat({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <div style={{ fontFamily: WR_FONT_DISPLAY, fontSize: 20, color: PAL.brassHi, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
        {Number(value || 0).toLocaleString()}
      </div>
      <div style={{ ...S.label, fontSize: 9 }}>{label}</div>
    </div>
  );
}

function stripBB(s: string): string {
  return s.replace(/\[[^\]]+\]/g, "").replace(/\s+/g, " ").trim();
}

// ═══ Tab: Crew Finder (LFG) ════════════════════════════════════════════════════

type LfgPost = {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string | null;
  mode?: string | null;
  region?: string | null;
  tags?: string[] | null;
  note?: string | null;
  slotsWanted?: number | null;
  createdAt: string;
};

const WR_MODES   = ["Any", "PvE Solo", "Co-op 2", "Co-op 4", "Co-op 8", "Boss Run", "Exploration", "Naval"];
const WR_REGIONS = ["Any", "NA", "EU", "OCE", "ASIA", "SA", "MENA"];
const WR_TAGS    = ["chill", "mic-required", "no-mic", "first-time", "veteran", "streaming", "18+"];

// Published crews (crew profiles surfacing in a lobby's directory)
type PublishedCrew = {
  id: string;
  name: string;
  tag: string;
  description: string;
  logoUrl?: string | null;
  bannerUrl?: string | null;
  accentColor?: string | null;
  homePort?: string | null;
  recruiting: boolean;
  recruitingNote: string;
  memberCount: number;
  updatedAt: string;
  bountyKills?: number;
  bountyEarned?: number;
  ownerId?: string;
  ownerName?: string;
};

type CrewLeaderboardData = {
  stats: { crewCount: number; totalMembers: number; recruitingCount: number; totalKills: number };
  largest: { id: string; name: string; tag: string; logoUrl?: string | null; accentColor?: string | null; memberCount: number; bountyEarned: number; bountyKills: number; recruiting: boolean }[];
  mostDecorated: { id: string; name: string; tag: string; logoUrl?: string | null; accentColor?: string | null; memberCount: number; bountyEarned: number; bountyKills: number; recruiting: boolean }[];
  recruiting: { id: string; name: string; tag: string; logoUrl?: string | null; accentColor?: string | null; memberCount: number; bountyEarned: number; bountyKills: number; recruiting: boolean }[];
};

type MyCrew = {
  id: string;
  name: string;
  tag: string;
  description: string;
  logoUrl?: string | null;
  bannerUrl?: string | null;
  accentColor?: string | null;
  tagShape?: string | null;
  homePort?: string | null;
  recruiting: boolean;
  recruitingNote: string;
  publicInLobbies: string[];
  myRole: "LEADER" | "OFFICER" | "MEMBER";
};

function CrewTab({ lobbyId }: { lobbyId: string }) {
  const [posts, setPosts] = useState<LfgPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState("");
  const [mode, setMode] = useState(WR_MODES[0]);
  const [region, setRegion] = useState(WR_REGIONS[0]);
  const [slots, setSlots] = useState(1);
  const [tags, setTags] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  // Published crews
  const [crews, setCrews] = useState<PublishedCrew[]>([]);
  const [myCrews, setMyCrews] = useState<MyCrew[]>([]);
  const [editingCrew, setEditingCrew] = useState<MyCrew | null>(null);
  const [showCrewLeaders, setShowCrewLeaders] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    const [lfgJ, crewsJ, mineJ] = await Promise.all([
      apiFetch(`/lfg/${encodeURIComponent(lobbyId)}`).catch(() => null),
      apiFetch(`/lobbies/${encodeURIComponent(lobbyId)}/crews`).catch(() => null),
      apiFetch("/crews/mine").catch(() => null),
    ]);
    if (lfgJ?.ok && Array.isArray(lfgJ.posts)) setPosts(lfgJ.posts);
    if (crewsJ?.ok && Array.isArray(crewsJ.crews)) setCrews(crewsJ.crews);
    if (mineJ && Array.isArray(mineJ.crews)) setMyCrews(mineJ.crews);
    setLoading(false);
  }, [lobbyId]);

  useEffect(() => { reload(); }, [reload]);

  async function post() {
    if (!note.trim() || busy) return;
    setBusy(true);
    const body = {
      mode: mode === "Any" ? null : mode,
      region: region === "Any" ? null : region,
      tags: Array.from(tags),
      note: note.trim(),
      slotsWanted: slots,
    };
    const j = await apiFetch(`/lfg/${encodeURIComponent(lobbyId)}`, { method: "POST", body: JSON.stringify(body) });
    setBusy(false);
    if (j?.ok) { setNote(""); setTags(new Set()); reload(); }
  }

  function toggleTag(t: string) {
    setTags(prev => { const n = new Set(prev); n.has(t) ? n.delete(t) : n.add(t); return n; });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Compose */}
      <div style={{ ...S.card, padding: 18 }}>
        <div style={{ ...S.label, marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
          <SkullIcon size={14} />
          Raise Your Flag
        </div>
        <textarea
          value={note}
          onChange={e => setNote(e.target.value.slice(0, 240))}
          placeholder="Looking for 3 for a lighthouse run. Mic preferred. PvE, chill pace."
          style={{ ...S.input, minHeight: 64, fontFamily: WR_FONT_SERIF, fontSize: 14, fontStyle: "italic" } as React.CSSProperties}
        />
        <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap", alignItems: "center" }}>
          <select value={mode} onChange={e => setMode(e.target.value)} style={{ ...S.input, width: "auto" } as React.CSSProperties}>
            {WR_MODES.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <select value={region} onChange={e => setRegion(e.target.value)} style={{ ...S.input, width: "auto" } as React.CSSProperties}>
            {WR_REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ ...S.label, fontSize: 9 }}>Need</span>
            <input type="number" min={1} max={7} value={slots} onChange={e => setSlots(Math.max(1, Math.min(7, Number(e.target.value) || 1)))} style={{ ...S.input, width: 60, textAlign: "center" } as React.CSSProperties} />
          </div>
          <div style={{ flex: 1 }} />
          <button type="button" style={S.btnPrimary} onClick={post} disabled={busy || !note.trim()}>
            {busy ? "Hoisting…" : "Raise Flag"}
          </button>
        </div>
        <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
          {WR_TAGS.map(t => (
            <button
              key={t}
              type="button"
              onClick={() => toggleTag(t)}
              style={{
                ...S.btn,
                padding: "4px 10px",
                fontSize: 10,
                letterSpacing: "1px",
                borderColor: tags.has(t) ? PAL.brass : `${PAL.brass}35`,
                background: tags.has(t) ? `${PAL.brass}20` : S.btn.background,
                color: tags.has(t) ? PAL.brassHi : PAL.parchDim,
              }}
            >
              #{t}
            </button>
          ))}
        </div>
      </div>

      {/* Established crews — persistent profiles published into this lobby */}
      <div style={{ ...S.card, padding: "18px 22px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ ...S.label, marginBottom: 4 }}>Established Crews</div>
            <h3 style={{ fontFamily: WR_FONT_DISPLAY, fontSize: 20, color: PAL.brassHi, margin: 0, letterSpacing: "0.3px" }}>
              Who's sailing under colors.
            </h3>
            <div style={{ fontSize: 12, color: PAL.parchDim, marginTop: 4, fontStyle: "italic" }}>
              Persistent crew profiles — home port, colors, recruiting status. Different from the flags below (which are one-off calls).
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              style={S.btn}
              onClick={() => setShowCrewLeaders(true)}
            >
              ⚑ Hall of Crews
            </button>
            {myCrews.some(c => c.myRole === "LEADER") && (
              <button
                type="button"
                style={S.btnPrimary}
                onClick={() => {
                  const leaderCrews = myCrews.filter(c => c.myRole === "LEADER");
                  const unpublished = leaderCrews.find(c => !(c.publicInLobbies || []).includes(lobbyId));
                  setEditingCrew(unpublished || leaderCrews[0]);
                }}
              >
                {myCrews.some(c => c.myRole === "LEADER" && (c.publicInLobbies || []).includes(lobbyId))
                  ? "Edit My Crew"
                  : "Publish My Crew Here"}
              </button>
            )}
          </div>
        </div>
      </div>

      {crews.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 12 }}>
          {crews.map(c => (
            <CrewProfileCard
              key={c.id}
              crew={c}
              isMember={myCrews.some(mc => mc.id === c.id)}
            />
          ))}
        </div>
      )}

      {/* Divider between crews and LFG */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "6px 0" }}>
        <div style={{ flex: 1, height: 1, background: `linear-gradient(90deg, transparent, ${PAL.brass}40, transparent)` }} />
        <div style={{ ...S.label, fontSize: 9, whiteSpace: "nowrap" }}>Flags Flying Right Now</div>
        <div style={{ flex: 1, height: 1, background: `linear-gradient(90deg, transparent, ${PAL.brass}40, transparent)` }} />
      </div>

      {editingCrew && (
        <CrewProfileEditor
          crew={editingCrew}
          lobbyId={lobbyId}
          onClose={() => setEditingCrew(null)}
          onSaved={() => { setEditingCrew(null); reload(); }}
        />
      )}

      {showCrewLeaders && (
        <CrewLeaderboardModal lobbyId={lobbyId} onClose={() => setShowCrewLeaders(false)} />
      )}

      {/* List */}
      {loading ? (
        <LoadingState label="Scanning the horizon..." />
      ) : posts.length === 0 ? (
        <EmptyState icon="🏴‍☠️" title="No flags flying" hint="Be the first to raise one. Your crew is out there." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {posts.map(p => (
            <div key={p.id} style={{ ...S.card, padding: "12px 16px" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 2,
                  background: p.userAvatar ? `url(${p.userAvatar}) center/cover` : `linear-gradient(135deg, ${PAL.brass}, ${PAL.brassLow})`,
                  border: `1px solid ${PAL.brass}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontFamily: WR_FONT_DISPLAY, fontSize: 18, color: PAL.abyss, fontWeight: 700,
                  flexShrink: 0,
                }}>
                  {!p.userAvatar && (p.userName || "?").slice(0, 1).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontFamily: WR_FONT_DISPLAY, fontSize: 15, color: PAL.brassHi, letterSpacing: "0.3px" }}>
                      {p.userName}
                    </span>
                    {p.mode && <span style={{ ...S.label, fontSize: 9 }}>· {p.mode}</span>}
                    {p.region && <span style={{ ...S.label, fontSize: 9 }}>· {p.region}</span>}
                    {p.slotsWanted ? <span style={{ ...S.label, fontSize: 9, color: PAL.brass }}>· need {p.slotsWanted}</span> : null}
                    <span style={{ flex: 1 }} />
                    <span style={{ fontFamily: WR_FONT_MONO, fontSize: 10, color: PAL.parchDim, opacity: 0.6 }}>
                      {timeAgo(p.createdAt)}
                    </span>
                  </div>
                  <p style={{ margin: "6px 0 0", fontSize: 14, color: PAL.parchment, lineHeight: 1.5, fontStyle: "italic", opacity: 0.9 }}>
                    {p.note}
                  </p>
                  {p.tags && p.tags.length > 0 && (
                    <div style={{ marginTop: 6, display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {p.tags.map(t => (
                        <span key={t} style={{ fontSize: 10, color: PAL.brass, fontFamily: WR_FONT_MONO, letterSpacing: "0.5px" }}>
                          #{t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CrewProfileCard({ crew, isMember }: { crew: PublishedCrew; isMember: boolean }) {
  const accent = crew.accentColor && /^#[0-9a-f]{6}$/i.test(crew.accentColor) ? crew.accentColor : PAL.brass;

  function askToJoin() {
    if (!crew.ownerId) return;
    // Dock opens a DM thread with the leader. DockShell listens for this
    // event and pops the DM tab with the right peer selected.
    try {
      window.dispatchEvent(new CustomEvent("weered:dock:open", {
        detail: {
          mode: "dm",
          peer: { id: crew.ownerId, name: crew.ownerName || crew.name },
        },
      }));
    } catch { /* ignore */ }
  }
  return (
    <div style={{
      ...S.card,
      padding: 0,
      display: "flex", flexDirection: "column",
      overflow: "hidden",
      position: "relative",
      borderColor: `${accent}45`,
    }}>
      {/* Banner or gradient header */}
      <div style={{
        height: 76,
        background: crew.bannerUrl
          ? `linear-gradient(180deg, rgba(10,18,32,0.2), rgba(10,18,32,0.85)), url(${crew.bannerUrl}) center/cover no-repeat`
          : `linear-gradient(135deg, ${accent}35, ${PAL.stormDeep})`,
        position: "relative",
      }}>
        {crew.recruiting && (
          <span style={{
            position: "absolute", top: 8, right: 10,
            fontSize: 9, fontWeight: 900, letterSpacing: "1.5px", textTransform: "uppercase",
            padding: "3px 8px",
            background: "rgba(93,183,101,0.22)", color: "#5db765",
            border: "1px solid rgba(93,183,101,0.45)",
            fontFamily: WR_FONT_MONO,
          }}>
            Recruiting
          </span>
        )}
      </div>

      {/* Logo + identity */}
      <div style={{ padding: "14px 16px 16px", display: "flex", flexDirection: "column", gap: 10, position: "relative" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginTop: -30 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 4,
            background: crew.logoUrl
              ? `url(${crew.logoUrl}) center/cover no-repeat, ${PAL.stormDeep}`
              : `linear-gradient(135deg, ${accent}, ${PAL.brassLow})`,
            border: `2px solid ${accent}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: WR_FONT_DISPLAY, fontSize: 22, color: PAL.abyss, fontWeight: 700,
            flexShrink: 0,
            boxShadow: `0 2px 8px ${PAL.ink}`,
          }}>
            {!crew.logoUrl && (crew.tag || crew.name || "?").slice(0, 2).toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0, marginTop: 28 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <span style={{ fontFamily: WR_FONT_DISPLAY, fontSize: 18, color: PAL.brassHi, letterSpacing: "0.3px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {crew.name}
              </span>
              {crew.tag && (
                <span style={{ fontSize: 10, fontFamily: WR_FONT_MONO, color: accent, letterSpacing: "1.5px", padding: "2px 6px", border: `1px solid ${accent}45`, background: `${accent}10` }}>
                  [{crew.tag}]
                </span>
              )}
            </div>
            <div style={{ fontSize: 10, color: PAL.parchDim, fontFamily: WR_FONT_MONO, letterSpacing: "0.5px", marginTop: 2 }}>
              {crew.memberCount} member{crew.memberCount === 1 ? "" : "s"}
              {crew.homePort ? <> · {crew.homePort}</> : null}
            </div>
          </div>
        </div>

        {crew.description && (
          <div style={{ fontSize: 12, color: PAL.parchment, lineHeight: 1.55, fontStyle: "italic", opacity: 0.88 }}>
            {crew.description.length > 160 ? `${crew.description.slice(0, 160)}…` : crew.description}
          </div>
        )}

        {crew.recruiting && (
          <div style={{
            padding: "8px 10px",
            background: "rgba(93,183,101,0.08)",
            border: "1px solid rgba(93,183,101,0.25)",
            borderRadius: 2,
            fontSize: 11, color: PAL.parchment, lineHeight: 1.5, fontStyle: "italic",
          }}>
            {crew.recruitingNote && (
              <>
                <div style={{ ...S.label, fontSize: 8, marginBottom: 3, color: "#5db765" }}>Looking for</div>
                <div style={{ marginBottom: crew.ownerId && !isMember ? 8 : 0 }}>
                  {crew.recruitingNote.length > 140 ? `${crew.recruitingNote.slice(0, 140)}…` : crew.recruitingNote}
                </div>
              </>
            )}
            {crew.ownerId && !isMember && (
              <button
                type="button"
                onClick={askToJoin}
                style={{
                  ...S.btnPrimary,
                  background: `linear-gradient(180deg, rgba(93,183,101,0.22), rgba(93,183,101,0.10))`,
                  borderColor: "rgba(93,183,101,0.5)",
                  color: "#8edc93",
                  padding: "7px 14px", fontSize: 11, letterSpacing: "1.5px",
                }}
              >
                Ask to Join →
              </button>
            )}
          </div>
        )}

        {/* Bounty-board footer — surfaces when the crew's members have
            settled anything on the board. Cross-feature proof the crew
            actually does work. */}
        {((crew.bountyKills || 0) > 0 || (crew.bountyEarned || 0) > 0) && (
          <div style={{
            display: "flex", alignItems: "center", gap: 12,
            paddingTop: 10,
            borderTop: `1px solid ${PAL.brass}20`,
            fontFamily: WR_FONT_MONO, fontSize: 10, color: PAL.parchDim, letterSpacing: "0.5px",
          }}>
            <span style={{ color: "#5db765" }}>⚔</span>
            <span>
              <span style={{ color: PAL.parchment, fontWeight: 600, fontFamily: WR_FONT_DISPLAY, fontSize: 13, marginRight: 4 }}>
                {(crew.bountyKills || 0).toLocaleString()}
              </span>
              delivered
            </span>
            <span style={{ color: `${PAL.brass}60` }}>·</span>
            <span>
              <span style={{ color: accent, fontWeight: 600, fontFamily: WR_FONT_DISPLAY, fontSize: 13, marginRight: 4 }}>
                {(crew.bountyEarned || 0).toLocaleString()}
              </span>
              earned
            </span>
          </div>
        )}

        {/* View / share chip */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}>
          <a
            href={`/crew/${encodeURIComponent(crew.id)}`}
            target="_blank" rel="noopener noreferrer"
            style={{ fontSize: 10, color: PAL.parchDim, textDecoration: "none", fontFamily: WR_FONT_MONO, letterSpacing: "0.5px", padding: "3px 10px", border: `1px solid ${PAL.brass}20`, transition: "border-color .15s" }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = `${PAL.brass}55`)}
            onMouseLeave={e => (e.currentTarget.style.borderColor = `${PAL.brass}20`)}
          >
            view ↗
          </a>
        </div>
      </div>
    </div>
  );
}

function CrewLeaderboardModal({ lobbyId, onClose }: { lobbyId: string; onClose: () => void }) {
  const [d, setD] = useState<CrewLeaderboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    apiFetch(`/lobbies/${encodeURIComponent(lobbyId)}/crews/leaderboard`).then(j => {
      if (j?.ok) setD(j as CrewLeaderboardData);
      else setErr("Couldn't pull the rankings.");
      setLoading(false);
    }).catch(() => { setErr("Couldn't pull the rankings."); setLoading(false); });
  }, [lobbyId]);

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(5,5,10,.72)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ ...S.card, width: "min(860px, 100%)", padding: 0, maxHeight: "90vh", overflowY: "auto", borderColor: `${PAL.brass}55` }}>
        {/* Header */}
        <div style={{
          padding: "20px 26px 18px",
          background: `radial-gradient(ellipse 80% 60% at 20% 0%, ${PAL.brass}18 0%, transparent 60%), linear-gradient(180deg, ${PAL.stormMid} 0%, ${PAL.stormDeep} 100%)`,
          borderBottom: `1px solid ${PAL.brass}30`,
        }}>
          <div style={{ ...S.label, marginBottom: 4 }}>Hall of Crews</div>
          <div style={{ fontFamily: WR_FONT_DISPLAY, fontSize: 24, color: PAL.brassHi, letterSpacing: "0.3px", lineHeight: 1.1 }}>
            Who's flying the biggest colors.
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: "18px 26px 22px", display: "flex", flexDirection: "column", gap: 16 }}>
          {loading ? (
            <LoadingState label="Tallying the roster..." />
          ) : err ? (
            <div style={{ fontSize: 13, color: PAL.parchDim, fontStyle: "italic", padding: 16, textAlign: "center" }}>{err}</div>
          ) : !d ? null : (
            <>
              {/* Stat strip */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
                <StatTile label="Crews listed" value={d.stats.crewCount.toLocaleString()} />
                <StatTile label="Total members" value={d.stats.totalMembers.toLocaleString()} highlight />
                <StatTile label="Recruiting now" value={d.stats.recruitingCount.toLocaleString()} />
                <StatTile label="Bounties delivered" value={d.stats.totalKills.toLocaleString()} highlight />
              </div>

              {/* Three boards */}
              {d.largest.length === 0 && d.mostDecorated.length === 0 && d.recruiting.length === 0 ? (
                <EmptyState icon="⚑" title="No crews on the board yet" hint="Publish a crew to take your spot." />
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
                  <CrewLeaderColumn
                    title="Largest Crews"
                    caption="By member headcount"
                    rows={d.largest.map((c, i) => ({ ...c, rank: i + 1, value: c.memberCount, sub: "members" }))}
                    emptyLabel="No members rostered yet."
                  />
                  <CrewLeaderColumn
                    title="Most Decorated"
                    caption="Paper earned on the bounty board"
                    rows={d.mostDecorated.map((c, i) => ({ ...c, rank: i + 1, value: c.bountyEarned, sub: `${c.bountyKills} bount${c.bountyKills === 1 ? "y" : "ies"} delivered` }))}
                    emptyLabel="No crew's delivered a bounty yet."
                    valueKey="Paper"
                  />
                  <CrewLeaderColumn
                    title="Recruiting Now"
                    caption="Hoisted colors, taking hands"
                    rows={d.recruiting.map((c, i) => ({ ...c, rank: i + 1, value: c.memberCount, sub: "crew size" }))}
                    emptyLabel="No crews recruiting right now."
                  />
                </div>
              )}
            </>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button type="button" style={S.btn} onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CrewLeaderColumn({ title, caption, rows, emptyLabel, valueKey }: {
  title: string;
  caption: string;
  rows: { id: string; rank: number; name: string; tag: string; logoUrl?: string | null; accentColor?: string | null; value: number; sub: string }[];
  emptyLabel: string;
  valueKey?: string;
}) {
  return (
    <div style={{ ...S.card, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
      <div>
        <div style={{ fontFamily: WR_FONT_DISPLAY, fontSize: 16, color: PAL.brassHi, letterSpacing: "0.3px", lineHeight: 1 }}>
          {title}
        </div>
        <div style={{ fontSize: 11, color: PAL.parchDim, marginTop: 3, fontStyle: "italic" }}>
          {caption}
        </div>
      </div>
      <BrassDivider />
      {rows.length === 0 ? (
        <div style={{ fontSize: 12, color: PAL.parchDim, fontStyle: "italic", padding: "14px 0", textAlign: "center" }}>
          {emptyLabel}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {rows.map(r => {
            const accent = r.accentColor && /^#[0-9a-f]{6}$/i.test(r.accentColor) ? r.accentColor : PAL.brass;
            return (
              <div key={r.id} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "6px 8px",
                background: r.rank === 1 ? `${PAL.brass}12` : r.rank === 2 ? `${PAL.brass}08` : r.rank === 3 ? `${PAL.brass}05` : "transparent",
                border: `1px solid ${r.rank <= 3 ? `${PAL.brass}25` : `${PAL.brass}10`}`,
                borderRadius: 2,
              }}>
                <span style={{
                  width: 20, textAlign: "center",
                  fontFamily: WR_FONT_DISPLAY,
                  fontSize: r.rank === 1 ? 16 : 13,
                  color: r.rank === 1 ? PAL.brassHi : r.rank <= 3 ? PAL.brass : PAL.parchDim,
                  fontWeight: 700, flexShrink: 0,
                }}>{r.rank}</span>
                <div style={{
                  width: 24, height: 24, borderRadius: 2, flexShrink: 0,
                  background: r.logoUrl ? `url(${r.logoUrl}) center/cover` : `linear-gradient(135deg, ${accent}, ${PAL.brassLow})`,
                  border: `1px solid ${accent}40`,
                }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: WR_FONT_DISPLAY, fontSize: 13, color: PAL.parchment, letterSpacing: "0.2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {r.name}{r.tag ? <span style={{ fontSize: 9, color: accent, marginLeft: 6, fontFamily: WR_FONT_MONO }}>[{r.tag}]</span> : null}
                  </div>
                  <div style={{ fontSize: 9, color: PAL.parchDim, fontStyle: "italic" }}>{r.sub}</div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontFamily: WR_FONT_MONO, fontSize: 12, color: r.rank <= 3 ? PAL.brassHi : PAL.brass, fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>
                    {r.value.toLocaleString()}
                  </div>
                  {valueKey && <div style={{ fontSize: 7, color: PAL.parchDim, letterSpacing: "1px", marginTop: 1 }}>{valueKey}</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CrewProfileEditor({ crew, lobbyId, onClose, onSaved }: {
  crew: MyCrew;
  lobbyId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(crew.name);
  const [tag, setTag] = useState(crew.tag);
  const [description, setDescription] = useState(crew.description);
  const [logoUrl, setLogoUrl] = useState(crew.logoUrl || "");
  const [bannerUrl, setBannerUrl] = useState(crew.bannerUrl || "");
  const [accentColor, setAccentColor] = useState(crew.accentColor || "");
  const [tagShape, setTagShape] = useState((crew as any).tagShape || "rounded");
  const [homePort, setHomePort] = useState(crew.homePort || "");
  const [recruiting, setRecruiting] = useState(crew.recruiting);
  const [recruitingNote, setRecruitingNote] = useState(crew.recruitingNote);
  const [publish, setPublish] = useState((crew.publicInLobbies || []).includes(lobbyId));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    if (busy) return;
    setBusy(true); setErr(null);
    const lobbies = new Set(crew.publicInLobbies || []);
    if (publish) lobbies.add(lobbyId);
    else lobbies.delete(lobbyId);
    const j = await apiFetch(`/crews/${crew.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        name, tag, description,
        logoUrl, bannerUrl, accentColor, tagShape,
        homePort, recruiting, recruitingNote,
        publicInLobbies: Array.from(lobbies),
      }),
    });
    setBusy(false);
    if (j?.ok) onSaved();
    else setErr(j?.message || j?.error || "Failed to save.");
  }

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(5,5,10,.72)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ ...S.card, width: "min(560px, 100%)", padding: "22px 26px", maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ ...S.label, marginBottom: 4 }}>Crew Profile</div>
        <div style={{ fontFamily: WR_FONT_DISPLAY, fontSize: 22, color: PAL.brassHi, marginBottom: 14, letterSpacing: "0.3px" }}>
          {crew.name}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "3fr 1fr", gap: 10 }}>
          <Labeled label="Crew name">
            <input value={name} onChange={e => setName(e.target.value.slice(0, 60))} style={S.input as React.CSSProperties} />
          </Labeled>
          <Labeled label="Tag">
            <input value={tag} onChange={e => setTag(e.target.value.toUpperCase().slice(0, 8))} placeholder="[WR]" style={S.input as React.CSSProperties} />
          </Labeled>
        </div>

        <div style={{ marginTop: 10 }}>
          <Labeled label="Description">
            <textarea value={description} onChange={e => setDescription(e.target.value.slice(0, 800))} style={{ ...S.input, minHeight: 70, fontFamily: WR_FONT_SERIF, fontStyle: "italic" } as React.CSSProperties} />
          </Labeled>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
          <Labeled label="Logo URL">
            <input value={logoUrl} onChange={e => setLogoUrl(e.target.value.slice(0, 500))} placeholder="https://..." style={S.input as React.CSSProperties} />
          </Labeled>
          <Labeled label="Banner URL">
            <input value={bannerUrl} onChange={e => setBannerUrl(e.target.value.slice(0, 500))} placeholder="https://..." style={S.input as React.CSSProperties} />
          </Labeled>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 2fr", gap: 10, marginTop: 10 }}>
          <Labeled label="Accent color">
            <input
              value={accentColor}
              onChange={e => setAccentColor(e.target.value.slice(0, 7))}
              placeholder="#c9a066"
              style={{ ...S.input, fontFamily: WR_FONT_MONO, textTransform: "lowercase" } as React.CSSProperties}
            />
          </Labeled>
          <Labeled label="Tag shape">
            <select
              value={tagShape}
              onChange={e => setTagShape(e.target.value)}
              style={{ ...S.input, fontFamily: WR_FONT_MONO } as React.CSSProperties}
            >
              <option value="rounded">Rounded</option>
              <option value="square">Square</option>
              <option value="pill">Pill</option>
            </select>
          </Labeled>
          <Labeled label="Home port">
            <input value={homePort} onChange={e => setHomePort(e.target.value.slice(0, 80))} placeholder="Tortuga · EU-3" style={S.input as React.CSSProperties} />
          </Labeled>
        </div>

        <div style={{ marginTop: 14, padding: "12px 14px", background: "rgba(93,183,101,0.06)", border: "1px solid rgba(93,183,101,0.2)", borderRadius: 2 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 12, color: PAL.parchment, fontWeight: 600 }}>
            <input type="checkbox" checked={recruiting} onChange={e => setRecruiting(e.target.checked)} />
            Recruiting new members
          </label>
          {recruiting && (
            <div style={{ marginTop: 8 }}>
              <textarea
                value={recruitingNote}
                onChange={e => setRecruitingNote(e.target.value.slice(0, 400))}
                placeholder="Looking for 2 cannoneers, 40+ level, mic preferred. No drama."
                style={{ ...S.input, minHeight: 50, fontFamily: WR_FONT_SERIF, fontStyle: "italic", fontSize: 12 } as React.CSSProperties}
              />
            </div>
          )}
        </div>

        <div style={{ marginTop: 14, padding: "12px 14px", background: `${PAL.brass}10`, border: `1px solid ${PAL.brass}30`, borderRadius: 2 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 12, color: PAL.parchment, fontWeight: 600 }}>
            <input type="checkbox" checked={publish} onChange={e => setPublish(e.target.checked)} />
            List this crew in the {lobbyId} lobby
          </label>
          <div style={{ fontSize: 10, color: PAL.parchDim, marginTop: 4, fontStyle: "italic", marginLeft: 24 }}>
            Other captains in this lobby will see your crew profile. Uncheck to delist.
          </div>
        </div>

        {err && (
          <div style={{ marginTop: 10, padding: "8px 12px", background: "rgba(163,61,61,0.12)", border: "1px solid rgba(163,61,61,0.35)", borderRadius: 3, color: "rgba(232,196,138,0.9)", fontSize: 12 }}>
            {err}
          </div>
        )}

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 18 }}>
          <button type="button" style={S.btn} onClick={onClose} disabled={busy}>Cancel</button>
          <button type="button" style={S.btnPrimary} onClick={submit} disabled={busy}>
            {busy ? "Saving…" : "Save Profile"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══ Hunter / Poster tier titles ═══════════════════════════════════════════
// Pure derivation from kill count / post count. Used on the dossier header,
// next to names in bounty cards, and wherever a hunter's record is shown.

type TierInfo = { label: string; color: string; glow: string; min: number };

const HUNTER_TIERS: TierInfo[] = [
  { label: "Reaper",   color: "#a33d3d", glow: "rgba(163,61,61,.35)",  min: 40 },
  { label: "Marshal",  color: "#e8c48a", glow: "rgba(232,196,138,.35)", min: 15 },
  { label: "Tracker",  color: "#f97316", glow: "rgba(249,115,22,.35)",  min: 5  },
  { label: "Outlaw",   color: "#5db765", glow: "rgba(93,183,101,.30)",  min: 1  },
];
const POSTER_TIERS: TierInfo[] = [
  { label: "Kingmaker", color: "#e8c48a", glow: "rgba(232,196,138,.35)", min: 40 },
  { label: "Broker",    color: "#c9a066", glow: "rgba(201,160,102,.30)", min: 15 },
  { label: "Runner",    color: "#f97316", glow: "rgba(249,115,22,.30)",  min: 5  },
  { label: "Informant", color: "#4a8a9d", glow: "rgba(74,138,157,.30)",  min: 1  },
];

function hunterTier(kills: number): TierInfo | null {
  return HUNTER_TIERS.find(t => kills >= t.min) || null;
}
function posterTier(posts: number): TierInfo | null {
  return POSTER_TIERS.find(t => posts >= t.min) || null;
}

function TierBadge({ tier, size = "sm" }: { tier: TierInfo | null; size?: "sm" | "md" }) {
  if (!tier) return null;
  const sm = size === "sm";
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: sm ? 3 : 5,
      padding: sm ? "2px 7px" : "3px 10px",
      fontSize: sm ? 9 : 11,
      fontWeight: 800, letterSpacing: "1.5px", textTransform: "uppercase",
      fontFamily: WR_FONT_MONO,
      color: tier.color,
      background: `${tier.color}15`,
      border: `1px solid ${tier.color}50`,
      boxShadow: `0 0 8px ${tier.glow}`,
      flexShrink: 0,
    }}>
      <span style={{ width: sm ? 4 : 5, height: sm ? 4 : 5, borderRadius: "50%", background: tier.color }} />
      {tier.label}
    </span>
  );
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ═══ Tab: Ports of Call (community servers directory) ═══════════════════════════

type CommunityServer = {
  id: string;
  name: string;
  host: string;
  dashboardUrl?: string | null;
  queryUrl?: string | null;
  region?: string | null;
  description?: string | null;
  tags?: string[];
  maxSlots?: number | null;
  framework?: string | null;
  status: string;
  lastSeenAt?: string | null;
  lastState?: any;
  createdAt: string;
  owner?: { id: string; name: string; avatar?: string | null; avatarColor?: string | null };
};

type PublicServer = {
  addr: string;           // "ip:port"
  steamId: string;
  name: string;
  players: number;
  maxPlayers: number;
  map: string;
  gameType: string;
  version: string;
  os: string;             // "w"|"l"|"m"
  secure: boolean;
  passworded: boolean;
};

/** Unified row shape the Ports list renders */
type PortRow = {
  key: string;
  source: "registered" | "public" | "both";
  // Display
  name: string;
  addr: string;           // host for public, host for registered
  description?: string | null;
  region?: string | null;
  framework?: string | null;
  tags?: string[];
  // Live
  players: number;
  maxPlayers: number;
  passworded?: boolean;
  secure?: boolean;
  // Registered-only bits
  owner?: CommunityServer["owner"];
  dashboardUrl?: string | null;
  status?: string;
};

const WR_REGIONS_LIST = ["NA-East", "NA-West", "EU", "OCE", "ASIA", "SA", "MENA"];
const WR_FRAMEWORKS = ["WindrosePlus", "Vanilla", "Other"];

// ═══ Tab: Bounty Board ═════════════════════════════════════════════════════

type Bounty = {
  id: string;
  posterId: string;
  posterName: string;
  targetHandle: string;
  targetServer?: string | null;
  amount: number;
  reason: string;
  status: "OPEN" | "CLAIMED" | "SETTLED" | "CANCELLED";
  claimantId?: string | null;
  claimantName?: string | null;
  proofNote?: string | null;
  proofImageUrl?: string | null;
  createdAt: string;
  claimedAt?: string | null;
  settledAt?: string | null;
  cancelledAt?: string | null;
};

type BountyFilter = "OPEN" | "CLAIMED" | "SETTLED" | "MINE" | "LEADERBOARD";

type HunterDossier = {
  user: { id: string; name: string; avatar?: string | null; avatarColor?: string | null; tier?: string; globalRole?: string };
  hunter: {
    kills: number;
    totalEarned: number;
    biggestHit: { target: string; amount: number; at: string } | null;
    pendingClaims: number;
    rank: number | null;
    totalHunters: number;
    recentKills: { id: string; target: string; amount: number; at: string }[];
  };
  poster: {
    postedCount: number;
    totalPosted: number;
    open: number;
    settled: number;
    rank: number | null;
    totalPosters: number;
    recentPosts: { id: string; target: string; amount: number; status: string; at: string }[];
  };
};

type LeaderboardData = {
  mostWanted: { targetHandle: string; openCount: number; totalAmount: number }[];
  topHunters: { userId: string; userName: string; kills: number; totalEarned: number }[];
  biggestPosters: { userId: string; userName: string; postedCount: number; totalPosted: number }[];
  stats: { openCount: number; openTotal: number; settledCount: number; settledTotal: number };
};

function BountiesTab() {
  const [bounties, setBounties] = useState<Bounty[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<BountyFilter>("OPEN");
  const [balance, setBalance] = useState<number | null>(null);

  // Compose form
  const [target, setTarget] = useState("");
  const [server, setServer] = useState("");
  const [amount, setAmount] = useState<number>(1000);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Claim modal
  const [claiming, setClaiming] = useState<Bounty | null>(null);

  // Leaderboard data
  const [leaderboard, setLeaderboard] = useState<LeaderboardData | null>(null);

  // Own hunter dossier — inline in the hero strip for the logged-in user
  const [myDossier, setMyDossier] = useState<HunterDossier | null>(null);

  // Dossier modal — click any name in a bounty card
  const [dossierUserId, setDossierUserId] = useState<string | null>(null);

  // Rap sheet filter — click a target handle to scope to their history
  const [targetFilter, setTargetFilter] = useState<string>("");

  // Who am I
  const [myId, setMyId] = useState<string>("");
  useEffect(() => {
    apiFetch("/auth/me").then(j => { if (j?.user?.id) setMyId(j.user.id); }).catch(() => {});
    apiFetch("/paper/wallet").then(j => { if (typeof j?.balance === "number") setBalance(j.balance); }).catch(() => {});
  }, []);

  // Load own dossier whenever myId lands or a bounty mutation happens
  const loadDossier = useCallback(() => {
    if (!myId) return;
    apiFetch(`/windrose/hunter/${encodeURIComponent(myId)}`).then(j => {
      if (j?.ok) setMyDossier(j as HunterDossier);
    }).catch(() => {});
  }, [myId]);
  useEffect(() => { loadDossier(); }, [loadDossier]);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      if (filter === "LEADERBOARD") {
        const j = await apiFetch("/windrose/bounties/leaderboard");
        setLeaderboard(j?.ok ? (j as LeaderboardData) : null);
      } else {
        const params = new URLSearchParams();
        if (targetFilter) {
          params.set("target", targetFilter); // rap-sheet view ignores status + mine filters
        } else {
          if (filter === "MINE")    params.set("mine", "1");
          if (filter === "OPEN")    params.set("status", "OPEN");
          if (filter === "CLAIMED") params.set("status", "CLAIMED");
          if (filter === "SETTLED") params.set("status", "SETTLED");
        }
        const qs = params.toString() ? `?${params.toString()}` : "";
        const j = await apiFetch(`/windrose/bounties${qs}`);
        if (j?.ok && Array.isArray(j.bounties)) setBounties(j.bounties);
        else setBounties([]);
      }
    } catch { setBounties([]); setLeaderboard(null); }
    setLoading(false);
  }, [filter, targetFilter]);

  useEffect(() => { reload(); }, [reload]);

  async function refreshWallet() {
    try { const j = await apiFetch("/paper/wallet"); if (typeof j?.balance === "number") setBalance(j.balance); } catch {}
  }

  async function postBounty() {
    if (!target.trim() || busy) return;
    setErr(null); setBusy(true);
    const j = await apiFetch("/windrose/bounties", {
      method: "POST",
      body: JSON.stringify({ targetHandle: target.trim(), targetServer: server.trim() || undefined, amount, reason: reason.trim() }),
    });
    setBusy(false);
    if (j?.ok) {
      setTarget(""); setServer(""); setReason(""); setAmount(1000);
      if (typeof j.balance === "number") setBalance(j.balance);
      reload();
    } else {
      setErr(j?.message || j?.error || "Failed to post bounty.");
    }
  }

  async function settleBounty(id: string) {
    const j = await apiFetch(`/windrose/bounties/${id}/settle`, { method: "POST", body: "{}" });
    if (j?.ok) { reload(); refreshWallet(); loadDossier(); }
  }
  async function rejectBounty(id: string) {
    const j = await apiFetch(`/windrose/bounties/${id}/reject`, { method: "POST", body: "{}" });
    if (j?.ok) { reload(); loadDossier(); }
  }
  async function cancelBounty(id: string) {
    if (!window.confirm("Cancel and refund this bounty?")) return;
    const j = await apiFetch(`/windrose/bounties/${id}/cancel`, { method: "POST", body: "{}" });
    if (j?.ok) { reload(); refreshWallet(); loadDossier(); }
  }

  const openBountyTotal = (bounties || [])
    .filter(b => b.status === "OPEN" || b.status === "CLAIMED")
    .reduce((sum, b) => sum + b.amount, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Hero strip */}
      <div style={{ ...S.card, padding: "18px 22px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 240 }}>
            <div style={{ ...S.label, marginBottom: 4 }}>The Bounty Board</div>
            <h3 style={{ fontFamily: WR_FONT_DISPLAY, fontSize: 24, color: PAL.brassHi, margin: 0, letterSpacing: "0.5px" }}>
              Put a price on anything.
            </h3>
            <div style={{ fontSize: 13, color: PAL.parchDim, marginTop: 6, fontStyle: "italic", lineHeight: 1.55 }}>
              Paper bounty on whatever you want hunted down — a sailor, a Kraken tooth, a lighthouse seed, a cargo run. A hunter delivers proof, you confirm, Paper changes hands. Stake's escrowed the moment you post — refunded only on cancel.
            </div>
          </div>
          <div style={{ display: "flex", gap: 22, flexShrink: 0, alignItems: "flex-start" }}>
            {/* Hunter dossier — only shows once the user has any bounty history */}
            {myDossier && (myDossier.hunter.kills > 0 || myDossier.poster.postedCount > 0) && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, paddingRight: 22, borderRight: `1px solid ${PAL.brass}25` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ ...S.label, fontSize: 9 }}>Your Hunter Record</div>
                  <TierBadge tier={hunterTier(myDossier.hunter.kills)} />
                </div>
                <div style={{ display: "flex", gap: 18, alignItems: "flex-end" }}>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontFamily: WR_FONT_DISPLAY, fontSize: 22, color: PAL.parchment, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
                      {myDossier.hunter.kills}
                    </div>
                    <div style={{ fontSize: 9, color: PAL.parchDim, fontFamily: WR_FONT_MONO, letterSpacing: "1px", textTransform: "uppercase", marginTop: 3 }}>delivered</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontFamily: WR_FONT_DISPLAY, fontSize: 22, color: "#5db765", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
                      {myDossier.hunter.totalEarned.toLocaleString()}
                    </div>
                    <div style={{ fontSize: 9, color: PAL.parchDim, fontFamily: WR_FONT_MONO, letterSpacing: "1px", textTransform: "uppercase", marginTop: 3 }}>earned</div>
                  </div>
                  {myDossier.hunter.rank ? (
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontFamily: WR_FONT_DISPLAY, fontSize: 22, color: PAL.brassHi, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
                        #{myDossier.hunter.rank}
                      </div>
                      <div style={{ fontSize: 9, color: PAL.parchDim, fontFamily: WR_FONT_MONO, letterSpacing: "1px", textTransform: "uppercase", marginTop: 3 }}>
                        of {myDossier.hunter.totalHunters}
                      </div>
                    </div>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => myId && setDossierUserId(myId)}
                  style={{ ...S.btn, fontSize: 10, padding: "5px 12px", marginTop: 4 }}
                >
                  View dossier →
                </button>
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
              <div style={{ ...S.label, fontSize: 9 }}>Your Paper</div>
              <div style={{ fontFamily: WR_FONT_DISPLAY, fontSize: 28, color: PAL.brassHi, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
                {balance === null ? "—" : balance.toLocaleString()}
              </div>
              <div style={{ fontSize: 10, color: PAL.parchDim, fontFamily: WR_FONT_MONO, letterSpacing: "0.5px" }}>
                · {openBountyTotal.toLocaleString()} in flight
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Compose */}
      <div style={{ ...S.card, padding: 18 }}>
        <div style={{ ...S.label, marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
          <SkullIcon size={14} />
          Post a bounty
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 10 }}>
          <div>
            <div style={{ ...S.label, fontSize: 9, marginBottom: 4 }}>Mark *</div>
            <input
              value={target} onChange={e => setTarget(e.target.value.slice(0, 60))}
              placeholder="BlackbeardXL · Kraken tooth · Rum run to Tortuga"
              style={S.input as React.CSSProperties}
            />
            <div style={{ fontSize: 9, color: PAL.parchDim, marginTop: 3, fontStyle: "italic" }}>
              Sailor, beast, cargo, location — whatever you want hunted.
            </div>
          </div>
          <div>
            <div style={{ ...S.label, fontSize: 9, marginBottom: 4 }}>Server (optional)</div>
            <input
              value={server} onChange={e => setServer(e.target.value.slice(0, 120))}
              placeholder="play.myserver.com"
              style={S.input as React.CSSProperties}
            />
          </div>
          <div>
            <div style={{ ...S.label, fontSize: 9, marginBottom: 4 }}>Amount (Paper) *</div>
            <input
              type="number" min={100} max={500000} step={100}
              value={amount} onChange={e => setAmount(Math.max(100, Math.min(500000, Number(e.target.value) || 100)))}
              style={{ ...S.input, fontVariantNumeric: "tabular-nums" } as React.CSSProperties}
            />
          </div>
        </div>
        <div style={{ marginTop: 10 }}>
          <div style={{ ...S.label, fontSize: 9, marginBottom: 4 }}>Terms (optional)</div>
          <textarea
            value={reason} onChange={e => setReason(e.target.value.slice(0, 400))}
            placeholder="What counts as delivered. A grudge, a trade, a dare — spell it out so the hunter knows what proof you'll accept."
            style={{ ...S.input, minHeight: 54, fontFamily: WR_FONT_SERIF, fontStyle: "italic" } as React.CSSProperties}
          />
        </div>
        {err && (
          <div style={{ marginTop: 10, padding: "8px 12px", background: "rgba(163,61,61,0.12)", border: "1px solid rgba(163,61,61,0.35)", borderRadius: 3, color: "rgba(232,196,138,0.9)", fontSize: 12 }}>
            {err}
          </div>
        )}
        <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 10, justifyContent: "flex-end" }}>
          <span style={{ fontFamily: WR_FONT_MONO, fontSize: 10, color: PAL.parchDim }}>
            {amount.toLocaleString()} Paper will be held in escrow
          </span>
          <button type="button" style={S.btnPrimary} onClick={postBounty} disabled={busy || !target.trim()}>
            {busy ? "Posting…" : "Post Bounty"}
          </button>
        </div>
      </div>

      {/* Rap-sheet banner — scopes list to every bounty on one target */}
      {targetFilter && (
        <div style={{
          ...S.card,
          padding: "14px 20px",
          display: "flex", alignItems: "center", gap: 14,
          borderColor: PAL.blood,
          background: `radial-gradient(ellipse 80% 60% at 10% 0%, ${PAL.blood}20 0%, transparent 65%), ${S.card.background}`,
        }}>
          <SkullIcon size={18} color={PAL.blood} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ ...S.label, fontSize: 9, color: PAL.blood, marginBottom: 3 }}>Rap Sheet</div>
            <div style={{ fontFamily: WR_FONT_DISPLAY, fontSize: 20, color: PAL.brassHi, letterSpacing: "0.3px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              Every bounty on {targetFilter}
            </div>
          </div>
          <button type="button" style={{ ...S.btn, fontSize: 10, padding: "6px 14px" }} onClick={() => setTargetFilter("")}>
            Clear ✕
          </button>
        </div>
      )}

      {/* Filter strip — hidden when a target filter is active */}
      {!targetFilter && <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {([
          { id: "OPEN", label: "Open" },
          { id: "CLAIMED", label: "Claimed" },
          { id: "MINE", label: "Mine" },
          { id: "SETTLED", label: "Settled" },
          { id: "LEADERBOARD", label: "⚑ Hall of Fame" },
        ] as { id: BountyFilter; label: string }[]).map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => setFilter(t.id)}
            style={{
              ...S.btn,
              padding: "6px 14px",
              fontSize: 11,
              borderColor: filter === t.id ? PAL.brass : `${PAL.brass}35`,
              background: filter === t.id ? `${PAL.brass}20` : S.btn.background,
              color: filter === t.id ? PAL.brassHi : PAL.parchDim,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>}

      {/* List — or leaderboards */}
      {loading ? (
        <LoadingState label={filter === "LEADERBOARD" ? "Tallying the tales..." : "Combing the wanted posters..."} />
      ) : filter === "LEADERBOARD" ? (
        <BountyLeaderboard data={leaderboard} onPickTarget={(h) => { setTargetFilter(h); setFilter("OPEN"); }} />
      ) : !bounties || bounties.length === 0 ? (
        <EmptyState
          icon="🏴‍☠️"
          title={filter === "MINE" ? "You've posted nothing." : "No bounties yet."}
          hint={filter === "MINE" ? "No marks on your tally — yet." : "Be the first to put a price on the board."}
        />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 12 }}>
          {bounties.map(b => (
            <BountyCard
              key={b.id}
              b={b}
              meId={myId}
              onClaim={() => setClaiming(b)}
              onSettle={() => settleBounty(b.id)}
              onReject={() => rejectBounty(b.id)}
              onCancel={() => cancelBounty(b.id)}
              onOpenHunter={(uid) => setDossierUserId(uid)}
              onFilterTarget={(h) => setTargetFilter(h)}
            />
          ))}
        </div>
      )}

      {claiming && (
        <ClaimModal
          bounty={claiming}
          onClose={() => setClaiming(null)}
          onSubmitted={() => { setClaiming(null); reload(); loadDossier(); }}
        />
      )}

      {dossierUserId && (
        <HunterDossierModal
          userId={dossierUserId}
          onClose={() => setDossierUserId(null)}
        />
      )}
    </div>
  );
}

function BountyLeaderboard({ data, onPickTarget }: { data: LeaderboardData | null; onPickTarget: (handle: string) => void }) {
  if (!data) {
    return <EmptyState icon="⚑" title="No legends yet" hint="Once the first bounty settles, the Hall of Fame opens its doors." />;
  }
  const { mostWanted, topHunters, biggestPosters, stats } = data;
  const hasAny = mostWanted.length > 0 || topHunters.length > 0 || biggestPosters.length > 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Stats strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
        <StatTile label="Open bounties"   value={stats.openCount.toLocaleString()}      sub="on the board" />
        <StatTile label="Paper in flight" value={stats.openTotal.toLocaleString()}      sub="held in escrow" highlight />
        <StatTile label="Bounties settled" value={stats.settledCount.toLocaleString()}  sub="kills confirmed" />
        <StatTile label="Paper paid out"  value={stats.settledTotal.toLocaleString()}  sub="to hunters" highlight />
      </div>

      {!hasAny ? (
        <EmptyState icon="⚑" title="No legends yet" hint="Post a few bounties and settle a few kills — the Hall of Fame fills itself." />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 12 }}>
          <LeaderboardColumn
            title="Most Wanted"
            caption="Highest bounty on a sailor's head"
            emptyLabel="No open marks right now."
            rows={mostWanted.map((r, i) => ({
              key: r.targetHandle,
              rank: i + 1,
              primary: r.targetHandle,
              secondary: `${r.openCount} bounty${r.openCount === 1 ? "" : "ies"} open`,
              value: r.totalAmount,
              onClick: () => onPickTarget(r.targetHandle),
            }))}
          />
          <LeaderboardColumn
            title="Top Hunters"
            caption="Most Paper earned on delivered bounties"
            emptyLabel="No one's cashed in yet."
            rows={topHunters.map((r, i) => ({
              key: r.userId,
              rank: i + 1,
              primary: r.userName,
              secondary: `${r.kills} delivered`,
              value: r.totalEarned,
            }))}
          />
          <LeaderboardColumn
            title="Biggest Posters"
            caption="Most Paper put on the board"
            emptyLabel="No one's opened their purse."
            rows={biggestPosters.map((r, i) => ({
              key: r.userId,
              rank: i + 1,
              primary: r.userName,
              secondary: `${r.postedCount} bount${r.postedCount === 1 ? "y" : "ies"} posted`,
              value: r.totalPosted,
            }))}
          />
        </div>
      )}
    </div>
  );
}

function StatTile({ label, value, sub, highlight }: { label: string; value: string; sub?: string; highlight?: boolean }) {
  return (
    <div style={{
      ...S.card,
      padding: "12px 14px",
      textAlign: "center",
      background: highlight
        ? `linear-gradient(180deg, ${PAL.stormMid} 0%, ${PAL.stormDeep} 100%)`
        : S.card.background,
      borderColor: highlight ? PAL.brass : `${PAL.brass}35`,
    }}>
      <div style={{ ...S.label, fontSize: 9, marginBottom: 4 }}>{label}</div>
      <div style={{ fontFamily: WR_FONT_DISPLAY, fontSize: 24, color: highlight ? PAL.brassHi : PAL.parchment, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 10, color: PAL.parchDim, marginTop: 5, fontStyle: "italic" }}>{sub}</div>}
    </div>
  );
}

function LeaderboardColumn({
  title, caption, rows, emptyLabel,
}: {
  title: string; caption: string; emptyLabel: string;
  rows: { key: string; rank: number; primary: string; secondary: string; value: number; onClick?: () => void }[];
}) {
  return (
    <div style={{ ...S.card, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
      <div>
        <div style={{ fontFamily: WR_FONT_DISPLAY, fontSize: 18, color: PAL.brassHi, letterSpacing: "0.3px", lineHeight: 1 }}>
          {title}
        </div>
        <div style={{ fontSize: 11, color: PAL.parchDim, marginTop: 3, fontStyle: "italic" }}>
          {caption}
        </div>
      </div>
      <BrassDivider />
      {rows.length === 0 ? (
        <div style={{ fontSize: 12, color: PAL.parchDim, fontStyle: "italic", padding: "16px 0", textAlign: "center" }}>
          {emptyLabel}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {rows.map(r => (
            <div key={r.key}
              onClick={r.onClick}
              title={r.onClick ? "See all bounties on this target" : undefined}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "8px 10px",
                background: r.rank === 1 ? `${PAL.brass}12` : r.rank === 2 ? `${PAL.brass}08` : r.rank === 3 ? `${PAL.brass}05` : "transparent",
                border: `1px solid ${r.rank <= 3 ? `${PAL.brass}25` : `${PAL.brass}10`}`,
                borderRadius: 2,
                cursor: r.onClick ? "pointer" : "default",
                transition: "border-color .15s, background .15s",
              }}
              onMouseEnter={e => { if (r.onClick) (e.currentTarget as HTMLElement).style.borderColor = PAL.brass; }}
              onMouseLeave={e => { if (r.onClick) (e.currentTarget as HTMLElement).style.borderColor = r.rank <= 3 ? `${PAL.brass}25` : `${PAL.brass}10`; }}
            >
              <span style={{
                width: 22, textAlign: "center",
                fontFamily: WR_FONT_DISPLAY,
                fontSize: r.rank === 1 ? 18 : 14,
                color: r.rank === 1 ? PAL.brassHi : r.rank <= 3 ? PAL.brass : PAL.parchDim,
                fontWeight: 700,
                flexShrink: 0,
              }}>
                {r.rank}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontFamily: WR_FONT_DISPLAY,
                  fontSize: 14,
                  color: r.rank === 1 ? PAL.parchment : PAL.parchment,
                  letterSpacing: "0.3px",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {r.primary}
                </div>
                <div style={{ fontSize: 10, color: PAL.parchDim, fontStyle: "italic", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {r.secondary}
                </div>
              </div>
              <div style={{
                textAlign: "right",
                flexShrink: 0,
                fontFamily: WR_FONT_MONO,
                fontSize: 12,
                fontVariantNumeric: "tabular-nums",
                color: r.rank <= 3 ? PAL.brassHi : PAL.brass,
                fontWeight: 600,
              }}>
                {r.value.toLocaleString()}
                <div style={{ fontSize: 8, color: PAL.parchDim, letterSpacing: "1px", marginTop: 1 }}>PAPER</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function BountyCard({ b, meId, onClaim, onSettle, onReject, onCancel, onOpenHunter, onFilterTarget }: {
  b: Bounty;
  meId: string;
  onClaim: () => void;
  onSettle: () => void;
  onReject: () => void;
  onCancel: () => void;
  onOpenHunter: (userId: string) => void;
  onFilterTarget: (handle: string) => void;
}) {
  const mine = !!meId && meId === b.posterId;
  const mineClaim = !!meId && meId === b.claimantId;
  const statusColor =
    b.status === "OPEN"    ? "#5db765" :
    b.status === "CLAIMED" ? PAL.brassHi :
    b.status === "SETTLED" ? PAL.brass :
                             "#a54848";
  const statusLabel =
    b.status === "OPEN" ? "OPEN" :
    b.status === "CLAIMED" ? "AWAITING SETTLE" :
    b.status === "SETTLED" ? "SETTLED" :
    "CANCELLED";

  return (
    <div style={{ ...S.card, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
      {/* Header: target + amount */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ ...S.label, fontSize: 9, marginBottom: 2 }}>
            <SkullIcon size={10} /> Wanted
          </div>
          <button
            type="button"
            onClick={() => onFilterTarget(b.targetHandle)}
            title="See all bounties on this target"
            style={{ background: "none", border: "none", padding: 0, cursor: "pointer", display: "block", textAlign: "left", maxWidth: "100%", fontFamily: WR_FONT_DISPLAY, fontSize: 20, color: PAL.parchment, lineHeight: 1.1, letterSpacing: "0.3px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
            onMouseEnter={e => (e.currentTarget.style.color = PAL.brassHi)}
            onMouseLeave={e => (e.currentTarget.style.color = PAL.parchment)}
          >
            {b.targetHandle}
          </button>
          {b.targetServer && (
            <div style={{ fontFamily: WR_FONT_MONO, fontSize: 10, color: PAL.parchDim, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              on {b.targetServer}
            </div>
          )}
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontFamily: WR_FONT_DISPLAY, fontSize: 22, color: PAL.brassHi, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
            {b.amount.toLocaleString()}
          </div>
          <div style={{ fontSize: 9, color: PAL.parchDim, fontFamily: WR_FONT_MONO, letterSpacing: "1px", textTransform: "uppercase" }}>
            Paper
          </div>
        </div>
      </div>

      {/* Reason */}
      {b.reason && (
        <div style={{ fontSize: 12, color: PAL.parchment, lineHeight: 1.5, fontStyle: "italic", opacity: 0.85, borderLeft: `2px solid ${PAL.brass}55`, paddingLeft: 10 }}>
          {b.reason.length > 160 ? `${b.reason.slice(0, 160)}…` : b.reason}
        </div>
      )}

      {/* Claim proof if CLAIMED/SETTLED */}
      {(b.status === "CLAIMED" || b.status === "SETTLED") && b.proofNote && (
        <div style={{ padding: "8px 10px", background: `${PAL.brass}10`, border: `1px solid ${PAL.brass}25`, borderRadius: 2, fontSize: 11, color: PAL.parchment }}>
          <div style={{ ...S.label, fontSize: 8, marginBottom: 3 }}>
            Proof ·{" "}
            {b.claimantId ? (
              <button
                type="button"
                onClick={() => onOpenHunter(b.claimantId!)}
                style={{ background: "none", border: "none", padding: 0, color: PAL.brass, cursor: "pointer", fontFamily: "inherit", letterSpacing: "inherit", textTransform: "inherit", textDecoration: "underline dotted", textDecorationColor: `${PAL.brass}60`, textUnderlineOffset: 2 }}
              >{b.claimantName || "hunter"}</button>
            ) : (b.claimantName || "hunter")}
          </div>
          <div style={{ lineHeight: 1.4, fontStyle: "italic" }}>
            {b.proofNote.length > 180 ? `${b.proofNote.slice(0, 180)}…` : b.proofNote}
          </div>
          {b.proofImageUrl && (
            <div style={{ marginTop: 6 }}>
              <a href={b.proofImageUrl} target="_blank" rel="noopener noreferrer" style={{ color: PAL.verdigris, fontSize: 10, fontFamily: WR_FONT_MONO, letterSpacing: "0.5px" }}>
                View evidence →
              </a>
            </div>
          )}
        </div>
      )}

      {/* Meta strip */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 9, fontFamily: WR_FONT_MONO, color: statusColor, letterSpacing: "1px" }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: statusColor, boxShadow: `0 0 6px ${statusColor}` }} />
          {statusLabel}
        </span>
        <span style={{ fontSize: 10, color: PAL.parchDim, fontStyle: "italic" }}>
          posted by{" "}
          <button
            type="button"
            onClick={() => onOpenHunter(b.posterId)}
            style={{ background: "none", border: "none", padding: 0, color: PAL.brass, cursor: "pointer", fontFamily: "inherit", fontSize: 10, fontStyle: "italic", textDecoration: "underline dotted", textDecorationColor: `${PAL.brass}60`, textUnderlineOffset: 2 }}
          >{b.posterName}</button>
          {" "}· {timeAgo(b.createdAt)}
        </span>
        <span style={{ flex: 1 }} />
        <a
          href={`/windrose/bounty/${encodeURIComponent(b.id)}`}
          target="_blank" rel="noopener noreferrer"
          title="Open the shareable bounty page"
          style={{ fontSize: 10, color: PAL.parchDim, textDecoration: "none", fontFamily: WR_FONT_MONO, letterSpacing: "0.5px", padding: "2px 6px", border: `1px solid ${PAL.brass}20`, transition: "border-color .15s" }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = `${PAL.brass}55`)}
          onMouseLeave={e => (e.currentTarget.style.borderColor = `${PAL.brass}20`)}
        >
          share ↗
        </a>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 2 }}>
        {b.status === "OPEN" && !mine && meId && (
          <button type="button" style={{ ...S.btnPrimary, fontSize: 11, padding: "7px 14px" }} onClick={onClaim}>
            I got 'em — Claim
          </button>
        )}
        {b.status === "OPEN" && mine && (
          <button type="button" style={{ ...S.btn, fontSize: 10, padding: "6px 12px", color: "rgba(252,165,165,0.85)", borderColor: "rgba(163,61,61,0.45)" }} onClick={onCancel}>
            Cancel & Refund
          </button>
        )}
        {b.status === "CLAIMED" && mine && (
          <>
            <button type="button" style={{ ...S.btnPrimary, fontSize: 11, padding: "7px 14px" }} onClick={onSettle}>
              Settle · Pay {b.amount.toLocaleString()}
            </button>
            <button type="button" style={{ ...S.btn, fontSize: 10, padding: "6px 12px", color: "rgba(252,165,165,0.85)" }} onClick={onReject}>
              Reject
            </button>
          </>
        )}
        {b.status === "CLAIMED" && !mine && mineClaim && (
          <span style={{ fontSize: 11, color: PAL.brass, fontStyle: "italic", padding: "6px 0" }}>
            Awaiting poster's confirmation…
          </span>
        )}
        {b.status === "SETTLED" && (
          <span style={{ fontSize: 11, color: PAL.brass, fontStyle: "italic" }}>
            Paid to{" "}
            {b.claimantId ? (
              <button
                type="button"
                onClick={() => onOpenHunter(b.claimantId!)}
                style={{ background: "none", border: "none", padding: 0, color: PAL.brassHi, cursor: "pointer", fontFamily: "inherit", fontStyle: "italic", fontSize: 11, textDecoration: "underline dotted", textDecorationColor: `${PAL.brassHi}60`, textUnderlineOffset: 2 }}
              >{b.claimantName || "hunter"}</button>
            ) : (b.claimantName || "hunter")}
          </span>
        )}
      </div>
    </div>
  );
}

function HunterDossierModal({ userId, onClose }: { userId: string; onClose: () => void }) {
  const [d, setD] = useState<HunterDossier | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true); setErr(null);
    apiFetch(`/windrose/hunter/${encodeURIComponent(userId)}`).then(j => {
      if (j?.ok) setD(j as HunterDossier);
      else setErr("No dossier on record.");
      setLoading(false);
    }).catch(() => { setErr("Couldn't pull the dossier."); setLoading(false); });
  }, [userId]);

  const avatarColor = d?.user.avatarColor || PAL.brass;

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(5,5,10,.72)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ ...S.card, width: "min(620px, 100%)", padding: 0, maxHeight: "90vh", overflowY: "auto", borderColor: `${PAL.brass}55` }}>
        {/* Header */}
        <div style={{
          padding: "20px 26px 18px",
          background: `radial-gradient(ellipse 80% 60% at 20% 0%, ${PAL.brass}18 0%, transparent 60%), linear-gradient(180deg, ${PAL.stormMid} 0%, ${PAL.stormDeep} 100%)`,
          borderBottom: `1px solid ${PAL.brass}30`,
        }}>
          <div style={{ ...S.label, marginBottom: 6, display: "flex", alignItems: "center", gap: 8 }}>
            <SkullIcon size={12} /> Hunter Dossier
          </div>
          {loading ? (
            <div style={{ fontSize: 13, color: PAL.parchDim, fontStyle: "italic" }}>Digging through the ledger…</div>
          ) : err ? (
            <div style={{ fontSize: 13, color: PAL.parchDim, fontStyle: "italic" }}>{err}</div>
          ) : d ? (
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{
                width: 48, height: 48, borderRadius: 4,
                background: d.user.avatar ? `url(${d.user.avatar}) center/cover` : `linear-gradient(135deg, ${avatarColor}, ${PAL.brassLow})`,
                border: `2px solid ${PAL.brass}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: WR_FONT_DISPLAY, fontSize: 22, color: PAL.abyss, fontWeight: 700, flexShrink: 0,
              }}>
                {!d.user.avatar && (d.user.name || "?").slice(0, 1).toUpperCase()}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontFamily: WR_FONT_DISPLAY, fontSize: 24, color: PAL.brassHi, letterSpacing: "0.3px", lineHeight: 1.1 }}>
                  {d.user.name}
                </div>
                <div style={{ fontSize: 11, color: PAL.parchDim, marginTop: 4, fontFamily: WR_FONT_MONO, letterSpacing: "0.5px" }}>
                  {d.hunter.kills > 0 || d.poster.postedCount > 0 ? "ACTIVE ON THE BOUNTY BOARD" : "NO BOUNTY ACTIVITY YET"}
                </div>
                <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                  <TierBadge tier={hunterTier(d.hunter.kills)} size="md" />
                  <TierBadge tier={posterTier(d.poster.postedCount)} size="md" />
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {/* Body */}
        {d && (
          <div style={{ padding: "18px 26px 22px", display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Hunter side */}
            <section>
              <div style={{ ...S.label, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ color: "#5db765" }}>⚔</span> As Hunter
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
                <DossierStat label="Delivered" value={d.hunter.kills.toLocaleString()} />
                <DossierStat label="Earned" value={d.hunter.totalEarned.toLocaleString()} sub="Paper" highlight />
                <DossierStat
                  label="Biggest Hit"
                  value={d.hunter.biggestHit ? d.hunter.biggestHit.amount.toLocaleString() : "—"}
                  sub={d.hunter.biggestHit ? d.hunter.biggestHit.target : undefined}
                />
                <DossierStat
                  label="Rank"
                  value={d.hunter.rank ? `#${d.hunter.rank}` : "—"}
                  sub={d.hunter.rank ? `of ${d.hunter.totalHunters}` : undefined}
                />
              </div>
              {d.hunter.pendingClaims > 0 && (
                <div style={{ fontSize: 11, color: PAL.brass, fontStyle: "italic", marginTop: 8 }}>
                  {d.hunter.pendingClaims} claim{d.hunter.pendingClaims === 1 ? "" : "s"} awaiting settlement.
                </div>
              )}
              {d.hunter.recentKills.length > 0 && (
                <div style={{ marginTop: 10, padding: "10px 12px", background: `${PAL.brass}06`, border: `1px solid ${PAL.brass}18`, borderRadius: 2 }}>
                  <div style={{ ...S.label, fontSize: 9, marginBottom: 6 }}>Recent Deliveries</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {d.hunter.recentKills.map(k => (
                      <div key={k.id} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12, color: PAL.parchment }}>
                        <span style={{ color: "#5db765", flexShrink: 0 }}>⚔</span>
                        <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontStyle: "italic" }}>
                          {k.target}
                        </span>
                        <span style={{ fontFamily: WR_FONT_MONO, fontSize: 11, color: PAL.brassHi, fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>
                          {k.amount.toLocaleString()}
                        </span>
                        <span style={{ fontFamily: WR_FONT_MONO, fontSize: 10, color: PAL.parchDim, flexShrink: 0, width: 60, textAlign: "right" }}>
                          {timeAgo(k.at)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>

            {/* Poster side */}
            <section>
              <div style={{ ...S.label, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ color: PAL.blood }}>☠</span> As Poster
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
                <DossierStat label="Posted" value={d.poster.postedCount.toLocaleString()} />
                <DossierStat label="Total Staked" value={d.poster.totalPosted.toLocaleString()} sub="Paper" highlight />
                <DossierStat label="In Flight" value={d.poster.open.toLocaleString()} />
                <DossierStat
                  label="Rank"
                  value={d.poster.rank ? `#${d.poster.rank}` : "—"}
                  sub={d.poster.rank ? `of ${d.poster.totalPosters}` : undefined}
                />
              </div>
              {d.poster.recentPosts.length > 0 && (
                <div style={{ marginTop: 10, padding: "10px 12px", background: `${PAL.brass}06`, border: `1px solid ${PAL.brass}18`, borderRadius: 2 }}>
                  <div style={{ ...S.label, fontSize: 9, marginBottom: 6 }}>Recent Bounties Posted</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {d.poster.recentPosts.map(p => (
                      <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12, color: PAL.parchment }}>
                        <span style={{ color: p.status === "SETTLED" ? "#5db765" : p.status === "OPEN" ? PAL.blood : p.status === "CLAIMED" ? PAL.brassHi : PAL.parchDim, flexShrink: 0 }}>
                          {p.status === "SETTLED" ? "✓" : p.status === "OPEN" ? "☠" : p.status === "CLAIMED" ? "⋯" : "✕"}
                        </span>
                        <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontStyle: "italic" }}>
                          {p.target}
                        </span>
                        <span style={{ fontFamily: WR_FONT_MONO, fontSize: 11, color: PAL.brass, fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>
                          {p.amount.toLocaleString()}
                        </span>
                        <span style={{ fontFamily: WR_FONT_MONO, fontSize: 10, color: PAL.parchDim, flexShrink: 0, width: 60, textAlign: "right" }}>
                          {timeAgo(p.at)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
              <a
                href={`/windrose/hunter/${encodeURIComponent(userId)}`}
                target="_blank" rel="noopener noreferrer"
                style={{ ...S.btn, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6, fontSize: 10 }}
                title="Open the shareable dossier page"
              >
                Share · Open Full Dossier →
              </a>
              <button type="button" style={S.btn} onClick={onClose}>Close</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function DossierStat({ label, value, sub, highlight }: { label: string; value: string; sub?: string; highlight?: boolean }) {
  return (
    <div style={{
      ...S.card,
      padding: "10px 12px",
      background: highlight ? `linear-gradient(180deg, ${PAL.stormMid} 0%, ${PAL.stormDeep} 100%)` : S.card.background,
      borderColor: highlight ? PAL.brass : `${PAL.brass}30`,
    }}>
      <div style={{ ...S.label, fontSize: 9, marginBottom: 3 }}>{label}</div>
      <div style={{
        fontFamily: WR_FONT_DISPLAY,
        fontSize: 20,
        color: highlight ? PAL.brassHi : PAL.parchment,
        lineHeight: 1,
        fontVariantNumeric: "tabular-nums",
      }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 9, color: PAL.parchDim, marginTop: 3, fontFamily: WR_FONT_MONO, letterSpacing: "0.5px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {sub}
        </div>
      )}
    </div>
  );
}

function ClaimModal({ bounty, onClose, onSubmitted }: { bounty: Bounty; onClose: () => void; onSubmitted: () => void }) {
  const [proofNote, setProofNote] = useState("");
  const [proofImageUrl, setProofImageUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    if (!proofNote.trim() || busy) return;
    setErr(null); setBusy(true);
    const j = await apiFetch(`/windrose/bounties/${bounty.id}/claim`, {
      method: "POST",
      body: JSON.stringify({ proofNote: proofNote.trim(), proofImageUrl: proofImageUrl.trim() || undefined }),
    });
    setBusy(false);
    if (j?.ok) onSubmitted();
    else setErr(j?.message || j?.error || "Failed to submit claim.");
  }

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(5,5,10,.72)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center" }}
    >
      <div onClick={e => e.stopPropagation()} style={{ ...S.card, width: "min(520px, calc(100% - 32px))", padding: "22px 26px" }}>
        <div style={{ ...S.label, marginBottom: 6 }}>Claiming bounty on</div>
        <div style={{ fontFamily: WR_FONT_DISPLAY, fontSize: 22, color: PAL.parchment, letterSpacing: "0.3px", marginBottom: 4 }}>
          {bounty.targetHandle}
        </div>
        <div style={{ fontSize: 12, color: PAL.parchDim, fontStyle: "italic", marginBottom: 16 }}>
          {bounty.amount.toLocaleString()} Paper if the poster confirms the kill.
        </div>

        <div style={{ ...S.label, fontSize: 9, marginBottom: 4 }}>Proof · what you delivered *</div>
        <textarea
          value={proofNote}
          onChange={e => setProofNote(e.target.value.slice(0, 500))}
          placeholder="Sank their galleon / Dropped off the rum / Brought back the Kraken tooth — whatever the bounty asked for. Link a screenshot or clip below if you've got one."
          style={{ ...S.input, minHeight: 90, fontFamily: WR_FONT_SERIF, fontStyle: "italic" } as React.CSSProperties}
        />

        <div style={{ ...S.label, fontSize: 9, marginBottom: 4, marginTop: 12 }}>Evidence link (optional)</div>
        <input
          value={proofImageUrl}
          onChange={e => setProofImageUrl(e.target.value.slice(0, 300))}
          placeholder="https://imgur.com/... or https://clips.twitch.tv/..."
          style={S.input as React.CSSProperties}
        />

        {err && (
          <div style={{ marginTop: 10, padding: "8px 12px", background: "rgba(163,61,61,0.12)", border: "1px solid rgba(163,61,61,0.35)", borderRadius: 3, color: "rgba(232,196,138,0.9)", fontSize: 12 }}>
            {err}
          </div>
        )}

        <div style={{ display: "flex", gap: 10, marginTop: 18, justifyContent: "flex-end" }}>
          <button type="button" style={S.btn} onClick={onClose} disabled={busy}>Cancel</button>
          <button type="button" style={S.btnPrimary} onClick={submit} disabled={busy || !proofNote.trim()}>
            {busy ? "Submitting…" : "Submit Claim"}
          </button>
        </div>
      </div>
    </div>
  );
}

function PortsOfCallTab() {
  const [registered, setRegistered] = useState<CommunityServer[] | null>(null);
  const [publicServers, setPublicServers] = useState<PublicServer[] | null>(null);
  const [publicError, setPublicError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filterRegion, setFilterRegion] = useState<string>("");
  const [filterSlots, setFilterSlots] = useState<boolean>(false);
  const [query, setQuery] = useState<string>("");

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [r1, r2] = await Promise.all([
        apiFetch("/windrose/servers").catch(() => ({ ok: false })),
        apiFetch("/windrose/public-servers").catch(() => ({ ok: false })),
      ]);
      setRegistered(Array.isArray(r1?.servers) ? r1.servers : []);
      if (r2?.ok) {
        setPublicServers(Array.isArray(r2.servers) ? r2.servers : []);
        setPublicError(null);
      } else {
        setPublicServers([]);
        setPublicError(r2?.error === "steam_key_missing" ? "Steam discovery disabled" : "Steam discovery unavailable");
      }
    } catch { setRegistered([]); setPublicServers([]); }
    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
    const t = setInterval(reload, 60_000);
    return () => clearInterval(t);
  }, [reload]);

  // Merge the two lists by host/addr. A manually-registered server enhances
  // the Steam-discovered one with description, tags, owner, dashboard, etc.
  const rows: PortRow[] = useMemo(() => {
    const reg = registered || [];
    const pub = publicServers || [];
    const byAddr = new Map<string, PortRow>();

    // Seed with auto-discovered public servers
    for (const p of pub) {
      byAddr.set(p.addr.toLowerCase(), {
        key: `pub:${p.addr}`,
        source: "public",
        name: p.name || p.addr,
        addr: p.addr,
        players: p.players,
        maxPlayers: p.maxPlayers,
        passworded: p.passworded,
        secure: p.secure,
      });
    }
    // Overlay registered entries (merge when host matches; append when it doesn't)
    for (const r of reg) {
      const host = String(r.host || "").toLowerCase();
      const existing = host ? byAddr.get(host) : undefined;
      const regLive = Number(r.lastState?.players?.length ?? r.lastState?.online ?? r.lastState?.count ?? 0);
      const maxRegistered = Number(r.maxSlots ?? 8);
      if (existing) {
        byAddr.set(host, {
          ...existing,
          source: "both",
          // Prefer the name the owner curated
          name: r.name || existing.name,
          description: r.description ?? existing.description,
          region: r.region ?? existing.region,
          framework: r.framework ?? existing.framework,
          tags: r.tags && r.tags.length ? r.tags : existing.tags,
          owner: r.owner,
          dashboardUrl: r.dashboardUrl,
          status: r.status,
        });
      } else {
        byAddr.set(`reg:${r.id}`, {
          key: `reg:${r.id}`,
          source: "registered",
          name: r.name,
          addr: r.host,
          description: r.description,
          region: r.region,
          framework: r.framework,
          tags: r.tags,
          players: regLive,
          maxPlayers: maxRegistered,
          owner: r.owner,
          dashboardUrl: r.dashboardUrl,
          status: r.status,
        });
      }
    }
    return Array.from(byAddr.values()).sort((a, b) => {
      // Registered/enhanced rows float up, then by players desc, then name
      const aPin = a.source === "both" || a.source === "registered" ? 1 : 0;
      const bPin = b.source === "both" || b.source === "registered" ? 1 : 0;
      if (aPin !== bPin) return bPin - aPin;
      if ((b.players || 0) !== (a.players || 0)) return (b.players || 0) - (a.players || 0);
      return (a.name || "").localeCompare(b.name || "");
    });
  }, [registered, publicServers]);

  const filtered = rows.filter(s => {
    if (filterRegion && s.region !== filterRegion) return false;
    if (filterSlots && s.maxPlayers > 0 && s.players >= s.maxPlayers) return false;
    if (query) {
      const q = query.trim().toLowerCase();
      if (q && !(`${s.name} ${s.addr} ${(s.tags || []).join(" ")}`.toLowerCase().includes(q))) return false;
    }
    return true;
  });

  const publicCount = (publicServers || []).length;
  const registeredCount = (registered || []).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ ...S.card, padding: "18px 22px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ ...S.label, marginBottom: 4 }}>Community Servers</div>
            <h3 style={{ fontFamily: WR_FONT_DISPLAY, fontSize: 22, color: PAL.brassHi, margin: 0, letterSpacing: "0.3px" }}>Ports of Call</h3>
            <div style={{ fontSize: 13, color: PAL.parchDim, marginTop: 4, fontStyle: "italic" }}>
              Every public Windrose server, auto-discovered from Steam. Owners can list their port for richer details — description, tags, dashboard links.
            </div>
          </div>
          <button type="button" style={S.btnPrimary} onClick={() => setShowForm(true)}>
            List Your Port
          </button>
        </div>

        <BrassDivider />

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search by name, address, or tag..."
            style={{ ...S.input, width: 260, flex: "0 1 260px" } as React.CSSProperties}
          />
          <span style={{ ...S.label, fontSize: 9 }}>Region</span>
          <select value={filterRegion} onChange={e => setFilterRegion(e.target.value)} style={{ ...S.input, width: "auto" } as React.CSSProperties}>
            <option value="">Any</option>
            {WR_REGIONS_LIST.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer", color: PAL.parchDim, fontSize: 12 }}>
            <input type="checkbox" checked={filterSlots} onChange={e => setFilterSlots(e.target.checked)} />
            slots available only
          </label>
          <span style={{ flex: 1 }} />
          <span style={{ fontFamily: WR_FONT_MONO, fontSize: 10, color: PAL.parchDim }}>
            {filtered.length} of {rows.length}
            {publicError ? (
              <span style={{ color: PAL.blood, marginLeft: 8, opacity: 0.85 }}>· {publicError}</span>
            ) : (
              <> · {publicCount} public · {registeredCount} listed</>
            )}
          </span>
        </div>
      </div>

      {showForm && <LinkServerForm onClose={() => { setShowForm(false); reload(); }} />}

      {loading ? (
        <LoadingState label="Scanning the open seas..." />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="⚓"
          title={rows.length === 0 ? "No ports flying colors yet" : "No ports match that filter"}
          hint={rows.length === 0
            ? "No public Windrose servers advertising right now. Run one? Be the first port of call."
            : "Try loosening the filters, or clear the search."}
          action={<button type="button" style={S.btnPrimary} onClick={() => setShowForm(true)}>List Your Port</button>}
        />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 12 }}>
          {filtered.map(s => <PortCard key={s.key} row={s} />)}
        </div>
      )}

      <div style={{ ...S.card, padding: "14px 18px", background: `linear-gradient(180deg, ${PAL.stormMid}50 0%, ${PAL.stormDeep}70 100%)` }}>
        <div style={{ ...S.label, marginBottom: 6, fontSize: 9 }}>Running a server?</div>
        <div style={{ fontSize: 13, color: PAL.parchment, lineHeight: 1.55, fontStyle: "italic" }}>
          If you&apos;re on <strong style={{ color: PAL.brassHi, fontStyle: "normal" }}>WindrosePlus</strong>, you can drop your query endpoint below and we&apos;ll keep the listing live — player count, multipliers, uptime. Never logged in as admin, just read-only polling. Deeper event integration (join/leave broadcasts to your lobby) coming as the ecosystem matures.
        </div>
      </div>
    </div>
  );
}

function PortCard({ row }: { row: PortRow }) {
  const online = row.players || 0;
  const max = row.maxPlayers || 8;
  const pct = max > 0 ? Math.min(100, (online / max) * 100) : 0;
  const full = max > 0 && online >= max;

  // Source-driven pill
  const srcPill =
    row.source === "both"       ? { label: "LISTED · LIVE", color: PAL.brassHi } :
    row.source === "registered" ? { label: "LISTED",         color: PAL.brass   } :
                                   { label: "PUBLIC",         color: "#5db765"   };

  // Heat colour — green if room to spare, amber if packed, red if full
  const heat = full ? "#a54848" : pct > 75 ? PAL.brassHi : pct > 30 ? PAL.brass : "#5db765";

  return (
    <div style={{ ...S.card, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2, flexWrap: "wrap" }}>
            <span style={{ fontFamily: WR_FONT_DISPLAY, fontSize: 17, color: PAL.brassHi, letterSpacing: "0.3px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" }}>
              {row.name}
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 9, fontFamily: WR_FONT_MONO, color: srcPill.color, letterSpacing: "1px" }}>
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: srcPill.color, boxShadow: `0 0 6px ${srcPill.color}` }} />
              {srcPill.label}
            </span>
            {row.passworded && (
              <span style={{ fontSize: 9, fontFamily: WR_FONT_MONO, color: PAL.parchDim, letterSpacing: "1px" }}>· LOCKED</span>
            )}
          </div>
          <div style={{ fontFamily: WR_FONT_MONO, fontSize: 11, color: PAL.parchDim, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {row.addr}
          </div>
        </div>
      </div>

      {row.description && (
        <div style={{ fontSize: 12, color: PAL.parchment, lineHeight: 1.5, fontStyle: "italic", opacity: 0.88 }}>
          {row.description.length > 140 ? `${row.description.slice(0, 140)}…` : row.description}
        </div>
      )}

      {/* Slots bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ flex: 1, height: 4, background: `${PAL.brass}18`, borderRadius: 1, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${pct}%`, background: `linear-gradient(90deg, ${heat}, ${PAL.brassHi})`, transition: "width 400ms ease" }} />
        </div>
        <span style={{ fontFamily: WR_FONT_MONO, fontSize: 11, color: heat, fontVariantNumeric: "tabular-nums" }}>
          {online}<span style={{ color: PAL.parchDim }}>/</span>{max || "?"}
        </span>
      </div>

      {/* Meta strip */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        {row.region && (
          <span style={{ ...S.label, fontSize: 9 }}>
            <SkullIcon size={10} /> {row.region}
          </span>
        )}
        {row.framework && (
          <span style={{ ...S.label, fontSize: 9, color: PAL.brass }}>
            · {row.framework}
          </span>
        )}
        {(row.tags || []).slice(0, 3).map(t => (
          <span key={t} style={{ fontSize: 10, color: PAL.brass, fontFamily: WR_FONT_MONO, letterSpacing: "0.5px" }}>
            #{t}
          </span>
        ))}
        <span style={{ flex: 1 }} />
        {row.owner && (
          <span style={{ fontSize: 10, color: PAL.parchDim, fontStyle: "italic" }}>
            listed by {row.owner.name}
          </span>
        )}
      </div>

      {/* Action row */}
      <div style={{ display: "flex", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
        <a
          href={`steam://connect/${row.addr}`}
          title="Launches Windrose and connects you to this server"
          style={{ ...S.btnPrimary, textDecoration: "none", fontSize: 10, padding: "6px 14px", letterSpacing: "1.5px" }}
        >
          Set Sail
        </a>
        {row.dashboardUrl && (
          <a href={row.dashboardUrl} target="_blank" rel="noopener noreferrer" style={{ ...S.btn, textDecoration: "none", fontSize: 10, padding: "6px 12px" }}>
            Dashboard
          </a>
        )}
        <button
          type="button"
          style={{ ...S.btn, fontSize: 10, padding: "6px 12px" }}
          onClick={() => { try { navigator.clipboard.writeText(row.addr); } catch {} }}
        >
          Copy Address
        </button>
      </div>
    </div>
  );
}

function LinkServerForm({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("");
  const [host, setHost] = useState("");
  const [dashboardUrl, setDashboardUrl] = useState("");
  const [queryUrl, setQueryUrl] = useState("");
  const [region, setRegion] = useState("");
  const [description, setDescription] = useState("");
  const [framework, setFramework] = useState("WindrosePlus");
  const [maxSlots, setMaxSlots] = useState(8);
  const [tags, setTags] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    if (!name.trim() || !host.trim() || busy) return;
    setErr(null); setBusy(true);
    const tagList = tags.split(",").map(t => t.trim().replace(/^#/, "")).filter(Boolean).slice(0, 10);
    const j = await apiFetch("/windrose/servers", {
      method: "POST",
      body: JSON.stringify({
        name: name.trim(), host: host.trim(),
        dashboardUrl: dashboardUrl.trim() || undefined,
        queryUrl: queryUrl.trim() || undefined,
        region: region || undefined,
        description: description.trim() || undefined,
        framework: framework || undefined,
        maxSlots,
        tags: tagList,
      }),
    });
    setBusy(false);
    if (j?.ok) onClose();
    else setErr(j?.message || j?.error || "Couldn't list your port. Try again.");
  }

  return (
    <div style={{ ...S.card, padding: "20px 24px", borderColor: PAL.brass }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div>
          <div style={{ ...S.label, marginBottom: 2 }}>Register a server</div>
          <h3 style={{ fontFamily: WR_FONT_DISPLAY, fontSize: 20, color: PAL.brassHi, margin: 0, letterSpacing: "0.3px" }}>
            List Your Port
          </h3>
        </div>
        <button type="button" style={{ ...S.btn, padding: "6px 12px", fontSize: 10 }} onClick={onClose}>Close</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <Labeled label="Server name *">
          <input value={name} onChange={e => setName(e.target.value.slice(0, 60))} placeholder="Kraken's Fury" style={S.input as React.CSSProperties} />
        </Labeled>
        <Labeled label="Server address *">
          <input value={host} onChange={e => setHost(e.target.value.slice(0, 120))} placeholder="play.myserver.com:28000" style={S.input as React.CSSProperties} />
        </Labeled>
        <Labeled label="Region">
          <select value={region} onChange={e => setRegion(e.target.value)} style={S.input as React.CSSProperties}>
            <option value="">Choose...</option>
            {WR_REGIONS_LIST.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </Labeled>
        <Labeled label="Framework">
          <select value={framework} onChange={e => setFramework(e.target.value)} style={S.input as React.CSSProperties}>
            {WR_FRAMEWORKS.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        </Labeled>
        <Labeled label="Max slots">
          <input type="number" min={1} max={64} value={maxSlots} onChange={e => setMaxSlots(Math.max(1, Math.min(64, Number(e.target.value) || 8)))} style={S.input as React.CSSProperties} />
        </Labeled>
        <Labeled label="Tags (comma-separated)">
          <input value={tags} onChange={e => setTags(e.target.value)} placeholder="chill, 2xloot, pve-only" style={S.input as React.CSSProperties} />
        </Labeled>
        <Labeled label="Public dashboard URL (optional)" span={2}>
          <input value={dashboardUrl} onChange={e => setDashboardUrl(e.target.value.slice(0, 300))} placeholder="https://play.myserver.com:8080" style={S.input as React.CSSProperties} />
        </Labeled>
        <Labeled label="Public query/status URL (optional — live polling)" span={2}>
          <input value={queryUrl} onChange={e => setQueryUrl(e.target.value.slice(0, 300))} placeholder="https://play.myserver.com:8080/status.json" style={S.input as React.CSSProperties} />
        </Labeled>
        <Labeled label="Description" span={2}>
          <textarea value={description} onChange={e => setDescription(e.target.value.slice(0, 500))} placeholder="Casual PvE, 2x loot weekends, active crew, no-wipe policy for a year. All welcome." style={{ ...S.input, minHeight: 70, fontFamily: WR_FONT_SERIF, fontStyle: "italic" } as React.CSSProperties} />
        </Labeled>
      </div>

      {err && (
        <div style={{ marginTop: 10, padding: "10px 14px", background: "rgba(163,61,61,0.12)", border: "1px solid rgba(163,61,61,0.35)", borderRadius: 3, color: "rgba(232,196,138,0.9)", fontSize: 12 }}>
          {err}
        </div>
      )}

      <div style={{ display: "flex", gap: 10, marginTop: 16, justifyContent: "flex-end" }}>
        <button type="button" style={S.btn} onClick={onClose} disabled={busy}>Cancel</button>
        <button type="button" style={S.btnPrimary} onClick={submit} disabled={busy || !name.trim() || !host.trim()}>
          {busy ? "Listing…" : "Raise Your Colors"}
        </button>
      </div>
    </div>
  );
}

function Labeled({ label, children, span = 1 }: { label: string; children: React.ReactNode; span?: number }) {
  return (
    <div style={{ gridColumn: `span ${span}`, display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ ...S.label, fontSize: 9 }}>{label}</div>
      {children}
    </div>
  );
}

// ═══ Tab: Twitch Streams ═══════════════════════════════════════════════════════

function StreamsTab({ gameName, lobbyId }: { gameName: string; lobbyId: string }) {
  const [streams, setStreams] = useState<StreamInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [intercept, setIntercept] = useState<StreamInfo | null>(null);
  const [activeStream, setActiveStream] = useState<string | null>(null);

  useEffect(() => {
    const ch = consumePendingStream();
    console.log("[live-handoff] STREAMS tab mount, consumePendingStream", { channel: ch });
    if (ch) setActiveStream(ch);
  }, []);

  useEffect(() => {
    const game = encodeURIComponent(gameName || "Windrose");
    apiFetch(`/twitch/streams?game=${game}&first=20`).then(j => {
      if (j?.ok && Array.isArray(j.streams)) setStreams(j.streams);
      setLoading(false);
    });
  }, [gameName]);

  if (loading) return <LoadingState label="Tuning the spyglass..." />;
  if (streams.length === 0) return <EmptyState icon="📡" title="No one's live" hint="When a captain goes live on Twitch, they'll show up here." />;

  const parentHost = typeof window !== "undefined" ? window.location.hostname : "weered.ca";

  return (
    <>
      {activeStream && (
        <div style={{ ...S.card, padding: 0, marginBottom: 16, overflow: "hidden", border: `1px solid ${PAL.brass}` }}>
          <iframe
            src={`https://player.twitch.tv/?channel=${activeStream}&parent=${parentHost}&muted=true`}
            width="100%" height="380" style={{ border: "none", display: "block" }} allowFullScreen
            title={`${activeStream} live stream`}
          />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: `${PAL.brass}10`, borderTop: `1px solid ${PAL.brass}35` }}>
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: PAL.blood, boxShadow: `0 0 8px ${PAL.blood}` }} />
              <span style={{ fontFamily: WR_FONT_DISPLAY, fontSize: 15, color: PAL.brassHi, letterSpacing: "0.3px" }}>{activeStream}</span>
              <span style={{ ...S.label, fontSize: 9 }}>LIVE · Watching in the hub</span>
            </span>
            <button type="button" onClick={() => setActiveStream(null)} style={{ ...S.btn, fontSize: 10, padding: "6px 12px" }}>Close</button>
          </div>
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
        {streams.map(s => (
          <div key={s.userLogin} style={{ ...S.card, padding: 0, overflow: "hidden", cursor: "pointer" }} onClick={() => setIntercept(s)}>
            <div style={{
              width: "100%", aspectRatio: "16 / 9",
              background: s.thumbnailUrl
                ? `url(${s.thumbnailUrl.replace("{width}", "440").replace("{height}", "248")}) center/cover`
                : PAL.stormMid,
              position: "relative",
            }}>
              <span style={{
                position: "absolute", top: 8, left: 8,
                padding: "3px 8px",
                background: PAL.blood,
                color: PAL.parchment,
                fontSize: 10, fontWeight: 800, letterSpacing: "1px",
                fontFamily: WR_FONT_MONO,
              }}>LIVE</span>
              {typeof s.viewerCount === "number" && (
                <span style={{
                  position: "absolute", top: 8, right: 8,
                  padding: "3px 8px",
                  background: `${PAL.ink}c0`,
                  color: PAL.brassHi,
                  fontSize: 10, fontWeight: 700,
                  fontFamily: WR_FONT_MONO, letterSpacing: "0.5px",
                }}>{s.viewerCount.toLocaleString()} watching</span>
              )}
            </div>
            <div style={{ padding: "10px 14px" }}>
              <div style={{ fontFamily: WR_FONT_DISPLAY, fontSize: 15, color: PAL.brassHi, letterSpacing: "0.3px" }}>
                {s.userName}
              </div>
              <div style={{ fontSize: 12, color: PAL.parchDim, marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {s.title}
              </div>
            </div>
          </div>
        ))}
      </div>
      {intercept && (
        <StreamInterceptModal
          stream={intercept}
          lobbyId={lobbyId}
          onClose={() => setIntercept(null)}
          onWatchHere={(s) => setActiveStream(s.userLogin)}
        />
      )}
    </>
  );
}

// ═══ Tab: About ════════════════════════════════════════════════════════════════

function AboutTab() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 760 }}>
      <div style={{ ...S.card, padding: "22px 26px" }}>
        <div style={{ ...S.label, marginBottom: 6 }}>The Studio</div>
        <h2 style={{ fontFamily: WR_FONT_DISPLAY, fontSize: 28, color: PAL.brassHi, margin: "0 0 10px", letterSpacing: "0.5px" }}>
          Kraken Express
        </h2>
        <p style={{ fontSize: 14, color: PAL.parchment, lineHeight: 1.7, margin: "0 0 10px", fontStyle: "italic" }}>
          Uzbekistan-based indie studio previously known as <em>Windrose Crew</em>, originally <em>Crosswind Crew</em>. Producer Philip Molodkovets delivered the Gamescom 2025 demo and has been the studio&apos;s public voice through the pivot.
        </p>
        <p style={{ fontSize: 14, color: PAL.parchment, lineHeight: 1.7, margin: 0, fontStyle: "italic" }}>
          Upcoming: <strong style={{ color: PAL.brassHi, fontStyle: "normal" }}>Kraken&apos;s Lair: Battle for the Abyss</strong> — a free-to-play underwater multiplayer action game.
        </p>
      </div>

      <div style={{ ...S.card, padding: "22px 26px" }}>
        <div style={{ ...S.label, marginBottom: 6 }}>Windrose</div>
        <h2 style={{ fontFamily: WR_FONT_DISPLAY, fontSize: 28, color: PAL.brassHi, margin: "0 0 10px", letterSpacing: "0.5px" }}>
          Build. Sail. Survive.
        </h2>
        <p style={{ fontSize: 14, color: PAL.parchment, lineHeight: 1.7, margin: "0 0 10px", fontStyle: "italic" }}>
          A PvE survival adventure in the Age of Piracy. Procedural open world, soulslite combat, naval warfare, base building. Fully playable solo offline or up to 8-player co-op. Self-hosted or dedicated servers.
        </p>
        <p style={{ fontSize: 14, color: PAL.parchment, lineHeight: 1.7, margin: 0, fontStyle: "italic" }}>
          The studio has cited Assassin&apos;s Creed IV: Black Flag as the best pirate game of all time — and it shows. Originally announced as a free-to-play MMO called <em>Crosswind</em>, Kraken Express pivoted to a paid survival adventure. The gamble paid off.
        </p>
      </div>

      {/* Why Weered — the ecosystem-gap positioning */}
      <div style={{
        ...S.card,
        padding: "22px 26px",
        borderColor: `${PAL.brass}80`,
        background: `
          radial-gradient(ellipse 70% 55% at 50% 0%, rgba(232,196,138,0.10) 0%, transparent 60%),
          linear-gradient(180deg, rgba(30,48,72,0.70) 0%, rgba(20,34,56,0.85) 100%)
        `,
      }}>
        <div style={{ ...S.label, marginBottom: 6 }}>Why Weered</div>
        <h3 style={{ fontFamily: WR_FONT_DISPLAY, fontSize: 22, color: PAL.brassHi, margin: "0 0 10px", letterSpacing: "0.5px" }}>
          The crew-social layer nobody else built.
        </h3>
        <p style={{ fontSize: 14, color: PAL.parchment, lineHeight: 1.7, margin: "0 0 10px", fontStyle: "italic" }}>
          Windrose&apos;s community shipped incredible infrastructure in the five days since launch: <strong style={{ color: PAL.brassHi, fontStyle: "normal" }}>WindrosePlus</strong> (RCON + Lua modding), the <strong style={{ color: PAL.brassHi, fontStyle: "normal" }}>Mod Manager</strong> (SFTP deploy to hosted servers), dozens of Nexus mods, <strong style={{ color: PAL.brassHi, fontStyle: "normal" }}>windrose.gaming.tools</strong> (seed-parsed world maps, character builder), and five+ commercial hosts with pre-installed mod stacks.
        </p>
        <p style={{ fontSize: 14, color: PAL.parchment, lineHeight: 1.7, margin: 0, fontStyle: "italic" }}>
          No one built the <em>crew-social</em> layer — where to hang out between sessions, find a crew, watch a stream together, talk to the dev team. That&apos;s what we do. We respect the stack the community already put down.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div style={{ ...S.card, padding: 18, textAlign: "center" }}>
          <div style={{ ...S.label, marginBottom: 6 }}>Publisher</div>
          <div style={{ fontFamily: WR_FONT_DISPLAY, fontSize: 22, color: PAL.brassHi }}>Pocketpair</div>
          <div style={{ fontSize: 11, color: PAL.parchDim, marginTop: 4, fontStyle: "italic" }}>Palworld studio</div>
        </div>
        <div style={{ ...S.card, padding: 18, textAlign: "center" }}>
          <div style={{ ...S.label, marginBottom: 6 }}>Platforms</div>
          <div style={{ fontFamily: WR_FONT_DISPLAY, fontSize: 20, color: PAL.brassHi }}>Steam · Epic · Stove</div>
          <div style={{ fontSize: 11, color: PAL.parchDim, marginTop: 4, fontStyle: "italic" }}>Console TBD</div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <a href="https://store.steampowered.com/app/3041230/Windrose/" target="_blank" rel="noopener noreferrer" style={{ ...S.btnPrimary, textDecoration: "none" }}>Steam Store</a>
        <a href="https://playwindrose.com/" target="_blank" rel="noopener noreferrer" style={{ ...S.btn, textDecoration: "none" }}>playwindrose.com</a>
      </div>

      <div style={{ fontSize: 10, color: PAL.parchDim, marginTop: 8, lineHeight: 1.5, opacity: 0.7 }}>
        Windrose and Kraken Express are trademarks of their respective owners. This is an unofficial community hub. Not affiliated with, endorsed by, or officially associated with Kraken Express or Pocketpair. If the studio wants anything changed or removed, email hello@weered.ca and we&apos;ll act same-day.
      </div>
    </div>
  );
}

// ═══ Main Panel ════════════════════════════════════════════════════════════════

export default function WindroseModulesPanel({
  lobbyId,
  gameName,
  accentColor: _accent,
  style,
}: {
  lobbyId: string;
  gameName: string;
  accentColor?: string;
  style?: React.CSSProperties;
}) {
  const [tab, setTab] = useState<TabId>(() => {
    // If we landed here from a "Watch Here" / home Join Room click that
    // already stashed a pending stream, open directly on Streams instead
    // of the flagship tab. The watchhere event itself fires *before* this
    // panel mounts (the lobby has to switch view → modules first), so the
    // event listener wouldn't catch it — the window stash is the bridge.
    try {
      if (typeof window !== "undefined") {
        const v = (window as any).__weeredPendingStream as { channel?: string; ts?: number } | undefined;
        const ageMs = v?.ts ? Date.now() - v.ts : -1;
        const isFresh = !!v?.channel && typeof v?.ts === "number" && ageMs >= 0 && ageMs < 5000;
        console.log("[live-handoff] WINDROSE panel mount, initial tab", { stashChannel: v?.channel, ageMs, isFresh, chosenTab: isFresh ? "streams" : "flagship" });
        if (isFresh) return "streams";
      }
    } catch {}
    return "flagship";
  });
  useWatchHere(React.useCallback((ch: string) => { console.log("[live-handoff] WINDROSE useWatchHere fired", { channel: ch }); setTab("streams"); }, []));

  return (
    <>
      {/* Google Fonts — pirate era */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Pirata+One&family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400;1,600&display=swap');
        @keyframes windrose-wave {
          0%,100% { transform: translateY(0) rotate(0); }
          50% { transform: translateY(-2px) rotate(0.3deg); }
        }
        @keyframes windrose-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .windrose-tab {
          padding: 10px 20px;
          border: 1px solid ${PAL.brass}30;
          border-bottom: none;
          background: ${PAL.stormDeep};
          color: ${PAL.parchDim};
          font-family: ${WR_FONT_SERIF};
          font-size: 12px;
          letter-spacing: 2px;
          text-transform: uppercase;
          cursor: pointer;
          transition: all .15s;
          margin-right: 2px;
          position: relative;
          top: 1px;
        }
        .windrose-tab:hover:not(.active) { color: ${PAL.brass}; border-color: ${PAL.brass}55; background: ${PAL.stormMid}; }
        .windrose-tab.active {
          color: ${PAL.brassHi};
          border-color: ${PAL.brass};
          background: linear-gradient(180deg, ${PAL.stormFoam}, ${PAL.stormMid});
          font-weight: 700;
        }
        .windrose-tab.active::after {
          content: ''; position: absolute; bottom: -1px; left: 0; right: 0;
          height: 2px; background: ${PAL.brass};
        }
      `}</style>

      <div style={{ ...S.shell, ...(style || {}), flex: "initial", minHeight: "auto", overflow: "visible" }}>
        {/* Plaque header */}
        <div style={S.plaque}>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ ...S.label, marginBottom: 2 }}>A Kraken Express Voyage</div>
              <img
                src="/brand/lobbies/windrose-wordmark-official.png"
                alt="Windrose"
                style={{ height: 54, width: "auto", maxWidth: 420, objectFit: "contain", filter: `drop-shadow(0 2px 8px ${PAL.brass}55)` }}
              />
              <div style={{ fontSize: 12, color: PAL.parchDim, fontStyle: "italic" }}>
                Build. Sail. Survive the storm. <span style={{ color: PAL.brass }}>·</span> Early Access &middot; 2026
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                <div style={{ ...S.label, fontSize: 9 }}>Community Hub</div>
                <div style={{ fontFamily: WR_FONT_MONO, fontSize: 10, color: PAL.parchDim, opacity: 0.7 }}>
                  unofficial
                </div>
              </div>
              <div style={{ animation: "windrose-spin 90s linear infinite", flexShrink: 0, opacity: 0.8 }}>
                <CompassRose size={48} />
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={S.tabBar}>
          {TABS.map(t => (
            <button
              key={t.id}
              className={`windrose-tab ${tab === t.id ? "active" : ""}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div style={S.body}>
          {tab === "flagship" && <FlagshipTab />}
          {tab === "log"      && <LogTab />}
          {tab === "crew"     && <CrewTab lobbyId={lobbyId} />}
          {tab === "bounties" && <BountiesTab />}
          {tab === "ports"    && <PortsOfCallTab />}
          {tab === "streams"  && <StreamsTab gameName={gameName} lobbyId={lobbyId} />}
          {tab === "about"    && <AboutTab />}
        </div>
      </div>
    </>
  );
}

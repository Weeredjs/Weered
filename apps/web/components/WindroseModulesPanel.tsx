"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import StreamInterceptModal, { type StreamInfo } from "./StreamInterceptModal";
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

      {/* Three-column: Inspiration / Systems / Platform */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
        <FeatureBlock icon="⚓" title="Soulslite Combat" body="Challenging bosses. Weighty swings. Parries that matter. Not a Souls clone — a Souls-lite. Takes inspiration from Black Flag." />
        <FeatureBlock icon="🌊" title="Naval & Exploration" body="Procedural open world. Build a galleon, captain a crew of eight, discover isles, and weather real-time storms." />
        <FeatureBlock icon="🏴‍☠️" title="PvE, Solo or Co-op" body="Fully playable offline. Self-hosted or dedicated servers. 8-player co-op. No forced PvP." />
      </div>
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

  useEffect(() => {
    setLoading(true);
    apiFetch("/windrose/news").then(j => {
      if (j?.ok && Array.isArray(j.news)) setItems(j.news);
      else setItems([]);
      setLoading(false);
    });
  }, []);

  if (loading) return <LoadingState label="Loading Captain's Log..." />;
  if (!items || items.length === 0) {
    return <EmptyState icon="📜" title="The log is empty" hint="No dispatches from Kraken Express yet. Check back after the storm passes." />;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {items.map((n, i) => (
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
      ))}
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

function CrewTab({ lobbyId }: { lobbyId: string }) {
  const [posts, setPosts] = useState<LfgPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState("");
  const [mode, setMode] = useState(WR_MODES[0]);
  const [region, setRegion] = useState(WR_REGIONS[0]);
  const [slots, setSlots] = useState(1);
  const [tags, setTags] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    const j = await apiFetch(`/lfg/${encodeURIComponent(lobbyId)}`);
    if (j?.ok && Array.isArray(j.posts)) setPosts(j.posts);
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

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ═══ Tab: Twitch Streams ═══════════════════════════════════════════════════════

function StreamsTab({ gameName, lobbyId }: { gameName: string; lobbyId: string }) {
  const [streams, setStreams] = useState<StreamInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [intercept, setIntercept] = useState<StreamInfo | null>(null);

  useEffect(() => {
    const game = encodeURIComponent(gameName || "Windrose");
    apiFetch(`/twitch/streams?game=${game}&first=20`).then(j => {
      if (j?.ok && Array.isArray(j.streams)) setStreams(j.streams);
      setLoading(false);
    });
  }, [gameName]);

  if (loading) return <LoadingState label="Tuning the spyglass..." />;
  if (streams.length === 0) return <EmptyState icon="📡" title="No one's live" hint="When a captain goes live on Twitch, they'll show up here." />;

  return (
    <>
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
      {intercept && <StreamInterceptModal stream={intercept} lobbyId={lobbyId} onClose={() => setIntercept(null)} onWatchHere={() => setIntercept(null)} />}
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
  const [tab, setTab] = useState<TabId>("flagship");

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
          {tab === "streams"  && <StreamsTab gameName={gameName} lobbyId={lobbyId} />}
          {tab === "about"    && <AboutTab />}
        </div>
      </div>
    </>
  );
}

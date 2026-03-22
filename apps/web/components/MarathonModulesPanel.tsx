"use client";

import React, { useCallback, useEffect, useState } from "react";
import StreamInterceptModal, { type StreamInfo } from "./StreamInterceptModal";

// ── Twitch Glitch icon ──────────────────────────────────────────────────────

function TwitchIcon({ size = 13, color = "#9146FF", style }: { size?: number; color?: string; style?: React.CSSProperties }) {
  return (
    <svg width={size} height={size} viewBox="0 0 256 268" style={{ display: "inline-block", verticalAlign: "middle", flexShrink: 0, ...style }}>
      <path d="M17.458 0L0 46.556v185.81h63.983v34.934h34.932l34.898-34.934h52.36L256 162.954V0H17.458zm23.259 23.263H232.73v128.029l-40.739 40.736H128L93.113 226.93v-34.902H40.717V23.263zm64.008 116.405H128V69.844h-23.275v69.824zm63.997 0h23.275V69.844h-23.275v69.824z" fill={color} />
    </svg>
  );
}

const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";

function authHeaders() {
  try { const t = localStorage.getItem("weered_token") || ""; return t ? { Authorization: "Bearer " + t } : {}; } catch { return {}; }
}

async function apiFetch(path: string, opts?: RequestInit) {
  const r = await fetch(API + path, { ...opts, headers: { "Content-Type": "application/json", ...authHeaders(), ...(opts?.headers || {}) } });
  return r.json();
}

// ── Marathon Design Tokens (derived from lobby accent) ───────────────────────

const DEFAULT_ACCENT = "#C2FE0B";

function makeTheme(accent: string) {
  return {
    accent,
    accentDim:  `${accent}18`,
    accentMid:  `${accent}55`,
    danger:     "#FF4444",
    warning:    "#FFB020",
    ranked:     "#E8C547",
    bg:         "rgba(8,12,16,0.95)",
    card:       "rgba(255,255,255,0.03)",
    border:     "rgba(255,255,255,0.06)",
    textPri:    "rgba(226,232,240,0.92)",
    textSec:    "rgba(148,163,184,0.65)",
    textDim:    "rgba(100,116,139,0.45)",
  };
}

// Static default for module-level styles that can't be dynamic
const M = makeTheme(DEFAULT_ACCENT);

const S = {
  card: { borderRadius: 8, border: `1px solid ${M.border}`, background: M.card, padding: "10px 12px" } as React.CSSProperties,
  label: { fontSize: 9, fontWeight: 800, opacity: 0.35, letterSpacing: "1.2px", textTransform: "uppercase" as const, marginBottom: 6, fontFamily: "monospace" } as React.CSSProperties,
  btn: { padding: "6px 12px", borderRadius: 6, border: `1px solid ${M.border}`, background: "rgba(255,255,255,0.04)", fontSize: 11, cursor: "pointer", color: M.textPri, fontFamily: "monospace" } as React.CSSProperties,
  btnAccent: { padding: "6px 14px", borderRadius: 6, border: `1px solid ${M.accentMid}`, background: M.accentDim, fontSize: 11, cursor: "pointer", color: M.accent, fontWeight: 700, fontFamily: "monospace" } as React.CSSProperties,
  input: { width: "100%", padding: "8px 12px", borderRadius: 6, border: `1px solid ${M.border}`, background: "rgba(0,0,0,.40)", fontSize: 12, color: M.textPri, outline: "none", boxSizing: "border-box" as const, fontFamily: "monospace" },
};

// ── Scan Line Effect ────────────────────────────────────────────────────────

function ScanLines() {
  return (
    <div style={{
      position: "absolute", inset: 0, pointerEvents: "none", zIndex: 1, opacity: 0.03,
      background: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,229,204,0.15) 2px, rgba(0,229,204,0.15) 4px)",
    }} />
  );
}

// ── Twitch Streams (reused, works now) ──────────────────────────────────────

function TwitchStreams({ lobbyId, accentColor }: { lobbyId?: string; accentColor?: string }) {
  const [streams, setStreams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeStream, setActiveStream] = useState<string | null>(null);
  const [interceptStream, setInterceptStream] = useState<StreamInfo | null>(null);

  useEffect(() => {
    apiFetch(`/twitch/streams?game=${encodeURIComponent("Marathon")}`)
      .then(j => { setStreams(j.streams || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <LoadingPulse text="SCANNING TWITCH FEEDS" />;

  function handleCardClick(s: any) {
    setInterceptStream({
      userLogin: s.userLogin || s.user_login || "",
      userName: s.userName || s.user_name || "",
      title: s.title || "",
      viewerCount: Number(s.viewerCount || s.viewer_count || 0),
      thumbnailUrl: s.thumbnailUrl || s.thumbnail_url || "",
      gameName: "Marathon",
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {activeStream && (
        <div style={{ borderRadius: 8, overflow: "hidden", border: `1px solid ${M.accentMid}`, background: "#000", marginBottom: 4 }}>
          <iframe
            src={`https://player.twitch.tv/?channel=${activeStream}&parent=${typeof window !== "undefined" ? window.location.hostname : "weered.ca"}&muted=true`}
            width="100%" height="280" style={{ border: "none", display: "block" }} allowFullScreen
          />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", background: M.accentDim }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: M.accent, fontFamily: "monospace" }}>{activeStream}</span>
            <button onClick={() => setActiveStream(null)} style={S.btn}>CLOSE</button>
          </div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 8 }}>
        {streams.map(s => (
          <div key={s.id} onClick={() => handleCardClick(s)} style={{
            ...S.card, cursor: "pointer", transition: "border-color .15s, background .15s",
            border: activeStream === s.userLogin ? `1px solid ${M.accentMid}` : `1px solid ${M.border}`,
          }}>
            {s.thumbnailUrl && <img src={s.thumbnailUrl} alt="" style={{ width: "100%", borderRadius: 4, marginBottom: 6, aspectRatio: "16/9", objectFit: "cover" }} />}
            <div style={{ fontWeight: 700, fontSize: 11, marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: "monospace" }}>{s.userName}</div>
            <div style={{ fontSize: 10, opacity: 0.4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 4 }}>{s.title}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: M.danger, flexShrink: 0, boxShadow: `0 0 6px ${M.danger}` }} />
              <span style={{ fontSize: 10, color: "rgba(255,100,100,.8)", fontWeight: 700, fontFamily: "monospace" }}>{s.viewerCount?.toLocaleString()}</span>
            </div>
          </div>
        ))}
      </div>

      {streams.length === 0 && (
        <div style={{ textAlign: "center", padding: 30, opacity: 0.3, fontSize: 12, fontFamily: "monospace" }}>NO LIVE MARATHON FEEDS DETECTED</div>
      )}

      <StreamInterceptModal stream={interceptStream} lobbyId={lobbyId} accentColor={accentColor} onClose={() => setInterceptStream(null)} onWatchHere={(s) => setActiveStream(s.userLogin)} />
    </div>
  );
}

// ── Squad Finder (Marathon LFG — 3-player crews) ────────────────────────────

const MARATHON_ZONES = ["Perimeter", "Dire Marsh", "Outpost", "Cryo Archive", "Any Zone"];
const MARATHON_MODES = ["Extraction Run", "Ranked Queue", "Casual Run", "Contract Grind", "Zone Exploration", "Other"];
const MARATHON_SHELLS = ["Any Shell", "Assassin", "Vandal", "Destroyer", "Recon", "Thief", "Triage", "Rook"];

function SquadFinder({ lobbyId }: { lobbyId: string }) {
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [activity, setActivity] = useState(MARATHON_MODES[0]);
  const [zone, setZone] = useState(MARATHON_ZONES[0]);
  const [desc, setDesc] = useState("");
  const [shell, setShell] = useState(MARATHON_SHELLS[0]);
  const [msg, setMsg] = useState("");

  const load = useCallback(() => {
    apiFetch(`/lfg/${encodeURIComponent(lobbyId)}`)
      .then(j => { setPosts(j.posts || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [lobbyId]);

  useEffect(() => { load(); const i = setInterval(load, 12000); return () => clearInterval(i); }, [load]);

  async function create() {
    const fullActivity = `${activity} — ${zone}${shell !== "Any Shell" ? ` (${shell})` : ""}`;
    const j = await apiFetch(`/lfg/${encodeURIComponent(lobbyId)}`, {
      method: "POST",
      body: JSON.stringify({ activity: fullActivity, description: desc, maxPlayers: 3, platform: "crossplay" }),
    });
    if (j.ok) { setShowForm(false); setDesc(""); load(); }
    else setMsg(j.message || j.error || "Failed");
  }

  async function joinPost(postId: string) {
    const j = await apiFetch(`/lfg/${postId}/join`, { method: "POST", body: JSON.stringify({}) });
    if (j.ok) load(); else setMsg(j.message || j.error || "Failed");
  }

  async function leavePost(postId: string) {
    const j = await apiFetch(`/lfg/${postId}/leave`, { method: "POST", body: JSON.stringify({}) });
    if (j.ok) load(); else setMsg(j.message || j.error || "Failed");
  }

  if (loading) return <LoadingPulse text="SCANNING SQUAD BEACONS" />;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ fontSize: 11, opacity: 0.5, fontFamily: "monospace" }}>{posts.length} ACTIVE SQUADS</div>
        <button style={S.btnAccent} onClick={() => setShowForm(!showForm)}>{showForm ? "CANCEL" : "+ DEPLOY BEACON"}</button>
      </div>
      {msg && <div style={{ marginBottom: 8, fontSize: 11, color: M.warning, fontFamily: "monospace" }}>{msg}</div>}

      {showForm && (
        <div style={{ ...S.card, marginBottom: 14, border: `1px solid ${M.accentMid}`, background: M.accentDim, position: "relative", overflow: "hidden" }}>
          <ScanLines />
          <div style={{ position: "relative", zIndex: 2 }}>
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <div style={{ flex: 1 }}>
                <div style={S.label}>MODE</div>
                <select value={activity} onChange={e => setActivity(e.target.value)} style={{ ...S.input, cursor: "pointer" }}>
                  {MARATHON_MODES.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <div style={S.label}>ZONE</div>
                <select value={zone} onChange={e => setZone(e.target.value)} style={{ ...S.input, cursor: "pointer" }}>
                  {MARATHON_ZONES.map(z => <option key={z} value={z}>{z}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <div style={{ flex: 1 }}>
                <div style={S.label}>PREFERRED SHELL</div>
                <select value={shell} onChange={e => setShell(e.target.value)} style={{ ...S.input, cursor: "pointer" }}>
                  {MARATHON_SHELLS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <div style={S.label}>NOTE</div>
                <input style={S.input} value={desc} onChange={e => setDesc(e.target.value)} placeholder="Mic required, chill run..." />
              </div>
            </div>
            <button style={{ ...S.btnAccent, width: "100%", padding: "10px 0", fontSize: 12, letterSpacing: "1px" }} onClick={create}>DEPLOY SQUAD BEACON</button>
          </div>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {posts.map(p => {
          const isFull = p.status === "FULL" || (p.players || []).length >= (p.maxPlayers || 3);
          const slots = (p.players || []).length;
          const max = p.maxPlayers || 3;
          return (
            <div key={p.id} style={{
              ...S.card, display: "flex", alignItems: "center", gap: 12, position: "relative", overflow: "hidden",
              border: isFull ? `1px solid rgba(255,176,32,.15)` : `1px solid ${M.border}`,
              opacity: isFull ? 0.6 : 1,
            }}>
              {/* Slot indicators */}
              <div style={{ display: "flex", flexDirection: "column", gap: 3, flexShrink: 0 }}>
                {Array.from({ length: max }).map((_, i) => (
                  <div key={i} style={{
                    width: 8, height: 8, borderRadius: 2,
                    background: i < slots ? M.accent : "rgba(255,255,255,0.08)",
                    boxShadow: i < slots ? `0 0 4px ${M.accent}` : "none",
                    transition: "all .2s",
                  }} />
                ))}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 2, fontFamily: "monospace", display: "flex", alignItems: "center", gap: 8 }}>
                  {p.activity}
                  {isFull && <span style={{ fontSize: 8, padding: "1px 5px", borderRadius: 3, background: "rgba(255,176,32,.12)", border: "1px solid rgba(255,176,32,.25)", color: M.warning, fontWeight: 800, letterSpacing: "0.5px" }}>FULL</span>}
                </div>
                {p.description && <div style={{ fontSize: 10, opacity: 0.4, marginBottom: 3 }}>{p.description}</div>}
                <div style={{ display: "flex", gap: 6, fontSize: 10, opacity: 0.35, fontFamily: "monospace" }}>
                  <span>{slots}/{max} RUNNERS</span>
                  <span>by {p.userName}</span>
                </div>
                {(p.playerNames || []).length > 0 && (
                  <div style={{ display: "flex", gap: 3, marginTop: 5, flexWrap: "wrap" }}>
                    {p.playerNames.map((n: string, i: number) => (
                      <span key={i} style={{ fontSize: 9, padding: "1px 6px", borderRadius: 3, background: M.accentDim, border: `1px solid ${M.accentMid}`, color: M.accent, fontFamily: "monospace" }}>{n}</span>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, flexShrink: 0 }}>
                {!isFull && <button style={S.btnAccent} onClick={() => joinPost(p.id)}>JOIN</button>}
                <button style={S.btn} onClick={() => leavePost(p.id)}>LEAVE</button>
              </div>
            </div>
          );
        })}
        {posts.length === 0 && (
          <div style={{ textAlign: "center", padding: 30, opacity: 0.25, fontSize: 12, fontFamily: "monospace" }}>
            NO ACTIVE SQUADS — DEPLOY THE FIRST BEACON
          </div>
        )}
      </div>
    </div>
  );
}

// ── Zone Intel ──────────────────────────────────────────────────────────────

const ZONES = [
  {
    name: "Perimeter",
    threat: 1,
    desc: "Entry-level zone. Scattered outposts and abandoned research facilities on the colony edge. Lower UESC presence, ideal for new Runners gearing up.",
    loot: "Common to Rare",
    enemies: "Light UESC patrols, Scavengers",
    tips: "Good for learning extraction routes. Watch the ridgelines — snipers love the high ground.",
  },
  {
    name: "Dire Marsh",
    threat: 2,
    desc: "Toxic wetlands surrounding the colony core. Dynamic weather shifts visibility and enemy behavior. Night variant coming Season 2.",
    loot: "Rare to Legendary",
    enemies: "UESC squads, hostile fauna, environmental hazards",
    tips: "Storm events drastically change the run. High-value caches spawn in the flooded tunnels.",
  },
  {
    name: "Outpost",
    threat: 3,
    desc: "Fortified UESC installation. Heavy security presence and chokepoint-heavy layout. High-stakes PvP zone.",
    loot: "Rare to Legendary",
    enemies: "Armored UESC units, turret systems, rival crews",
    tips: "Control the extraction points. Proximity chat alliances can flip fights here.",
  },
  {
    name: "Cryo Archive",
    threat: 4,
    desc: "The UESC Marathon in low orbit. End-game zone with sequential vaults, raid-like puzzles, and the deadliest enemies in the game. Where legends are made.",
    loot: "Legendary to Exotic",
    enemies: "Elite UESC, unknown entities, fully-geared rival crews",
    tips: "Bring your best gear — you will lose it if you die. The 7th vault holds secrets about what happened to the colony.",
  },
];

function ZoneIntel() {
  const [selected, setSelected] = useState(0);
  const zone = ZONES[selected];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {/* Zone selector */}
      <div style={{ display: "flex", gap: 4 }}>
        {ZONES.map((z, i) => (
          <button key={z.name} onClick={() => setSelected(i)} style={{
            flex: 1, padding: "8px 6px", border: "none", cursor: "pointer", borderRadius: 6,
            background: selected === i ? M.accentDim : "transparent",
            borderBottom: selected === i ? `2px solid ${M.accent}` : "2px solid transparent",
            color: selected === i ? M.accent : M.textSec,
            fontWeight: selected === i ? 800 : 400, fontSize: 11, fontFamily: "monospace",
            transition: "all .12s", letterSpacing: "0.5px",
          }}>
            {z.name.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Zone detail */}
      <div style={{ ...S.card, position: "relative", overflow: "hidden" }}>
        <ScanLines />
        <div style={{ position: "relative", zIndex: 2 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <div style={{ fontWeight: 900, fontSize: 18, fontFamily: "monospace", color: M.textPri, letterSpacing: "1px" }}>
              {zone.name.toUpperCase()}
            </div>
            <div style={{ display: "flex", gap: 3 }}>
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} style={{
                  width: 10, height: 10, borderRadius: 2,
                  background: i < zone.threat ? (zone.threat >= 4 ? M.danger : zone.threat >= 3 ? M.warning : M.accent) : "rgba(255,255,255,0.06)",
                  boxShadow: i < zone.threat ? `0 0 4px ${zone.threat >= 4 ? M.danger : zone.threat >= 3 ? M.warning : M.accent}` : "none",
                }} />
              ))}
              <span style={{ fontSize: 9, opacity: 0.4, fontFamily: "monospace", marginLeft: 4 }}>THREAT</span>
            </div>
          </div>

          <div style={{ fontSize: 12, lineHeight: 1.6, opacity: 0.7, marginBottom: 14 }}>{zone.desc}</div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div style={{ padding: "8px 10px", borderRadius: 6, background: "rgba(255,255,255,0.02)", border: `1px solid ${M.border}` }}>
              <div style={S.label}>LOOT TIER</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: zone.threat >= 4 ? M.ranked : zone.threat >= 3 ? M.warning : M.accent, fontFamily: "monospace" }}>{zone.loot}</div>
            </div>
            <div style={{ padding: "8px 10px", borderRadius: 6, background: "rgba(255,255,255,0.02)", border: `1px solid ${M.border}` }}>
              <div style={S.label}>HOSTILES</div>
              <div style={{ fontSize: 11, opacity: 0.7 }}>{zone.enemies}</div>
            </div>
          </div>

          <div style={{ marginTop: 10, padding: "8px 10px", borderRadius: 6, background: M.accentDim, border: `1px solid ${M.accentMid}` }}>
            <div style={{ ...S.label, color: M.accent, opacity: 0.7 }}>INTEL</div>
            <div style={{ fontSize: 11, opacity: 0.65, lineHeight: 1.5 }}>{zone.tips}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Runner Database ─────────────────────────────────────────────────────────

const RUNNERS = [
  { name: "Assassin", role: "Flanker", desc: "Silent and deadly. Built for aggressive flanking and catching enemies off-guard.", color: "#FF4466", icon: "🗡" },
  { name: "Vandal", role: "Flanker", desc: "Disruptive chaos agent. Excels at breaking enemy formations and creating openings.", color: "#FF6644", icon: "💥" },
  { name: "Destroyer", role: "Frontline", desc: "The wall. Anchors the team with heavy firepower and damage absorption.", color: "#4488FF", icon: "🛡" },
  { name: "Recon", role: "Intel", desc: "Eyes of the team. Long-range intel gathering and precision strikes from distance.", color: "#44DDFF", icon: "🔭" },
  { name: "Thief", role: "Stealth", desc: "In and out. Covert loot specialist who rewards clean, efficient extraction runs.", color: "#AA66FF", icon: "👻" },
  { name: "Triage", role: "Support", desc: "The lifeline. Keeps the crew alive through healing and tactical support.", color: "#44FF88", icon: "💉" },
  { name: "Rook", role: "Wildcard", desc: "The opportunist. Scavenger mode with adaptive playstyle — thrives in chaos.", color: "#FFB020", icon: "🎲" },
];

function RunnerDatabase() {
  const [selected, setSelected] = useState<number | null>(null);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ ...S.label, marginBottom: 2 }}>7 RUNNER SHELLS — TAU CETI IV DEPLOYMENT ROSTER</div>

      {RUNNERS.map((r, i) => (
        <div key={r.name} onClick={() => setSelected(selected === i ? null : i)} style={{
          ...S.card, cursor: "pointer", transition: "all .15s",
          border: selected === i ? `1px solid ${r.color}55` : `1px solid ${M.border}`,
          background: selected === i ? `${r.color}08` : M.card,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center",
              background: `${r.color}18`, border: `1px solid ${r.color}35`, fontSize: 18, flexShrink: 0,
            }}>{r.icon}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontWeight: 800, fontSize: 13, fontFamily: "monospace", color: r.color }}>{r.name.toUpperCase()}</span>
                <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 3, border: `1px solid ${r.color}30`, color: `${r.color}aa`, fontFamily: "monospace", fontWeight: 700 }}>{r.role}</span>
              </div>
              {selected === i && (
                <div style={{ fontSize: 11, opacity: 0.6, marginTop: 4, lineHeight: 1.5 }}>{r.desc}</div>
              )}
            </div>
            <span style={{ fontSize: 10, opacity: 0.2, transform: selected === i ? "rotate(90deg)" : "none", transition: "transform .15s" }}>▶</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── My Runner (API placeholder) ─────────────────────────────────────────────

function MyRunner({ accentColor }: { accentColor?: string }) {
  const accent = accentColor || M.accent;

  // TODO: When Bungie opens Marathon API, this will:
  // - Show linked Bungie account's Marathon stats
  // - K/D ratio, extraction rate, total loot value
  // - Match history with zone, loadout, outcome
  // - Runner shell usage stats
  // - Ranked tier and progression
  // - Current loadout (weapons, mods, implants, cores)

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 20px", gap: 20, height: "100%" }}>
      <div style={{ position: "relative" }}>
        <div style={{
          width: 80, height: 80, borderRadius: 12,
          background: `linear-gradient(135deg, ${accent}15, ${accent}05)`,
          border: `1px solid ${accent}30`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 36,
        }}>🏃</div>
        {/* Pulsing ring */}
        <div style={{
          position: "absolute", inset: -4, borderRadius: 16,
          border: `1px solid ${accent}20`,
          animation: "marathon-pulse 3s ease-in-out infinite",
        }} />
      </div>

      <div style={{ textAlign: "center" }}>
        <div style={{ fontWeight: 900, fontSize: 18, fontFamily: "monospace", letterSpacing: "2px", color: M.textPri }}>MY RUNNER</div>
        <div style={{ fontSize: 11, opacity: 0.4, fontFamily: "monospace", marginTop: 4, letterSpacing: "1px" }}>AWAITING API ACCESS</div>
      </div>

      <div style={{
        maxWidth: 380, textAlign: "center", fontSize: 12, lineHeight: 1.7, opacity: 0.5,
      }}>
        Bungie has not yet released a public Marathon API. When they do, this tab will show your Runner stats, match history, loadout, ranked progression, and extraction data — all pulled live from your linked Bungie account.
      </div>

      {/* Preview of what's coming */}
      <div style={{ width: "100%", maxWidth: 420, display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
        <div style={S.label}>COMING WHEN API LAUNCHES</div>
        {[
          { icon: "📊", label: "K/D, extraction rate, loot value stats" },
          { icon: "🏆", label: "Ranked tier and season progression" },
          { icon: "🔫", label: "Current loadout — weapons, mods, cores" },
          { icon: "📜", label: "Match history with zone breakdowns" },
          { icon: "🏃", label: "Runner shell usage and performance" },
          { icon: "👥", label: "Crew stats and synergy analysis" },
        ].map((item, i) => (
          <div key={i} style={{
            display: "flex", alignItems: "center", gap: 10, padding: "6px 10px",
            borderRadius: 6, background: "rgba(255,255,255,0.015)", border: `1px solid ${M.border}`,
            opacity: 0.5,
          }}>
            <span style={{ fontSize: 14 }}>{item.icon}</span>
            <span style={{ fontSize: 11, fontFamily: "monospace" }}>{item.label}</span>
          </div>
        ))}
      </div>

      <style>{`@keyframes marathon-pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.3;transform:scale(1.08)}}`}</style>
    </div>
  );
}

// ── Leaderboards (API placeholder) ──────────────────────────────────────────

const RANK_TIERS = [
  { name: "Master", color: "#E8C547", icon: "👑" },
  { name: "Pinnacle", color: "#FF4466", icon: "💎" },
  { name: "Diamond", color: "#44DDFF", icon: "💠" },
  { name: "Platinum", color: "#00E5CC", icon: "⚡" },
  { name: "Gold", color: "#FFB020", icon: "🥇" },
  { name: "Silver", color: "#C0C0C0", icon: "🥈" },
  { name: "Bronze", color: "#CD7F32", icon: "🥉" },
];

function Leaderboards() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Ranked tiers preview */}
      <div>
        <div style={S.label}>RANKED TIERS</div>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {RANK_TIERS.map(t => (
            <div key={t.name} style={{
              display: "flex", alignItems: "center", gap: 5, padding: "5px 10px",
              borderRadius: 6, border: `1px solid ${t.color}25`, background: `${t.color}08`,
            }}>
              <span style={{ fontSize: 12 }}>{t.icon}</span>
              <span style={{ fontSize: 10, fontWeight: 800, color: t.color, fontFamily: "monospace", letterSpacing: "0.5px" }}>{t.name.toUpperCase()}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Placeholder leaderboard */}
      <div style={{ ...S.card, position: "relative", overflow: "hidden" }}>
        <ScanLines />
        <div style={{ position: "relative", zIndex: 2 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div style={{ fontWeight: 900, fontSize: 14, fontFamily: "monospace", letterSpacing: "1px" }}>EXTRACTION LEADERS</div>
            <span style={{ fontSize: 9, opacity: 0.3, fontFamily: "monospace" }}>AWAITING API</span>
          </div>

          {/* Fake leaderboard rows to show what it'll look like */}
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: 10, padding: "8px 10px",
              borderRadius: 6, background: i === 0 ? "rgba(232,197,71,0.04)" : "transparent",
              border: `1px solid ${i === 0 ? "rgba(232,197,71,0.12)" : M.border}`,
              marginBottom: 4, opacity: 0.3,
            }}>
              <span style={{ fontWeight: 900, fontSize: 14, fontFamily: "monospace", width: 24, color: i === 0 ? M.ranked : M.textSec }}>{i + 1}</span>
              <div style={{ width: 28, height: 28, borderRadius: 6, background: "rgba(255,255,255,0.04)", border: `1px solid ${M.border}` }} />
              <div style={{ flex: 1 }}>
                <div style={{ width: `${60 + Math.random() * 40}%`, height: 10, borderRadius: 3, background: "rgba(255,255,255,0.06)" }} />
                <div style={{ width: `${30 + Math.random() * 30}%`, height: 7, borderRadius: 3, background: "rgba(255,255,255,0.03)", marginTop: 3 }} />
              </div>
              <div style={{ width: 50, height: 12, borderRadius: 3, background: "rgba(255,255,255,0.04)" }} />
            </div>
          ))}

          <div style={{ textAlign: "center", padding: "12px 0 4px", fontSize: 10, opacity: 0.25, fontFamily: "monospace", letterSpacing: "1px" }}>
            LEADERBOARD DATA REQUIRES BUNGIE MARATHON API ACCESS
          </div>
        </div>
      </div>

      {/* Season info */}
      <div style={{ ...S.card, textAlign: "center" }}>
        <div style={{ fontWeight: 900, fontSize: 12, fontFamily: "monospace", letterSpacing: "1px", color: M.accent, marginBottom: 4 }}>SEASON 1 — DEATH IS THE FIRST STEP</div>
        <div style={{ fontSize: 11, opacity: 0.5 }}>March 2026 — June 2026</div>
        <div style={{ fontSize: 10, opacity: 0.3, marginTop: 4 }}>Progress resets each season. Cosmetics and Codex carry over.</div>
      </div>
    </div>
  );
}

// ── Loading Pulse ───────────────────────────────────────────────────────────

function LoadingPulse({ text }: { text: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 40, gap: 12 }}>
      <div style={{
        width: 24, height: 24, borderRadius: 4,
        border: `2px solid ${M.accent}`,
        borderTopColor: "transparent",
        animation: "marathon-spin 0.8s linear infinite",
      }} />
      <div style={{ fontSize: 10, fontFamily: "monospace", letterSpacing: "2px", opacity: 0.4, color: M.accent }}>{text}</div>
      <style>{`@keyframes marathon-spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

// ── Main Panel ──────────────────────────────────────────────────────────────

const TABS = [
  { id: "streams",     label: "FEEDS",         icon: "__twitch__" },
  { id: "squads",      label: "SQUADS",        icon: "📡" },
  { id: "zones",       label: "ZONE INTEL",    icon: "🗺" },
  { id: "runners",     label: "RUNNERS",       icon: "🏃" },
  { id: "myrunner",    label: "MY RUNNER",     icon: "⚔" },
  { id: "leaderboards",label: "RANKED",        icon: "🏆" },
] as const;

type TabId = typeof TABS[number]["id"];

export default function MarathonModulesPanel({
  lobbyId,
  accentColor,
  style,
}: {
  lobbyId: string;
  accentColor?: string;
  style?: React.CSSProperties;
}) {
  const accent = accentColor || DEFAULT_ACCENT;
  const T = makeTheme(accent);
  const [tab, setTab] = useState<TabId>("streams");

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0, position: "relative", ...style }}>
      {/* Tabs */}
      <div style={{
        display: "flex", gap: 1, padding: "6px 10px 0",
        borderBottom: `1px solid ${T.border}`,
        background: `${accent}06`,
        flexShrink: 0, overflowX: "auto",
      }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: "6px 10px",
              borderRadius: "6px 6px 0 0",
              border: "none",
              background: tab === t.id ? T.accentDim : "transparent",
              color: tab === t.id ? accent : M.textSec,
              fontWeight: tab === t.id ? 800 : 400,
              fontSize: 10,
              cursor: "pointer",
              transition: "all .1s",
              display: "flex", alignItems: "center", gap: 4,
              whiteSpace: "nowrap", flexShrink: 0,
              fontFamily: "monospace",
              letterSpacing: "0.5px",
              borderBottom: tab === t.id ? `2px solid ${accent}` : "2px solid transparent",
            }}
          >
            {t.icon === "__twitch__" ? (
              <TwitchIcon size={11} color={tab === t.id ? "#9146FF" : "rgba(148,163,184,.4)"} />
            ) : (
              <span style={{ fontSize: 11 }}>{t.icon}</span>
            )}
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{
        flex: 1, minHeight: 0,
        overflowY: tab === "myrunner" ? "hidden" : "auto",
        padding: tab === "myrunner" ? 0 : "12px 12px 12px",
        display: "flex", flexDirection: "column",
      }}>
        {tab === "streams"      && <TwitchStreams lobbyId={lobbyId} accentColor={accent} />}
        {tab === "squads"       && <SquadFinder lobbyId={lobbyId} />}
        {tab === "zones"        && <ZoneIntel />}
        {tab === "runners"      && <RunnerDatabase />}
        {tab === "myrunner"     && <MyRunner accentColor={accent} />}
        {tab === "leaderboards" && <Leaderboards />}
      </div>
    </div>
  );
}

"use client";

import React, { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import StreamInterceptModal, { type StreamInfo } from "./StreamInterceptModal";
import { useWatchHere, consumePendingStream } from "../lib/useWatchHere";
import ModuleTabBar from "./ModuleTabBar";
import { onActivate } from "@/lib/a11y";

function TwitchIcon({ size = 13, color = "#9146FF", style }: { size?: number; color?: string; style?: React.CSSProperties }) {
  return (
    <svg width={size} height={size} viewBox="0 0 256 268" style={{ display: "inline-block", verticalAlign: "middle", flexShrink: 0, ...style }}>
      <path d="M17.458 0L0 46.556v185.81h63.983v34.934h34.932l34.898-34.934h52.36L256 162.954V0H17.458zm23.259 23.263H232.73v128.029l-40.739 40.736H128L93.113 226.93v-34.902H40.717V23.263zm64.008 116.405H128V69.844h-23.275v69.824zm63.997 0h23.275V69.844h-23.275v69.824z" fill={color} />
    </svg>
  );
}

const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";

function authHeaders(): Record<string, string> {
  try { const t = localStorage.getItem("weered_token") || ""; return t ? { Authorization: "Bearer " + t } : {}; } catch { return {}; }
}

async function apiFetch(path: string, opts?: RequestInit) {
  const r = await fetch(API + path, { ...opts, headers: { "Content-Type": "application/json", ...authHeaders(), ...(opts?.headers || {}) } });
  return r.json();
}

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

const M = makeTheme(DEFAULT_ACCENT);

const S = {
  card: { borderRadius: 2, border: `1px solid ${M.border}`, background: M.card, padding: "10px 12px" } as React.CSSProperties,
  label: { fontSize: 9, fontWeight: 800, opacity: 0.35, letterSpacing: "1.2px", textTransform: "uppercase" as const, marginBottom: 6, fontFamily: "monospace" } as React.CSSProperties,
  btn: { padding: "6px 12px", borderRadius: 2, border: `1px solid ${M.border}`, background: "rgba(255,255,255,0.04)", fontSize: 11, cursor: "pointer", color: M.textPri, fontFamily: "monospace" } as React.CSSProperties,
  btnAccent: { padding: "6px 14px", borderRadius: 2, border: `1px solid ${M.accentMid}`, background: M.accentDim, fontSize: 11, cursor: "pointer", color: M.accent, fontWeight: 700, fontFamily: "monospace" } as React.CSSProperties,
  input: { width: "100%", padding: "8px 12px", borderRadius: 2, border: `1px solid ${M.border}`, background: "rgba(0,0,0,.40)", fontSize: 12, color: M.textPri, outline: "none", boxSizing: "border-box" as const, fontFamily: "monospace" },
};

function ScanLines() {
  return (
    <div style={{
      position: "absolute", inset: 0, pointerEvents: "none", zIndex: 1, opacity: 0.03,
      background: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,229,204,0.15) 2px, rgba(0,229,204,0.15) 4px)",
    }} />
  );
}

function TwitchStreams({ lobbyId, accentColor }: { lobbyId?: string; accentColor?: string }) {
  const [streams, setStreams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeStream, setActiveStream] = useState<string | null>(null);
  const [interceptStream, setInterceptStream] = useState<StreamInfo | null>(null);

  useEffect(() => {
    const ch = consumePendingStream();
    if (ch) setActiveStream(ch);
  }, []);

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
        <div style={{ borderRadius: 2, overflow: "hidden", border: `1px solid ${M.accentMid}`, background: "#000", marginBottom: 4 }}>
          <iframe title="Marathon stream"
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
          <div key={s.id} onClick={() => handleCardClick(s)} onKeyDown={onActivate(() => handleCardClick(s))} tabIndex={0} role="button" style={{
            ...S.card, cursor: "pointer", transition: "border-color .15s, background .15s",
            border: activeStream === s.userLogin ? `1px solid ${M.accentMid}` : `1px solid ${M.border}`,
          }}>
            {s.thumbnailUrl && <img src={s.thumbnailUrl} alt={s.userName + " stream thumbnail"} style={{ width: "100%", borderRadius: 2, marginBottom: 6, aspectRatio: "16/9", objectFit: "cover" }} />}
            <div style={{ fontWeight: 700, fontSize: 11, marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: "monospace" }}>{s.userName}</div>
            <div style={{ fontSize: 10, opacity: 0.4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 4 }}>{s.title}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#22c55e", flexShrink: 0, boxShadow: "0 0 6px rgba(34,197,94,.6)" }} />
              <span style={{ fontSize: 10, color: "rgba(230,235,240,.75)", fontWeight: 700, fontFamily: "monospace" }}>{s.viewerCount?.toLocaleString()} viewers</span>
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
        <div style={{ ...S.card, marginBottom: 14, border: `1px solid ${M.accentMid}`, borderLeft: `2px solid ${M.accent}`, background: M.accentDim, position: "relative", overflow: "hidden" }}>
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
      <div style={{ display: "flex", gap: 4 }}>
        {ZONES.map((z, i) => (
          <button key={z.name} onClick={() => setSelected(i)} style={{
            flex: 1, padding: "8px 6px", border: "none", cursor: "pointer", borderRadius: 2,
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
            <div style={{ padding: "8px 10px", borderRadius: 2, background: "rgba(255,255,255,0.02)", border: `1px solid ${M.border}` }}>
              <div style={S.label}>LOOT TIER</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: zone.threat >= 4 ? M.ranked : zone.threat >= 3 ? M.warning : M.accent, fontFamily: "monospace" }}>{zone.loot}</div>
            </div>
            <div style={{ padding: "8px 10px", borderRadius: 2, background: "rgba(255,255,255,0.02)", border: `1px solid ${M.border}` }}>
              <div style={S.label}>HOSTILES</div>
              <div style={{ fontSize: 11, opacity: 0.7 }}>{zone.enemies}</div>
            </div>
          </div>

          <div style={{ marginTop: 10, padding: "8px 10px", borderRadius: 2, background: M.accentDim, border: `1px solid ${M.accentMid}` }}>
            <div style={{ ...S.label, color: M.accent, opacity: 0.7 }}>INTEL</div>
            <div style={{ fontSize: 11, opacity: 0.65, lineHeight: 1.5 }}>{zone.tips}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

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
        <div key={r.name} onClick={() => setSelected(selected === i ? null : i)} onKeyDown={onActivate(() => setSelected(selected === i ? null : i))} tabIndex={0} role="button" style={{
          ...S.card, cursor: "pointer", transition: "all .15s",
          border: selected === i ? `1px solid ${r.color}55` : `1px solid ${M.border}`,
          background: selected === i ? `${r.color}08` : M.card,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 2, display: "flex", alignItems: "center", justifyContent: "center",
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

function MyRunner({ accentColor }: { accentColor?: string }) {
  const accent = accentColor || M.accent;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 20px", gap: 20, height: "100%" }}>
      <div style={{ position: "relative" }}>
        <div style={{
          width: 80, height: 80, borderRadius: 2,
          background: `linear-gradient(135deg, ${accent}15, ${accent}05)`,
          border: `1px solid ${accent}30`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 36,
        }}>🏃</div>
        <div style={{
          position: "absolute", inset: -4, borderRadius: 2,
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
            borderRadius: 2, background: "rgba(255,255,255,0.015)", border: `1px solid ${M.border}`,
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
      <div>
        <div style={S.label}>RANKED TIERS</div>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {RANK_TIERS.map(t => (
            <div key={t.name} style={{
              display: "flex", alignItems: "center", gap: 5, padding: "5px 10px",
              borderRadius: 2, border: `1px solid ${t.color}25`, background: `${t.color}08`,
            }}>
              <span style={{ fontSize: 12 }}>{t.icon}</span>
              <span style={{ fontSize: 10, fontWeight: 800, color: t.color, fontFamily: "monospace", letterSpacing: "0.5px" }}>{t.name.toUpperCase()}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ ...S.card, position: "relative", overflow: "hidden" }}>
        <ScanLines />
        <div style={{ position: "relative", zIndex: 2 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div style={{ fontWeight: 900, fontSize: 14, fontFamily: "monospace", letterSpacing: "1px" }}>EXTRACTION LEADERS</div>
            <span style={{ fontSize: 9, opacity: 0.3, fontFamily: "monospace" }}>AWAITING API</span>
          </div>

          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: 10, padding: "8px 10px",
              borderRadius: 2, background: i === 0 ? "rgba(232,197,71,0.04)" : "transparent",
              border: `1px solid ${i === 0 ? "rgba(232,197,71,0.12)" : M.border}`,
              marginBottom: 4, opacity: 0.3,
            }}>
              <span style={{ fontWeight: 900, fontSize: 14, fontFamily: "monospace", width: 24, color: i === 0 ? M.ranked : M.textSec }}>{i + 1}</span>
              <div style={{ width: 28, height: 28, borderRadius: 2, background: "rgba(255,255,255,0.04)", border: `1px solid ${M.border}` }} />
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

      <div style={{ ...S.card, textAlign: "center" }}>
        <div style={{ fontWeight: 900, fontSize: 12, fontFamily: "monospace", letterSpacing: "1px", color: M.accent, marginBottom: 4 }}>SEASON 1 — DEATH IS THE FIRST STEP</div>
        <div style={{ fontSize: 11, opacity: 0.5 }}>March 2026 — June 2026</div>
        <div style={{ fontSize: 10, opacity: 0.3, marginTop: 4 }}>Progress resets each season. Cosmetics and Codex carry over.</div>
      </div>
    </div>
  );
}

function ZoneMap() {
  const [fullscreen, setFullscreen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = React.useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  const MAP_SRC = "/brand/marathon-map.png";

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setZoom(z => Math.min(6, Math.max(0.5, z - e.deltaY * 0.002)));
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
  }, [pan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging) return;
    setPan({
      x: dragStart.current.panX + (e.clientX - dragStart.current.x),
      y: dragStart.current.panY + (e.clientY - dragStart.current.y),
    });
  }, [dragging]);

  const handleMouseUp = useCallback(() => setDragging(false), []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    const t = e.touches[0];
    setDragging(true);
    dragStart.current = { x: t.clientX, y: t.clientY, panX: pan.x, panY: pan.y };
  }, [pan]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!dragging || e.touches.length !== 1) return;
    const t = e.touches[0];
    setPan({
      x: dragStart.current.panX + (t.clientX - dragStart.current.x),
      y: dragStart.current.panY + (t.clientY - dragStart.current.y),
    });
  }, [dragging]);

  const resetView = useCallback(() => { setZoom(1); setPan({ x: 0, y: 0 }); }, []);

  const thumbnail = (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ ...S.label, display: "flex", alignItems: "center", gap: 8 }}>
        UESC MARATHON — ZONE MAP
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 800, color: "#E8C547", letterSpacing: "0.5px", opacity: 1 }}>
          <span style={{ fontSize: 12, filter: "drop-shadow(0 0 4px rgba(232,197,71,.5))" }}>&#9733;</span>
          LordTT
        </span>
      </div>
      <div
        onClick={() => { setFullscreen(true); setZoom(1); setPan({ x: 0, y: 0 }); }}
        onKeyDown={onActivate(() => { setFullscreen(true); setZoom(1); setPan({ x: 0, y: 0 }); })}
        tabIndex={0}
        role="button"
        style={{
          ...S.card, cursor: "pointer", position: "relative", overflow: "hidden",
          padding: 0, border: `1px solid ${M.accentMid}`,
          transition: "border-color .15s",
        }}
      >
        <img
          src={MAP_SRC}
          alt="Marathon Zone Map by LordTT"
          style={{ width: "100%", display: "block", borderRadius: 2 }}
        />
        <div style={{
          position: "absolute", inset: 0,
          background: "linear-gradient(transparent 60%, rgba(0,0,0,.7))",
          display: "flex", alignItems: "flex-end", justifyContent: "center",
          padding: 14,
        }}>
          <div style={{
            padding: "8px 20px", borderRadius: 2,
            background: M.accentDim, border: `1px solid ${M.accentMid}`,
            fontFamily: "monospace", fontSize: 11, fontWeight: 800,
            color: M.accent, letterSpacing: "1px",
          }}>
            OPEN FULL MAP
          </div>
        </div>
      </div>
      <div style={{ fontSize: 10, opacity: 0.3, fontFamily: "monospace", textAlign: "center" }}>
        Map by <span style={{ color: M.accent, opacity: 1 }}>LordTT</span> — click to open full-screen interactive view
      </div>
    </div>
  );

  const fullscreenOverlay = fullscreen ? (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 99999,
        background: "rgba(2,2,6,.96)",
        backdropFilter: "blur(8px)",
        display: "flex", flexDirection: "column",
      }}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchEnd={() => setDragging(false)}
    >
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "10px 16px",
        background: "rgba(0,0,0,.5)",
        borderBottom: `1px solid ${M.border}`,
        flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontFamily: "monospace", fontWeight: 900, fontSize: 13, color: M.accent, letterSpacing: "1px" }}>
            ZONE MAP
          </span>
          <span style={{ fontSize: 10, opacity: 0.35, fontFamily: "monospace" }}>
            by LordTT
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 10, fontFamily: "monospace", opacity: 0.4 }}>{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom(z => Math.min(6, z + 0.5))} style={{ ...S.btn, padding: "4px 10px", fontSize: 14, lineHeight: 1 }}>+</button>
          <button onClick={() => setZoom(z => Math.max(0.5, z - 0.5))} style={{ ...S.btn, padding: "4px 10px", fontSize: 14, lineHeight: 1 }}>-</button>
          <button onClick={resetView} style={{ ...S.btn, padding: "4px 10px", fontSize: 10 }}>RESET</button>
          <button
            onClick={() => setFullscreen(false)}
            style={{
              ...S.btn, padding: "4px 12px", fontSize: 11, fontWeight: 800,
              color: "#FF4444", borderColor: "rgba(255,68,68,.25)",
            }}
          >
            CLOSE
          </button>
        </div>
      </div>

      <div
        style={{
          flex: 1, overflow: "hidden", cursor: dragging ? "grabbing" : "grab",
          display: "flex", alignItems: "center", justifyContent: "center",
          position: "relative",
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onWheel={handleWheel}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
      >
        <img
          src={MAP_SRC}
          alt="Marathon Zone Map"
          draggable={false}
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: "center center",
            transition: dragging ? "none" : "transform 0.15s ease-out",
            maxWidth: "none", maxHeight: "none",
            userSelect: "none",
            pointerEvents: "none",
          }}
        />
      </div>

      <div style={{
        padding: "6px 16px",
        background: "rgba(0,0,0,.5)",
        borderTop: `1px solid ${M.border}`,
        fontSize: 10, fontFamily: "monospace", opacity: 0.35, textAlign: "center",
        flexShrink: 0,
      }}>
        Map created by LordTT — scroll to zoom, drag to pan
      </div>
    </div>
  ) : null;

  return (
    <>
      {thumbnail}
      {fullscreenOverlay && typeof document !== "undefined" && createPortal(fullscreenOverlay, document.body)}
    </>
  );
}

function LoadingPulse({ text }: { text: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 40, gap: 12 }}>
      <div style={{
        width: 24, height: 24, borderRadius: 2,
        border: `2px solid ${M.accent}`,
        borderTopColor: "transparent",
        animation: "marathon-spin 0.8s linear infinite",
      }} />
      <div style={{ fontSize: 10, fontFamily: "monospace", letterSpacing: "2px", opacity: 0.4, color: M.accent }}>{text}</div>
      <style>{`@keyframes marathon-spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

const TABS = [
  { id: "streams",     label: "FEEDS",         icon: "__twitch__" },
  { id: "squads",      label: "SQUADS",        icon: "📡" },
  { id: "map",         label: "MAP",           icon: "🗺" },
  { id: "zones",       label: "ZONE INTEL",    icon: "📋" },
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
  useWatchHere(useCallback(() => { setTab("streams"); }, []));

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0, position: "relative", ...style }}>
      <ModuleTabBar
        tabs={TABS.map(t => ({
          id: t.id,
          label: t.label,
          icon: t.icon === "__twitch__" ? <TwitchIcon size={11} /> : t.icon,
        }))}
        active={tab}
        onSelect={(id) => setTab(id as TabId)}
        accent={accent}
      />

      <div style={{
        flex: 1, minHeight: 0,
        overflowY: tab === "myrunner" ? "hidden" : "auto",
        padding: tab === "myrunner" ? 0 : "12px 12px 12px",
        display: "flex", flexDirection: "column",
      }}>
        {tab === "streams"      && <TwitchStreams lobbyId={lobbyId} accentColor={accent} />}
        {tab === "squads"       && <SquadFinder lobbyId={lobbyId} />}
        {tab === "map"          && <ZoneMap />}
        {tab === "zones"        && <ZoneIntel />}
        {tab === "runners"      && <RunnerDatabase />}
        {tab === "myrunner"     && <MyRunner accentColor={accent} />}
        {tab === "leaderboards" && <Leaderboards />}
      </div>
    </div>
  );
}

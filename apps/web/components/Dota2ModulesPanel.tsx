"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import StreamInterceptModal, { type StreamInfo } from "./StreamInterceptModal";
import EmptyState from "./EmptyState";
import ModuleTabBar from "./ModuleTabBar";
import { useWatchHere, consumePendingStream } from "../lib/useWatchHere";
import { onActivate } from "@/lib/a11y";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";
const ODOTA = "https://api.opendota.com/api";

function authHeaders(): Record<string, string> {
  try { const t = localStorage.getItem("weered_token") || ""; return t ? { Authorization: `Bearer ${t}` } : {}; } catch { return {}; }
}

async function apiFetch(path: string, opts?: RequestInit) {
  const r = await fetch(`${API}${path}`, { ...opts, headers: { "Content-Type": "application/json", ...authHeaders(), ...(opts?.headers || {}) } });
  return r.json();
}

async function odotaFetch(path: string) {
  const r = await fetch(`${ODOTA}${path}`);
  return r.json();
}

const ACCENT_DOTA = "#C23C2A";
const GREEN_DOTA = "#1A8A4A";

const S = {
  card: { borderRadius: 2, border: "1px solid rgba(255,255,255,.06)", background: "rgba(255,255,255,.03)", padding: "10px 12px" } as React.CSSProperties,
  btn: { padding: "6px 12px", borderRadius: 2, border: "1px solid rgba(255,255,255,.10)", background: "rgba(255,255,255,.05)", fontSize: 12, cursor: "pointer", color: "rgba(243,244,246,.88)" } as React.CSSProperties,
  btnPri: { padding: "6px 12px", borderRadius: 2, border: "1px solid rgba(194,60,42,.35)", background: "rgba(194,60,42,.12)", fontSize: 12, cursor: "pointer", color: "rgb(194,60,42)", fontWeight: 600 } as React.CSSProperties,
  input: { width: "100%", padding: "8px 12px", borderRadius: 2, border: "1px solid rgba(255,255,255,.10)", background: "rgba(0,0,0,.30)", fontSize: 13, color: "rgba(243,244,246,.92)", outline: "none", boxSizing: "border-box" as const },
  select: { padding: "8px 12px", borderRadius: 2, border: "1px solid rgba(255,255,255,.10)", background: "rgba(0,0,0,.30)", fontSize: 12, color: "rgba(243,244,246,.92)", outline: "none", cursor: "pointer" } as React.CSSProperties,
  label: { fontSize: 10, fontWeight: 700, opacity: 0.45, letterSpacing: ".7px", textTransform: "uppercase" as const, marginBottom: 6 } as React.CSSProperties,
};

const DOTA_MODES = ["Ranked", "Unranked", "Turbo", "All Pick", "Captains Mode"];
const DOTA_ROLES = ["Any", "Carry (Pos 1)", "Mid (Pos 2)", "Offlane (Pos 3)", "Soft Support (Pos 4)", "Hard Support (Pos 5)"];
const DOTA_RANKS = ["Any", "Herald", "Guardian", "Crusader", "Archon", "Legend", "Ancient", "Divine", "Immortal"];
const DOTA_REGIONS = ["US East", "US West", "EU West", "EU East", "SEA", "China", "South America", "Australia"];

const RANK_COLORS: Record<string, string> = {
  Herald: "#8B7355", Guardian: "#87CEEB", Crusader: "#FFD700", Archon: "#87CEEB",
  Legend: "#9370DB", Ancient: "#FF6347", Divine: "#FF4500", Immortal: "#FFD700",
};

const ATTR_COLORS: Record<string, string> = {
  str: "#EF4444", agi: "#22C55E", int: "#3B82F6", all: "#A855F7",
};

const MEDAL_NAMES = ["", "Herald", "Guardian", "Crusader", "Archon", "Legend", "Ancient", "Divine", "Immortal"];

function decodeRankTier(rankTier: number | null | undefined): string {
  if (!rankTier) return "Unranked";
  const medal = Math.floor(rankTier / 10);
  const stars = rankTier % 10;
  const name = MEDAL_NAMES[medal] || "Unknown";
  return stars > 0 ? `${name} ${stars}` : name;
}

function rankColor(rankTier: number | null | undefined): string {
  if (!rankTier) return "#8A8A8A";
  const medal = Math.floor(rankTier / 10);
  const name = MEDAL_NAMES[medal] || "";
  return RANK_COLORS[name] || "#8A8A8A";
}

function attrLabel(attr: string): string {
  if (attr === "str") return "STR";
  if (attr === "agi") return "AGI";
  if (attr === "int") return "INT";
  if (attr === "all") return "UNI";
  return attr.toUpperCase();
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const TABS = [
  { id: "lfg" as const, label: "Stack Finder", icon: "\u{1F3AE}" },
  { id: "player" as const, label: "Player Lookup", icon: "\u{1F50D}" },
  { id: "live" as const, label: "Live Matches", icon: "\u{1F534}" },
  { id: "heroes" as const, label: "Heroes", icon: "\u2694\uFE0F" },
  { id: "streams" as const, label: "Streams", icon: "\u{1F4FA}" },
];
type TabId = typeof TABS[number]["id"];

function StackFinder({ lobbyId, accent }: { lobbyId: string; accent: string }) {
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [mode, setMode] = useState("Ranked");
  const [role, setRole] = useState("Any");
  const [rank, setRank] = useState("Any");
  const [region, setRegion] = useState("US East");
  const [micRequired, setMicRequired] = useState(true);
  const [note, setNote] = useState("");
  const [creating, setCreating] = useState(false);
  const [msg, setMsg] = useState("");

  const load = useCallback(() => {
    apiFetch(`/lfg/${encodeURIComponent(lobbyId)}`)
      .then(j => { setPosts(j.posts || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [lobbyId]);

  useEffect(() => { load(); const i = setInterval(load, 12000); return () => clearInterval(i); }, [load]);

  async function create() {
    setCreating(true);
    setMsg("");
    const micStr = micRequired ? " (Mic)" : "";
    const roleStr = role !== "Any" ? ` \u2014 ${role}` : "";
    const rankStr = rank !== "Any" ? ` \u2014 ${rank}` : "";
    const activity = `${mode}${rankStr}${roleStr} \u2014 ${region}${micStr}`;

    const j = await apiFetch(`/lfg/${encodeURIComponent(lobbyId)}`, {
      method: "POST",
      body: JSON.stringify({
        activity,
        description: note,
        maxPlayers: 5,
        platform: "pc",
      }),
    });
    setCreating(false);
    if (j.ok) { setShowForm(false); setNote(""); load(); }
    else setMsg(j.message || j.error || "Failed to create post");
  }

  async function join(postId: string) {
    const j = await apiFetch(`/lfg/${postId}/join`, { method: "POST", body: JSON.stringify({}) });
    if (j.ok) load(); else setMsg(j.message || j.error || "Failed to join");
  }

  async function leave(postId: string) {
    const j = await apiFetch(`/lfg/${postId}/leave`, { method: "POST", body: JSON.stringify({}) });
    if (j.ok) load(); else setMsg(j.message || j.error || "Failed to leave");
  }

  if (loading) return <div style={{ padding: 20, textAlign: "center", opacity: 0.4, fontSize: 13 }}>Loading stacks...</div>;

  const openPosts = posts.filter(p => p.status === "OPEN");

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={S.label}>STACK FINDER ({openPosts.length} open)</div>
        <button
          style={showForm ? S.btn : { ...S.btnPri, border: `1px solid ${accent}55`, background: `${accent}18`, color: accent }}
          onClick={() => { setShowForm(!showForm); setMsg(""); }}
        >
          {showForm ? "Cancel" : "+ Find Stack"}
        </button>
      </div>

      {msg && (
        <div style={{
          marginBottom: 10, fontSize: 12, padding: "6px 10px", borderRadius: 2,
          background: "rgba(239,68,68,.08)", border: "1px solid rgba(239,68,68,.2)",
          color: "rgba(252,165,165,.8)",
        }}>{msg}</div>
      )}

      {showForm && (
        <div style={{
          ...S.card, marginBottom: 16, display: "flex", flexDirection: "column", gap: 10,
          border: `1px solid ${accent}33`, background: `${accent}06`,
        }}>
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ flex: 1 }}>
              <div style={S.label}>Mode</div>
              <select style={{ ...S.select, width: "100%" }} value={mode} onChange={e => setMode(e.target.value)}>
                {DOTA_MODES.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <div style={S.label}>Role Preference</div>
              <select style={{ ...S.select, width: "100%" }} value={role} onChange={e => setRole(e.target.value)}>
                {DOTA_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ flex: 1 }}>
              <div style={S.label}>Rank</div>
              <select style={{ ...S.select, width: "100%" }} value={rank} onChange={e => setRank(e.target.value)}>
                {DOTA_RANKS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <div style={S.label}>Region</div>
              <select style={{ ...S.select, width: "100%" }} value={region} onChange={e => setRegion(e.target.value)}>
                {DOTA_REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <button
              onClick={() => setMicRequired(!micRequired)}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "6px 12px", borderRadius: 2, cursor: "pointer",
                border: micRequired ? `1px solid ${accent}55` : "1px solid rgba(255,255,255,.10)",
                background: micRequired ? `${accent}18` : "rgba(255,255,255,.03)",
                color: micRequired ? accent : "rgba(148,163,184,.6)",
                fontSize: 12, fontWeight: micRequired ? 700 : 400,
                transition: "all .15s",
              }}
            >
              <span style={{ fontSize: 14 }}>{micRequired ? "\u{1F3A4}" : "\u{1F507}"}</span>
              Mic {micRequired ? "Required" : "Optional"}
            </button>
            <div style={{ fontSize: 11, opacity: 0.45, fontFamily: "monospace" }}>
              Team: 5 players
            </div>
          </div>

          <div>
            <div style={S.label}>Note (optional)</div>
            <input
              style={S.input}
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Need pos 5 for ranked grind, Legend+ preferred..."
              maxLength={300}
            />
          </div>

          <button
            style={{ ...S.btnPri, padding: "10px 24px", alignSelf: "flex-start", fontSize: 13, border: `1px solid ${accent}55`, background: `${accent}18`, color: accent }}
            onClick={create}
            disabled={creating}
          >
            {creating ? "Posting..." : "Post Stack"}
          </button>
        </div>
      )}

      {posts.length === 0 ? (
        <EmptyState icon="🎮" title="No stacks posted yet." hint="Drop one — someone's ready to queue." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {posts.map(p => {
            const isFull = p.status === "FULL";
            const playerCount = (p.players || []).length;
            const maxP = p.maxPlayers || 5;
            const slots = Array.from({ length: maxP }, (_, i) => i < playerCount);

            return (
              <div key={p.id} style={{
                ...S.card, display: "flex", flexDirection: "column", gap: 8,
                border: isFull ? `1px solid ${accent}30` : "1px solid rgba(255,255,255,.06)",
                opacity: isFull ? 0.65 : 1,
                transition: "border-color .15s",
              }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "rgba(243,244,246,.92)", lineHeight: 1.4 }}>
                      {p.activity || "Looking for stack"}
                    </div>
                    <div style={{ fontSize: 11, opacity: 0.45, marginTop: 2 }}>
                      {p.userName}
                      {p.platform && p.platform !== "pc" ? ` \u00B7 ${p.platform}` : ""}
                    </div>
                  </div>
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 2, flexShrink: 0,
                    background: isFull ? "rgba(239,68,68,.12)" : "rgba(34,197,94,.12)",
                    color: isFull ? "#EF4444" : "#22C55E",
                  }}>{p.status}</span>
                </div>

                {p.description && (
                  <div style={{ fontSize: 11, color: "rgba(148,163,184,.55)", lineHeight: 1.4, fontStyle: "italic" }}>
                    {p.description}
                  </div>
                )}

                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ display: "flex", gap: 3 }}>
                    {slots.map((filled, i) => (
                      <div key={i} style={{
                        width: 22, height: 22, borderRadius: 2,
                        border: filled ? `1.5px solid ${accent}` : "1.5px solid rgba(255,255,255,.10)",
                        background: filled ? `${accent}25` : "rgba(255,255,255,.02)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 10, fontWeight: 700, color: filled ? accent : "rgba(148,163,184,.25)",
                        transition: "all .15s",
                      }}>
                        {filled ? "\u2713" : ""}
                      </div>
                    ))}
                  </div>
                  <span style={{ fontSize: 11, fontFamily: "monospace", opacity: 0.5 }}>
                    {playerCount}/{maxP}
                  </span>
                </div>

                {(p.playerNames || []).length > 0 && (
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    {p.playerNames.map((n: string, i: number) => (
                      <span key={i} style={{
                        fontSize: 10, padding: "2px 7px", borderRadius: 2,
                        background: `${accent}12`, border: `1px solid ${accent}28`,
                        color: `${accent}dd`, fontWeight: 600,
                      }}>{n}</span>
                    ))}
                  </div>
                )}

                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                  {!isFull && (
                    <button
                      style={{ ...S.btnPri, fontSize: 11, padding: "5px 14px", border: `1px solid ${accent}55`, background: `${accent}18`, color: accent }}
                      onClick={() => join(p.id)}
                    >Join Stack</button>
                  )}
                  <button
                    style={{ ...S.btn, fontSize: 11, padding: "5px 14px" }}
                    onClick={() => leave(p.id)}
                  >Leave</button>
                  <a
                    href="steam://run/570"
                    style={{
                      ...S.btn, fontSize: 10, padding: "5px 12px", textDecoration: "none",
                      display: "inline-flex", alignItems: "center", gap: 4,
                      color: "#22c55e", borderColor: "rgba(34,197,94,.25)",
                    }}
                  >&#9654; Launch Dota 2</a>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PlayerLookup({ accent, heroMap }: { accent: string; heroMap: Record<number, string> }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [wl, setWl] = useState<{ win: number; lose: number } | null>(null);
  const [topHeroes, setTopHeroes] = useState<any[]>([]);
  const [recentMatches, setRecentMatches] = useState<any[]>([]);
  const [loadingProfile, setLoadingProfile] = useState(false);

  async function search() {
    if (!query.trim()) return;
    setSearching(true);
    setSelected(null);
    setProfile(null);
    try {
      const data = await odotaFetch(`/search?q=${encodeURIComponent(query.trim())}`);
      setResults(Array.isArray(data) ? data.slice(0, 15) : []);
    } catch { setResults([]); }
    setSearching(false);
  }

  async function selectPlayer(player: any) {
    setSelected(player);
    setLoadingProfile(true);
    setProfile(null);
    setWl(null);
    setTopHeroes([]);
    setRecentMatches([]);

    try {
      const [prof, winLoss, heroes, matches] = await Promise.all([
        odotaFetch(`/players/${player.account_id}`),
        odotaFetch(`/players/${player.account_id}/wl`),
        odotaFetch(`/players/${player.account_id}/heroes?limit=5`),
        odotaFetch(`/players/${player.account_id}/recentMatches`),
      ]);
      setProfile(prof);
      setWl(winLoss);
      setTopHeroes(Array.isArray(heroes) ? heroes.slice(0, 5) : []);
      setRecentMatches(Array.isArray(matches) ? matches.slice(0, 5) : []);
    } catch { }
    setLoadingProfile(false);
  }

  function goBack() {
    setSelected(null);
    setProfile(null);
    setWl(null);
    setTopHeroes([]);
    setRecentMatches([]);
  }

  const winRate = wl && (wl.win + wl.lose) > 0
    ? ((wl.win / (wl.win + wl.lose)) * 100).toFixed(1)
    : null;

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <input
          style={{ ...S.input, flex: 1 }}
          placeholder="Search player name..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") search(); }}
        />
        <button
          style={{ ...S.btnPri, padding: "8px 18px", border: `1px solid ${accent}55`, background: `${accent}18`, color: accent }}
          onClick={search}
          disabled={searching}
        >
          {searching ? "..." : "Search"}
        </button>
      </div>

      {selected && (
        <div>
          <button onClick={goBack} style={{ ...S.btn, fontSize: 11, marginBottom: 12, display: "inline-flex", alignItems: "center", gap: 4 }}>
            &#8592; Back to results
          </button>

          {loadingProfile ? (
            <div style={{ padding: 20, textAlign: "center", opacity: 0.4, fontSize: 13 }}>Loading player data...</div>
          ) : profile ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{
                ...S.card, display: "flex", alignItems: "center", gap: 14,
                border: `1px solid ${accent}30`, borderLeft: `2px solid ${accent}`, background: `${accent}06`,
                padding: "16px 18px",
              }}>
                {profile.profile?.avatarfull && (
                  <img
                    src={profile.profile.avatarfull}
                    alt={(profile.profile?.personaname || "Player") + " avatar"}
                    style={{ width: 56, height: 56, borderRadius: 2, border: `2px solid ${rankColor(profile.rank_tier)}`, flexShrink: 0 }}
                  />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "rgba(243,244,246,.95)" }}>
                    {profile.profile?.personaname || selected.personaname}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4, flexWrap: "wrap" }}>
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 2,
                      background: `${rankColor(profile.rank_tier)}20`,
                      border: `1px solid ${rankColor(profile.rank_tier)}40`,
                      color: rankColor(profile.rank_tier),
                    }}>
                      {decodeRankTier(profile.rank_tier)}
                    </span>
                    {profile.mmr_estimate?.estimate && (
                      <span style={{ fontSize: 11, opacity: 0.5, fontFamily: "monospace" }}>
                        ~{profile.mmr_estimate.estimate} MMR
                      </span>
                    )}
                    {profile.leaderboard_rank && (
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 2,
                        background: "rgba(255,215,0,.12)", border: "1px solid rgba(255,215,0,.3)",
                        color: "#FFD700",
                      }}>
                        #{profile.leaderboard_rank}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 10, opacity: 0.35, marginTop: 4, fontFamily: "monospace" }}>
                    ID: {selected.account_id}
                  </div>
                </div>
              </div>

              {wl && (wl.win + wl.lose) > 0 && (
                <div style={{ ...S.card, border: `1px solid ${accent}20` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <div style={S.label}>WIN / LOSS</div>
                    <span style={{
                      fontSize: 14, fontWeight: 800,
                      color: Number(winRate) >= 50 ? GREEN_DOTA : "#EF4444",
                    }}>
                      {winRate}%
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: GREEN_DOTA }}>{wl.win}W</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#EF4444" }}>{wl.lose}L</span>
                    <span style={{ fontSize: 11, opacity: 0.35 }}>{wl.win + wl.lose} total</span>
                  </div>
                  <div style={{
                    height: 6, borderRadius: 3, overflow: "hidden",
                    background: "rgba(239,68,68,.25)",
                    display: "flex",
                  }}>
                    <div style={{
                      width: `${(wl.win / (wl.win + wl.lose)) * 100}%`,
                      height: "100%",
                      background: GREEN_DOTA,
                      borderRadius: 3,
                      transition: "width .4s ease",
                    }} />
                  </div>
                </div>
              )}

              {topHeroes.length > 0 && (
                <div style={{ ...S.card, border: `1px solid ${accent}15` }}>
                  <div style={{ ...S.label, marginBottom: 10 }}>TOP HEROES</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {topHeroes.map((h, i) => {
                      const heroName = heroMap[h.hero_id] || `Hero ${h.hero_id}`;
                      const heroWr = h.games > 0 ? ((h.win / h.games) * 100).toFixed(1) : "0.0";
                      return (
                        <div key={h.hero_id} style={{
                          display: "flex", alignItems: "center", gap: 10,
                          padding: "6px 8px", borderRadius: 2,
                          background: i === 0 ? `${accent}08` : "transparent",
                        }}>
                          <span style={{
                            fontSize: 11, fontWeight: 800, color: accent, opacity: 0.5,
                            width: 16, textAlign: "right", flexShrink: 0,
                          }}>
                            {i + 1}
                          </span>
                          <span style={{ fontSize: 13, fontWeight: 700, flex: 1, color: "rgba(243,244,246,.88)" }}>
                            {heroName}
                          </span>
                          <span style={{ fontSize: 11, fontFamily: "monospace", opacity: 0.5 }}>
                            {h.games} games
                          </span>
                          <span style={{
                            fontSize: 11, fontWeight: 700, fontFamily: "monospace", minWidth: 48, textAlign: "right",
                            color: Number(heroWr) >= 50 ? GREEN_DOTA : "#EF4444",
                          }}>
                            {heroWr}%
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {recentMatches.length > 0 && (
                <div style={{ ...S.card, border: `1px solid ${accent}15` }}>
                  <div style={{ ...S.label, marginBottom: 10 }}>RECENT MATCHES</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {recentMatches.map(m => {
                      const heroName = heroMap[m.hero_id] || `Hero ${m.hero_id}`;
                      const isWin = (m.player_slot < 128 && m.radiant_win) || (m.player_slot >= 128 && !m.radiant_win);
                      return (
                        <div key={m.match_id} style={{
                          display: "flex", alignItems: "center", gap: 8,
                          padding: "7px 8px", borderRadius: 2,
                          background: isWin ? "rgba(26,138,74,.06)" : "rgba(239,68,68,.04)",
                          border: isWin ? "1px solid rgba(26,138,74,.12)" : "1px solid rgba(239,68,68,.08)",
                        }}>
                          <span style={{
                            fontSize: 9, fontWeight: 800, padding: "2px 5px", borderRadius: 3,
                            background: isWin ? "rgba(26,138,74,.18)" : "rgba(239,68,68,.12)",
                            color: isWin ? GREEN_DOTA : "#EF4444",
                            flexShrink: 0, minWidth: 22, textAlign: "center",
                          }}>
                            {isWin ? "W" : "L"}
                          </span>
                          <span style={{ fontSize: 12, fontWeight: 600, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {heroName}
                          </span>
                          <span style={{ fontSize: 12, fontWeight: 700, fontFamily: "monospace", color: "rgba(243,244,246,.8)", flexShrink: 0 }}>
                            {m.kills}/{m.deaths}/{m.assists}
                          </span>
                          <span style={{ fontSize: 10, opacity: 0.35, fontFamily: "monospace", flexShrink: 0, minWidth: 40, textAlign: "right" }}>
                            {formatDuration(m.duration)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div style={{ fontSize: 10, opacity: 0.25, textAlign: "center", marginTop: 4 }}>
                Data provided by OpenDota
              </div>
            </div>
          ) : (
            <div style={{ padding: 20, textAlign: "center", opacity: 0.4, fontSize: 13 }}>Failed to load player data</div>
          )}
        </div>
      )}

      {!selected && results.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ ...S.label, marginBottom: 6 }}>RESULTS ({results.length})</div>
          {results.map(p => (
            <div key={p.account_id} onClick={() => selectPlayer(p)} onKeyDown={onActivate(() => selectPlayer(p))} tabIndex={0} role="button" style={{
              ...S.card, cursor: "pointer", display: "flex", alignItems: "center", gap: 12,
              transition: "border-color .12s",
            }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = `${accent}44`)}
              onMouseLeave={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,.06)")}
            >
              {p.avatarfull && (
                <img src={p.avatarfull} alt={(p.personaname || "Player") + " avatar"} style={{
                  width: 36, height: 36, borderRadius: 2, flexShrink: 0,
                  border: "1px solid rgba(255,255,255,.08)",
                }} />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {p.personaname}
                </div>
                <div style={{ fontSize: 10, opacity: 0.35, fontFamily: "monospace", marginTop: 2 }}>
                  ID: {p.account_id}
                </div>
              </div>
              <span style={{ fontSize: 14, opacity: 0.25, flexShrink: 0 }}>&rsaquo;</span>
            </div>
          ))}
        </div>
      )}

      {!selected && !searching && results.length === 0 && query && (
        <EmptyState compact title="No players found." />
      )}

      {!selected && !searching && !query && (
        <div style={{ padding: 32, textAlign: "center" }}>
          <div style={{ fontSize: 28, marginBottom: 8, opacity: 0.15 }}>{"\u{1F50D}"}</div>
          <div style={{ opacity: 0.4, fontSize: 13, marginBottom: 4 }}>Search for any Dota 2 player</div>
          <div style={{ opacity: 0.25, fontSize: 11 }}>View MMR, win rate, top heroes, and recent matches</div>
        </div>
      )}
    </div>
  );
}

function LiveMatches({ accent }: { accent: string }) {
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await odotaFetch("/live");
      if (Array.isArray(data)) {
        const sorted = data
          .filter(m => m.average_mmr && m.average_mmr > 0)
          .sort((a, b) => (b.average_mmr || 0) - (a.average_mmr || 0))
          .slice(0, 10);
        setMatches(sorted);
        setError(false);
      }
    } catch { setError(true); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); const i = setInterval(load, 30000); return () => clearInterval(i); }, [load]);

  if (loading) return <div style={{ padding: 20, textAlign: "center", opacity: 0.4, fontSize: 13 }}>Loading live matches...</div>;
  if (error) return <div style={{ padding: 20, textAlign: "center", opacity: 0.4, fontSize: 13 }}>Failed to load live matches</div>;
  if (matches.length === 0) return <EmptyState compact title="No high-MMR matches live." hint="Pub scene is quiet — check back in a bit." />;

  return (
    <div>
      <div style={{ ...S.label, marginBottom: 10 }}>TOP LIVE MATCHES BY MMR</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {matches.map((m, idx) => {
          const radiantPlayers = (m.players || []).filter((p: any) => p.team === 0 || (p.team_tag === "radiant"));
          const direPlayers = (m.players || []).filter((p: any) => p.team === 1 || (p.team_tag === "dire"));
          const allPlayers = m.players || [];
          const radiant = radiantPlayers.length > 0 ? radiantPlayers : allPlayers.slice(0, 5);
          const dire = direPlayers.length > 0 ? direPlayers : allPlayers.slice(5, 10);

          const duration = m.game_time ? formatDuration(m.game_time) : "--:--";

          return (
            <div key={m.match_id || idx} style={{
              ...S.card,
              border: `1px solid ${accent}20`,
              background: `${accent}04`,
              padding: "14px 16px",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#EF4444", boxShadow: "0 0 6px rgba(239,68,68,.6)", animation: "pulse 2s infinite" }} />
                  <span style={{ fontSize: 12, fontWeight: 800, color: "rgba(243,244,246,.9)" }}>
                    ~{m.average_mmr?.toLocaleString()} MMR
                  </span>
                  {m.game_mode !== undefined && (
                    <span style={{ fontSize: 10, opacity: 0.35, fontFamily: "monospace" }}>
                      Mode {m.game_mode}
                    </span>
                  )}
                </div>
                <span style={{ fontSize: 11, fontFamily: "monospace", opacity: 0.5 }}>{duration}</span>
              </div>

              <div style={{ display: "flex", gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 9, fontWeight: 800, color: GREEN_DOTA, letterSpacing: ".6px", marginBottom: 6 }}>
                    RADIANT
                  </div>
                  {radiant.slice(0, 5).map((p: any, i: number) => (
                    <div key={i} style={{ fontSize: 11, color: "rgba(243,244,246,.7)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", lineHeight: 1.6 }}>
                      {p.name || p.personaname || `Player ${i + 1}`}
                    </div>
                  ))}
                  {radiant.length === 0 && <div style={{ fontSize: 11, opacity: 0.3 }}>--</div>}
                </div>
                <div style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
                  <span style={{ fontSize: 10, fontWeight: 800, opacity: 0.2, letterSpacing: "1px" }}>VS</span>
                </div>
                <div style={{ flex: 1, minWidth: 0, textAlign: "right" }}>
                  <div style={{ fontSize: 9, fontWeight: 800, color: accent, letterSpacing: ".6px", marginBottom: 6 }}>
                    DIRE
                  </div>
                  {dire.slice(0, 5).map((p: any, i: number) => (
                    <div key={i} style={{ fontSize: 11, color: "rgba(243,244,246,.7)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", lineHeight: 1.6 }}>
                      {p.name || p.personaname || `Player ${i + 1}`}
                    </div>
                  ))}
                  {dire.length === 0 && <div style={{ fontSize: 11, opacity: 0.3 }}>--</div>}
                </div>
              </div>

              {m.server_steam_id && (
                <div style={{ marginTop: 10, textAlign: "center" }}>
                  <a
                    href={`steam://watchgame/570/${m.server_steam_id}`}
                    style={{
                      ...S.btn, fontSize: 10, padding: "5px 14px", textDecoration: "none",
                      display: "inline-flex", alignItems: "center", gap: 4,
                      color: GREEN_DOTA, borderColor: `${GREEN_DOTA}40`,
                    }}
                  >&#9654; Watch in Dota 2</a>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div style={{ fontSize: 10, opacity: 0.2, textAlign: "center", marginTop: 10 }}>
        Auto-refreshes every 30 seconds &middot; Data from OpenDota
      </div>
    </div>
  );
}

type SortKey = "name" | "pick" | "win";

function HeroesBrowser({ accent }: { accent: string }) {
  const [heroes, setHeroes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("pick");

  useEffect(() => {
    odotaFetch("/heroStats")
      .then(data => {
        if (Array.isArray(data)) setHeroes(data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const totalPicksForRate = useMemo(() => {
    return heroes.reduce((acc, h) => {
      const picks = (h["1_pick"] || 0) + (h["2_pick"] || 0) + (h["3_pick"] || 0) + (h["4_pick"] || 0) + (h["5_pick"] || 0) + (h["6_pick"] || 0) + (h["7_pick"] || 0) + (h["8_pick"] || 0);
      return acc + picks;
    }, 0);
  }, [heroes]);

  const processed = useMemo(() => {
    return heroes.map(h => {
      const picks = (h["1_pick"] || 0) + (h["2_pick"] || 0) + (h["3_pick"] || 0) + (h["4_pick"] || 0) + (h["5_pick"] || 0) + (h["6_pick"] || 0) + (h["7_pick"] || 0) + (h["8_pick"] || 0);
      const wins = (h["1_win"] || 0) + (h["2_win"] || 0) + (h["3_win"] || 0) + (h["4_win"] || 0) + (h["5_win"] || 0) + (h["6_win"] || 0) + (h["7_win"] || 0) + (h["8_win"] || 0);
      const winRate = picks > 0 ? (wins / picks) * 100 : 0;
      const pickRate = totalPicksForRate > 0 ? (picks / totalPicksForRate) * 100 : 0;
      return { ...h, picks, wins, winRate, pickRate };
    });
  }, [heroes, totalPicksForRate]);

  const filtered = useMemo(() => {
    let list = processed;
    if (filter.trim()) {
      const q = filter.toLowerCase();
      list = list.filter(h => (h.localized_name || "").toLowerCase().includes(q));
    }
    list.sort((a, b) => {
      if (sortBy === "name") return (a.localized_name || "").localeCompare(b.localized_name || "");
      if (sortBy === "pick") return b.pickRate - a.pickRate;
      if (sortBy === "win") return b.winRate - a.winRate;
      return 0;
    });
    return list;
  }, [processed, filter, sortBy]);

  if (loading) return <div style={{ padding: 20, textAlign: "center", opacity: 0.4, fontSize: 13 }}>Loading heroes...</div>;

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center" }}>
        <input
          style={{ ...S.input, flex: 1 }}
          placeholder="Filter heroes..."
          value={filter}
          onChange={e => setFilter(e.target.value)}
        />
        <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
          {([["name", "A-Z"], ["pick", "Pick%"], ["win", "Win%"]] as [SortKey, string][]).map(([key, label]) => (
            <button key={key} onClick={() => setSortBy(key)} style={{
              padding: "6px 10px", borderRadius: 2, border: "none", fontSize: 10, cursor: "pointer", fontWeight: sortBy === key ? 700 : 400,
              background: sortBy === key ? `${accent}20` : "rgba(255,255,255,.04)",
              color: sortBy === key ? accent : "rgba(148,163,184,.6)",
              transition: "all .12s",
            }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ ...S.label, marginBottom: 8 }}>{filtered.length} HEROES</div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
        {filtered.map(h => {
          const attr = h.primary_attr || "all";
          const attrColor = ATTR_COLORS[attr] || ATTR_COLORS.all;

          return (
            <div key={h.id} style={{
              borderRadius: 2, overflow: "hidden",
              border: `1px solid ${attrColor}18`,
              background: `${attrColor}05`,
              padding: "12px 10px 10px",
              transition: "border-color .12s, transform .12s",
              cursor: "default",
            }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = `${attrColor}40`;
                e.currentTarget.style.transform = "translateY(-1px)";
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = `${attrColor}18`;
                e.currentTarget.style.transform = "translateY(0)";
              }}
            >
              <div style={{
                width: "100%", height: 3, borderRadius: 2, marginBottom: 8,
                background: `linear-gradient(90deg, ${attrColor}70, ${attrColor}10)`,
              }} />

              <div style={{ fontSize: 12, fontWeight: 800, color: "rgba(243,244,246,.9)", marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {h.localized_name}
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                <span style={{
                  fontSize: 9, fontWeight: 800, padding: "1px 5px", borderRadius: 3,
                  background: `${attrColor}20`, color: attrColor, letterSpacing: ".5px",
                }}>
                  {attrLabel(attr)}
                </span>
                <span style={{ fontSize: 9, opacity: 0.35 }}>
                  {h.attack_type === "Melee" ? "\u2694 Melee" : "\u{1F3AF} Ranged"}
                </span>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 9, opacity: 0.35, marginBottom: 1 }}>PICK</div>
                  <div style={{ fontSize: 12, fontWeight: 700, fontFamily: "monospace", color: "rgba(243,244,246,.7)" }}>
                    {h.pickRate.toFixed(1)}%
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 9, opacity: 0.35, marginBottom: 1 }}>WIN</div>
                  <div style={{
                    fontSize: 12, fontWeight: 700, fontFamily: "monospace",
                    color: h.winRate >= 52 ? GREEN_DOTA : h.winRate < 48 ? "#EF4444" : "rgba(243,244,246,.7)",
                  }}>
                    {h.winRate.toFixed(1)}%
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <EmptyState compact title="No heroes match." hint="Try a different filter." />
      )}

      <div style={{ fontSize: 10, opacity: 0.2, textAlign: "center", marginTop: 10 }}>
        Aggregated across all rank brackets &middot; Data from OpenDota
      </div>
    </div>
  );
}

function TwitchStreams({ lobbyId, accentColor }: { lobbyId: string; accentColor: string }) {
  const [streams, setStreams] = useState<StreamInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [interceptStream, setInterceptStream] = useState<StreamInfo | null>(null);
  const [activeStream, setActiveStream] = useState<string | null>(null);

  useEffect(() => {
    const ch = consumePendingStream();
    if (ch) setActiveStream(ch);
  }, []);

  const load = useCallback(async () => {
    try {
      const j = await apiFetch(`/twitch/streams?game=${encodeURIComponent("Dota 2")}&first=20`);
      if (j.ok) setStreams(j.streams || []);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); const i = setInterval(load, 30000); return () => clearInterval(i); }, [load]);

  function handleCardClick(s: any) {
    setInterceptStream({
      userLogin: s.userLogin || s.user_login || "",
      userName: s.userName || s.user_name || "",
      title: s.title || "",
      viewerCount: Number(s.viewerCount || s.viewer_count || 0),
      thumbnailUrl: s.thumbnailUrl || s.thumbnail_url || "",
      gameName: "Dota 2",
    });
  }

  function handleWatchHere(stream: StreamInfo) {
    setActiveStream(stream.userLogin);
  }

  if (loading) return <div style={{ padding: 20, textAlign: "center", opacity: 0.4, fontSize: 13 }}>Loading streams...</div>;
  if (streams.length === 0) return <EmptyState compact title="Nobody streaming Dota right now." />;

  return (
    <>
      {activeStream && (
        <div style={{ borderRadius: 2, overflow: "hidden", border: `1px solid ${accentColor}40`, background: "#000", marginBottom: 8 }}>
          <iframe
            src={`https://player.twitch.tv/?channel=${activeStream}&parent=${typeof window !== "undefined" ? window.location.hostname : "weered.ca"}&muted=true`}
            width="100%" height="280" style={{ border: "none", display: "block" }} allowFullScreen
          />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", background: `${accentColor}10` }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: accentColor }}>{activeStream}</span>
            <button onClick={() => setActiveStream(null)} style={{ ...S.btn, fontSize: 11, padding: "4px 10px" }}>Close</button>
          </div>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {streams.map(s => (
          <div key={s.userLogin} onClick={() => handleCardClick(s)} onKeyDown={onActivate(() => handleCardClick(s))} tabIndex={0} role="button" style={{
            ...S.card, cursor: "pointer", display: "flex", gap: 10, alignItems: "center",
            transition: "border-color .12s",
          }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = `${accentColor}44`)}
            onMouseLeave={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,.06)")}
          >
            {s.thumbnailUrl && (
              <img
                src={(s.thumbnailUrl || "").replace("{width}", "80").replace("{height}", "45")}
                alt={s.userName + " stream thumbnail"} style={{ width: 80, height: 45, borderRadius: 2, objectFit: "cover", flexShrink: 0, border: "1px solid rgba(255,255,255,.06)" }}
              />
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.title}</div>
              <div style={{ fontSize: 11, opacity: 0.5, marginTop: 2 }}>{s.userName} &middot; {s.viewerCount?.toLocaleString()} viewers</div>
            </div>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 6px rgba(34,197,94,.6)", flexShrink: 0 }} />
          </div>
        ))}
      </div>

      <StreamInterceptModal
        stream={interceptStream}
        lobbyId={lobbyId}
        accentColor={accentColor}
        onClose={() => setInterceptStream(null)}
        onWatchHere={handleWatchHere}
      />
    </>
  );
}

interface Props {
  lobbyId: string;
  gameName?: string;
  accentColor?: string;
  style?: React.CSSProperties;
}

export default function Dota2ModulesPanel({
  lobbyId,
  gameName = "Dota 2",
  accentColor = ACCENT_DOTA,
  style,
}: Props) {
  const [tab, setTab] = useState<TabId>("lfg");
  useWatchHere(useCallback(() => { setTab("streams"); }, []));

  const [heroMap, setHeroMap] = useState<Record<number, string>>({});

  useEffect(() => {
    odotaFetch("/heroes")
      .then(data => {
        if (Array.isArray(data)) {
          const map: Record<number, string> = {};
          data.forEach((h: any) => { map[h.id] = h.localized_name; });
          setHeroMap(map);
        }
      })
      .catch(() => {});
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0, ...style }}>
      <ModuleTabBar tabs={TABS} active={tab} onSelect={(id) => setTab(id as TabId)} accent={accentColor} />

      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "14px 14px 14px", display: "flex", flexDirection: "column" }}>
        {tab === "lfg"     && <StackFinder lobbyId={lobbyId} accent={accentColor} />}
        {tab === "player"  && <PlayerLookup accent={accentColor} heroMap={heroMap} />}
        {tab === "live"    && <LiveMatches accent={accentColor} />}
        {tab === "heroes"  && <HeroesBrowser accent={accentColor} />}
        {tab === "streams" && <TwitchStreams lobbyId={lobbyId} accentColor={accentColor} />}
      </div>

      <div style={{ padding: "6px 14px 8px", flexShrink: 0, borderTop: "1px solid rgba(255,255,255,.04)" }}>
        <p style={{ fontSize: 9, color: "rgba(100,116,139,.35)", lineHeight: 1.4, margin: 0, textAlign: "center" }}>
          Dota 2 is a registered trademark of Valve Corporation. Weered is not affiliated with, endorsed by, or sponsored by Valve Corporation. Game data provided by OpenDota.
        </p>
      </div>
    </div>
  );
}

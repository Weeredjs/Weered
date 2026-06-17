"use client";

import React, { useCallback, useEffect, useState } from "react";
import StreamInterceptModal, { type StreamInfo } from "./StreamInterceptModal";
import EmptyState from "./EmptyState";
import LoadingState from "./LoadingState";
import ModuleTabBar from "./ModuleTabBar";
import { useWatchHere, consumePendingStream } from "../lib/useWatchHere";
import { onActivate } from "@/lib/a11y";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";

function authHeaders(): Record<string, string> {
  try { const t = localStorage.getItem("weered_token") || ""; return t ? { Authorization: `Bearer ${t}` } : {}; } catch { return {}; }
}

async function apiFetch(path: string, opts?: RequestInit) {
  const r = await fetch(`${API}${path}`, { ...opts, headers: { "Content-Type": "application/json", ...authHeaders(), ...(opts?.headers || {}) } });
  return r.json();
}

const S = {
  card: { borderRadius: 2, border: "1px solid rgba(255,255,255,.08)", background: "rgba(255,255,255,.03)", padding: "10px 12px" } as React.CSSProperties,
  btn: { padding: "6px 12px", borderRadius: 2, border: "1px solid rgba(255,255,255,.10)", background: "rgba(255,255,255,.05)", fontSize: 12, cursor: "pointer", color: "rgba(243,244,246,.88)" } as React.CSSProperties,
  btnPri: { padding: "6px 12px", borderRadius: 2, border: "1px solid rgba(80,200,255,.35)", background: "rgba(80,200,255,.12)", fontSize: 12, cursor: "pointer", color: "rgb(80,200,255)", fontWeight: 600 } as React.CSSProperties,
  input: { width: "100%", padding: "8px 12px", borderRadius: 2, border: "1px solid rgba(255,255,255,.10)", background: "rgba(0,0,0,.30)", fontSize: 13, color: "rgba(243,244,246,.92)", outline: "none", boxSizing: "border-box" as const },
  select: { padding: "8px 12px", borderRadius: 2, border: "1px solid rgba(255,255,255,.10)", background: "rgba(0,0,0,.30)", fontSize: 12, color: "rgba(243,244,246,.92)", outline: "none", cursor: "pointer" } as React.CSSProperties,
  label: { fontSize: 10, fontWeight: 700, opacity: 0.45, letterSpacing: ".7px", textTransform: "uppercase" as const, marginBottom: 6 } as React.CSSProperties,
};

const ACCENT_FN = "#00D4FF";

const RARITY_COLORS: Record<string, string> = {
  legendary: "#FF8C00", epic: "#B15BFF", rare: "#00AAFF", uncommon: "#30B030",
  common: "#8A8A8A", marvel: "#C0392B", dc: "#1E90FF", icon: "#00CCCC",
  gaming: "#117DFF", dark: "#FF00FF", frozen: "#ACE5FF", lava: "#FF4500",
  shadow: "#5E35B1", slurp: "#00DDAA", star: "#E57C00",
};
function rarityColor(rarity?: string): string { return RARITY_COLORS[rarity?.toLowerCase() || ""] || "#8A8A8A"; }

function useWishlist() {
  const [items, setItems] = useState<Map<string, any>>(new Map());
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const j = await apiFetch("/fortnite/wishlist");
    if (j.ok) {
      const m = new Map<string, any>();
      for (const i of j.items || []) m.set(i.cosmeticId, i);
      setItems(m);
    }
    setLoaded(true);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function toggle(cosmeticId: string, meta?: { name?: string; type?: string; rarity?: string; image?: string }) {
    if (items.has(cosmeticId)) {
      setItems(prev => { const n = new Map(prev); n.delete(cosmeticId); return n; });
      await apiFetch(`/fortnite/wishlist/${encodeURIComponent(cosmeticId)}`, { method: "DELETE" });
    } else {
      const item = { cosmeticId, ...meta };
      setItems(prev => new Map(prev).set(cosmeticId, item));
      await apiFetch("/fortnite/wishlist", { method: "POST", body: JSON.stringify(item) });
    }
  }

  return { items, loaded, toggle, reload: load };
}

function WishlistHeart({ cosmeticId, wishlisted, onToggle, size = 16 }: {
  cosmeticId: string; wishlisted: boolean; onToggle: () => void; size?: number;
}) {
  return (
    <button
      onClick={e => { e.stopPropagation(); onToggle(); }}
      title={wishlisted ? "Remove from wishlist" : "Add to wishlist"}
      style={{
        background: "none", border: "none", cursor: "pointer", padding: 2,
        fontSize: size, lineHeight: 1, color: wishlisted ? "#EF4444" : "rgba(148,163,184,.3)",
        transition: "color .15s, transform .15s",
        transform: wishlisted ? "scale(1.1)" : "scale(1)",
      }}
    >
      {wishlisted ? "♥" : "♡"}
    </button>
  );
}

const TABS = [
  { id: "streams" as const,   label: "Streams",   icon: "📺" },
  { id: "lfg" as const,       label: "Find Team", icon: "🎮" },
  { id: "stats" as const,     label: "Stats",     icon: "📊" },
  { id: "ranked" as const,    label: "Ranked",    icon: "🏆" },
  { id: "shop" as const,      label: "Shop",      icon: "🛒" },
  { id: "cosmetics" as const, label: "Cosmetics", icon: "✨" },
  { id: "news" as const,      label: "News",      icon: "📰" },
];
type TabId = typeof TABS[number]["id"];

const FN_MODES = ["Any", "Solo", "Duo", "Squad", "Zero Build Solo", "Zero Build Duo", "Zero Build Squad", "Ranked", "Creative"];
const FN_RANKS = ["Any", "Bronze", "Silver", "Gold", "Platinum", "Diamond", "Elite", "Champion", "Unreal"];
const FN_REGIONS = ["Any", "NAE", "NAW", "EU", "OCE", "ASIA", "BR", "ME"];
const FN_TAGS = ["casual", "competitive", "chill", "sweaty", "mic-required", "no-mic", "18+", "content-creator"];

function TwitchStreams({ gameName, lobbyId, accentColor }: { gameName: string; lobbyId: string; accentColor: string }) {
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
      const j = await apiFetch(`/twitch/streams?game=${encodeURIComponent(gameName)}&first=20`);
      if (j.ok) setStreams(j.streams || []);
    } catch {}
    setLoading(false);
  }, [gameName]);

  useEffect(() => { load(); const i = setInterval(load, 30000); return () => clearInterval(i); }, [load]);

  const parentHost = typeof window !== "undefined" ? window.location.hostname : "weered.ca";

  if (loading) return <div style={{ padding: 20, textAlign: "center", opacity: 0.4, fontSize: 13 }}>Loading streams...</div>;
  if (streams.length === 0 && !activeStream) return <EmptyState compact title="Nobody streaming right now." hint="Check back, someone usually goes live soon." />;

  return (
    <>
      {activeStream && (
        <div style={{ ...S.card, padding: 0, marginBottom: 12, overflow: "hidden", border: `1px solid ${accentColor}55`, flexShrink: 0 }}>
          <iframe
            src={`https://player.twitch.tv/?channel=${activeStream}&parent=${parentHost}&muted=true`}
            width="100%" height="380" style={{ border: "none", display: "block" }} allowFullScreen
            title={`${activeStream} live stream`}
          />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: `${accentColor}10`, borderTop: `1px solid ${accentColor}35` }}>
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#ef4444", boxShadow: "0 0 8px #ef4444" }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: accentColor }}>{activeStream}</span>
              <span style={{ fontSize: 10, opacity: 0.5, letterSpacing: ".06em", textTransform: "uppercase" }}>Live · Watching in the lobby</span>
            </span>
            <button type="button" onClick={() => setActiveStream(null)} style={{ ...S.btn, fontSize: 11 }}>Close</button>
          </div>
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {streams.map(s => (
          <div key={s.userLogin} onClick={() => setInterceptStream(s)} onKeyDown={onActivate(() => setInterceptStream(s))} tabIndex={0} role="button" style={{ ...S.card, cursor: "pointer", display: "flex", gap: 10, alignItems: "center", transition: "border-color .12s" }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = `${accentColor}44`)}
            onMouseLeave={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,.08)")}
          >
            {s.thumbnailUrl && <img src={s.thumbnailUrl.replace("{width}", "80").replace("{height}", "45")} alt={s.userName + " stream thumbnail"} style={{ width: 80, height: 45, borderRadius: 2, objectFit: "cover", flexShrink: 0, border: "1px solid rgba(255,255,255,.06)" }} />}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.title}</div>
              <div style={{ fontSize: 11, opacity: 0.5, marginTop: 2 }}>{s.userName} · {s.viewerCount?.toLocaleString()} viewers</div>
            </div>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#EF4444", boxShadow: "0 0 6px #EF444488", flexShrink: 0 }} />
          </div>
        ))}
      </div>
      <StreamInterceptModal stream={interceptStream} lobbyId={lobbyId} onClose={() => setInterceptStream(null)} onWatchHere={(s) => { setActiveStream(s.userLogin); setInterceptStream(null); }} />
    </>
  );
}

function LfgBoard({ lobbyId, accent }: { lobbyId: string; accent: string }) {
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [activity, setActivity] = useState("");
  const [description, setDescription] = useState("");
  const [gameMode, setGameMode] = useState("Any");
  const [rankTier, setRankTier] = useState("Any");
  const [region, setRegion] = useState("Any");
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [platform, setPlatform] = useState("crossplay");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);

  function load() {
    apiFetch(`/lfg/${encodeURIComponent(lobbyId)}`)
      .then(j => { if (j.ok) setPosts(j.posts || []); setLoading(false); })
      .catch(() => setLoading(false));
  }
  useEffect(() => { load(); }, [lobbyId]);

  async function create() {
    setCreating(true);
    await apiFetch(`/lfg/${encodeURIComponent(lobbyId)}`, {
      method: "POST",
      body: JSON.stringify({
        activity: activity || `${gameMode !== "Any" ? gameMode : "Fortnite"} LFG`,
        description, maxPlayers, platform,
        gameMode: gameMode !== "Any" ? gameMode : null,
        rankTier: rankTier !== "Any" ? rankTier : null,
        region: region !== "Any" ? region : null,
        tags: selectedTags,
      }),
    });
    setCreating(false);
    setShowForm(false);
    setActivity(""); setDescription("");
    load();
  }

  function toggleTag(tag: string) {
    setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag].slice(0, 4));
  }

  if (loading) return <div style={{ padding: 20, textAlign: "center", opacity: 0.4, fontSize: 13 }}>Loading LFG...</div>;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={S.label}>LOOKING FOR GROUP ({posts.filter(p => p.status === "OPEN").length} open)</div>
        <button style={S.btnPri} onClick={() => setShowForm(!showForm)}>{showForm ? "Cancel" : "+ Post"}</button>
      </div>

      {showForm && (
        <div style={{ ...S.card, marginBottom: 16, display: "flex", flexDirection: "column", gap: 10, border: `1px solid ${accent}33`, borderLeft: `2px solid ${accent}`, background: `${accent}06` }}>
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ flex: 1 }}>
              <div style={S.label}>Mode</div>
              <select style={{ ...S.select, width: "100%" }} value={gameMode} onChange={e => setGameMode(e.target.value)}>
                {FN_MODES.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <div style={S.label}>Rank</div>
              <select style={{ ...S.select, width: "100%" }} value={rankTier} onChange={e => setRankTier(e.target.value)}>
                {FN_RANKS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <div style={S.label}>Region</div>
              <select style={{ ...S.select, width: "100%" }} value={region} onChange={e => setRegion(e.target.value)}>
                {FN_REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ flex: 1 }}>
              <div style={S.label}>Platform</div>
              <select style={{ ...S.select, width: "100%" }} value={platform} onChange={e => setPlatform(e.target.value)}>
                {["crossplay", "pc", "xbox", "psn", "switch", "mobile"].map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div style={{ width: 80 }}>
              <div style={S.label}>Players</div>
              <select style={{ ...S.select, width: "100%" }} value={maxPlayers} onChange={e => setMaxPlayers(Number(e.target.value))}>
                {[2, 3, 4].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          </div>

          <div>
            <div style={S.label}>Tags</div>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {FN_TAGS.map(tag => (
                <button key={tag} onClick={() => toggleTag(tag)} style={{
                  ...S.btn, fontSize: 10, padding: "3px 8px",
                  borderColor: selectedTags.includes(tag) ? `${accent}55` : undefined,
                  background: selectedTags.includes(tag) ? `${accent}18` : undefined,
                  color: selectedTags.includes(tag) ? accent : undefined,
                }}>{tag}</button>
              ))}
            </div>
          </div>

          <input style={S.input} value={description} onChange={e => setDescription(e.target.value)} placeholder="Any extra details..." maxLength={300} />

          <button style={{ ...S.btnPri, padding: "8px 20px", alignSelf: "flex-start" }} onClick={create} disabled={creating}>
            {creating ? "Posting..." : "Post LFG"}
          </button>
        </div>
      )}

      {posts.length === 0 ? (
        <EmptyState compact title="No LFG posts yet." hint="Drop the first one — someone's looking." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {posts.map(p => (
            <div key={p.id} style={{ ...S.card, display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "rgba(243,244,246,.9)" }}>{p.activity || "Looking for team"}</div>
                  <div style={{ fontSize: 11, opacity: 0.5, marginTop: 2 }}>
                    {p.userName} · {p.players?.length || 1}/{p.maxPlayers}
                    {p.platform && p.platform !== "crossplay" ? ` · ${p.platform}` : ""}
                  </div>
                </div>
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 2,
                  background: p.status === "OPEN" ? "rgba(34,197,94,.12)" : "rgba(239,68,68,.12)",
                  color: p.status === "OPEN" ? "#22C55E" : "#EF4444",
                }}>{p.status}</span>
              </div>
              {((p.gameMode || p.rankTier || p.region || (p.tags && p.tags.length > 0))) && (
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  {p.gameMode && <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 2, background: `${accent}15`, color: accent, fontWeight: 700 }}>{p.gameMode}</span>}
                  {p.rankTier && <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 2, background: "rgba(255,215,0,.12)", color: "#FFD700", fontWeight: 700 }}>{p.rankTier}</span>}
                  {p.region && <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 2, background: "rgba(255,255,255,.06)", color: "rgba(148,163,184,.6)", fontWeight: 600 }}>{p.region}</span>}
                  {(p.tags || []).map((t: string) => <span key={t} style={{ fontSize: 9, padding: "2px 6px", borderRadius: 2, background: "rgba(255,255,255,.04)", color: "rgba(148,163,184,.45)", fontWeight: 500 }}>{t}</span>)}
                </div>
              )}
              {p.description && <div style={{ fontSize: 11, color: "rgba(148,163,184,.5)", lineHeight: 1.4 }}>{p.description}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const FEATURED_PLAYERS = ["Bugha", "MrSavage", "Tfue", "Mero", "EpikWhale", "Queasy"];

function StatsLookup({ accent }: { accent: string }) {
  const [query, setQuery] = useState("");
  const [platform, setPlatform] = useState("");
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [preloaded, setPreloaded] = useState(false);

  async function lookup(name?: string) {
    const n = (name || query).trim(); if (!n) return;
    setLoading(true); setError(""); setStats(null);
    if (!name) setPreloaded(false);
    const url = `/fortnite/stats/${encodeURIComponent(n)}${platform ? `?platform=${platform}` : ""}`;
    const j = await apiFetch(url);
    if (j.ok) setStats(j); else if (!name) setError(j.error === "player_not_found" ? "Player not found." : j.error || "Lookup failed");
    setLoading(false);
  }

  useEffect(() => {
    const pick = FEATURED_PLAYERS[Math.floor(Math.random() * FEATURED_PLAYERS.length)];
    setPreloaded(true);
    lookup(pick);
  }, []);

  function StatBox({ label, value }: { label: string; value: string | number }) {
    return (
      <div style={{ flex: "1 1 90px", padding: "10px 12px", borderRadius: 2, border: `1px solid ${accent}20`, background: `${accent}06`, textAlign: "center" }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(148,163,184,.5)", letterSpacing: ".5px", textTransform: "uppercase", marginBottom: 4 }}>{label}</div>
        <div style={{ fontSize: 18, fontWeight: 800, color: "rgba(243,244,246,.95)" }}>{value}</div>
      </div>
    );
  }

  function ModeRow({ label, data }: { label: string; data: any }) {
    if (!data) return null;
    return (
      <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,.04)" }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: accent, width: 50, flexShrink: 0 }}>{label}</span>
        <span style={{ fontSize: 11, color: "rgba(243,244,246,.8)", flex: 1 }}>{data.wins ?? 0} W · {data.kills ?? 0} K · {(data.kd ?? 0).toFixed(2)} K/D · {data.matches ?? 0} games</span>
        <span style={{ fontSize: 10, color: "rgba(148,163,184,.4)" }}>{data.winRate ? `${(data.winRate * 100).toFixed(1)}%` : "—"} WR</span>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input style={{ ...S.input, flex: 1 }} value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === "Enter" && lookup()} placeholder="Epic username" />
        <select value={platform} onChange={e => setPlatform(e.target.value)} style={{ ...S.select, width: 80 }}>
          <option value="">Any</option><option value="epic">Epic</option><option value="psn">PSN</option><option value="xbl">Xbox</option>
        </select>
        <button style={S.btnPri} onClick={() => lookup()} disabled={loading}>{loading ? "..." : "Search"}</button>
      </div>
      {error && <div style={{ color: "#EF4444", fontSize: 12, marginBottom: 12 }}>{error}</div>}
      {stats && (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            {stats.image && <img src={stats.image} alt={(stats.account?.name || "Player") + " avatar"} style={{ width: 64, height: 64, borderRadius: 2, border: `2px solid ${accent}44`, objectFit: "cover" }} />}
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 18, fontWeight: 800, color: "rgba(243,244,246,.95)" }}>{stats.account?.name}</span>
                {preloaded && <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 2, background: `${accent}15`, color: accent, letterSpacing: ".3px" }}>FEATURED</span>}
              </div>
              {stats.battlePass && <div style={{ fontSize: 11, color: "rgba(148,163,184,.5)", marginTop: 2 }}>BP Level {stats.battlePass.level}</div>}
            </div>
          </div>
          {stats.stats?.all && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
              <StatBox label="Wins" value={stats.stats.all.wins ?? 0} />
              <StatBox label="Kills" value={(stats.stats.all.kills ?? 0).toLocaleString()} />
              <StatBox label="K/D" value={(stats.stats.all.kd ?? 0).toFixed(2)} />
              <StatBox label="Win Rate" value={stats.stats.all.winRate ? `${(stats.stats.all.winRate * 100).toFixed(1)}%` : "—"} />
              <StatBox label="Matches" value={(stats.stats.all.matches ?? 0).toLocaleString()} />
            </div>
          )}
          <div style={S.card}>
            <div style={{ ...S.label, marginBottom: 8 }}>BY MODE</div>
            <ModeRow label="Solo" data={stats.stats?.solo} />
            <ModeRow label="Duo" data={stats.stats?.duo} />
            <ModeRow label="Squad" data={stats.stats?.squad} />
            <ModeRow label="LTM" data={stats.stats?.ltm} />
          </div>
        </div>
      )}
    </div>
  );
}

function RankedTab({ accent }: { accent: string }) {
  const [query, setQuery] = useState("");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function lookup(name?: string) {
    const n = (name || query).trim(); if (!n) return;
    setLoading(true); setError(""); setData(null);
    const j = await apiFetch(`/fortnite/stats/${encodeURIComponent(n)}/ranked`);
    if (j.ok) setData(j); else if (!name) setError(j.error || "Lookup failed");
    setLoading(false);
  }

  useEffect(() => {
    const pick = FEATURED_PLAYERS[Math.floor(Math.random() * FEATURED_PLAYERS.length)];
    lookup(pick);
  }, []);

  function CompareRow({ label, lifetime, season }: { label: string; lifetime: any; season: any }) {
    if (!lifetime && !season) return null;
    const lk = lifetime?.kd ?? 0, sk = season?.kd ?? 0;
    const lw = lifetime?.winRate ?? 0, sw = season?.winRate ?? 0;
    const kdDelta = sk - lk;
    const wrDelta = sw - lw;
    return (
      <div style={{ padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,.04)" }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: accent, marginBottom: 6 }}>{label}</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, fontSize: 11 }}>
          <div><span style={{ opacity: 0.4 }}>Stat</span></div>
          <div style={{ textAlign: "center" }}><span style={{ opacity: 0.4 }}>Lifetime</span></div>
          <div style={{ textAlign: "center" }}><span style={{ opacity: 0.4 }}>This Season</span></div>

          <div style={{ color: "rgba(243,244,246,.7)" }}>K/D</div>
          <div style={{ textAlign: "center", fontWeight: 600 }}>{lk.toFixed(2)}</div>
          <div style={{ textAlign: "center", fontWeight: 700, color: kdDelta > 0 ? "#22C55E" : kdDelta < 0 ? "#EF4444" : "rgba(243,244,246,.7)" }}>
            {sk.toFixed(2)} {kdDelta !== 0 && <span style={{ fontSize: 9 }}>{kdDelta > 0 ? "+" : ""}{kdDelta.toFixed(2)}</span>}
          </div>

          <div style={{ color: "rgba(243,244,246,.7)" }}>Win %</div>
          <div style={{ textAlign: "center", fontWeight: 600 }}>{(lw * 100).toFixed(1)}%</div>
          <div style={{ textAlign: "center", fontWeight: 700, color: wrDelta > 0 ? "#22C55E" : wrDelta < 0 ? "#EF4444" : "rgba(243,244,246,.7)" }}>
            {(sw * 100).toFixed(1)}% {wrDelta !== 0 && <span style={{ fontSize: 9 }}>{wrDelta > 0 ? "+" : ""}{(wrDelta * 100).toFixed(1)}%</span>}
          </div>

          <div style={{ color: "rgba(243,244,246,.7)" }}>Wins</div>
          <div style={{ textAlign: "center", fontWeight: 600 }}>{(lifetime?.wins ?? 0).toLocaleString()}</div>
          <div style={{ textAlign: "center", fontWeight: 600 }}>{(season?.wins ?? 0).toLocaleString()}</div>

          <div style={{ color: "rgba(243,244,246,.7)" }}>Matches</div>
          <div style={{ textAlign: "center", fontWeight: 600 }}>{(lifetime?.matches ?? 0).toLocaleString()}</div>
          <div style={{ textAlign: "center", fontWeight: 600 }}>{(season?.matches ?? 0).toLocaleString()}</div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input style={{ ...S.input, flex: 1 }} value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === "Enter" && lookup()} placeholder="Epic username" />
        <button style={S.btnPri} onClick={() => lookup()} disabled={loading}>{loading ? "..." : "Compare"}</button>
      </div>
      {error && <div style={{ color: "#EF4444", fontSize: 12, marginBottom: 12 }}>{error}</div>}
      {data && (
        <div>
          <div style={{ fontSize: 16, fontWeight: 800, color: "rgba(243,244,246,.95)", marginBottom: 4 }}>{data.account?.name}</div>
          {data.battlePass && <div style={{ fontSize: 11, color: "rgba(148,163,184,.5)", marginBottom: 16 }}>Battle Pass Level {data.battlePass.level}</div>}
          <div style={S.card}>
            <div style={{ ...S.label, marginBottom: 4 }}>SEASON vs LIFETIME</div>
            <CompareRow label="Overall" lifetime={data.lifetime?.overall} season={data.season?.overall} />
            <CompareRow label="Solo" lifetime={data.lifetime?.solo} season={data.season?.solo} />
            <CompareRow label="Duo" lifetime={data.lifetime?.duo} season={data.season?.duo} />
            <CompareRow label="Squad" lifetime={data.lifetime?.squad} season={data.season?.squad} />
          </div>
        </div>
      )}
    </div>
  );
}

function ItemShop({ accent, wishlist }: { accent: string; wishlist: ReturnType<typeof useWishlist> }) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    apiFetch("/fortnite/shop").then(j => { if (j.ok) setItems(j.sections || []); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ padding: 20, textAlign: "center", opacity: 0.4, fontSize: 13 }}>Loading shop...</div>;

  const filtered = filter ? items.filter(i => i.type?.toLowerCase().includes(filter)) : items;
  const types = [...new Set(items.map(i => i.type).filter(Boolean))];

  return (
    <div>
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 12 }}>
        <button onClick={() => setFilter("")} style={{ ...S.btn, fontSize: 10, padding: "3px 10px", borderColor: !filter ? `${accent}55` : undefined, background: !filter ? `${accent}18` : undefined, color: !filter ? accent : undefined }}>All ({items.length})</button>
        {types.map(t => (
          <button key={t} onClick={() => setFilter(filter === t.toLowerCase() ? "" : t.toLowerCase())} style={{ ...S.btn, fontSize: 10, padding: "3px 10px", borderColor: filter === t.toLowerCase() ? `${accent}55` : undefined, background: filter === t.toLowerCase() ? `${accent}18` : undefined, color: filter === t.toLowerCase() ? accent : undefined }}>{t}</button>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 8 }}>
        {filtered.map((item, i) => {
          const rc = rarityColor(item.rarityColor);
          const wishlisted = wishlist.items.has(item.id);
          return (
            <div key={item.id + i} style={{ borderRadius: 2, overflow: "hidden", border: `1px solid ${rc}33`, background: `linear-gradient(180deg, ${rc}12 0%, rgba(0,0,0,0.2) 100%)`, position: "relative" }}>
              <div style={{ position: "absolute", top: 6, right: 6, zIndex: 2 }}>
                <WishlistHeart cosmeticId={item.id} wishlisted={wishlisted} onToggle={() => wishlist.toggle(item.id, { name: item.name, type: item.type, rarity: item.rarity, image: item.image })} />
              </div>
              <div style={{ position: "relative", paddingTop: "100%", background: `${rc}08` }}>
                {item.image && <img src={item.image} alt={item.name} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain", padding: 8 }} />}
                {item.banner && <span style={{ position: "absolute", top: 6, left: 6, fontSize: 8, fontWeight: 800, letterSpacing: ".5px", padding: "2px 6px", borderRadius: 3, background: rc, color: "#fff", textTransform: "uppercase" }}>{item.banner}</span>}
              </div>
              <div style={{ padding: "8px 10px" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(243,244,246,.92)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
                  <span style={{ fontSize: 10, color: "rgba(148,163,184,.5)" }}>{item.rarity}</span>
                  <span style={{ fontSize: 11, fontWeight: 800, color: "#FFD700" }}>{item.price?.toLocaleString()} V</span>
                </div>
                {item.shopHistory > 0 && <div style={{ fontSize: 9, color: "rgba(148,163,184,.35)", marginTop: 3 }}>Seen {item.shopHistory}x in shop</div>}
              </div>
            </div>
          );
        })}
      </div>
      {filtered.length === 0 && <EmptyState compact title="Nothing in this category." />}
    </div>
  );
}

function FnNews() {
  const [news, setNews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { apiFetch("/fortnite/news").then(j => { if (j.ok) setNews(j.news || []); setLoading(false); }).catch(() => setLoading(false)); }, []);

  if (loading) return <div style={{ padding: 20, textAlign: "center", opacity: 0.4, fontSize: 13 }}>Loading news...</div>;
  if (news.length === 0) return <EmptyState compact title="No news right now." />;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {news.map(n => (
        <div key={n.id} style={{ borderRadius: 2, overflow: "hidden", border: "1px solid rgba(255,255,255,.08)", background: "rgba(255,255,255,.02)" }}>
          {(n.image || n.tileImage) && <div style={{ height: 140, background: `url(${n.image || n.tileImage}) center/cover no-repeat`, borderBottom: "1px solid rgba(255,255,255,.06)" }} />}
          <div style={{ padding: "12px 14px" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "rgba(243,244,246,.95)", lineHeight: 1.3 }}>{n.title}</div>
            {n.body && <div style={{ fontSize: 12, color: "rgba(148,163,184,.6)", marginTop: 6, lineHeight: 1.5 }}>{n.body}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}

function CosmeticSearch({ accent, wishlist }: { accent: string; wishlist: ReturnType<typeof useWishlist> }) {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [showingNew, setShowingNew] = useState(true);

  useEffect(() => {
    setLoading(true);
    apiFetch("/fortnite/cosmetics/new").then(j => {
      if (j.ok && j.items?.length) setItems(j.items);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  async function search() {
    if (query.trim().length < 2) return;
    setLoading(true); setSearched(true); setShowingNew(false);
    const j = await apiFetch(`/fortnite/cosmetics/search?query=${encodeURIComponent(query.trim())}`);
    if (j.ok) setItems(j.items || []);
    setLoading(false);
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <input style={{ ...S.input, flex: 1 }} value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === "Enter" && search()} placeholder="Search skins, pickaxes, gliders..." />
        <button style={S.btnPri} onClick={search} disabled={loading}>{loading ? "..." : "Search"}</button>
      </div>

      {showingNew && items.length > 0 && !loading && (
        <div style={{ ...S.label, marginBottom: 10 }}>NEWEST COSMETICS</div>
      )}

      {loading && items.length === 0 && <LoadingState compact label="Loading items" />}
      {!loading && searched && !showingNew && items.length === 0 && <EmptyState compact title="No results." />}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 8 }}>
        {items.map(item => {
          const rc = rarityColor(item.rarityColor);
          const wishlisted = wishlist.items.has(item.id);
          return (
            <div key={item.id} style={{ borderRadius: 2, overflow: "hidden", border: `1px solid ${rc}33`, background: `linear-gradient(180deg, ${rc}12 0%, rgba(0,0,0,0.2) 100%)`, position: "relative" }}>
              <div style={{ position: "absolute", top: 6, right: 6, zIndex: 2 }}>
                <WishlistHeart cosmeticId={item.id} wishlisted={wishlisted} onToggle={() => wishlist.toggle(item.id, { name: item.name, type: item.type, rarity: item.rarity, image: item.image })} />
              </div>
              <div style={{ position: "relative", paddingTop: "100%", background: `${rc}08` }}>
                {item.image && <img src={item.image} alt={item.name} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain", padding: 8 }} />}
              </div>
              <div style={{ padding: "8px 10px" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(243,244,246,.92)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</div>
                <div style={{ fontSize: 10, color: "rgba(148,163,184,.5)", marginTop: 2 }}>{item.type} · {item.rarity}</div>
                {item.set && <div style={{ fontSize: 9, color: "rgba(148,163,184,.35)", marginTop: 2 }}>Set: {item.set}</div>}
                {item.shopHistory > 0 && <div style={{ fontSize: 9, color: "rgba(148,163,184,.35)", marginTop: 2 }}>Shop: {item.shopHistory}x{item.lastSeen ? ` · Last: ${new Date(item.lastSeen).toLocaleDateString()}` : ""}</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function FortniteModulesPanel({
  lobbyId,
  gameName = "Fortnite",
  accentColor = ACCENT_FN,
  style,
}: {
  lobbyId: string;
  gameName?: string;
  accentColor?: string;
  style?: React.CSSProperties;
}) {
  const [tab, setTab] = useState<TabId>("streams");
  useWatchHere(useCallback(() => { setTab("streams"); }, []));
  const wishlist = useWishlist();

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0, ...style }}>
      <ModuleTabBar
        tabs={TABS.map(t => ({
          id: t.id,
          label: t.id === "shop" && wishlist.items.size > 0 ? `${t.label} ♥${wishlist.items.size}` : t.label,
          icon: t.icon,
        }))}
        active={tab}
        onSelect={(id) => setTab(id as TabId)}
        accent={accentColor}
      />

      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "14px 14px 14px", display: "flex", flexDirection: "column" }}>
        {tab === "streams"   && <TwitchStreams gameName={gameName} lobbyId={lobbyId} accentColor={accentColor} />}
        {tab === "lfg"       && <LfgBoard lobbyId={lobbyId} accent={accentColor} />}
        {tab === "stats"     && <StatsLookup accent={accentColor} />}
        {tab === "ranked"    && <RankedTab accent={accentColor} />}
        {tab === "shop"      && <ItemShop accent={accentColor} wishlist={wishlist} />}
        {tab === "cosmetics" && <CosmeticSearch accent={accentColor} wishlist={wishlist} />}
        {tab === "news"      && <FnNews />}
      </div>

      <div style={{ padding: "6px 14px 8px", flexShrink: 0, borderTop: "1px solid rgba(255,255,255,.04)" }}>
        <p style={{ fontSize: 9, color: "rgba(100,116,139,.35)", lineHeight: 1.4, margin: 0, textAlign: "center" }}>
          Weered is not affiliated with, endorsed by, or sponsored by Epic Games, Inc. Fortnite and all related logos and trademarks are the property of Epic Games, Inc.
        </p>
      </div>
    </div>
  );
}

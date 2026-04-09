"use client";

import React, { useCallback, useEffect, useState } from "react";
import StreamInterceptModal, { type StreamInfo } from "./StreamInterceptModal";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";

function authHeaders() {
  try { const t = localStorage.getItem("weered_token") || ""; return t ? { Authorization: `Bearer ${t}` } : {}; } catch { return {}; }
}

async function apiFetch(path: string, opts?: RequestInit) {
  const r = await fetch(`${API}${path}`, { ...opts, headers: { "Content-Type": "application/json", ...authHeaders(), ...(opts?.headers || {}) } });
  return r.json();
}

// ── Style ────────────────────────────────────────────────────────────────────

const S = {
  card: { borderRadius: 10, border: "1px solid rgba(255,255,255,.08)", background: "rgba(255,255,255,.03)", padding: "10px 12px" } as React.CSSProperties,
  btn: { padding: "6px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,.10)", background: "rgba(255,255,255,.05)", fontSize: 12, cursor: "pointer", color: "rgba(243,244,246,.88)" } as React.CSSProperties,
  btnPri: { padding: "6px 12px", borderRadius: 8, border: "1px solid rgba(80,200,255,.35)", background: "rgba(80,200,255,.12)", fontSize: 12, cursor: "pointer", color: "rgb(80,200,255)", fontWeight: 600 } as React.CSSProperties,
  input: { width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,.10)", background: "rgba(0,0,0,.30)", fontSize: 13, color: "rgba(243,244,246,.92)", outline: "none", boxSizing: "border-box" as const },
  label: { fontSize: 10, fontWeight: 700, opacity: 0.45, letterSpacing: ".7px", textTransform: "uppercase" as const, marginBottom: 6 } as React.CSSProperties,
};

const ACCENT_FN = "#00D4FF";

// ── Rarity Colors ────────────────────────────────────────────────────────────

const RARITY_COLORS: Record<string, string> = {
  legendary: "#FF8C00",
  epic: "#B15BFF",
  rare: "#00AAFF",
  uncommon: "#30B030",
  common: "#8A8A8A",
  marvel: "#C0392B",
  dc: "#1E90FF",
  icon: "#00CCCC",
  gaming: "#117DFF",
  dark: "#FF00FF",
  frozen: "#ACE5FF",
  lava: "#FF4500",
  shadow: "#5E35B1",
  slurp: "#00DDAA",
  star: "#E57C00",
};

function rarityColor(rarity?: string): string {
  if (!rarity) return "#8A8A8A";
  return RARITY_COLORS[rarity.toLowerCase()] || "#8A8A8A";
}

// ── Tabs ─────────────────────────────────────────────────────────────────────

const TABS = [
  { id: "streams" as const, label: "Streams", icon: "📺" },
  { id: "lfg" as const,     label: "Find Team", icon: "🎮" },
  { id: "stats" as const,   label: "Stats", icon: "📊" },
  { id: "shop" as const,    label: "Item Shop", icon: "🛒" },
  { id: "news" as const,    label: "News", icon: "📰" },
  { id: "cosmetics" as const, label: "Cosmetics", icon: "✨" },
];
type TabId = typeof TABS[number]["id"];

// ── Twitch Streams (shared pattern) ─────────────────────────────────────────

function TwitchStreams({ gameName, lobbyId, accentColor }: { gameName: string; lobbyId: string; accentColor: string }) {
  const [streams, setStreams] = useState<StreamInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [interceptStream, setInterceptStream] = useState<StreamInfo | null>(null);

  const load = useCallback(async () => {
    try {
      const j = await apiFetch(`/twitch/streams?game=${encodeURIComponent(gameName)}&first=20`);
      if (j.ok) setStreams(j.streams || []);
    } catch {}
    setLoading(false);
  }, [gameName]);

  useEffect(() => { load(); const i = setInterval(load, 30000); return () => clearInterval(i); }, [load]);

  if (loading) return <div style={{ padding: 20, textAlign: "center", opacity: 0.4, fontSize: 13 }}>Loading streams...</div>;
  if (streams.length === 0) return <div style={{ padding: 20, textAlign: "center", opacity: 0.4, fontSize: 13 }}>No live streams</div>;

  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {streams.map(s => (
          <div
            key={s.userLogin}
            onClick={() => setInterceptStream(s)}
            style={{
              ...S.card, cursor: "pointer", display: "flex", gap: 10, alignItems: "center",
              transition: "border-color .12s",
            }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = `${accentColor}44`)}
            onMouseLeave={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,.08)")}
          >
            {s.thumbnailUrl && (
              <img
                src={s.thumbnailUrl.replace("{width}", "80").replace("{height}", "45")}
                alt="" style={{ width: 80, height: 45, borderRadius: 6, objectFit: "cover", flexShrink: 0, border: "1px solid rgba(255,255,255,.06)" }}
              />
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.title}</div>
              <div style={{ fontSize: 11, opacity: 0.5, marginTop: 2 }}>{s.userName} · {s.viewerCount?.toLocaleString()} viewers</div>
            </div>
            <div style={{
              width: 8, height: 8, borderRadius: "50%", background: "#EF4444",
              boxShadow: "0 0 6px #EF444488", flexShrink: 0,
            }} />
          </div>
        ))}
      </div>
      <StreamInterceptModal stream={interceptStream} lobbyId={lobbyId} onClose={() => setInterceptStream(null)} />
    </>
  );
}

// ── LFG Board (reuse existing) ──────────────────────────────────────────────

function LfgBoard({ lobbyId }: { lobbyId: string }) {
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch(`/lfg/${encodeURIComponent(lobbyId)}`)
      .then(j => { if (j.ok) setPosts(j.posts || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [lobbyId]);

  if (loading) return <div style={{ padding: 20, textAlign: "center", opacity: 0.4, fontSize: 13 }}>Loading LFG...</div>;
  if (posts.length === 0) return <div style={{ padding: 20, textAlign: "center", opacity: 0.4, fontSize: 13 }}>No LFG posts yet. Be the first!</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {posts.map(p => (
        <div key={p.id} style={{ ...S.card, display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 600 }}>{p.title || "Looking for team"}</div>
            <div style={{ fontSize: 11, opacity: 0.5, marginTop: 2 }}>{p.authorName} · {p.gameMode || "Any mode"}</div>
          </div>
          <span style={{
            fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 4,
            background: p.status === "OPEN" ? "rgba(34,197,94,.12)" : "rgba(239,68,68,.12)",
            color: p.status === "OPEN" ? "#22C55E" : "#EF4444",
          }}>{p.status}</span>
        </div>
      ))}
    </div>
  );
}

// ── Stats Lookup ─────────────────────────────────────────────────────────────

function StatsLookup({ accent }: { accent: string }) {
  const [query, setQuery] = useState("");
  const [platform, setPlatform] = useState("");
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function lookup() {
    const name = query.trim();
    if (!name) return;
    setLoading(true); setError(""); setStats(null);
    try {
      let url = `/fortnite/stats/${encodeURIComponent(name)}`;
      if (platform) url += `?platform=${platform}`;
      const j = await apiFetch(url);
      if (j.ok) {
        setStats(j);
      } else {
        setError(j.error === "player_not_found" ? "Player not found. Check the Epic username." : j.error || "Lookup failed");
      }
    } catch {
      setError("Network error");
    }
    setLoading(false);
  }

  function StatBox({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
    return (
      <div style={{
        flex: "1 1 100px", padding: "10px 12px", borderRadius: 8,
        border: `1px solid ${accent}20`, background: `${accent}06`,
        textAlign: "center",
      }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(148,163,184,.5)", letterSpacing: ".5px", textTransform: "uppercase", marginBottom: 4 }}>{label}</div>
        <div style={{ fontSize: 18, fontWeight: 800, color: "rgba(243,244,246,.95)" }}>{value}</div>
        {sub && <div style={{ fontSize: 10, color: "rgba(148,163,184,.4)", marginTop: 2 }}>{sub}</div>}
      </div>
    );
  }

  function ModeRow({ label, data }: { label: string; data: any }) {
    if (!data) return null;
    return (
      <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,.04)" }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: accent, width: 50, flexShrink: 0 }}>{label}</span>
        <span style={{ fontSize: 11, color: "rgba(243,244,246,.8)", flex: 1 }}>
          {data.wins ?? 0} W · {data.kills ?? 0} K · {(data.kd ?? 0).toFixed(2)} K/D · {data.matches ?? 0} games
        </span>
        <span style={{ fontSize: 10, color: "rgba(148,163,184,.4)" }}>
          {data.winRate ? `${(data.winRate * 100).toFixed(1)}%` : "—"} WR
        </span>
      </div>
    );
  }

  return (
    <div>
      {/* Search bar */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input
          style={{ ...S.input, flex: 1 }}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === "Enter" && lookup()}
          placeholder="Epic username"
        />
        <select
          value={platform}
          onChange={e => setPlatform(e.target.value)}
          style={{ ...S.input, width: 90, flex: "none", cursor: "pointer" }}
        >
          <option value="">Any</option>
          <option value="epic">Epic</option>
          <option value="psn">PSN</option>
          <option value="xbl">Xbox</option>
        </select>
        <button style={S.btnPri} onClick={lookup} disabled={loading}>
          {loading ? "..." : "Search"}
        </button>
      </div>

      {error && <div style={{ color: "#EF4444", fontSize: 12, marginBottom: 12 }}>{error}</div>}

      {stats && (
        <div>
          {/* Player header */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            {stats.image && (
              <img src={stats.image} alt="" style={{
                width: 64, height: 64, borderRadius: 10,
                border: `2px solid ${accent}44`, objectFit: "cover",
              }} />
            )}
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: "rgba(243,244,246,.95)" }}>{stats.account?.name}</div>
              {stats.battlePass && (
                <div style={{ fontSize: 11, color: "rgba(148,163,184,.5)", marginTop: 2 }}>
                  Battle Pass Level {stats.battlePass.level}
                </div>
              )}
            </div>
          </div>

          {/* Overall stats */}
          {stats.stats?.all && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
              <StatBox label="Wins" value={stats.stats.all.wins ?? 0} />
              <StatBox label="Kills" value={(stats.stats.all.kills ?? 0).toLocaleString()} />
              <StatBox label="K/D" value={(stats.stats.all.kd ?? 0).toFixed(2)} />
              <StatBox label="Win Rate" value={stats.stats.all.winRate ? `${(stats.stats.all.winRate * 100).toFixed(1)}%` : "—"} />
              <StatBox label="Matches" value={(stats.stats.all.matches ?? 0).toLocaleString()} />
              <StatBox label="Top 10" value={(stats.stats.all.top10 ?? stats.stats.all.top12 ?? 0).toLocaleString()} />
            </div>
          )}

          {/* Mode breakdown */}
          <div style={{ ...S.card }}>
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

// ── Item Shop ────────────────────────────────────────────────────────────────

function ItemShop({ accent }: { accent: string }) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    apiFetch("/fortnite/shop")
      .then(j => { if (j.ok) setItems(j.sections || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ padding: 20, textAlign: "center", opacity: 0.4, fontSize: 13 }}>Loading shop...</div>;

  const filtered = filter
    ? items.filter(i => i.type?.toLowerCase().includes(filter))
    : items;

  const types = [...new Set(items.map(i => i.type).filter(Boolean))];

  return (
    <div>
      {/* Type filter */}
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 12 }}>
        <button
          onClick={() => setFilter("")}
          style={{
            ...S.btn, fontSize: 10, padding: "3px 10px",
            borderColor: !filter ? `${accent}55` : undefined,
            background: !filter ? `${accent}18` : undefined,
            color: !filter ? accent : undefined,
          }}
        >All ({items.length})</button>
        {types.map(t => (
          <button
            key={t}
            onClick={() => setFilter(filter === t.toLowerCase() ? "" : t.toLowerCase())}
            style={{
              ...S.btn, fontSize: 10, padding: "3px 10px",
              borderColor: filter === t.toLowerCase() ? `${accent}55` : undefined,
              background: filter === t.toLowerCase() ? `${accent}18` : undefined,
              color: filter === t.toLowerCase() ? accent : undefined,
            }}
          >{t}</button>
        ))}
      </div>

      {/* Shop grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 8 }}>
        {filtered.map((item, i) => {
          const rc = rarityColor(item.rarityColor);
          return (
            <div key={item.id + i} style={{
              borderRadius: 10, overflow: "hidden",
              border: `1px solid ${rc}33`,
              background: `linear-gradient(180deg, ${rc}12 0%, rgba(0,0,0,0.2) 100%)`,
              display: "flex", flexDirection: "column",
            }}>
              <div style={{ position: "relative", paddingTop: "100%", background: `${rc}08` }}>
                {item.image && (
                  <img src={item.image} alt="" style={{
                    position: "absolute", inset: 0, width: "100%", height: "100%",
                    objectFit: "contain", padding: 8,
                  }} />
                )}
                {item.banner && (
                  <span style={{
                    position: "absolute", top: 6, left: 6,
                    fontSize: 8, fontWeight: 800, letterSpacing: ".5px",
                    padding: "2px 6px", borderRadius: 3,
                    background: rc, color: "#fff", textTransform: "uppercase",
                  }}>{item.banner}</span>
                )}
              </div>
              <div style={{ padding: "8px 10px" }}>
                <div style={{
                  fontSize: 11, fontWeight: 700, color: "rgba(243,244,246,.92)",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>{item.name}</div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
                  <span style={{ fontSize: 10, color: "rgba(148,163,184,.5)" }}>{item.rarity}</span>
                  <span style={{ fontSize: 11, fontWeight: 800, color: "#FFD700" }}>
                    {item.price?.toLocaleString()} V
                  </span>
                </div>
                {item.shopHistory > 0 && (
                  <div style={{ fontSize: 9, color: "rgba(148,163,184,.35)", marginTop: 3 }}>
                    Seen {item.shopHistory}x in shop
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div style={{ padding: "20px 0", textAlign: "center", opacity: 0.4, fontSize: 12 }}>No items in this category</div>
      )}
    </div>
  );
}

// ── News ─────────────────────────────────────────────────────────────────────

function FnNews({ accent }: { accent: string }) {
  const [news, setNews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch("/fortnite/news")
      .then(j => { if (j.ok) setNews(j.news || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ padding: 20, textAlign: "center", opacity: 0.4, fontSize: 13 }}>Loading news...</div>;
  if (news.length === 0) return <div style={{ padding: 20, textAlign: "center", opacity: 0.4, fontSize: 13 }}>No news available</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {news.map(n => (
        <div key={n.id} style={{
          borderRadius: 12, overflow: "hidden",
          border: "1px solid rgba(255,255,255,.08)",
          background: "rgba(255,255,255,.02)",
        }}>
          {(n.image || n.tileImage) && (
            <div style={{
              height: 140, background: `url(${n.image || n.tileImage}) center/cover no-repeat`,
              borderBottom: "1px solid rgba(255,255,255,.06)",
            }} />
          )}
          <div style={{ padding: "12px 14px" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "rgba(243,244,246,.95)", lineHeight: 1.3 }}>{n.title}</div>
            {n.body && (
              <div style={{ fontSize: 12, color: "rgba(148,163,184,.6)", marginTop: 6, lineHeight: 1.5 }}>{n.body}</div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Cosmetic Search ──────────────────────────────────────────────────────────

function CosmeticSearch({ accent }: { accent: string }) {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  async function search() {
    const q = query.trim();
    if (q.length < 2) return;
    setLoading(true); setSearched(true);
    const j = await apiFetch(`/fortnite/cosmetics/search?query=${encodeURIComponent(q)}`);
    if (j.ok) setItems(j.items || []);
    setLoading(false);
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input
          style={{ ...S.input, flex: 1 }}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === "Enter" && search()}
          placeholder="Search skins, pickaxes, gliders..."
        />
        <button style={S.btnPri} onClick={search} disabled={loading}>
          {loading ? "..." : "Search"}
        </button>
      </div>

      {loading && <div style={{ padding: 20, textAlign: "center", opacity: 0.4, fontSize: 13 }}>Searching...</div>}

      {!loading && searched && items.length === 0 && (
        <div style={{ padding: 20, textAlign: "center", opacity: 0.4, fontSize: 12 }}>No results found</div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 8 }}>
        {items.map(item => {
          const rc = rarityColor(item.rarityColor);
          return (
            <div key={item.id} style={{
              borderRadius: 10, overflow: "hidden",
              border: `1px solid ${rc}33`,
              background: `linear-gradient(180deg, ${rc}12 0%, rgba(0,0,0,0.2) 100%)`,
            }}>
              <div style={{ position: "relative", paddingTop: "100%", background: `${rc}08` }}>
                {item.image && (
                  <img src={item.image} alt="" style={{
                    position: "absolute", inset: 0, width: "100%", height: "100%",
                    objectFit: "contain", padding: 8,
                  }} />
                )}
              </div>
              <div style={{ padding: "8px 10px" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(243,244,246,.92)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</div>
                <div style={{ fontSize: 10, color: "rgba(148,163,184,.5)", marginTop: 2 }}>{item.type} · {item.rarity}</div>
                {item.set && <div style={{ fontSize: 9, color: "rgba(148,163,184,.35)", marginTop: 2 }}>Set: {item.set}</div>}
                {item.shopHistory > 0 && (
                  <div style={{ fontSize: 9, color: "rgba(148,163,184,.35)", marginTop: 2 }}>
                    Shop: {item.shopHistory}x{item.lastSeen ? ` · Last: ${new Date(item.lastSeen).toLocaleDateString()}` : ""}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PANEL
// ═══════════════════════════════════════════════════════════════════════════════

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

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0, ...style }}>
      {/* Tabs */}
      <div style={{ display: "flex", gap: 2, padding: "8px 12px 0", borderBottom: "1px solid rgba(255,255,255,.07)", flexShrink: 0, overflowX: "auto" }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: "7px 12px", borderRadius: "8px 8px 0 0", border: "none",
              background: tab === t.id ? `${accentColor}20` : "transparent",
              color: tab === t.id ? "rgba(243,244,246,.92)" : "rgba(148,163,184,.65)",
              fontWeight: tab === t.id ? 700 : 400, fontSize: 12, cursor: "pointer",
              transition: "background .1s, color .1s",
              display: "flex", alignItems: "center", gap: 5, whiteSpace: "nowrap",
            }}
          >
            <span style={{ fontSize: 13 }}>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "14px 14px 14px", display: "flex", flexDirection: "column" }}>
        {tab === "streams"   && <TwitchStreams gameName={gameName} lobbyId={lobbyId} accentColor={accentColor} />}
        {tab === "lfg"       && <LfgBoard lobbyId={lobbyId} />}
        {tab === "stats"     && <StatsLookup accent={accentColor} />}
        {tab === "shop"      && <ItemShop accent={accentColor} />}
        {tab === "news"      && <FnNews accent={accentColor} />}
        {tab === "cosmetics" && <CosmeticSearch accent={accentColor} />}
      </div>

      {/* Epic Games legal disclaimer */}
      <div style={{ padding: "6px 14px 8px", flexShrink: 0, borderTop: "1px solid rgba(255,255,255,.04)" }}>
        <p style={{ fontSize: 9, color: "rgba(100,116,139,.35)", lineHeight: 1.4, margin: 0, textAlign: "center" }}>
          Weered is not affiliated with, endorsed by, or sponsored by Epic Games, Inc. Fortnite and all related logos and trademarks are the property of Epic Games, Inc.
        </p>
      </div>
    </div>
  );
}

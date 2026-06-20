"use client";

import React, { useCallback, useEffect, useState } from "react";
import StreamInterceptModal, { type StreamInfo } from "./StreamInterceptModal";
import EmptyState from "./EmptyState";
import ModuleTabBar from "./ModuleTabBar";
import { useWatchHere, consumePendingStream } from "../lib/useWatchHere";
import { onActivate } from "@/lib/a11y";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";

function authHeaders(): Record<string, string> {
  try {
    const t = localStorage.getItem("weered_token") || "";
    return t ? { Authorization: `Bearer ${t}` } : {};
  } catch {
    return {};
  }
}

async function apiFetch(path: string, opts?: RequestInit) {
  const r = await fetch(`${API}${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", ...authHeaders(), ...(opts?.headers || {}) },
  });
  return r.json();
}

const S = {
  card: {
    borderRadius: 2,
    border: "1px solid rgba(255,255,255,.08)",
    background: "rgba(255,255,255,.03)",
    padding: "10px 12px",
  } as React.CSSProperties,
  btn: {
    padding: "6px 12px",
    borderRadius: 2,
    border: "1px solid rgba(255,255,255,.10)",
    background: "rgba(255,255,255,.05)",
    fontSize: 12,
    cursor: "pointer",
    color: "rgba(243,244,246,.88)",
  } as React.CSSProperties,
  btnPri: {
    padding: "6px 12px",
    borderRadius: 2,
    border: "1px solid rgba(255,170,0,.35)",
    background: "rgba(255,170,0,.12)",
    fontSize: 12,
    cursor: "pointer",
    color: "rgb(255,170,0)",
    fontWeight: 600,
  } as React.CSSProperties,
  input: {
    width: "100%",
    padding: "8px 12px",
    borderRadius: 2,
    border: "1px solid rgba(255,255,255,.10)",
    background: "rgba(0,0,0,.30)",
    fontSize: 13,
    color: "rgba(243,244,246,.92)",
    outline: "none",
    boxSizing: "border-box" as const,
  },
  select: {
    padding: "8px 12px",
    borderRadius: 2,
    border: "1px solid rgba(255,255,255,.10)",
    background: "rgba(0,0,0,.30)",
    fontSize: 12,
    color: "rgba(243,244,246,.92)",
    outline: "none",
    cursor: "pointer",
  } as React.CSSProperties,
  label: {
    fontSize: 10,
    fontWeight: 700,
    opacity: 0.45,
    letterSpacing: ".7px",
    textTransform: "uppercase" as const,
    marginBottom: 6,
  } as React.CSSProperties,
};

const ACCENT_PUBG = "#FFAA00";

const MAP_NAMES: Record<string, string> = {
  Baltic_Main: "Erangel",
  Desert_Main: "Miramar",
  Savage_Main: "Sanhok",
  DihorOtok_Main: "Vikendi",
  Tiger_Main: "Taego",
  Chimera_Main: "Deston",
  Kiki_Main: "Deston",
  Heaven_Main: "Haven",
  Summerland_Main: "Karakin",
  Range_Main: "Camp Jackal",
  Neon_Main: "Rondo",
};
function mapName(raw?: string): string {
  return MAP_NAMES[raw || ""] || raw || "Unknown";
}

function modeName(raw: string): string {
  const m: Record<string, string> = {
    solo: "Solo TPP",
    "solo-fpp": "Solo FPP",
    duo: "Duo TPP",
    "duo-fpp": "Duo FPP",
    squad: "Squad TPP",
    "squad-fpp": "Squad FPP",
  };
  return m[raw] || raw;
}

const TABS = [
  { id: "streams" as const, label: "Streams", icon: "📺" },
  { id: "lfg" as const, label: "Find Team", icon: "🎮" },
  { id: "stats" as const, label: "Stats", icon: "📊" },
  { id: "weapons" as const, label: "Weapons", icon: "🔫" },
  { id: "matches" as const, label: "Matches", icon: "🗺️" },
  { id: "leaderboard" as const, label: "Leaderboard", icon: "🏆" },
];
type TabId = (typeof TABS)[number]["id"];

const PUBG_MODES = [
  "Any",
  "Solo FPP",
  "Solo TPP",
  "Duo FPP",
  "Duo TPP",
  "Squad FPP",
  "Squad TPP",
  "Ranked",
];
const PUBG_RANKS = ["Any", "Bronze", "Silver", "Gold", "Platinum", "Diamond", "Master"];
const PUBG_REGIONS = ["Any", "NA", "EU", "AS", "OC", "SA", "SEA", "JP", "KR"];
const PUBG_TAGS = [
  "casual",
  "competitive",
  "chill",
  "sweaty",
  "mic-required",
  "no-mic",
  "18+",
  "ranked-grind",
];

function TwitchStreams({
  gameName,
  lobbyId,
  accentColor,
}: {
  gameName: string;
  lobbyId: string;
  accentColor: string;
}) {
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

  useEffect(() => {
    load();
    const i = setInterval(load, 30000);
    return () => clearInterval(i);
  }, [load]);

  const parentHost = typeof window !== "undefined" ? window.location.hostname : "weered.ca";

  if (loading)
    return (
      <div style={{ padding: 20, textAlign: "center", opacity: 0.4, fontSize: 13 }}>
        Loading streams...
      </div>
    );
  if (streams.length === 0 && !activeStream)
    return <EmptyState compact title="Nobody streaming right now." />;

  return (
    <>
      {activeStream && (
        <div
          style={{
            ...S.card,
            padding: 0,
            marginBottom: 12,
            overflow: "hidden",
            border: `1px solid ${accentColor}55`,
            borderLeft: `2px solid ${accentColor}`,
            flexShrink: 0,
          }}
        >
          <iframe
            src={`https://player.twitch.tv/?channel=${activeStream}&parent=${parentHost}&muted=true`}
            width="100%"
            height="380"
            style={{ border: "none", display: "block" }}
            allowFullScreen
            title={`${activeStream} live stream`}
          />
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "10px 14px",
              background: `${accentColor}10`,
              borderTop: `1px solid ${accentColor}35`,
            }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: "#ef4444",
                  boxShadow: "0 0 8px #ef4444",
                }}
              />
              <span style={{ fontSize: 13, fontWeight: 700, color: accentColor }}>
                {activeStream}
              </span>
              <span
                style={{
                  fontSize: 10,
                  opacity: 0.5,
                  letterSpacing: ".06em",
                  textTransform: "uppercase",
                }}
              >
                Live · Watching in the lobby
              </span>
            </span>
            <button
              type="button"
              onClick={() => setActiveStream(null)}
              style={{ ...S.btn, fontSize: 11 }}
            >
              Close
            </button>
          </div>
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {streams.map((s) => (
          <div
            key={s.userLogin}
            onClick={() => setInterceptStream(s)}
            onKeyDown={onActivate(() => {
              setInterceptStream(s);
            })}
            tabIndex={0}
            role="button"
            style={{
              ...S.card,
              cursor: "pointer",
              display: "flex",
              gap: 10,
              alignItems: "center",
              transition: "border-color .12s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = `${accentColor}44`)}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,.08)")}
          >
            {s.thumbnailUrl && (
              <img
                src={s.thumbnailUrl.replace("{width}", "80").replace("{height}", "45")}
                alt={s.userName + " stream thumbnail"}
                style={{
                  width: 80,
                  height: 45,
                  borderRadius: 2,
                  objectFit: "cover",
                  flexShrink: 0,
                  border: "1px solid rgba(255,255,255,.06)",
                }}
              />
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {s.title}
              </div>
              <div style={{ fontSize: 11, opacity: 0.5, marginTop: 2 }}>
                {s.userName} · {s.viewerCount?.toLocaleString()} viewers
              </div>
            </div>
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "#EF4444",
                boxShadow: "0 0 6px #EF444488",
                flexShrink: 0,
              }}
            />
          </div>
        ))}
      </div>
      <StreamInterceptModal
        stream={interceptStream}
        lobbyId={lobbyId}
        onClose={() => setInterceptStream(null)}
        onWatchHere={(s) => {
          setActiveStream(s.userLogin);
          setInterceptStream(null);
        }}
      />
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
      .then((j) => {
        if (j.ok) setPosts(j.posts || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }
  useEffect(() => {
    load();
  }, [lobbyId]);

  async function create() {
    setCreating(true);
    await apiFetch(`/lfg/${encodeURIComponent(lobbyId)}`, {
      method: "POST",
      body: JSON.stringify({
        activity: activity || `${gameMode !== "Any" ? gameMode : "PUBG"} LFG`,
        description,
        maxPlayers,
        platform,
        gameMode: gameMode !== "Any" ? gameMode : null,
        rankTier: rankTier !== "Any" ? rankTier : null,
        region: region !== "Any" ? region : null,
        tags: selectedTags,
      }),
    });
    setCreating(false);
    setShowForm(false);
    setActivity("");
    setDescription("");
    load();
  }

  function toggleTag(tag: string) {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag].slice(0, 4),
    );
  }

  if (loading)
    return (
      <div style={{ padding: 20, textAlign: "center", opacity: 0.4, fontSize: 13 }}>
        Loading LFG...
      </div>
    );

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <div style={S.label}>
          LOOKING FOR GROUP ({posts.filter((p) => p.status === "OPEN").length} open)
        </div>
        <button style={S.btnPri} onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancel" : "+ Post"}
        </button>
      </div>

      {showForm && (
        <div
          style={{
            ...S.card,
            marginBottom: 16,
            display: "flex",
            flexDirection: "column",
            gap: 10,
            border: `1px solid ${accent}33`,
            background: `${accent}06`,
          }}
        >
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ flex: 1 }}>
              <div style={S.label}>Mode</div>
              <select
                style={{ ...S.select, width: "100%" }}
                value={gameMode}
                onChange={(e) => setGameMode(e.target.value)}
              >
                {PUBG_MODES.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <div style={S.label}>Rank</div>
              <select
                style={{ ...S.select, width: "100%" }}
                value={rankTier}
                onChange={(e) => setRankTier(e.target.value)}
              >
                {PUBG_RANKS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <div style={S.label}>Region</div>
              <select
                style={{ ...S.select, width: "100%" }}
                value={region}
                onChange={(e) => setRegion(e.target.value)}
              >
                {PUBG_REGIONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ flex: 1 }}>
              <div style={S.label}>Platform</div>
              <select
                style={{ ...S.select, width: "100%" }}
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
              >
                {["crossplay", "pc", "xbox", "psn"].map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ width: 80 }}>
              <div style={S.label}>Players</div>
              <select
                style={{ ...S.select, width: "100%" }}
                value={maxPlayers}
                onChange={(e) => setMaxPlayers(Number(e.target.value))}
              >
                {[2, 3, 4].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <div style={S.label}>Tags</div>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {PUBG_TAGS.map((tag) => (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  style={{
                    ...S.btn,
                    fontSize: 10,
                    padding: "3px 8px",
                    borderColor: selectedTags.includes(tag) ? `${accent}55` : undefined,
                    background: selectedTags.includes(tag) ? `${accent}18` : undefined,
                    color: selectedTags.includes(tag) ? accent : undefined,
                  }}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          <input
            style={S.input}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Any extra details..."
            maxLength={300}
          />

          <button
            style={{ ...S.btnPri, padding: "8px 20px", alignSelf: "flex-start" }}
            onClick={create}
            disabled={creating}
          >
            {creating ? "Posting..." : "Post LFG"}
          </button>
        </div>
      )}

      {posts.length === 0 ? (
        <EmptyState compact title="No LFG posts yet." hint="Drop the first one." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {posts.map((p) => (
            <div key={p.id} style={{ ...S.card, display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "rgba(243,244,246,.9)" }}>
                    {p.activity || "Looking for team"}
                  </div>
                  <div style={{ fontSize: 11, opacity: 0.5, marginTop: 2 }}>
                    {p.userName} · {p.players?.length || 1}/{p.maxPlayers}
                    {p.platform && p.platform !== "crossplay" ? ` · ${p.platform}` : ""}
                  </div>
                </div>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    padding: "2px 8px",
                    borderRadius: 2,
                    background: p.status === "OPEN" ? "rgba(34,197,94,.12)" : "rgba(239,68,68,.12)",
                    color: p.status === "OPEN" ? "#22C55E" : "#EF4444",
                  }}
                >
                  {p.status}
                </span>
              </div>
              {(p.gameMode || p.rankTier || p.region || (p.tags && p.tags.length > 0)) && (
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  {p.gameMode && (
                    <span
                      style={{
                        fontSize: 9,
                        padding: "2px 6px",
                        borderRadius: 2,
                        background: `${accent}15`,
                        color: accent,
                        fontWeight: 700,
                      }}
                    >
                      {p.gameMode}
                    </span>
                  )}
                  {p.rankTier && (
                    <span
                      style={{
                        fontSize: 9,
                        padding: "2px 6px",
                        borderRadius: 2,
                        background: "rgba(255,215,0,.12)",
                        color: "#FFD700",
                        fontWeight: 700,
                      }}
                    >
                      {p.rankTier}
                    </span>
                  )}
                  {p.region && (
                    <span
                      style={{
                        fontSize: 9,
                        padding: "2px 6px",
                        borderRadius: 2,
                        background: "rgba(255,255,255,.06)",
                        color: "rgba(148,163,184,.6)",
                        fontWeight: 600,
                      }}
                    >
                      {p.region}
                    </span>
                  )}
                  {(p.tags || []).map((t: string) => (
                    <span
                      key={t}
                      style={{
                        fontSize: 9,
                        padding: "2px 6px",
                        borderRadius: 2,
                        background: "rgba(255,255,255,.04)",
                        color: "rgba(148,163,184,.45)",
                        fontWeight: 500,
                      }}
                    >
                      {t}
                    </span>
                  ))}
                </div>
              )}
              {p.description && (
                <div style={{ fontSize: 11, color: "rgba(148,163,184,.5)", lineHeight: 1.4 }}>
                  {p.description}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatsLookup({ accent }: { accent: string }) {
  const [query, setQuery] = useState("");
  const [platform, setPlatform] = useState("steam");
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function lookup(name?: string) {
    const n = (name || query).trim();
    if (!n) return;
    setLoading(true);
    setError("");
    setStats(null);
    const url = `/pubg/stats/${encodeURIComponent(n)}?platform=${platform}`;
    const j = await apiFetch(url);
    if (j.ok) setStats(j);
    else
      setError(j.error === "player_not_found" ? "Player not found." : j.error || "Lookup failed");
    setLoading(false);
  }

  function StatBox({ label, value }: { label: string; value: string | number }) {
    return (
      <div
        style={{
          flex: "1 1 80px",
          padding: "10px 12px",
          borderRadius: 2,
          border: `1px solid ${accent}20`,
          background: `${accent}06`,
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: "rgba(148,163,184,.5)",
            letterSpacing: ".5px",
            textTransform: "uppercase",
            marginBottom: 4,
          }}
        >
          {label}
        </div>
        <div style={{ fontSize: 18, fontWeight: 800, color: "rgba(243,244,246,.95)" }}>{value}</div>
      </div>
    );
  }

  function ModeRow({ label, data }: { label: string; data: any }) {
    if (!data || data.rounds === 0) return null;
    return (
      <div
        style={{
          display: "flex",
          gap: 8,
          alignItems: "center",
          padding: "6px 0",
          borderBottom: "1px solid rgba(255,255,255,.04)",
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 700, color: accent, width: 70, flexShrink: 0 }}>
          {label}
        </span>
        <span style={{ fontSize: 11, color: "rgba(243,244,246,.8)", flex: 1 }}>
          {data.wins}W · {data.kills}K · {data.kd} K/D · {data.avgDmg} ADR · {data.rounds} games
        </span>
        <span style={{ fontSize: 10, color: "rgba(148,163,184,.4)" }}>
          {data.winRate ? `${(data.winRate * 100).toFixed(1)}%` : "—"} WR
        </span>
      </div>
    );
  }

  function totals(statsObj: any) {
    if (!statsObj) return null;
    let wins = 0,
      kills = 0,
      rounds = 0,
      damage = 0,
      top10s = 0;
    for (const mode of Object.values(statsObj) as any[]) {
      if (!mode) continue;
      wins += mode.wins || 0;
      kills += mode.kills || 0;
      rounds += mode.rounds || 0;
      damage += (mode.avgDmg || 0) * (mode.rounds || 0);
      top10s += mode.top10s || 0;
    }
    return {
      wins,
      kills,
      rounds,
      top10s,
      kd: rounds > 0 ? +(kills / Math.max(rounds - wins, 1)).toFixed(2) : 0,
      avgDmg: rounds > 0 ? Math.round(damage / rounds) : 0,
      winRate: rounds > 0 ? +(wins / rounds).toFixed(4) : 0,
    };
  }

  const lt = stats ? totals(stats.stats?.lifetime) : null;

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input
          style={{ ...S.input, flex: 1 }}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && lookup()}
          placeholder="PUBG username"
        />
        <select
          value={platform}
          onChange={(e) => setPlatform(e.target.value)}
          style={{ ...S.select, width: 80 }}
        >
          <option value="steam">Steam</option>
          <option value="xbox">Xbox</option>
          <option value="psn">PSN</option>
        </select>
        <button style={S.btnPri} onClick={() => lookup()} disabled={loading}>
          {loading ? "..." : "Search"}
        </button>
      </div>
      {error && <div style={{ color: "#EF4444", fontSize: 12, marginBottom: 12 }}>{error}</div>}
      {stats && (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 2,
                border: `2px solid ${accent}44`,
                background: `${accent}12`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 22,
                fontWeight: 900,
                color: accent,
              }}
            >
              {(stats.account?.name || "?")[0].toUpperCase()}
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: "rgba(243,244,246,.95)" }}>
                {stats.account?.name}
              </div>
              <div style={{ fontSize: 11, color: "rgba(148,163,184,.5)", marginTop: 2 }}>
                {stats.account?.platform?.toUpperCase()} · {stats.season?.name || "Current Season"}
              </div>
            </div>
          </div>

          {lt && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
              <StatBox label="Wins" value={lt.wins} />
              <StatBox label="Kills" value={lt.kills.toLocaleString()} />
              <StatBox label="K/D" value={lt.kd} />
              <StatBox label="Avg DMG" value={lt.avgDmg} />
              <StatBox label="Top 10s" value={lt.top10s} />
              <StatBox
                label="Win %"
                value={lt.winRate ? `${(lt.winRate * 100).toFixed(1)}%` : "—"}
              />
            </div>
          )}

          <div style={S.card}>
            <div style={{ ...S.label, marginBottom: 8 }}>SEASON STATS</div>
            <ModeRow label="Solo FPP" data={stats.stats?.season?.["solo-fpp"]} />
            <ModeRow label="Solo TPP" data={stats.stats?.season?.solo} />
            <ModeRow label="Duo FPP" data={stats.stats?.season?.["duo-fpp"]} />
            <ModeRow label="Duo TPP" data={stats.stats?.season?.duo} />
            <ModeRow label="Squad FPP" data={stats.stats?.season?.["squad-fpp"]} />
            <ModeRow label="Squad TPP" data={stats.stats?.season?.squad} />
          </div>

          <div style={{ ...S.card, marginTop: 10 }}>
            <div style={{ ...S.label, marginBottom: 8 }}>LIFETIME STATS</div>
            <ModeRow label="Solo FPP" data={stats.stats?.lifetime?.["solo-fpp"]} />
            <ModeRow label="Solo TPP" data={stats.stats?.lifetime?.solo} />
            <ModeRow label="Duo FPP" data={stats.stats?.lifetime?.["duo-fpp"]} />
            <ModeRow label="Duo TPP" data={stats.stats?.lifetime?.duo} />
            <ModeRow label="Squad FPP" data={stats.stats?.lifetime?.["squad-fpp"]} />
            <ModeRow label="Squad TPP" data={stats.stats?.lifetime?.squad} />
          </div>
        </div>
      )}
    </div>
  );
}

function WeaponMastery({ accent }: { accent: string }) {
  const [query, setQuery] = useState("");
  const [platform, setPlatform] = useState("steam");
  const [weapons, setWeapons] = useState<any[]>([]);
  const [playerName, setPlayerName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function lookup(name?: string) {
    const n = (name || query).trim();
    if (!n) return;
    setLoading(true);
    setError("");
    setWeapons([]);
    const j = await apiFetch(`/pubg/stats/${encodeURIComponent(n)}?platform=${platform}`);
    if (j.ok && j.weapons?.length) {
      setWeapons(j.weapons);
      setPlayerName(j.account?.name || n);
    } else {
      setError(j.error === "player_not_found" ? "Player not found." : j.error || "No weapon data");
    }
    setLoading(false);
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input
          style={{ ...S.input, flex: 1 }}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && lookup()}
          placeholder="PUBG username"
        />
        <select
          value={platform}
          onChange={(e) => setPlatform(e.target.value)}
          style={{ ...S.select, width: 80 }}
        >
          <option value="steam">Steam</option>
          <option value="xbox">Xbox</option>
          <option value="psn">PSN</option>
        </select>
        <button style={S.btnPri} onClick={() => lookup()} disabled={loading}>
          {loading ? "..." : "Search"}
        </button>
      </div>
      {error && <div style={{ color: "#EF4444", fontSize: 12, marginBottom: 12 }}>{error}</div>}
      {weapons.length > 0 && (
        <div>
          <div
            style={{
              fontSize: 14,
              fontWeight: 800,
              color: "rgba(243,244,246,.9)",
              marginBottom: 12,
            }}
          >
            {playerName}'s Arsenal
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {weapons.map((w, i) => (
              <div
                key={w.weapon}
                style={{
                  ...S.card,
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  border: i === 0 ? `1px solid ${accent}33` : undefined,
                  background: i === 0 ? `${accent}08` : undefined,
                }}
              >
                <div
                  style={{
                    width: 28,
                    textAlign: "center",
                    fontSize: 14,
                    fontWeight: 900,
                    color: i < 3 ? accent : "rgba(148,163,184,.4)",
                  }}
                >
                  #{i + 1}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: "rgba(243,244,246,.9)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {w.weapon.replace(/_/g, " ")}
                    {w.level > 0 && (
                      <span
                        style={{
                          fontSize: 9,
                          fontWeight: 700,
                          marginLeft: 6,
                          padding: "1px 5px",
                          borderRadius: 3,
                          background: `${accent}15`,
                          color: accent,
                        }}
                      >
                        Lv.{w.level}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 10, color: "rgba(148,163,184,.5)", marginTop: 2 }}>
                    {w.kills} kills · {w.damage.toLocaleString()} dmg · {w.headshots} HS ·{" "}
                    {w.longestKill}m longest
                  </div>
                </div>
                <div style={{ fontSize: 16, fontWeight: 900, color: accent, flexShrink: 0 }}>
                  {w.kills}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function RecentMatches({ accent }: { accent: string }) {
  const [query, setQuery] = useState("");
  const [platform, setPlatform] = useState("steam");
  const [_matchIds, setMatchIds] = useState<string[]>([]);
  const [matches, setMatches] = useState<any[]>([]);
  const [playerName, setPlayerName] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  async function lookup(name?: string) {
    const n = (name || query).trim();
    if (!n) return;
    setLoading(true);
    setError("");
    setMatchIds([]);
    setMatches([]);
    const j = await apiFetch(`/pubg/stats/${encodeURIComponent(n)}?platform=${platform}`);
    if (j.ok && j.recentMatchIds?.length) {
      setMatchIds(j.recentMatchIds);
      setPlayerName(j.account?.name || n);
      setLoadingMatches(true);
      const loaded: any[] = [];
      for (const mid of j.recentMatchIds.slice(0, 5)) {
        const m = await apiFetch(`/pubg/match/${platform}/${mid}`);
        if (m.ok) loaded.push(m);
      }
      setMatches(loaded);
      setLoadingMatches(false);
    } else {
      setError(j.error === "player_not_found" ? "Player not found." : "No recent matches");
    }
    setLoading(false);
  }

  function findPlayer(match: any) {
    for (const team of match.teams || []) {
      for (const m of team.members || []) {
        if (m.name?.toLowerCase() === playerName.toLowerCase()) return { ...m, rank: team.rank };
      }
    }
    return null;
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input
          style={{ ...S.input, flex: 1 }}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && lookup()}
          placeholder="PUBG username"
        />
        <select
          value={platform}
          onChange={(e) => setPlatform(e.target.value)}
          style={{ ...S.select, width: 80 }}
        >
          <option value="steam">Steam</option>
          <option value="xbox">Xbox</option>
          <option value="psn">PSN</option>
        </select>
        <button style={S.btnPri} onClick={() => lookup()} disabled={loading}>
          {loading ? "..." : "Search"}
        </button>
      </div>
      {error && <div style={{ color: "#EF4444", fontSize: 12, marginBottom: 12 }}>{error}</div>}
      {loadingMatches && (
        <div style={{ padding: 20, textAlign: "center", opacity: 0.4, fontSize: 13 }}>
          Loading matches...
        </div>
      )}
      {matches.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {matches.map((m) => {
            const p = findPlayer(m);
            const isWin = p?.rank === 1;
            const isExpanded = expanded === m.match?.id;
            return (
              <div key={m.match?.id}>
                <div
                  onClick={() => setExpanded(isExpanded ? null : m.match?.id)}
                  onKeyDown={onActivate(() => {
                    setExpanded(isExpanded ? null : m.match?.id);
                  })}
                  tabIndex={0}
                  role="button"
                  style={{
                    ...S.card,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    border: isWin ? "1px solid rgba(34,197,94,.25)" : undefined,
                    background: isWin ? "rgba(34,197,94,.06)" : undefined,
                  }}
                >
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 2,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 14,
                      fontWeight: 900,
                      flexShrink: 0,
                      background: isWin
                        ? "rgba(34,197,94,.15)"
                        : p?.rank && p.rank <= 10
                          ? `${accent}15`
                          : "rgba(255,255,255,.04)",
                      color: isWin
                        ? "#22C55E"
                        : p?.rank && p.rank <= 10
                          ? accent
                          : "rgba(148,163,184,.5)",
                      border: `1px solid ${isWin ? "rgba(34,197,94,.3)" : p?.rank && p.rank <= 10 ? `${accent}25` : "rgba(255,255,255,.08)"}`,
                    }}
                  >
                    #{p?.rank || "?"}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "rgba(243,244,246,.9)" }}>
                      {mapName(m.match?.map)} · {modeName(m.match?.mode || "")}
                      {isWin && (
                        <span
                          style={{
                            marginLeft: 6,
                            fontSize: 9,
                            fontWeight: 800,
                            padding: "1px 6px",
                            borderRadius: 3,
                            background: "rgba(34,197,94,.15)",
                            color: "#22C55E",
                          }}
                        >
                          WINNER
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 10, color: "rgba(148,163,184,.5)", marginTop: 2 }}>
                      {p ? `${p.kills} kills · ${p.damage} dmg · ${p.assists} ast` : ""} ·{" "}
                      {m.match?.playerCount} players · {m.match?.duration}min
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: "rgba(148,163,184,.35)", flexShrink: 0 }}>
                    {m.match?.createdAt ? new Date(m.match.createdAt).toLocaleDateString() : ""}
                  </div>
                </div>
                {isExpanded && (
                  <div
                    style={{
                      padding: "8px 12px",
                      background: "rgba(0,0,0,.2)",
                      borderRadius: "0 0 2px 2px",
                      border: "1px solid rgba(255,255,255,.05)",
                      borderTop: "none",
                    }}
                  >
                    <div style={{ ...S.label, marginBottom: 6 }}>TOP TEAMS</div>
                    {(m.teams || []).slice(0, 5).map((t: any, ti: number) => (
                      <div
                        key={ti}
                        style={{
                          padding: "4px 0",
                          borderBottom: "1px solid rgba(255,255,255,.03)",
                          fontSize: 11,
                        }}
                      >
                        <span
                          style={{
                            fontWeight: 700,
                            color: t.rank === 1 ? "#22C55E" : accent,
                            width: 28,
                            display: "inline-block",
                          }}
                        >
                          #{t.rank}
                        </span>
                        {(t.members || []).map((mb: any, mi: number) => (
                          <span
                            key={mi}
                            style={{
                              color:
                                mb.name?.toLowerCase() === playerName.toLowerCase()
                                  ? accent
                                  : "rgba(243,244,246,.7)",
                              fontWeight:
                                mb.name?.toLowerCase() === playerName.toLowerCase() ? 700 : 400,
                            }}
                          >
                            {mi > 0 ? ", " : ""}
                            {mb.name} ({mb.kills}K/{mb.damage}dmg)
                          </span>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Leaderboard({ accent }: { accent: string }) {
  const [platform, setPlatform] = useState("steam");
  const [mode, setMode] = useState("squad-fpp");
  const [players, setPlayers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [season, setSeason] = useState("");
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    const j = await apiFetch(`/pubg/leaderboard/${platform}/${mode}`);
    if (j.ok) {
      setPlayers(j.players || []);
      setSeason(j.season || "");
    } else setError(j.error || "Failed to load");
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [platform, mode]);

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16, alignItems: "center" }}>
        <select value={platform} onChange={(e) => setPlatform(e.target.value)} style={S.select}>
          <option value="steam">PC - NA</option>
          <option value="pc-eu">PC - EU</option>
          <option value="pc-as">PC - Asia</option>
          <option value="xbox-na">Xbox - NA</option>
          <option value="xbox-eu">Xbox - EU</option>
          <option value="psn-na">PSN - NA</option>
          <option value="psn-eu">PSN - EU</option>
        </select>
        <select value={mode} onChange={(e) => setMode(e.target.value)} style={S.select}>
          <option value="squad-fpp">Squad FPP</option>
          <option value="squad">Squad TPP</option>
          <option value="duo-fpp">Duo FPP</option>
          <option value="duo">Duo TPP</option>
          <option value="solo-fpp">Solo FPP</option>
          <option value="solo">Solo TPP</option>
        </select>
        <button style={S.btn} onClick={load} disabled={loading}>
          {loading ? "..." : "Refresh"}
        </button>
      </div>
      {season && <div style={{ ...S.label, marginBottom: 10 }}>SEASON: {season}</div>}
      {error && <div style={{ color: "#EF4444", fontSize: 12, marginBottom: 12 }}>{error}</div>}
      {loading && players.length === 0 && (
        <div style={{ padding: 20, textAlign: "center", opacity: 0.4, fontSize: 13 }}>
          Loading leaderboard...
        </div>
      )}
      {players.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <div
            style={{
              display: "flex",
              gap: 4,
              padding: "6px 10px",
              fontSize: 9,
              fontWeight: 700,
              color: "rgba(148,163,184,.4)",
              letterSpacing: ".5px",
              textTransform: "uppercase",
            }}
          >
            <span style={{ width: 30 }}>#</span>
            <span style={{ flex: 1 }}>Player</span>
            <span style={{ width: 50, textAlign: "center" }}>Wins</span>
            <span style={{ width: 50, textAlign: "center" }}>K/D</span>
            <span style={{ width: 50, textAlign: "center" }}>ADR</span>
            <span style={{ width: 50, textAlign: "center" }}>Games</span>
          </div>
          {players.map((p, i) => (
            <div
              key={p.name + i}
              style={{
                ...S.card,
                display: "flex",
                gap: 4,
                alignItems: "center",
                padding: "8px 10px",
                border: i < 3 ? `1px solid ${accent}22` : undefined,
                background: i < 3 ? `${accent}06` : undefined,
              }}
            >
              <span
                style={{
                  width: 30,
                  fontSize: 12,
                  fontWeight: 900,
                  color: i < 3 ? accent : "rgba(148,163,184,.4)",
                }}
              >
                {p.rank || i + 1}
              </span>
              <span
                style={{
                  flex: 1,
                  fontSize: 12,
                  fontWeight: 600,
                  color: "rgba(243,244,246,.9)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {p.name}
                {p.stats?.tier && (
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 700,
                      marginLeft: 6,
                      padding: "1px 5px",
                      borderRadius: 3,
                      background: `${accent}15`,
                      color: accent,
                    }}
                  >
                    {p.stats.tier}
                    {p.stats.subTier ? ` ${p.stats.subTier}` : ""}
                  </span>
                )}
              </span>
              <span
                style={{
                  width: 50,
                  textAlign: "center",
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#22C55E",
                }}
              >
                {p.stats?.wins}
              </span>
              <span
                style={{
                  width: 50,
                  textAlign: "center",
                  fontSize: 12,
                  fontWeight: 600,
                  color: "rgba(243,244,246,.8)",
                }}
              >
                {p.stats?.kd}
              </span>
              <span
                style={{
                  width: 50,
                  textAlign: "center",
                  fontSize: 12,
                  fontWeight: 600,
                  color: "rgba(243,244,246,.6)",
                }}
              >
                {p.stats?.avgDmg}
              </span>
              <span
                style={{
                  width: 50,
                  textAlign: "center",
                  fontSize: 11,
                  color: "rgba(148,163,184,.4)",
                }}
              >
                {p.stats?.games}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function PubgModulesPanel({
  lobbyId,
  gameName = "PUBG: Battlegrounds",
  accentColor = ACCENT_PUBG,
  style,
}: {
  lobbyId: string;
  gameName?: string;
  accentColor?: string;
  style?: React.CSSProperties;
}) {
  const [tab, setTab] = useState<TabId>("streams");
  useWatchHere(
    useCallback(() => {
      setTab("streams");
    }, []),
  );

  return (
    <div
      style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0, ...style }}
    >
      <ModuleTabBar
        tabs={TABS}
        active={tab}
        onSelect={(id) => setTab(id as TabId)}
        accent={accentColor}
      />

      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          padding: "14px 14px 14px",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {tab === "streams" && (
          <TwitchStreams gameName={gameName} lobbyId={lobbyId} accentColor={accentColor} />
        )}
        {tab === "lfg" && <LfgBoard lobbyId={lobbyId} accent={accentColor} />}
        {tab === "stats" && <StatsLookup accent={accentColor} />}
        {tab === "weapons" && <WeaponMastery accent={accentColor} />}
        {tab === "matches" && <RecentMatches accent={accentColor} />}
        {tab === "leaderboard" && <Leaderboard accent={accentColor} />}
      </div>

      <div
        style={{
          padding: "6px 14px 8px",
          flexShrink: 0,
          borderTop: "1px solid rgba(255,255,255,.04)",
        }}
      >
        <p
          style={{
            fontSize: 9,
            color: "rgba(100,116,139,.35)",
            lineHeight: 1.4,
            margin: 0,
            textAlign: "center",
          }}
        >
          PUBG, PLAYERUNKNOWN'S BATTLEGROUNDS and all related logos are trademarks of PUBG
          Corporation or its affiliates. Weered is not affiliated with, endorsed by, or sponsored by
          KRAFTON, Inc.
        </p>
      </div>
    </div>
  );
}

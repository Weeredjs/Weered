"use client";

import React, { useCallback, useEffect, useState } from "react";
import StreamInterceptModal, { type StreamInfo } from "./StreamInterceptModal";
import EmptyState from "./EmptyState";
import ModuleTabBar from "./ModuleTabBar";
import { useWatchHere, consumePendingStream } from "../lib/useWatchHere";

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
  btnPri: { padding: "6px 12px", borderRadius: 2, border: "1px solid rgba(200,155,60,.35)", background: "rgba(200,155,60,.12)", fontSize: 12, cursor: "pointer", color: "rgb(200,155,60)", fontWeight: 600 } as React.CSSProperties,
  input: { width: "100%", padding: "8px 12px", borderRadius: 2, border: "1px solid rgba(255,255,255,.10)", background: "rgba(0,0,0,.30)", fontSize: 13, color: "rgba(243,244,246,.92)", outline: "none", boxSizing: "border-box" as const },
  label: { fontSize: 10, fontWeight: 700, opacity: 0.45, letterSpacing: ".7px", textTransform: "uppercase" as const, marginBottom: 6 } as React.CSSProperties,
};

const ACCENT_LEAGUE = "#C89B3C";

const TIER_COLORS: Record<string, string> = {
  IRON: "#5c4033", BRONZE: "#8c5a2e", SILVER: "#7c8389", GOLD: "#c89b3c",
  PLATINUM: "#2d8f8f", EMERALD: "#1ea362", DIAMOND: "#576bce", MASTER: "#9d48c9",
  GRANDMASTER: "#e44040", CHALLENGER: "#f0b232",
};

const TIER_ORDER = ["IRON","BRONZE","SILVER","GOLD","PLATINUM","EMERALD","DIAMOND","MASTER","GRANDMASTER","CHALLENGER"];

function tierBadgeUrl(tier: string) {
  return `https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-shared-components/global/default/images/${tier.toLowerCase()}.png`;
}

function kda(k: number, d: number, a: number) {
  return d === 0 ? "Perfect" : ((k + a) / d).toFixed(2);
}

function championImgUrl(championName: string, version: string) {
  return `https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${championName}.png`;
}

function championImgById(championId: number, champions: any[]) {
  const champ = champions.find((c: any) => c.key === championId);
  return champ ? champ.image : "";
}

function championNameById(championId: number, champions: any[]) {
  const champ = champions.find((c: any) => c.key === championId);
  return champ ? champ.name : `Champion ${championId}`;
}

function itemImgUrl(itemId: number, version: string) {
  if (!itemId || itemId === 0) return "";
  return `https://ddragon.leagueoflegends.com/cdn/${version}/img/item/${itemId}.png`;
}

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function timeAgo(timestamp: number) {
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function TwitchStreams({ gameName = "League of Legends", lobbyId, accentColor }: { gameName?: string; lobbyId?: string; accentColor?: string }) {
  const [streams, setStreams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeStream, setActiveStream] = useState<string | null>(null);
  const [interceptStream, setInterceptStream] = useState<StreamInfo | null>(null);

  useEffect(() => {
    const ch = consumePendingStream();
    if (ch) setActiveStream(ch);
  }, []);

  useEffect(() => {
    apiFetch(`/twitch/streams?game=${encodeURIComponent(gameName)}`)
      .then(j => { setStreams(j.streams || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [gameName]);

  if (loading) return <div style={{ padding: 20, textAlign: "center", opacity: 0.4, fontSize: 13 }}>Loading streams...</div>;

  function handleCardClick(s: any) {
    setInterceptStream({
      userLogin: s.userLogin || s.user_login || "",
      userName: s.userName || s.user_name || "",
      title: s.title || "",
      viewerCount: Number(s.viewerCount || s.viewer_count || 0),
      thumbnailUrl: s.thumbnailUrl || s.thumbnail_url || "",
      gameName,
    });
  }

  function handleWatchHere(stream: StreamInfo) {
    setActiveStream(stream.userLogin);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {activeStream && (
        <div style={{ borderRadius: 2, overflow: "hidden", border: `1px solid ${ACCENT_LEAGUE}40`, background: "#000", marginBottom: 4 }}>
          <iframe
            src={`https://player.twitch.tv/?channel=${activeStream}&parent=${typeof window !== "undefined" ? window.location.hostname : "weered.ca"}&muted=true`}
            width="100%" height="280" style={{ border: "none", display: "block" }} allowFullScreen
          />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", background: `${ACCENT_LEAGUE}10` }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: ACCENT_LEAGUE }}>{activeStream}</span>
            <button onClick={() => setActiveStream(null)} style={{ ...S.btn, fontSize: 11, padding: "4px 10px" }}>Close</button>
          </div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 8 }}>
        {streams.map(s => (
          <div key={s.id} onClick={() => handleCardClick(s)} style={{
            ...S.card, cursor: "pointer", transition: "border-color .15s, background .15s",
            border: activeStream === s.userLogin ? `1px solid ${ACCENT_LEAGUE}50` : "1px solid rgba(255,255,255,.08)",
            background: activeStream === s.userLogin ? `${ACCENT_LEAGUE}10` : "rgba(255,255,255,.03)",
          }}>
            {s.thumbnailUrl && <img src={s.thumbnailUrl} alt={s.userName + " stream thumbnail"} style={{ width: "100%", borderRadius: 2, marginBottom: 6, aspectRatio: "16/9", objectFit: "cover" }} />}
            <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.userName}</div>
            <div style={{ fontSize: 11, opacity: 0.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 4 }}>{s.title}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", flexShrink: 0, boxShadow: "0 0 6px rgba(34,197,94,.6)" }} />
              <span style={{ fontSize: 11, color: "rgba(230,235,240,.75)", fontWeight: 600 }}>{s.viewerCount?.toLocaleString()} viewers</span>
            </div>
          </div>
        ))}
      </div>

      {streams.length === 0 && <EmptyState compact title={`Nobody streaming ${gameName} right now.`} />}
      <StreamInterceptModal stream={interceptStream} lobbyId={lobbyId} accentColor={accentColor} onClose={() => setInterceptStream(null)} onWatchHere={handleWatchHere} />
    </div>
  );
}

const LOL_ACTIVITIES = [
  "Ranked Solo/Duo", "Ranked Flex", "Normal Draft", "ARAM",
  "Clash", "Ultimate Spellbook", "Arena", "Custom Game", "Other",
];
const LOL_ROLES = ["Fill", "Top", "Jungle", "Mid", "ADC", "Support"];
const LOL_PLATFORMS = ["any", "pc"];

function TeamFinder({ lobbyId, accent }: { lobbyId: string; accent: string }) {
  const [posts, setPosts]     = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [activity, setActivity]     = useState(LOL_ACTIVITIES[0]);
  const [desc, setDesc]             = useState("");
  const [maxPlayers, setMaxPlayers] = useState(5);
  const [platform, setPlatform]     = useState("any");
  const [msg, setMsg] = useState("");

  const load = useCallback(() => {
    apiFetch(`/lfg/${encodeURIComponent(lobbyId)}`)
      .then(j => { setPosts(j.posts || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [lobbyId]);

  useEffect(() => { load(); const i = setInterval(load, 15000); return () => clearInterval(i); }, [load]);

  async function create() {
    const j = await apiFetch(`/lfg/${encodeURIComponent(lobbyId)}`, {
      method: "POST",
      body: JSON.stringify({ activity, description: desc, maxPlayers, platform }),
    });
    if (j.ok) { setShowForm(false); setDesc(""); load(); }
    else setMsg(j.message || j.error || "Failed");
  }

  async function join(postId: string) {
    const j = await apiFetch(`/lfg/${postId}/join`, { method: "POST", body: JSON.stringify({}) });
    if (j.ok) load(); else setMsg(j.message || j.error || "Failed");
  }

  async function leave(postId: string) {
    const j = await apiFetch(`/lfg/${postId}/leave`, { method: "POST", body: JSON.stringify({}) });
    if (j.ok) load(); else setMsg(j.message || j.error || "Failed");
  }

  if (loading) return <div style={{ padding: 20, textAlign: "center", opacity: 0.4, fontSize: 13 }}>Loading teams...</div>;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ fontSize: 13, opacity: 0.6 }}>{posts.length} active teams</div>
        <button style={S.btnPri} onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancel" : "+ Find Team"}
        </button>
      </div>
      {msg && <div style={{ marginBottom: 8, fontSize: 12, opacity: 0.7 }}>{msg}</div>}

      {showForm && (
        <div style={{ ...S.card, marginBottom: 14, border: `1px solid ${accent}35`, background: `${accent}08` }}>
          <div style={S.label}>Queue Type</div>
          <select value={activity} onChange={e => setActivity(e.target.value)} style={{ ...S.input, marginBottom: 8, cursor: "pointer" }}>
            {LOL_ACTIVITIES.map(a => <option key={a} value={a}>{a}</option>)}
          </select>

          <div style={S.label}>Description (optional)</div>
          <input style={{ ...S.input, marginBottom: 8 }} value={desc} onChange={e => setDesc(e.target.value)} placeholder="Looking for duo, chill game, tryhard..." />

          <div style={{ display: "flex", gap: 10, marginBottom: 8 }}>
            <div style={{ flex: 1 }}>
              <div style={S.label}>Team Size</div>
              <input type="number" style={S.input} value={maxPlayers} onChange={e => setMaxPlayers(Number(e.target.value))} min={2} max={5} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={S.label}>Platform</div>
              <select value={platform} onChange={e => setPlatform(e.target.value)} style={{ ...S.input, cursor: "pointer" }}>
                {LOL_PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>

          <button style={{ ...S.btnPri, width: "100%", padding: "8px 0" }} onClick={create}>Post Team</button>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {posts.map(p => {
          const isFull = p.status === "FULL";
          const slots = `${(p.players || []).length}/${p.maxPlayers}`;
          return (
            <div key={p.id} style={{
              ...S.card, display: "flex", alignItems: "center", gap: 12,
              border: isFull ? `1px solid ${accent}30` : "1px solid rgba(255,255,255,.08)",
              opacity: isFull ? 0.7 : 1,
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 2, display: "flex", alignItems: "center", gap: 8 }}>
                  {p.activity}
                  {isFull && <span style={{ fontSize: 9, padding: "1px 5px", borderRadius: 2, background: `${accent}18`, border: `1px solid ${accent}35`, color: accent }}>FULL</span>}
                </div>
                {p.description && <div style={{ fontSize: 11, opacity: 0.5, marginBottom: 4 }}>{p.description}</div>}
                <div style={{ display: "flex", gap: 8, fontSize: 11, opacity: 0.5 }}>
                  <span>by {p.userName}</span>
                  <span>{slots} players</span>
                </div>
                {(p.playerNames || []).length > 0 && (
                  <div style={{ display: "flex", gap: 4, marginTop: 6, flexWrap: "wrap" }}>
                    {p.playerNames.map((n: string, i: number) => (
                      <span key={i} style={{ fontSize: 10, padding: "1px 6px", borderRadius: 2, background: `${accent}15`, border: `1px solid ${accent}30`, color: `${accent}dd` }}>{n}</span>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, flexShrink: 0 }}>
                {!isFull && <button style={{ ...S.btnPri, fontSize: 11 }} onClick={() => join(p.id)}>Join</button>}
                <button style={{ ...S.btn, fontSize: 11 }} onClick={() => leave(p.id)}>Leave</button>
              </div>
            </div>
          );
        })}
        {posts.length === 0 && (
          <EmptyState title="No teams running." hint="Flag one up top and rally a five-stack." />
        )}
      </div>
    </div>
  );
}

function SummonerLookup({ champions, accent }: { champions: any[]; accent: string }) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");

  async function search() {
    if (!query.includes("#")) { setError("Enter Riot ID (Name#TAG)"); return; }
    const [gameName, tagLine] = query.split("#");
    if (!gameName || !tagLine) { setError("Enter Riot ID (Name#TAG)"); return; }

    setLoading(true); setError(""); setData(null);
    try {
      const j = await apiFetch(`/league/summoner/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`);
      if (j.ok) setData(j);
      else setError(j.error === "player_not_found" ? "Player not found" : j.error || "Lookup failed");
    } catch { setError("Lookup failed"); }
    setLoading(false);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          style={{ ...S.input, flex: 1 }}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === "Enter" && search()}
          placeholder="Riot ID (e.g. Faker#KR1)"
        />
        <button style={S.btnPri} onClick={search} disabled={loading}>
          {loading ? "..." : "Lookup"}
        </button>
      </div>

      {error && <div style={{ fontSize: 12, color: "#f87171" }}>{error}</div>}

      {data && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ ...S.card, display: "flex", alignItems: "center", gap: 14, border: `1px solid ${accent}30`, borderLeft: `2px solid ${accent}`, background: `${accent}08` }}>
            <div style={{ position: "relative" }}>
              <img src={data.summoner.profileIconUrl} alt={data.summoner.name + " summoner icon"} style={{ width: 56, height: 56, borderRadius: 2, border: `2px solid ${accent}50` }} />
              <div style={{
                position: "absolute", bottom: -4, left: "50%", transform: "translateX(-50%)",
                background: "rgba(0,0,0,.85)", border: `1px solid ${accent}40`, borderRadius: 2,
                padding: "0 5px", fontSize: 10, fontWeight: 800, color: accent,
              }}>
                {data.summoner.summonerLevel}
              </div>
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 16, color: "rgba(243,244,246,.95)" }}>
                {data.summoner.gameName}<span style={{ opacity: 0.4, fontWeight: 400 }}>#{data.summoner.tagLine}</span>
              </div>
              <div style={{ fontSize: 11, opacity: 0.5 }}>Level {data.summoner.summonerLevel}</div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <RankedCard label="Solo/Duo" data={data.ranked?.solo} accent={accent} />
            <RankedCard label="Flex" data={data.ranked?.flex} accent={accent} />
          </div>

          {data.topChampions?.length > 0 && (
            <div>
              <div style={S.label}>Top Champions</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {data.topChampions.map((c: any, i: number) => {
                  const name = championNameById(c.championId, champions);
                  const img = championImgById(c.championId, champions);
                  return (
                    <div key={i} style={{
                      ...S.card, display: "flex", alignItems: "center", gap: 8, padding: "6px 10px",
                      border: `1px solid rgba(255,255,255,.06)`, minWidth: 130,
                    }}>
                      {img && <img src={img} alt={name + " champion icon"} style={{ width: 28, height: 28, borderRadius: 2, border: `1px solid ${accent}30` }} />}
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 11 }}>{name}</div>
                        <div style={{ fontSize: 10, opacity: 0.4 }}>
                          M{c.championLevel} · {(c.championPoints / 1000).toFixed(0)}k pts
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {data.recentMatches?.length > 0 && (
            <div>
              <div style={S.label}>Recent Matches</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {data.recentMatches.map((m: any, i: number) => (
                  <MatchRow key={i} match={m} champions={champions} version={data.ddragonVersion} accent={accent} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function RankedCard({ label, data, accent }: { label: string; data: any; accent: string }) {
  if (!data) {
    return (
      <div style={{ ...S.card, textAlign: "center" }}>
        <div style={{ fontSize: 10, opacity: 0.4, marginBottom: 4 }}>{label}</div>
        <div style={{ fontSize: 12, opacity: 0.3 }}>Unranked</div>
      </div>
    );
  }

  const tierColor = TIER_COLORS[data.tier] || "rgba(255,255,255,.3)";

  return (
    <div style={{ ...S.card, border: `1px solid ${tierColor}40`, background: `${tierColor}08`, textAlign: "center" }}>
      <div style={{ fontSize: 10, opacity: 0.5, marginBottom: 4 }}>{label}</div>
      <img src={tierBadgeUrl(data.tier)} alt={data.tier + " rank badge"} style={{ width: 48, height: 48, margin: "0 auto 4px", display: "block", filter: "drop-shadow(0 2px 8px rgba(0,0,0,.5))" }}
        onError={e => (e.currentTarget.style.display = "none")}
      />
      <div style={{ fontWeight: 800, fontSize: 14, color: tierColor }}>
        {data.tier} {data.rank}
      </div>
      <div style={{ fontSize: 11, opacity: 0.6 }}>{data.lp} LP</div>
      <div style={{ fontSize: 10, opacity: 0.4, marginTop: 2 }}>
        {data.wins}W {data.losses}L · {data.winRate}% WR
      </div>
    </div>
  );
}

function MatchRow({ match: m, champions, version, accent }: { match: any; champions: any[]; version: string; accent: string }) {
  const champImg = championImgUrl(m.championName, version);
  const kdaVal = kda(m.kills, m.deaths, m.assists);

  return (
    <div style={{
      ...S.card, display: "flex", alignItems: "center", gap: 10, padding: "6px 10px",
      border: m.win ? "1px solid rgba(34,197,94,.15)" : "1px solid rgba(239,68,68,.15)",
      background: m.win ? "rgba(34,197,94,.04)" : "rgba(239,68,68,.04)",
    }}>
      <img src={champImg} alt={m.championName + " champion icon"} style={{ width: 32, height: 32, borderRadius: 2, border: m.win ? "1px solid rgba(34,197,94,.3)" : "1px solid rgba(239,68,68,.3)" }} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontWeight: 700, fontSize: 12, color: m.win ? "rgba(134,239,172,.9)" : "rgba(252,165,165,.9)" }}>
            {m.win ? "WIN" : "LOSS"}
          </span>
          <span style={{ fontSize: 11, opacity: 0.5 }}>{m.championName}</span>
          <span style={{ fontSize: 10, opacity: 0.3 }}>{formatDuration(m.gameDuration)}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, marginTop: 2 }}>
          <span style={{ fontWeight: 700 }}>{m.kills}/{m.deaths}/{m.assists}</span>
          <span style={{ fontSize: 10, opacity: 0.4 }}>({kdaVal} KDA)</span>
          <span style={{ fontSize: 10, opacity: 0.4 }}>{m.cs} CS</span>
          <span style={{ fontSize: 10, opacity: 0.4 }}>{m.level}</span>
        </div>
      </div>

      <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
        {m.items?.filter((id: number) => id > 0).slice(0, 6).map((id: number, i: number) => (
          <img key={i} src={itemImgUrl(id, version)} alt="Item icon" style={{ width: 22, height: 22, borderRadius: 3, border: "1px solid rgba(255,255,255,.08)" }} />
        ))}
      </div>

      <div style={{ fontSize: 10, opacity: 0.3, flexShrink: 0 }}>{timeAgo(m.gameCreation)}</div>
    </div>
  );
}

function FreeRotation({ champions, accent }: { champions: any[]; accent: string }) {
  const [rotation, setRotation] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch("/league/rotation")
      .then(j => { if (j.ok) setRotation(j); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ padding: 20, textAlign: "center", opacity: 0.4, fontSize: 13 }}>Loading rotation...</div>;
  if (!rotation) return <div style={{ padding: 20, textAlign: "center", opacity: 0.4, fontSize: 13 }}>Rotation unavailable</div>;

  return (
    <div>
      <div style={S.label}>Free This Week</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(90px, 1fr))", gap: 8 }}>
        {(rotation.freeChampionIds || []).map((id: number) => {
          const name = championNameById(id, champions);
          const img = championImgById(id, champions);
          return (
            <div key={id} style={{
              ...S.card, textAlign: "center", padding: 8,
              border: `1px solid ${accent}20`, background: `${accent}06`,
            }}>
              {img && <img src={img} alt={name + " champion icon"} style={{ width: 40, height: 40, borderRadius: 2, margin: "0 auto 4px", display: "block", border: `1px solid ${accent}25` }} />}
              <div style={{ fontSize: 10, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Leaderboard({ accent }: { accent: string }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch("/league/leaderboard")
      .then(j => { if (j.ok) setData(j); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ padding: 20, textAlign: "center", opacity: 0.4, fontSize: 13 }}>Loading leaderboard...</div>;
  if (!data) return <div style={{ padding: 20, textAlign: "center", opacity: 0.4, fontSize: 13 }}>Leaderboard unavailable</div>;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <div style={{ fontWeight: 800, fontSize: 14, color: TIER_COLORS.CHALLENGER }}>Challenger Ladder</div>
        <span style={{ fontSize: 10, opacity: 0.3 }}>NA · Solo/Duo</span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <div style={{ display: "flex", padding: "4px 10px", fontSize: 10, fontWeight: 700, opacity: 0.35, gap: 8 }}>
          <span style={{ width: 30 }}>#</span>
          <span style={{ flex: 1 }}>Player</span>
          <span style={{ width: 55, textAlign: "right" }}>LP</span>
          <span style={{ width: 45, textAlign: "right" }}>W</span>
          <span style={{ width: 45, textAlign: "right" }}>L</span>
          <span style={{ width: 45, textAlign: "right" }}>WR</span>
        </div>

        {data.entries?.map((e: any) => (
          <div key={e.rank} style={{
            display: "flex", alignItems: "center", padding: "6px 10px", gap: 8,
            borderRadius: 2,
            background: e.rank <= 3 ? `${TIER_COLORS.CHALLENGER}08` : "transparent",
            border: e.rank <= 3 ? `1px solid ${TIER_COLORS.CHALLENGER}15` : "1px solid transparent",
          }}>
            <span style={{ width: 30, fontWeight: 800, fontSize: 12, color: e.rank <= 3 ? TIER_COLORS.CHALLENGER : "rgba(255,255,255,.5)" }}>
              {e.rank}
            </span>
            <span style={{ flex: 1, fontWeight: 600, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {e.gameName}{e.tagLine ? <span style={{ opacity: 0.35, fontWeight: 400 }}>#{e.tagLine}</span> : ""}
            </span>
            <span style={{ width: 55, textAlign: "right", fontWeight: 700, fontSize: 12, color: accent }}>{e.lp.toLocaleString()}</span>
            <span style={{ width: 45, textAlign: "right", fontSize: 11, color: "rgba(134,239,172,.7)" }}>{e.wins}</span>
            <span style={{ width: 45, textAlign: "right", fontSize: 11, color: "rgba(252,165,165,.7)" }}>{e.losses}</span>
            <span style={{ width: 45, textAlign: "right", fontSize: 11, opacity: 0.5 }}>{e.winRate}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const TABS = [
  { id: "streams",     label: "Live Streams",     icon: "📺" },
  { id: "lfg",         label: "Find Team",        icon: "🎮" },
  { id: "summoner",    label: "Summoner Lookup",   icon: "🔍" },
  { id: "leaderboard", label: "Leaderboard",      icon: "🏆" },
  { id: "rotation",    label: "Free Rotation",    icon: "🔄" },
] as const;

type TabId = typeof TABS[number]["id"];

export default function LeagueModulesPanel({
  lobbyId,
  gameName = "League of Legends",
  accentColor = ACCENT_LEAGUE,
  style,
}: {
  lobbyId: string;
  gameName?: string;
  accentColor?: string;
  style?: React.CSSProperties;
}) {
  const [tab, setTab] = useState<TabId>("streams");
  useWatchHere(useCallback(() => { setTab("streams"); }, []));
  const [champions, setChampions] = useState<any[]>([]);

  useEffect(() => {
    apiFetch("/league/champions")
      .then(j => { if (j.ok) setChampions(j.champions || []); })
      .catch(() => {});
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0, ...style }}>
      <ModuleTabBar tabs={TABS} active={tab} onSelect={(id) => setTab(id as TabId)} accent={accentColor} />

      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "14px 14px 14px", display: "flex", flexDirection: "column" }}>
        {tab === "streams"     && <TwitchStreams gameName={gameName} lobbyId={lobbyId} accentColor={accentColor} />}
        {tab === "lfg"         && <TeamFinder lobbyId={lobbyId} accent={accentColor} />}
        {tab === "summoner"    && <SummonerLookup champions={champions} accent={accentColor} />}
        {tab === "leaderboard" && <Leaderboard accent={accentColor} />}
        {tab === "rotation"    && <FreeRotation champions={champions} accent={accentColor} />}
      </div>

      <div style={{ padding: "6px 14px 8px", flexShrink: 0, borderTop: "1px solid rgba(255,255,255,.04)" }}>
        <p style={{ fontSize: 9, color: "rgba(100,116,139,.35)", lineHeight: 1.4, margin: 0, textAlign: "center" }}>
          Weered isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. Riot Games, and all associated properties are trademarks or registered trademarks of Riot Games, Inc.
        </p>
      </div>
    </div>
  );
}

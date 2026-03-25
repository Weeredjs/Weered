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
  btnPri: { padding: "6px 12px", borderRadius: 8, border: "1px solid rgba(124,58,237,.35)", background: "rgba(124,58,237,.12)", fontSize: 12, cursor: "pointer", color: "rgb(216,180,254)", fontWeight: 600 } as React.CSSProperties,
  input: { width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,.10)", background: "rgba(0,0,0,.30)", fontSize: 13, color: "rgba(243,244,246,.92)", outline: "none", boxSizing: "border-box" as const },
  label: { fontSize: 10, fontWeight: 700, opacity: 0.45, letterSpacing: ".7px", textTransform: "uppercase" as const, marginBottom: 6 } as React.CSSProperties,
};

const ACCENT_DESTINY = "#4F88C6";

// ── Tier colors for item rarity ──────────────────────────────────────────────

const TIER_COLORS: Record<string, string> = { Exotic: "#ceae33", Legendary: "#522f65", Rare: "#5076a3", Uncommon: "#366e42", Common: "#c3bcb4", Unknown: "rgba(255,255,255,.1)", Currency: "rgba(255,255,255,.1)" };
const TIER_BORDER: Record<string, string> = { Exotic: "rgba(206,174,51,.6)", Legendary: "rgba(82,47,101,.8)", Rare: "rgba(80,118,163,.6)", Uncommon: "rgba(54,110,66,.6)", Common: "rgba(195,188,180,.4)", Unknown: "rgba(255,255,255,.08)", Currency: "rgba(255,255,255,.08)" };

// ── Item Tile (compact or full) ──────────────────────────────────────────────

function ItemTile({ item, compact }: { item: any; compact?: boolean }) {
  const tier = item.tierName || "Unknown";
  const borderColor = TIER_BORDER[tier] || "rgba(255,255,255,.08)";
  const bgColor = TIER_COLORS[tier] || "rgba(255,255,255,.03)";

  if (compact) {
    return (
      <div title={`${item.name || "?"}${item.primaryStat ? ` (${item.primaryStat})` : ""}`} style={{
        width: 44, height: 44, borderRadius: 8, background: item.icon ? "rgba(0,0,0,.5)" : bgColor,
        border: `1.5px solid ${borderColor}`, overflow: "hidden", position: "relative", cursor: "default",
      }}>
        {item.icon && <img src={item.icon} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
        {item.primaryStat && (
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "rgba(0,0,0,.75)", textAlign: "center",
            fontSize: 9, fontWeight: 800, color: tier === "Exotic" ? "#ceae33" : "#fff", padding: "1px 0" }}>{item.primaryStat}</div>
        )}
        {item.watermark && <img src={item.watermark} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.25, pointerEvents: "none" }} />}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 8, border: `1px solid ${borderColor}`, background: `${bgColor}18` }}>
      <div style={{ width: 40, height: 40, borderRadius: 7, overflow: "hidden", flexShrink: 0, background: item.icon ? "rgba(0,0,0,.5)" : bgColor, border: `1px solid ${borderColor}`, position: "relative" }}>
        {item.icon && <img src={item.icon} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
        {item.watermark && <img src={item.watermark} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.3, pointerEvents: "none" }} />}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: tier === "Exotic" ? "#ceae33" : "rgba(243,244,246,.9)" }}>{item.name || "Unknown Item"}</div>
        <div style={{ fontSize: 10, opacity: 0.4, display: "flex", alignItems: "center", gap: 6 }}>
          {item.slotName && <span>{item.slotName}</span>}
          {item.damageType && item.damageType !== "None" && <><span style={{ opacity: 0.3 }}>·</span>{item.damageIcon && <img src={item.damageIcon} alt="" style={{ width: 10, height: 10, opacity: 0.6 }} />}<span>{item.damageType}</span></>}
        </div>
      </div>
      {item.primaryStat && <div style={{ fontSize: 14, fontWeight: 900, color: tier === "Exotic" ? "#ceae33" : "rgba(253,230,138,.9)", flexShrink: 0 }}>{item.primaryStat}</div>}
    </div>
  );
}

// ── Twitch Streams ───────────────────────────────────────────────────────────

function TwitchStreams({ gameName = "Destiny 2", lobbyId, accentColor }: { gameName?: string; lobbyId?: string; accentColor?: string }) {
  const [streams, setStreams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeStream, setActiveStream] = useState<string | null>(null);
  const [interceptStream, setInterceptStream] = useState<StreamInfo | null>(null);

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
      {/* Embed player */}
      {activeStream && (
        <div style={{ borderRadius: 10, overflow: "hidden", border: "1px solid rgba(145,70,255,.25)", background: "#000", marginBottom: 4 }}>
          <iframe
            src={`https://player.twitch.tv/?channel=${activeStream}&parent=${typeof window !== "undefined" ? window.location.hostname : "weered.ca"}&muted=true`}
            width="100%"
            height="280"
            style={{ border: "none", display: "block" }}
            allowFullScreen
          />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", background: "rgba(145,70,255,.08)" }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "rgba(216,180,254,.9)" }}>{activeStream}</span>
            <button onClick={() => setActiveStream(null)} style={{ ...S.btn, fontSize: 11, padding: "4px 10px" }}>Close</button>
          </div>
        </div>
      )}

      {/* Stream grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 8 }}>
        {streams.map(s => (
          <div
            key={s.id}
            onClick={() => handleCardClick(s)}
            style={{
              ...S.card,
              cursor: "pointer",
              transition: "border-color .15s, background .15s",
              border: activeStream === s.userLogin ? "1px solid rgba(145,70,255,.40)" : "1px solid rgba(255,255,255,.08)",
              background: activeStream === s.userLogin ? "rgba(145,70,255,.08)" : "rgba(255,255,255,.03)",
            }}
          >
            {s.thumbnailUrl && (
              <img src={s.thumbnailUrl} alt="" style={{ width: "100%", borderRadius: 6, marginBottom: 6, aspectRatio: "16/9", objectFit: "cover" }} />
            )}
            <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {s.userName}
            </div>
            <div style={{ fontSize: 11, opacity: 0.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 4 }}>
              {s.title}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#ef4444", flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: "rgba(252,165,165,.8)", fontWeight: 600 }}>
                {s.viewerCount?.toLocaleString()} viewers
              </span>
            </div>
          </div>
        ))}
      </div>

      {streams.length === 0 && (
        <div style={{ textAlign: "center", padding: 20, opacity: 0.4, fontSize: 13 }}>No live {gameName} streams right now.</div>
      )}

      <StreamInterceptModal
        stream={interceptStream}
        lobbyId={lobbyId}
        accentColor={accentColor}
        onClose={() => setInterceptStream(null)}
        onWatchHere={handleWatchHere}
      />
    </div>
  );
}

// ── LFG Board ────────────────────────────────────────────────────────────────

const D2_ACTIVITIES = [
  "Raid: Crota's End", "Raid: Root of Nightmares", "Raid: King's Fall",
  "Raid: Vow of the Disciple", "Raid: Vault of Glass", "Raid: Garden of Salvation",
  "Dungeon: Warlord's Ruin", "Dungeon: Ghosts of the Deep", "Dungeon: Spire of the Watcher",
  "Nightfall: Grandmaster", "Nightfall: Legend", "Nightfall: Hero",
  "Trials of Osiris", "Iron Banner", "Crucible: Competitive",
  "Gambit", "Exotic Quest", "Campaign (Legendary)", "Other",
];

const PLATFORMS = ["crossplay", "pc", "xbox", "psn"];

function LfgBoard({ lobbyId }: { lobbyId: string }) {
  const [posts, setPosts]     = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [activity, setActivity]     = useState(D2_ACTIVITIES[0]);
  const [desc, setDesc]             = useState("");
  const [maxPlayers, setMaxPlayers] = useState(6);
  const [platform, setPlatform]     = useState("crossplay");
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

  if (loading) return <div style={{ padding: 20, textAlign: "center", opacity: 0.4, fontSize: 13 }}>Loading fireteams...</div>;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ fontSize: 13, opacity: 0.6 }}>{posts.length} active fireteams</div>
        <button style={S.btnPri} onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancel" : "+ Create Fireteam"}
        </button>
      </div>
      {msg && <div style={{ marginBottom: 8, fontSize: 12, opacity: 0.7 }}>{msg}</div>}

      {showForm && (
        <div style={{ ...S.card, marginBottom: 14, border: `1px solid ${ACCENT_DESTINY}35`, background: `${ACCENT_DESTINY}08` }}>
          <div style={S.label}>Activity</div>
          <select
            value={activity} onChange={e => setActivity(e.target.value)}
            style={{ ...S.input, marginBottom: 8, cursor: "pointer" }}
          >
            {D2_ACTIVITIES.map(a => <option key={a} value={a}>{a}</option>)}
          </select>

          <div style={S.label}>Description (optional)</div>
          <input style={{ ...S.input, marginBottom: 8 }} value={desc} onChange={e => setDesc(e.target.value)} placeholder="KWTD, chill run, teaching..." />

          <div style={{ display: "flex", gap: 10, marginBottom: 8 }}>
            <div style={{ flex: 1 }}>
              <div style={S.label}>Max Players</div>
              <input type="number" style={S.input} value={maxPlayers} onChange={e => setMaxPlayers(Number(e.target.value))} min={2} max={12} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={S.label}>Platform</div>
              <select value={platform} onChange={e => setPlatform(e.target.value)} style={{ ...S.input, cursor: "pointer" }}>
                {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>

          <button style={{ ...S.btnPri, width: "100%", padding: "8px 0" }} onClick={create}>Post Fireteam</button>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {posts.map(p => {
          const isFull = p.status === "FULL";
          const slots = `${(p.players || []).length}/${p.maxPlayers}`;
          return (
            <div key={p.id} style={{
              ...S.card,
              display: "flex", alignItems: "center", gap: 12,
              border: isFull ? "1px solid rgba(245,158,11,.20)" : "1px solid rgba(255,255,255,.08)",
              opacity: isFull ? 0.7 : 1,
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 2, display: "flex", alignItems: "center", gap: 8 }}>
                  {p.activity}
                  {isFull && <span style={{ fontSize: 9, padding: "1px 5px", borderRadius: 999, background: "rgba(245,158,11,.12)", border: "1px solid rgba(245,158,11,.25)", color: "rgb(253,230,138)" }}>FULL</span>}
                </div>
                {p.description && <div style={{ fontSize: 11, opacity: 0.5, marginBottom: 4 }}>{p.description}</div>}
                <div style={{ display: "flex", gap: 8, fontSize: 11, opacity: 0.5 }}>
                  <span>{p.platform}</span>
                  <span>by {p.userName}</span>
                  <span>{slots} guardians</span>
                </div>
                {(p.playerNames || []).length > 0 && (
                  <div style={{ display: "flex", gap: 4, marginTop: 6, flexWrap: "wrap" }}>
                    {p.playerNames.map((n: string, i: number) => (
                      <span key={i} style={{ fontSize: 10, padding: "1px 6px", borderRadius: 999, background: "rgba(79,136,198,.12)", border: "1px solid rgba(79,136,198,.25)", color: "rgba(147,197,253,.85)" }}>{n}</span>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, flexShrink: 0 }}>
                {!isFull && (
                  <button style={{ ...S.btnPri, fontSize: 11 }} onClick={() => join(p.id)}>Join</button>
                )}
                <button style={{ ...S.btn, fontSize: 11 }} onClick={() => leave(p.id)}>Leave</button>
              </div>
            </div>
          );
        })}
        {posts.length === 0 && (
          <div style={{ textAlign: "center", padding: 24, opacity: 0.35, fontSize: 13 }}>
            No active fireteams. Be the first to create one!
          </div>
        )}
      </div>
    </div>
  );
}

// ── Bungie Weekly / Xur ──────────────────────────────────────────────────────

function BungieWeekly({ accentColor }: { accentColor?: string }) {
  const accent = accentColor || ACCENT_DESTINY;
  const [data, setData] = useState<any>(null);
  const [xur, setXur]   = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([apiFetch("/bungie/weekly"), apiFetch("/bungie/xur")])
      .then(([w, x]) => { setData(w); setXur(x); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ padding: 20, textAlign: "center", opacity: 0.4, fontSize: 13 }}>Loading Bungie data...</div>;

  const milestones = data?.milestones || [];
  const hasManifest = !!data?.manifestVersion;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Xur Status */}
      <div style={{ ...S.card, border: xur?.available ? "1px solid rgba(245,158,11,.30)" : "1px solid rgba(255,255,255,.08)", background: xur?.available ? "rgba(245,158,11,.06)" : "rgba(255,255,255,.03)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 22 }}>🐍</span>
          <div>
            <div style={{ fontWeight: 800, fontSize: 14, color: xur?.available ? "rgb(253,230,138)" : "rgba(255,255,255,.6)" }}>Xur {xur?.available ? "is here!" : "is away"}</div>
            <div style={{ fontSize: 11, opacity: 0.5 }}>{xur?.available ? "Exotic vendor is active — check inventory in-game" : "Returns every Friday at reset"}</div>
          </div>
        </div>
      </div>

      {/* Milestones */}
      {milestones.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {milestones.filter((ms: any) => !ms.name.startsWith("Milestone")).slice(0, 20).map((ms: any) => (
            <div key={ms.hash} style={{ ...S.card }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: ms.activities?.length ? 8 : 0 }}>
                {ms.icon ? (
                  <img src={ms.icon} alt="" style={{ width: 32, height: 32, borderRadius: 8, objectFit: "cover", flexShrink: 0 }} />
                ) : (
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: `${accent}20`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0 }}>📋</div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{ms.name}</div>
                  {ms.description && <div style={{ fontSize: 10, opacity: 0.4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ms.description}</div>}
                </div>
                {ms.activities?.length > 0 && <span style={{ fontSize: 10, opacity: 0.35, flexShrink: 0 }}>{ms.activities.length} activities</span>}
              </div>
              {hasManifest && ms.activities?.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {ms.activities.slice(0, 5).map((act: any, i: number) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", borderRadius: 6, background: "rgba(255,255,255,.02)", border: "1px solid rgba(255,255,255,.04)" }}>
                      {act.icon && <img src={act.icon} alt="" style={{ width: 24, height: 24, borderRadius: 5, objectFit: "cover", flexShrink: 0 }} />}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 11, fontWeight: 600 }}>{act.name}</div>
                        {act.lightLevel > 0 && <span style={{ fontSize: 9, opacity: 0.4 }}>{act.lightLevel} Power</span>}
                      </div>
                      {act.modifiers?.length > 0 && (
                        <div style={{ display: "flex", gap: 3, flexShrink: 0 }}>
                          {act.modifiers.slice(0, 6).map((mod: any, mi: number) => (
                            <div key={mi} title={`${mod.name}: ${mod.description || ""}`} style={{ width: 20, height: 20, borderRadius: 4, overflow: "hidden", background: "rgba(0,0,0,.3)", border: "1px solid rgba(255,255,255,.06)" }}>
                              {mod.icon && <img src={mod.icon} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div style={{ ...S.card, fontSize: 12, opacity: 0.4 }}>{data?.error ? "Bungie API unavailable — check back later" : "No milestone data available"}</div>
      )}

      <div style={{ ...S.card, textAlign: "center" }}>
        <div style={{ fontSize: 10, fontWeight: 700, opacity: 0.4, letterSpacing: ".7px", textTransform: "uppercase", marginBottom: 4 }}>Weekly Reset</div>
        <div style={{ fontSize: 13, opacity: 0.7 }}>Every Tuesday at 17:00 UTC</div>
        {hasManifest && <div style={{ fontSize: 9, opacity: 0.25, marginTop: 4 }}>Manifest v{data.manifestVersion}</div>}
      </div>
    </div>
  );
}

// ── Guardian Lookup ──────────────────────────────────────────────────────────

function GuardianLookup() {
  const [query, setQuery]     = useState("");
  const [result, setResult]   = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  const CLASS_NAMES: Record<number, string> = { 0: "Titan", 1: "Hunter", 2: "Warlock" };
  const CLASS_EMOJI: Record<number, string> = { 0: "🛡", 1: "🗡", 2: "✨" };

  async function search() {
    if (!query.trim()) return;
    setLoading(true); setError(""); setResult(null);
    try {
      const j = await apiFetch(`/bungie/player/${encodeURIComponent(query.trim())}`);
      if (j.ok && j.found) setResult(j);
      else if (j.ok && !j.found) setError("Guardian not found. Try BungieName#1234 format.");
      else setError(j.error || "Lookup failed");
    } catch { setError("Network error"); }
    setLoading(false);
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <input
          style={{ ...S.input, flex: 1 }}
          placeholder="BungieName#1234"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === "Enter" && search()}
        />
        <button style={S.btnPri} onClick={search} disabled={loading}>
          {loading ? "..." : "Search"}
        </button>
      </div>

      {error && <div style={{ fontSize: 12, color: "rgba(252,165,165,.8)", marginBottom: 10 }}>{error}</div>}

      {result && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {/* Player card */}
          <div style={{ ...S.card, display: "flex", alignItems: "center", gap: 12, border: `1px solid ${ACCENT_DESTINY}30`, background: `${ACCENT_DESTINY}08` }}>
            {result.player?.iconPath && (
              <img src={result.player.iconPath} alt="" style={{ width: 44, height: 44, borderRadius: 8, objectFit: "cover" }} />
            )}
            <div>
              <div style={{ fontWeight: 800, fontSize: 15 }}>
                {result.player?.displayName}
                {result.player?.displayNameCode ? `#${result.player.displayNameCode}` : ""}
              </div>
              <div style={{ fontSize: 11, opacity: 0.5 }}>
                {result.totalCharacters} characters · Platform {result.player?.membershipType}
              </div>
            </div>
          </div>

          {/* Characters */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 8 }}>
            {(result.characters || []).map((c: any) => (
              <div key={c.characterId} style={{
                ...S.card,
                position: "relative",
                overflow: "hidden",
              }}>
                {c.emblemBackgroundPath && (
                  <div style={{
                    position: "absolute", inset: 0,
                    background: `url(${c.emblemBackgroundPath}) center/cover no-repeat`,
                    opacity: 0.15,
                  }} />
                )}
                <div style={{ position: "relative" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: 18 }}>{CLASS_EMOJI[c.classType] || "?"}</span>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 14 }}>{CLASS_NAMES[c.classType] || "Unknown"}</div>
                      <div style={{ fontSize: 20, fontWeight: 900, color: "rgb(253,230,138)", lineHeight: 1.1 }}>
                        {c.light} <span style={{ fontSize: 10, fontWeight: 600, opacity: 0.5 }}>Power</span>
                      </div>
                    </div>
                  </div>
                  <div style={{ fontSize: 10, opacity: 0.4 }}>
                    {Math.round((c.minutesPlayedTotal || 0) / 60)}h played
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!result && !error && !loading && (
        <div style={{ textAlign: "center", padding: 20, opacity: 0.3, fontSize: 13 }}>
          Search for any Destiny 2 guardian to see their characters and power level
        </div>
      )}
    </div>
  );
}

// ── My Guardian (linked Bungie account) ─────────────────────────────────────

function MyGuardian({ accentColor }: { accentColor?: string }) {
  const accent = accentColor || ACCENT_DESTINY;
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedChar, setSelectedChar] = useState(0);
  const [subTab, setSubTab] = useState<"equipped" | "inventory" | "vault">("equipped");

  useEffect(() => {
    apiFetch("/bungie/me")
      .then(j => { setData(j); setLoading(false); })
      .catch(() => { setError("Failed to load"); setLoading(false); });
  }, []);

  if (loading) return <div style={{ padding: 20, textAlign: "center", opacity: 0.4, fontSize: 13 }}>Loading your Guardian...</div>;

  if (!data?.linked) {
    const token = typeof window !== "undefined" ? localStorage.getItem("weered_token") || "" : "";
    const linkUrl = `${API}/auth/bungie?token=${encodeURIComponent(token)}`;
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 20px", gap: 16 }}>
        <div style={{ fontSize: 48, opacity: 0.3 }}>🔗</div>
        <div style={{ fontWeight: 800, fontSize: 16, textAlign: "center" }}>Link your Bungie account</div>
        <div style={{ fontSize: 12, opacity: 0.45, textAlign: "center", maxWidth: 320, lineHeight: 1.5 }}>
          Connect your Bungie.net account to view your characters, inventory, vault, and loadouts right here on Weered.
        </div>
        <a href={linkUrl} style={{
          display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 28px", borderRadius: 12,
          background: `${accent}20`, border: `1px solid ${accent}50`, color: accent, fontWeight: 800, fontSize: 14,
          textDecoration: "none", cursor: "pointer",
        }}>Link Bungie Account</a>
        <div style={{ fontSize: 10, opacity: 0.25 }}>You will be redirected to Bungie.net to authorize</div>
      </div>
    );
  }

  if (error || data?.error) {
    const isExpired = data?.error === "token_expired" || data?.error === "no_profile_data" || data?.error === "fetch_failed";
    if (isExpired && data?.linked) {
      const token = typeof window !== "undefined" ? localStorage.getItem("weered_token") || "" : "";
      const linkUrl = `${API}/auth/bungie?token=${encodeURIComponent(token)}`;
      return (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 20px", gap: 16 }}>
          <div style={{ fontSize: 48, opacity: 0.3 }}>🔄</div>
          <div style={{ fontWeight: 800, fontSize: 16, textAlign: "center" }}>Session expired</div>
          <div style={{ fontSize: 12, opacity: 0.45, textAlign: "center", maxWidth: 320, lineHeight: 1.5 }}>
            Your Bungie authorization has expired. Re-link to restore access to your characters, inventory, and vault.
          </div>
          <a href={linkUrl} style={{
            display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 28px", borderRadius: 12,
            background: `${accent}20`, border: `1px solid ${accent}50`, color: accent, fontWeight: 800, fontSize: 14,
            textDecoration: "none", cursor: "pointer",
          }}>Re-link Bungie Account</a>
          <div style={{ fontSize: 10, opacity: 0.25 }}>You will be redirected to Bungie.net</div>
        </div>
      );
    }
    return <div style={{ padding: 20, textAlign: "center", color: "rgba(252,165,165,.8)", fontSize: 13 }}>{error || data?.message || data?.error}</div>;
  }

  const characters: any[] = Array.isArray(data?.characters) ? data.characters : typeof data?.characters === "object" && data.characters ? Object.values(data.characters) : [];
  const vault: any[] = data?.vault || [];
  const char = characters[selectedChar];
  const hasManifest = !!data?.manifestVersion;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0, height: "100%" }}>
      {/* Account header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderBottom: "1px solid rgba(255,255,255,.06)", flexShrink: 0 }}>
        <div style={{ width: 36, height: 36, borderRadius: 8, background: `${accent}25`, border: `1px solid ${accent}40`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>⚔</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 14, display: "flex", alignItems: "center", gap: 8 }}>
            {data.displayName}
            <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 999, background: "rgba(34,197,94,.10)", border: "1px solid rgba(34,197,94,.25)", color: "rgba(134,239,172,.9)" }}>LINKED</span>
          </div>
          <div style={{ fontSize: 10, opacity: 0.4 }}>Platform {data.platform} · {characters.length} characters{data.vaultCount ? ` · ${data.vaultCount} vault items` : ""}</div>
        </div>
        <button onClick={() => { const t = typeof window !== "undefined" ? localStorage.getItem("weered_token") || "" : ""; window.location.href = `${API}/auth/bungie?token=${encodeURIComponent(t)}`; }} style={{ ...S.btn, fontSize: 10, padding: "4px 10px" }}>Re-link</button>
      </div>

      {/* Character tabs */}
      {characters.length > 0 && (
        <div style={{ display: "flex", gap: 0, borderBottom: "1px solid rgba(255,255,255,.06)", flexShrink: 0 }}>
          {characters.map((c: any, i: number) => (
            <button key={c.characterId || i} onClick={() => { setSelectedChar(i); if (subTab === "vault") setSubTab("equipped"); }} style={{
              flex: 1, padding: "8px 6px", border: "none", cursor: "pointer",
              background: selectedChar === i && subTab !== "vault" ? `${accent}18` : "transparent",
              borderBottom: selectedChar === i && subTab !== "vault" ? `2px solid ${accent}` : "2px solid transparent",
              color: selectedChar === i && subTab !== "vault" ? "rgba(243,244,246,.92)" : "rgba(148,163,184,.55)",
              fontWeight: selectedChar === i && subTab !== "vault" ? 700 : 400, fontSize: 12, transition: "all .12s",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            }}>
              <span style={{ fontSize: 14 }}>{c.classType === 0 ? "🛡" : c.classType === 1 ? "🗡" : "✨"}</span>
              {c.className || ["Titan", "Hunter", "Warlock"][c.classType]}
              <span style={{ fontSize: 16, fontWeight: 900, color: "rgb(253,230,138)" }}>{c.light}</span>
            </button>
          ))}
          <button onClick={() => setSubTab("vault")} style={{
            padding: "8px 12px", border: "none", cursor: "pointer",
            background: subTab === "vault" ? "rgba(245,158,11,.08)" : "transparent",
            borderBottom: subTab === "vault" ? "2px solid rgba(245,158,11,.6)" : "2px solid transparent",
            color: subTab === "vault" ? "rgba(253,230,138,.9)" : "rgba(148,163,184,.55)",
            fontWeight: subTab === "vault" ? 700 : 400, fontSize: 12, transition: "all .12s",
          }}>🔒 Vault{data.vaultCount ? ` (${data.vaultCount})` : ""}</button>
        </div>
      )}

      {/* Sub-tabs for character view */}
      {subTab !== "vault" && char && (
        <div style={{ display: "flex", gap: 2, padding: "6px 12px", borderBottom: "1px solid rgba(255,255,255,.04)", flexShrink: 0 }}>
          {(["equipped", "inventory"] as const).map(st => (
            <button key={st} onClick={() => setSubTab(st)} style={{
              padding: "4px 10px", borderRadius: 6, border: "none", fontSize: 11, cursor: "pointer",
              background: subTab === st ? `${accent}20` : "transparent",
              color: subTab === st ? "rgba(243,244,246,.9)" : "rgba(148,163,184,.5)",
              fontWeight: subTab === st ? 700 : 400, textTransform: "capitalize",
            }}>{st}{st === "inventory" ? ` (${char.inventory?.length || 0})` : ""}</button>
          ))}
        </div>
      )}

      {/* Content */}
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: 12 }}>
        {subTab === "vault" ? (
          <VaultView items={vault} />
        ) : char ? (
          subTab === "equipped" ? (
            <EquippedView char={char} hasManifest={hasManifest} accent={accent} />
          ) : (
            <InventoryGrid items={char.inventory || []} hasManifest={hasManifest} />
          )
        ) : (
          <div style={{ textAlign: "center", padding: 20, opacity: 0.35, fontSize: 13 }}>No character data available</div>
        )}
      </div>
    </div>
  );
}

function EquippedView({ char, hasManifest, accent }: { char: any; hasManifest: boolean; accent: string }) {
  const weapons = char.weapons || [];
  const armor = char.armor || [];
  const other = char.otherEquipped || [];
  const allEquipped = char.equipped || [];
  const hasGrouped = weapons.length > 0 || armor.length > 0;

  if (!hasGrouped && allEquipped.length > 0) {
    return (
      <div>
        <div style={S.label}>Equipped</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {allEquipped.slice(0, 12).map((item: any, i: number) => <ItemTile key={i} item={item} compact />)}
        </div>
        {!hasManifest && <div style={{ fontSize: 10, opacity: 0.25, marginTop: 12, textAlign: "center" }}>Manifest not synced — item names unavailable</div>}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {char.emblemBackgroundPath && (
        <div style={{ borderRadius: 10, overflow: "hidden", position: "relative", height: 56,
          background: `url(${char.emblemBackgroundPath?.startsWith("http") ? char.emblemBackgroundPath : "https://www.bungie.net" + char.emblemBackgroundPath}) center/cover` }}>
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg, rgba(0,0,0,.7) 0%, transparent 60%)", display: "flex", alignItems: "center", padding: "0 16px", gap: 10 }}>
            <span style={{ fontSize: 20 }}>{char.classType === 0 ? "🛡" : char.classType === 1 ? "🗡" : "✨"}</span>
            <div>
              <div style={{ fontWeight: 800, fontSize: 14 }}>{char.className} <span style={{ opacity: 0.4, fontWeight: 400, fontSize: 11 }}>{char.raceName}</span></div>
              <div style={{ fontSize: 18, fontWeight: 900, color: "rgb(253,230,138)", lineHeight: 1 }}>{char.light} <span style={{ fontSize: 9, fontWeight: 600, opacity: 0.5 }}>POWER</span></div>
            </div>
          </div>
        </div>
      )}
      {weapons.length > 0 && (
        <div><div style={S.label}>Weapons</div><div style={{ display: "flex", flexDirection: "column", gap: 4 }}>{weapons.map((item: any, i: number) => <ItemTile key={i} item={item} />)}</div></div>
      )}
      {armor.length > 0 && (
        <div><div style={S.label}>Armor</div><div style={{ display: "flex", flexDirection: "column", gap: 4 }}>{armor.map((item: any, i: number) => <ItemTile key={i} item={item} />)}</div></div>
      )}
      {other.length > 0 && (
        <div><div style={S.label}>Other</div><div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>{other.map((item: any, i: number) => <ItemTile key={i} item={item} compact />)}</div></div>
      )}
      <div style={{ fontSize: 10, opacity: 0.2, textAlign: "center" }}>Last played: {char.dateLastPlayed ? new Date(char.dateLastPlayed).toLocaleDateString() : "—"} · {Math.round((char.minutesPlayedTotal || 0) / 60)}h total</div>
    </div>
  );
}

function InventoryGrid({ items, hasManifest }: { items: any[]; hasManifest: boolean }) {
  if (!items.length) return <div style={{ textAlign: "center", padding: 20, opacity: 0.35, fontSize: 13 }}>Inventory empty</div>;
  const exotics = items.filter((i: any) => i.tierName === "Exotic");
  const legendaries = items.filter((i: any) => i.tierName === "Legendary");
  const rest = items.filter((i: any) => i.tierName !== "Exotic" && i.tierName !== "Legendary");

  const renderGroup = (label: string, group: any[]) => group.length === 0 ? null : (
    <div>
      <div style={S.label}>{label} ({group.length})</div>
      {hasManifest ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>{group.map((item: any, i: number) => <ItemTile key={i} item={item} />)}</div>
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>{group.map((item: any, i: number) => <ItemTile key={i} item={item} compact />)}</div>
      )}
    </div>
  );
  return <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>{renderGroup("Exotics", exotics)}{renderGroup("Legendaries", legendaries)}{renderGroup("Other", rest)}</div>;
}

function VaultView({ items }: { items: any[] }) {
  const [filter, setFilter] = useState<"all" | "weapons" | "armor">("all");
  if (!items.length) return <div style={{ textAlign: "center", padding: 20, opacity: 0.35, fontSize: 13 }}>Vault empty or not loaded</div>;
  const weaponBuckets = new Set([1498876634, 2465295065, 953998645]);
  const armorBuckets = new Set([3448274439, 3551918588, 14239492, 20886954, 1585787867]);
  const filtered = items.filter((i: any) => {
    if (filter === "weapons") return weaponBuckets.has(i.bucketHash);
    if (filter === "armor") return armorBuckets.has(i.bucketHash);
    return true;
  });
  filtered.sort((a: any, b: any) => { const ta = a.tierType || 0, tb = b.tierType || 0; if (ta !== tb) return tb - ta; return (b.primaryStat || 0) - (a.primaryStat || 0); });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", gap: 4 }}>
        {(["all", "weapons", "armor"] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: "4px 10px", borderRadius: 6, border: "none", fontSize: 11, cursor: "pointer",
            background: filter === f ? "rgba(245,158,11,.15)" : "transparent",
            color: filter === f ? "rgba(253,230,138,.9)" : "rgba(148,163,184,.5)",
            fontWeight: filter === f ? 700 : 400, textTransform: "capitalize",
          }}>{f} ({f === "all" ? items.length : items.filter((i: any) => f === "weapons" ? weaponBuckets.has(i.bucketHash) : armorBuckets.has(i.bucketHash)).length})</button>
        ))}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
        {filtered.slice(0, 100).map((item: any, i: number) => <ItemTile key={i} item={item} compact />)}
      </div>
      {filtered.length > 100 && <div style={{ fontSize: 10, opacity: 0.3, textAlign: "center" }}>Showing first 100 of {filtered.length}</div>}
    </div>
  );
}



// ── Main Panel ───────────────────────────────────────────────────────────────

const TABS = [
  { id: "streams",  label: "Live Streams", icon: "📺" },
  { id: "lfg",      label: "Fireteams",    icon: "🔥" },
  { id: "weekly",   label: "Weekly Reset",  icon: "📋" },
  { id: "guardian",  label: "Guardian Lookup", icon: "🔍" },
  { id: "myguardian", label: "My Guardian", icon: "⚔" },
] as const;

type TabId = typeof TABS[number]["id"];

export default function LobbyModulesPanel({
  lobbyId,
  gameName = "Destiny 2",
  accentColor = ACCENT_DESTINY,
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
      <div style={{ display: "flex", gap: 2, padding: "8px 12px 0", borderBottom: "1px solid rgba(255,255,255,.07)", flexShrink: 0 }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: "7px 12px",
              borderRadius: "8px 8px 0 0",
              border: "none",
              background: tab === t.id ? `${accentColor}20` : "transparent",
              color: tab === t.id ? "rgba(243,244,246,.92)" : "rgba(148,163,184,.65)",
              fontWeight: tab === t.id ? 700 : 400,
              fontSize: 12,
              cursor: "pointer",
              transition: "background .1s, color .1s",
              display: "flex", alignItems: "center", gap: 5,
            }}
          >
            <span style={{ fontSize: 13 }}>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minHeight: 0, overflowY: tab === "myguardian" ? "hidden" : "auto", padding: tab === "myguardian" ? 0 : "14px 14px 14px", display: "flex", flexDirection: "column" }}>
        {tab === "streams"    && <TwitchStreams gameName={gameName} lobbyId={lobbyId} accentColor={accentColor} />}
        {tab === "lfg"        && <LfgBoard lobbyId={lobbyId} />}
        {tab === "weekly"     && <BungieWeekly accentColor={accentColor} />}
        {tab === "guardian"   && <GuardianLookup />}
        {tab === "myguardian" && <MyGuardian accentColor={accentColor} />}
      </div>
    </div>
  );
}

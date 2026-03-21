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
    else setMsg(j.error || "Failed");
  }

  async function join(postId: string) {
    const j = await apiFetch(`/lfg/${postId}/join`, { method: "POST", body: JSON.stringify({}) });
    if (j.ok) load(); else setMsg(j.error || "Failed");
  }

  async function leave(postId: string) {
    const j = await apiFetch(`/lfg/${postId}/leave`, { method: "POST", body: JSON.stringify({}) });
    if (j.ok) load(); else setMsg(j.error || "Failed");
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

function BungieWeekly() {
  const [weekly, setWeekly] = useState<any>(null);
  const [xur, setXur]       = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiFetch("/bungie/weekly"),
      apiFetch("/bungie/xur"),
    ]).then(([w, x]) => {
      setWeekly(w);
      setXur(x);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ padding: 20, textAlign: "center", opacity: 0.4, fontSize: 13 }}>Loading Bungie data...</div>;

  const CLASS_NAMES: Record<number, string> = { 0: "Titan", 1: "Hunter", 2: "Warlock" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Xur Status */}
      <div style={{
        ...S.card,
        border: xur?.available ? "1px solid rgba(245,158,11,.30)" : "1px solid rgba(255,255,255,.08)",
        background: xur?.available ? "rgba(245,158,11,.06)" : "rgba(255,255,255,.03)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <span style={{ fontSize: 22 }}>🐍</span>
          <div>
            <div style={{ fontWeight: 800, fontSize: 14, color: xur?.available ? "rgb(253,230,138)" : "rgba(255,255,255,.6)" }}>
              Xur {xur?.available ? "is here!" : "is away"}
            </div>
            <div style={{ fontSize: 11, opacity: 0.5 }}>
              {xur?.available ? "Exotic vendor is active — check inventory in-game" : "Returns every Friday at reset"}
            </div>
          </div>
        </div>
      </div>

      {/* Weekly Milestones */}
      <div style={{ ...S.card }}>
        <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}>
          <span>Weekly Activities</span>
          <span style={{ fontSize: 10, opacity: 0.4 }}>{weekly?.totalMilestones || 0} active milestones</span>
        </div>
        {(weekly?.milestones || []).length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {weekly.milestones.map((ms: any) => (
              <div key={ms.hash} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 8, background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.06)" }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: `${ACCENT_DESTINY}20`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0 }}>
                  {ms.name.includes("Nightfall") ? "🌙" : ms.name.includes("Raid") ? "⚔" : ms.name.includes("Crucible") ? "🎯" : ms.name.includes("Xur") ? "🐍" : "📋"}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 12 }}>{ms.name}</div>
                  <div style={{ fontSize: 10, opacity: 0.4 }}>
                    {ms.activities?.length || 0} activities · {ms.availableQuests || 0} quests
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: 12, opacity: 0.4 }}>
            {weekly?.error ? "Bungie API unavailable — check back later" : "No milestone data available"}
          </div>
        )}
      </div>

      {/* Reset Timer */}
      <div style={{ ...S.card, textAlign: "center" }}>
        <div style={{ fontSize: 10, fontWeight: 700, opacity: 0.4, letterSpacing: ".7px", textTransform: "uppercase", marginBottom: 4 }}>Weekly Reset</div>
        <div style={{ fontSize: 13, opacity: 0.7 }}>Every Tuesday at 17:00 UTC</div>
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

  const CLASS_NAMES: Record<number, string> = { 0: "Titan", 1: "Hunter", 2: "Warlock" };
  const CLASS_EMOJI: Record<number, string> = { 0: "🛡", 1: "🗡", 2: "✨" };
  const RACE_NAMES: Record<number, string> = { 0: "Human", 1: "Awoken", 2: "Exo" };

  useEffect(() => {
    apiFetch("/bungie/me")
      .then(j => { setData(j); setLoading(false); })
      .catch(() => { setError("Failed to load"); setLoading(false); });
  }, []);

  if (loading) return <div style={{ padding: 20, textAlign: "center", opacity: 0.4, fontSize: 13 }}>Loading your Guardian...</div>;

  // Not linked — show link button
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
        <a
          href={linkUrl}
          style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "12px 28px", borderRadius: 12,
            background: `${accent}20`, border: `1px solid ${accent}50`,
            color: accent, fontWeight: 800, fontSize: 14,
            textDecoration: "none", cursor: "pointer",
            transition: "background .15s, border-color .15s",
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = `${accent}35`; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = `${accent}20`; }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M5 8h6M8 5v6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          Link Bungie Account
        </a>
        <div style={{ fontSize: 10, opacity: 0.25, textAlign: "center" }}>
          You'll be redirected to Bungie.net to authorize
        </div>
      </div>
    );
  }

  if (error) return <div style={{ padding: 20, textAlign: "center", color: "rgba(252,165,165,.8)", fontSize: 13 }}>{error}</div>;

  const characters = Array.isArray(data?.characters) ? data.characters : typeof data?.characters === "object" && data.characters ? Object.values(data.characters) : [];
  const inventoryCount = data?.profileInventory || 0;
  const hasVault = data?.hasVaultAccess || false;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Linked account header */}
      <div style={{
        ...S.card,
        display: "flex", alignItems: "center", gap: 12,
        border: `1px solid ${accent}30`, background: `${accent}08`,
      }}>
        <div style={{
          width: 44, height: 44, borderRadius: 10,
          background: `${accent}25`, border: `1px solid ${accent}40`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 20, flexShrink: 0,
        }}>
          ⚔
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 15, display: "flex", alignItems: "center", gap: 8 }}>
            {data.displayName}
            <span style={{
              fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 999,
              background: "rgba(34,197,94,.10)", border: "1px solid rgba(34,197,94,.25)",
              color: "rgba(134,239,172,.9)",
            }}>LINKED</span>
          </div>
          <div style={{ fontSize: 11, opacity: 0.45, marginTop: 2 }}>
            Platform {data.platform} · {characters.length} characters{inventoryCount ? ` · ${inventoryCount} items` : ""}{hasVault ? " · Vault access" : ""}
          </div>
        </div>
        <button
          onClick={() => {
            const token = typeof window !== "undefined" ? localStorage.getItem("weered_token") || "" : "";
            window.location.href = `${API}/auth/bungie?token=${encodeURIComponent(token)}`;
          }}
          style={{ ...S.btn, fontSize: 10, padding: "4px 10px" }}
        >
          Re-link
        </button>
      </div>

      {/* Characters */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10 }}>
        {characters.map((c: any) => {
          const equipped = c.equipment || c.items || [];
          return (
            <div key={c.characterId} style={{
              ...S.card,
              position: "relative",
              overflow: "hidden",
              border: `1px solid ${accent}20`,
            }}>
              {/* Emblem background */}
              {c.emblemBackgroundPath && (
                <div style={{
                  position: "absolute", inset: 0,
                  background: `url(${c.emblemBackgroundPath.startsWith("http") ? c.emblemBackgroundPath : "https://www.bungie.net" + c.emblemBackgroundPath}) center/cover no-repeat`,
                  opacity: 0.12, pointerEvents: "none",
                }} />
              )}

              <div style={{ position: "relative" }}>
                {/* Class info */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                  <span style={{ fontSize: 22 }}>{CLASS_EMOJI[c.classType] || "?"}</span>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 15, display: "flex", alignItems: "center", gap: 6 }}>
                      {CLASS_NAMES[c.classType] || "Unknown"}
                      <span style={{ fontSize: 10, opacity: 0.4, fontWeight: 400 }}>{RACE_NAMES[c.raceType] || ""}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 22, fontWeight: 900, color: "rgb(253,230,138)", lineHeight: 1 }}>
                        {c.light}
                      </span>
                      <span style={{ fontSize: 9, fontWeight: 600, opacity: 0.4 }}>POWER</span>
                    </div>
                  </div>
                </div>

                {/* Stats */}
                <div style={{ fontSize: 10, opacity: 0.35, marginBottom: 8 }}>
                  {Math.round((c.minutesPlayedTotal || 0) / 60)}h played · Last: {c.dateLastPlayed ? new Date(c.dateLastPlayed).toLocaleDateString() : "—"}
                </div>

                {/* Equipped items */}
                {equipped.length > 0 && (
                  <div>
                    <div style={{ fontSize: 9, fontWeight: 700, opacity: 0.35, letterSpacing: ".5px", textTransform: "uppercase", marginBottom: 6 }}>
                      Equipped
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {equipped.slice(0, 10).map((item: any, i: number) => (
                        <div key={i} title={item.name || `Item ${item.itemHash}`} style={{
                          width: 32, height: 32, borderRadius: 6,
                          background: item.iconPath ? "rgba(0,0,0,.4)" : "rgba(255,255,255,.06)",
                          border: "1px solid rgba(255,255,255,.08)",
                          overflow: "hidden",
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}>
                          {item.iconPath ? (
                            <img src={`https://www.bungie.net${item.iconPath}`} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          ) : (
                            <span style={{ fontSize: 8, opacity: 0.3 }}>?</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {characters.length === 0 && (
        <div style={{ textAlign: "center", padding: 20, opacity: 0.35, fontSize: 13 }}>
          No characters found. Make sure your Bungie profile is public.
        </div>
      )}
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
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "14px 14px 14px" }}>
        {tab === "streams"  && <TwitchStreams gameName={gameName} lobbyId={lobbyId} accentColor={accentColor} />}
        {tab === "lfg"      && <LfgBoard lobbyId={lobbyId} />}
        {tab === "weekly"   && <BungieWeekly />}
        {tab === "guardian"  && <GuardianLookup />}
        {tab === "myguardian" && <MyGuardian accentColor={accentColor} />}
      </div>
    </div>
  );
}

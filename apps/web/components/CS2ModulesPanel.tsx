"use client";

import React, { useCallback, useEffect, useState } from "react";
import StreamInterceptModal, { type StreamInfo } from "./StreamInterceptModal";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";

function authHeaders(): Record<string, string> {
  try { const t = localStorage.getItem("weered_token") || ""; return t ? { Authorization: `Bearer ${t}` } : {}; } catch { return {}; }
}

async function apiFetch(path: string, opts?: RequestInit) {
  const r = await fetch(`${API}${path}`, { ...opts, headers: { "Content-Type": "application/json", ...authHeaders(), ...(opts?.headers || {}) } });
  return r.json();
}

// ── Style ────────────────────────────────────────────────────────────────────

const ACCENT_CS2 = "#DE9B35";

const S = {
  card: { borderRadius: 10, border: "1px solid rgba(255,255,255,.06)", background: "rgba(255,255,255,.03)", padding: "10px 12px" } as React.CSSProperties,
  btn: { padding: "6px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,.10)", background: "rgba(255,255,255,.05)", fontSize: 12, cursor: "pointer", color: "rgba(243,244,246,.88)" } as React.CSSProperties,
  btnPri: { padding: "6px 12px", borderRadius: 8, border: "1px solid rgba(222,155,53,.35)", background: "rgba(222,155,53,.12)", fontSize: 12, cursor: "pointer", color: "rgb(222,155,53)", fontWeight: 600 } as React.CSSProperties,
  input: { width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,.10)", background: "rgba(0,0,0,.30)", fontSize: 13, color: "rgba(243,244,246,.92)", outline: "none", boxSizing: "border-box" as const },
  select: { padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,.10)", background: "rgba(0,0,0,.30)", fontSize: 12, color: "rgba(243,244,246,.92)", outline: "none", cursor: "pointer" } as React.CSSProperties,
  label: { fontSize: 10, fontWeight: 700, opacity: 0.45, letterSpacing: ".7px", textTransform: "uppercase" as const, marginBottom: 6 } as React.CSSProperties,
};

// ── CS2 Constants ────────────────────────────────────────────────────────────

const CS2_MODES = ["Premier", "Competitive", "Wingman", "Casual", "Deathmatch", "Faceit"];

const CS2_COMP_RANKS = [
  "Silver I", "Silver II", "Silver III", "Silver IV", "Silver Elite", "Silver Elite Master",
  "Gold Nova I", "Gold Nova II", "Gold Nova III", "Gold Nova Master",
  "Master Guardian I", "Master Guardian II", "Master Guardian Elite", "Distinguished Master Guardian",
  "Legendary Eagle", "Legendary Eagle Master", "Supreme Master First Class", "The Global Elite",
];

const CS2_PREMIER_RATINGS = ["Under 5K", "5-10K", "10-15K", "15-20K", "20K+"];

const CS2_MAPS = ["Any Map", "Dust2", "Mirage", "Inferno", "Nuke", "Anubis", "Ancient", "Vertigo", "Overpass"];

const CS2_REGIONS = ["NA East", "NA West", "EU West", "EU East", "Asia", "Oceania", "South America"];

function maxPlayersForMode(mode: string): number {
  if (mode === "Wingman") return 2;
  if (mode === "Casual" || mode === "Deathmatch") return 10;
  return 5;
}

// ── Rank Colors ─────────────────────────────────────────────────────────────

function compRankColor(rank: string): string {
  if (rank.startsWith("Silver")) return "#8A8A8A";
  if (rank.startsWith("Gold Nova")) return "#D4A017";
  if (rank.startsWith("Master Guardian") || rank.startsWith("Distinguished")) return "#4A90D9";
  if (rank.startsWith("Legendary Eagle") || rank.startsWith("Supreme") || rank.startsWith("The Global")) return "#B44CF0";
  return "#8A8A8A";
}

function premierRatingColor(rating: number): string {
  if (rating >= 20000) return "#D4A017";
  if (rating >= 15000) return "#E76EBF";
  if (rating >= 10000) return "#9B59B6";
  if (rating >= 5000) return "#4A90D9";
  return "#8A8A8A";
}

// ── Tabs ─────────────────────────────────────────────────────────────────────

const TABS = [
  { id: "lfg" as const,     label: "Squad Finder", icon: "\u{1F3AE}" },
  { id: "streams" as const, label: "Live Streams", icon: "\u{1F4FA}" },
  { id: "ranks" as const,   label: "Ranks",        icon: "\u{1F3C6}" },
  { id: "maps" as const,    label: "Map Pool",     icon: "\u{1F5FA}" },
];
type TabId = typeof TABS[number]["id"];

// ── Squad Finder (LFG) ─────────────────────────────────────────────────────

function SquadFinder({ lobbyId, accent }: { lobbyId: string; accent: string }) {
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [mode, setMode] = useState("Premier");
  const [rank, setRank] = useState("Under 5K");
  const [mapPref, setMapPref] = useState("Any Map");
  const [region, setRegion] = useState("NA East");
  const [micRequired, setMicRequired] = useState(true);
  const [note, setNote] = useState("");
  const [creating, setCreating] = useState(false);
  const [msg, setMsg] = useState("");

  const rankOptions = mode === "Premier" || mode === "Faceit"
    ? CS2_PREMIER_RATINGS
    : CS2_COMP_RANKS;

  // Reset rank when mode changes
  useEffect(() => {
    if (mode === "Premier" || mode === "Faceit") {
      if (!CS2_PREMIER_RATINGS.includes(rank)) setRank("Under 5K");
    } else {
      if (!CS2_COMP_RANKS.includes(rank)) setRank("Gold Nova I");
    }
  }, [mode]);

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
    const mapStr = mapPref !== "Any Map" ? ` [${mapPref}]` : "";
    const activity = `${mode} \u2014 ${rank} \u2014 ${region}${micStr}${mapStr}`;
    const mp = maxPlayersForMode(mode);

    const j = await apiFetch(`/lfg/${encodeURIComponent(lobbyId)}`, {
      method: "POST",
      body: JSON.stringify({
        activity,
        description: note,
        maxPlayers: mp,
        platform: "pc",
      }),
    });
    setCreating(false);
    if (j.ok) {
      setShowForm(false);
      setNote("");
      load();
    } else {
      setMsg(j.message || j.error || "Failed to create post");
    }
  }

  async function join(postId: string) {
    const j = await apiFetch(`/lfg/${postId}/join`, { method: "POST", body: JSON.stringify({}) });
    if (j.ok) load(); else setMsg(j.message || j.error || "Failed to join");
  }

  async function leave(postId: string) {
    const j = await apiFetch(`/lfg/${postId}/leave`, { method: "POST", body: JSON.stringify({}) });
    if (j.ok) load(); else setMsg(j.message || j.error || "Failed to leave");
  }

  if (loading) return <div style={{ padding: 20, textAlign: "center", opacity: 0.4, fontSize: 13 }}>Loading squads...</div>;

  const openPosts = posts.filter(p => p.status === "OPEN");

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={S.label}>SQUAD FINDER ({openPosts.length} open)</div>
        <button
          style={showForm ? S.btn : S.btnPri}
          onClick={() => { setShowForm(!showForm); setMsg(""); }}
        >
          {showForm ? "Cancel" : "+ Find Squad"}
        </button>
      </div>

      {msg && (
        <div style={{
          marginBottom: 10, fontSize: 12, padding: "6px 10px", borderRadius: 8,
          background: "rgba(239,68,68,.08)", border: "1px solid rgba(239,68,68,.2)",
          color: "rgba(252,165,165,.8)",
        }}>{msg}</div>
      )}

      {/* Create Form */}
      {showForm && (
        <div style={{
          ...S.card, marginBottom: 16, display: "flex", flexDirection: "column", gap: 10,
          border: `1px solid ${accent}33`, background: `${accent}06`,
        }}>
          {/* Row 1: Mode + Rank */}
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ flex: 1 }}>
              <div style={S.label}>Mode</div>
              <select style={{ ...S.select, width: "100%" }} value={mode} onChange={e => setMode(e.target.value)}>
                {CS2_MODES.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <div style={S.label}>{mode === "Premier" || mode === "Faceit" ? "CS Rating" : "Rank"}</div>
              <select style={{ ...S.select, width: "100%" }} value={rank} onChange={e => setRank(e.target.value)}>
                {rankOptions.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </div>

          {/* Row 2: Map + Region */}
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ flex: 1 }}>
              <div style={S.label}>Map Preference</div>
              <select style={{ ...S.select, width: "100%" }} value={mapPref} onChange={e => setMapPref(e.target.value)}>
                {CS2_MAPS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <div style={S.label}>Region</div>
              <select style={{ ...S.select, width: "100%" }} value={region} onChange={e => setRegion(e.target.value)}>
                {CS2_REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </div>

          {/* Row 3: Mic toggle + Team size indicator */}
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <button
              onClick={() => setMicRequired(!micRequired)}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "6px 12px", borderRadius: 8, cursor: "pointer",
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
              Team: {maxPlayersForMode(mode)} players
            </div>
          </div>

          {/* Note */}
          <div>
            <div style={S.label}>Note (optional)</div>
            <input
              style={S.input}
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Looking for anchor on A site, need AWPer..."
              maxLength={300}
            />
          </div>

          {/* Submit */}
          <button
            style={{ ...S.btnPri, padding: "10px 24px", alignSelf: "flex-start", fontSize: 13 }}
            onClick={create}
            disabled={creating}
          >
            {creating ? "Posting..." : "Post Squad"}
          </button>
        </div>
      )}

      {/* Posts List */}
      {posts.length === 0 ? (
        <div style={{ padding: 32, textAlign: "center" }}>
          <div style={{ fontSize: 28, marginBottom: 8, opacity: 0.2 }}>{"\u{1F3AE}"}</div>
          <div style={{ opacity: 0.4, fontSize: 13, marginBottom: 4 }}>No squads posted yet</div>
          <div style={{ opacity: 0.25, fontSize: 11 }}>Be the first to find teammates</div>
        </div>
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
                {/* Top row: activity + status */}
                <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "rgba(243,244,246,.92)", lineHeight: 1.4 }}>
                      {p.activity || "Looking for squad"}
                    </div>
                    <div style={{ fontSize: 11, opacity: 0.45, marginTop: 2 }}>
                      {p.userName}
                      {p.platform && p.platform !== "pc" ? ` \u00B7 ${p.platform}` : ""}
                    </div>
                  </div>
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 4, flexShrink: 0,
                    background: isFull ? "rgba(239,68,68,.12)" : "rgba(34,197,94,.12)",
                    color: isFull ? "#EF4444" : "#22C55E",
                  }}>{p.status}</span>
                </div>

                {/* Description/note */}
                {p.description && (
                  <div style={{ fontSize: 11, color: "rgba(148,163,184,.55)", lineHeight: 1.4, fontStyle: "italic" }}>
                    {p.description}
                  </div>
                )}

                {/* Slot visualization */}
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ display: "flex", gap: 3 }}>
                    {slots.map((filled, i) => (
                      <div key={i} style={{
                        width: 22, height: 22, borderRadius: 6,
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

                {/* Player names */}
                {(p.playerNames || []).length > 0 && (
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    {p.playerNames.map((n: string, i: number) => (
                      <span key={i} style={{
                        fontSize: 10, padding: "2px 7px", borderRadius: 999,
                        background: `${accent}12`, border: `1px solid ${accent}28`,
                        color: `${accent}dd`, fontWeight: 600,
                      }}>{n}</span>
                    ))}
                  </div>
                )}

                {/* Actions */}
                <div style={{ display: "flex", gap: 6 }}>
                  {!isFull && (
                    <button
                      style={{ ...S.btnPri, fontSize: 11, padding: "5px 14px" }}
                      onClick={() => join(p.id)}
                    >Join Squad</button>
                  )}
                  <button
                    style={{ ...S.btn, fontSize: 11, padding: "5px 14px" }}
                    onClick={() => leave(p.id)}
                  >Leave</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Twitch Streams ──────────────────────────────────────────────────────────

function TwitchStreams({ gameName, lobbyId, accentColor }: { gameName: string; lobbyId: string; accentColor: string }) {
  const [streams, setStreams] = useState<StreamInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [interceptStream, setInterceptStream] = useState<StreamInfo | null>(null);
  const [activeStream, setActiveStream] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const j = await apiFetch(`/twitch/streams?game=${encodeURIComponent(gameName)}&first=20`);
      if (j.ok) setStreams(j.streams || []);
    } catch {}
    setLoading(false);
  }, [gameName]);

  useEffect(() => { load(); const i = setInterval(load, 30000); return () => clearInterval(i); }, [load]);

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

  if (loading) return <div style={{ padding: 20, textAlign: "center", opacity: 0.4, fontSize: 13 }}>Loading streams...</div>;
  if (streams.length === 0) return <div style={{ padding: 20, textAlign: "center", opacity: 0.4, fontSize: 13 }}>No live Counter-Strike 2 streams right now</div>;

  return (
    <>
      {activeStream && (
        <div style={{ borderRadius: 10, overflow: "hidden", border: `1px solid ${accentColor}40`, background: "#000", marginBottom: 8 }}>
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
          <div key={s.userLogin} onClick={() => handleCardClick(s)} style={{
            ...S.card, cursor: "pointer", display: "flex", gap: 10, alignItems: "center",
            transition: "border-color .12s",
          }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = `${accentColor}44`)}
            onMouseLeave={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,.06)")}
          >
            {s.thumbnailUrl && (
              <img
                src={(s.thumbnailUrl || "").replace("{width}", "80").replace("{height}", "45")}
                alt="" style={{ width: 80, height: 45, borderRadius: 6, objectFit: "cover", flexShrink: 0, border: "1px solid rgba(255,255,255,.06)" }}
              />
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.title}</div>
              <div style={{ fontSize: 11, opacity: 0.5, marginTop: 2 }}>{s.userName} \u00B7 {s.viewerCount?.toLocaleString()} viewers</div>
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

// ── Ranks Reference ─────────────────────────────────────────────────────────

const RANK_TIERS = [
  {
    group: "Silver",
    color: "#8A8A8A",
    ranks: ["Silver I", "Silver II", "Silver III", "Silver IV", "Silver Elite", "Silver Elite Master"],
  },
  {
    group: "Gold Nova",
    color: "#D4A017",
    ranks: ["Gold Nova I", "Gold Nova II", "Gold Nova III", "Gold Nova Master"],
  },
  {
    group: "Master Guardian",
    color: "#4A90D9",
    ranks: ["MG1", "MG2", "MGE", "DMG"],
  },
  {
    group: "Eagle+",
    color: "#B44CF0",
    ranks: ["LE", "LEM", "SMFC", "Global Elite"],
  },
];

const PREMIER_TIERS = [
  { label: "0 - 4,999",    color: "#8A8A8A", bg: "rgba(138,138,138,.08)" },
  { label: "5,000 - 9,999", color: "#4A90D9", bg: "rgba(74,144,217,.08)" },
  { label: "10,000 - 14,999", color: "#9B59B6", bg: "rgba(155,89,182,.08)" },
  { label: "15,000 - 19,999", color: "#E76EBF", bg: "rgba(231,110,191,.08)" },
  { label: "20,000+",       color: "#D4A017", bg: "rgba(212,160,23,.08)" },
];

function RanksReference({ accent }: { accent: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Premier Rating */}
      <div>
        <div style={{ ...S.label, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 12 }}>{"\u2B50"}</span> PREMIER CS RATING
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {PREMIER_TIERS.map(t => (
            <div key={t.label} style={{
              ...S.card, display: "flex", alignItems: "center", gap: 10,
              border: `1px solid ${t.color}30`, background: t.bg,
            }}>
              <div style={{
                width: 8, height: 24, borderRadius: 4, flexShrink: 0,
                background: t.color,
                boxShadow: `0 0 8px ${t.color}40`,
              }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: t.color, fontFamily: "monospace", minWidth: 130 }}>
                {t.label}
              </span>
              <div style={{
                flex: 1, height: 3, borderRadius: 2, overflow: "hidden",
                background: "rgba(255,255,255,.04)",
              }}>
                <div style={{ height: "100%", borderRadius: 2, background: `${t.color}50`, width: "100%" }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Competitive Ranks */}
      <div>
        <div style={{ ...S.label, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 12 }}>{"\u{1F396}"}</span> COMPETITIVE RANKS
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {RANK_TIERS.map(tier => (
            <div key={tier.group}>
              <div style={{
                fontSize: 11, fontWeight: 700, color: tier.color, marginBottom: 6,
                display: "flex", alignItems: "center", gap: 6,
              }}>
                <div style={{
                  width: 10, height: 10, borderRadius: 3,
                  background: tier.color, boxShadow: `0 0 6px ${tier.color}50`,
                }} />
                {tier.group}
              </div>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                {tier.ranks.map(r => (
                  <span key={r} style={{
                    fontSize: 10, padding: "3px 8px", borderRadius: 6,
                    background: `${tier.color}12`, border: `1px solid ${tier.color}28`,
                    color: `${tier.color}cc`, fontWeight: 600,
                  }}>{r}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div style={{
        ...S.card, border: `1px solid ${accent}20`, background: `${accent}04`,
        fontSize: 11, color: "rgba(148,163,184,.5)", lineHeight: 1.6,
      }}>
        <span style={{ fontWeight: 700, color: "rgba(243,244,246,.7)" }}>How it works: </span>
        Premier uses a visible CS Rating (Elo). Competitive uses the classic 18-rank ladder. Both reset with major updates. Your rank reflects individual performance plus win/loss record.
      </div>
    </div>
  );
}

// ── Map Pool ────────────────────────────────────────────────────────────────

const MAP_DATA: { name: string; color: string; bgColor: string; desc: string }[] = [
  { name: "Dust2",    color: "#D4A017", bgColor: "rgba(212,160,23,.08)",  desc: "Classic desert battleground" },
  { name: "Mirage",   color: "#E8943A", bgColor: "rgba(232,148,58,.08)", desc: "Moroccan market showdown" },
  { name: "Inferno",  color: "#E06030", bgColor: "rgba(224,96,48,.08)",  desc: "Italian street warfare" },
  { name: "Nuke",     color: "#4A90D9", bgColor: "rgba(74,144,217,.08)", desc: "Nuclear power plant, vertical play" },
  { name: "Anubis",   color: "#9B59B6", bgColor: "rgba(155,89,182,.08)", desc: "Egyptian temple, newest addition" },
  { name: "Ancient",  color: "#27AE60", bgColor: "rgba(39,174,96,.08)",  desc: "Aztec ruins, jungle setting" },
  { name: "Vertigo",  color: "#3498DB", bgColor: "rgba(52,152,219,.08)", desc: "Skyscraper rooftop combat" },
  { name: "Overpass", color: "#2ECC71", bgColor: "rgba(46,204,113,.08)", desc: "European canal, complex rotations" },
];

function MapPool({ accent }: { accent: string }) {
  return (
    <div>
      <div style={{ ...S.label, marginBottom: 10 }}>ACTIVE DUTY MAP POOL</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: 8 }}>
        {MAP_DATA.map(m => (
          <div key={m.name} style={{
            borderRadius: 12, overflow: "hidden",
            border: `1px solid ${m.color}25`,
            background: m.bgColor,
            padding: "14px 14px 12px",
            transition: "border-color .15s, transform .15s",
            cursor: "default",
          }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = `${m.color}50`;
              e.currentTarget.style.transform = "translateY(-1px)";
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = `${m.color}25`;
              e.currentTarget.style.transform = "translateY(0)";
            }}
          >
            {/* Map icon bar */}
            <div style={{
              width: "100%", height: 4, borderRadius: 2, marginBottom: 10,
              background: `linear-gradient(90deg, ${m.color}60, ${m.color}15)`,
            }} />
            <div style={{ fontSize: 15, fontWeight: 800, color: m.color, marginBottom: 4 }}>
              {m.name}
            </div>
            <div style={{ fontSize: 10, color: "rgba(148,163,184,.5)", lineHeight: 1.4 }}>
              {m.desc}
            </div>
          </div>
        ))}
      </div>

      {/* Quick reference */}
      <div style={{
        ...S.card, marginTop: 12, border: `1px solid ${accent}15`, background: `${accent}04`,
        fontSize: 11, color: "rgba(148,163,184,.45)", lineHeight: 1.6, textAlign: "center",
      }}>
        Active Duty maps rotate with CS2 major updates. Competitive and Premier queues use this pool.
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PANEL
// ═══════════════════════════════════════════════════════════════════════════════

interface Props {
  lobbyId: string;
  gameName?: string;
  accentColor?: string;
  style?: React.CSSProperties;
}

export default function CS2ModulesPanel({
  lobbyId,
  gameName = "Counter-Strike 2",
  accentColor = ACCENT_CS2,
  style,
}: Props) {
  const [tab, setTab] = useState<TabId>("lfg");

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0, ...style }}>
      {/* Tabs */}
      <div style={{
        display: "flex", gap: 2, padding: "8px 12px 0",
        borderBottom: "1px solid rgba(255,255,255,.07)", flexShrink: 0, overflowX: "auto",
      }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: "7px 12px", borderRadius: "8px 8px 0 0", border: "none",
            background: tab === t.id ? `${accentColor}20` : "transparent",
            color: tab === t.id ? "rgba(243,244,246,.92)" : "rgba(148,163,184,.65)",
            fontWeight: tab === t.id ? 700 : 400, fontSize: 12, cursor: "pointer",
            transition: "background .1s, color .1s",
            display: "flex", alignItems: "center", gap: 5, whiteSpace: "nowrap",
          }}>
            <span style={{ fontSize: 13 }}>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "14px 14px 14px", display: "flex", flexDirection: "column" }}>
        {tab === "lfg"     && <SquadFinder lobbyId={lobbyId} accent={accentColor} />}
        {tab === "streams" && <TwitchStreams gameName={gameName} lobbyId={lobbyId} accentColor={accentColor} />}
        {tab === "ranks"   && <RanksReference accent={accentColor} />}
        {tab === "maps"    && <MapPool accent={accentColor} />}
      </div>

      {/* Valve legal disclaimer */}
      <div style={{ padding: "6px 14px 8px", flexShrink: 0, borderTop: "1px solid rgba(255,255,255,.04)" }}>
        <p style={{ fontSize: 9, color: "rgba(100,116,139,.35)", lineHeight: 1.4, margin: 0, textAlign: "center" }}>
          Weered is not affiliated with, endorsed by, or sponsored by Valve Corporation. Counter-Strike 2 and all related logos and trademarks are the property of Valve Corporation.
        </p>
      </div>
    </div>
  );
}

"use client";
import React, { useEffect, useState, useCallback } from "react";
import TournamentsPanel from "./TournamentsPanel";

// Chess modules panel — five tabs covering the essentials:
//   STREAMS      — Twitch chess streamers (Hikaru, GothamChess, etc)
//   CHALLENGES   — chess-specific challenges from /challenges?lobbyId=chess
//   TOURNAMENTS  — reuses TournamentsPanel (templates already chess-aware)
//   PROFILE      — linked Lichess + Chess.com usernames + live ratings
//   AUDIT        — recent ChessActivityLog rows with full metadata

const ACCENT_CHESS = "#7C3AED";
const API = process.env.NEXT_PUBLIC_API_BASE || "https://api.weered.ca";

function tokenHeader(): Record<string, string> {
  try {
    const t = typeof window !== "undefined" ? localStorage.getItem("weered_token") : null;
    return t ? { Authorization: `Bearer ${t}` } : {};
  } catch { return {}; }
}

const TABS = [
  { id: "streams",     label: "Live Streams",  icon: "📺" },
  { id: "challenges",  label: "Challenges",    icon: "🎯" },
  { id: "tournaments", label: "Tournaments",   icon: "🏆" },
  { id: "profile",     label: "My Chess",      icon: "♟" },
  { id: "audit",       label: "Game Audit",    icon: "🔍" },
] as const;

type TabId = typeof TABS[number]["id"];

export default function ChessModulesPanel({
  lobbyId,
  currentUserId,
  isStaff,
  style,
}: {
  lobbyId: string;
  currentUserId?: string;
  isStaff?: boolean;
  style?: React.CSSProperties;
}) {
  const [tab, setTab] = useState<TabId>("challenges");

  useEffect(() => {
    const handler = () => setTab("tournaments");
    window.addEventListener("weered:openTournamentsTab", handler as any);
    return () => window.removeEventListener("weered:openTournamentsTab", handler as any);
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0, ...style }}>
      <div style={{ display: "flex", gap: 2, padding: "8px 12px 0", borderBottom: "1px solid rgba(255,255,255,.07)", flexShrink: 0, flexWrap: "wrap" }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: "7px 12px",
              borderRadius: "8px 8px 0 0",
              border: "none",
              background: tab === t.id ? `${ACCENT_CHESS}20` : "transparent",
              color: tab === t.id ? "rgba(243,244,246,.92)" : "rgba(148,163,184,.65)",
              fontWeight: tab === t.id ? 700 : 400,
              fontSize: 12,
              cursor: "pointer",
              transition: "background .1s, color .1s",
              display: "flex", alignItems: "center", gap: 5,
              fontFamily: "inherit",
            }}
          >
            <span style={{ fontSize: 13 }}>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "14px" }}>
        {tab === "streams"     && <ChessStreams />}
        {tab === "challenges"  && <ChessChallenges lobbyId={lobbyId} />}
        {tab === "tournaments" && <TournamentsPanel lobbyId={lobbyId} currentUserId={currentUserId} isStaff={isStaff} />}
        {tab === "profile"     && <ChessProfile />}
        {tab === "audit"       && <ChessAudit />}
      </div>
    </div>
  );
}

// ── Streams (Twitch chess directory) ─────────────────────────────────────────
function ChessStreams() {
  const [streams, setStreams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/twitch/streams?game=Chess`)
      .then(r => r.ok ? r.json() : null)
      .then(j => { if (j?.streams) setStreams(j.streams); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ color: "rgba(255,255,255,.4)", textAlign: "center", padding: 30 }}>Loading streams…</div>;
  if (streams.length === 0) return <div style={{ color: "rgba(255,255,255,.4)", textAlign: "center", padding: 30 }}>No chess streams live right now. Check back later.</div>;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10 }}>
      {streams.map((s: any) => (
        <a key={s.id || s.user_name} href={`https://twitch.tv/${s.user_login || s.user_name}`} target="_blank" rel="noreferrer" style={{
          textDecoration: "none", color: "inherit", border: "1px solid rgba(124,58,237,.25)",
          borderRadius: 6, overflow: "hidden", background: "rgba(255,255,255,.03)",
        }}>
          {s.thumbnail_url && (
            <img src={String(s.thumbnail_url).replace("{width}", "320").replace("{height}", "180")} alt="" style={{ width: "100%", display: "block" }} />
          )}
          <div style={{ padding: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,.92)" }}>{s.user_name || s.user_login}</div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,.55)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 2 }}>{s.title}</div>
            <div style={{ fontSize: 9, color: "rgba(124,58,237,.8)", marginTop: 4, fontWeight: 700 }}>{s.viewer_count?.toLocaleString?.()} watching</div>
          </div>
        </a>
      ))}
    </div>
  );
}

// ── Challenges (chess lobby's challenges) ────────────────────────────────────
function ChessChallenges({ lobbyId }: { lobbyId: string }) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    setLoading(true);
    fetch(`${API}/challenges?lobbyId=${encodeURIComponent(lobbyId)}`, { headers: tokenHeader() })
      .then(r => r.json())
      .then(j => { if (j?.ok && Array.isArray(j.challenges)) setItems(j.challenges); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [lobbyId]);

  useEffect(() => { refresh(); }, [refresh]);

  async function enroll(instanceId: string) {
    const r = await fetch(`${API}/challenges/${encodeURIComponent(instanceId)}/enroll`, {
      method: "POST", headers: tokenHeader(),
    });
    if (r.ok) refresh();
  }

  if (loading) return <div style={{ color: "rgba(255,255,255,.4)", textAlign: "center", padding: 30 }}>Loading challenges…</div>;
  if (items.length === 0) return <div style={{ color: "rgba(255,255,255,.4)", textAlign: "center", padding: 30 }}>No active chess challenges.</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {items.map((c: any) => {
        const def = c.definition || c;
        const enr = c.enrollment;
        const done = enr?.status === "COMPLETED";
        return (
          <div key={c.id || def.id} style={{
            padding: 12, background: done ? "rgba(34,197,94,.06)" : "rgba(255,255,255,.03)",
            border: `1px solid ${done ? "rgba(34,197,94,.30)" : "rgba(124,58,237,.20)"}`,
            borderRadius: 6,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: "rgba(255,255,255,.95)" }}>{def.title}</div>
              <div style={{ fontSize: 9, color: "rgba(124,58,237,.7)", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6 }}>
                {def.category || "chess"}
                {def.notorietyReward ? ` · ${def.notorietyReward} XP` : ""}
                {def.paperReward ? ` · ${def.paperReward}P` : ""}
              </div>
            </div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,.65)", lineHeight: 1.5, marginTop: 4 }}>{def.description}</div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,.5)" }}>
                {enr ? (done ? `✓ Completed ${enr.completedAt ? new Date(enr.completedAt).toLocaleDateString() : ""}` : `Progress: ${JSON.stringify(enr.progress || {}).slice(0, 80)}`) : "Not enrolled"}
              </div>
              {!enr && c.instanceId && (
                <button onClick={() => enroll(c.instanceId)} style={{
                  padding: "4px 10px", fontSize: 10, fontWeight: 800, background: "rgba(124,58,237,.18)",
                  border: "1px solid rgba(124,58,237,.55)", color: "#c4b5fd", borderRadius: 3, cursor: "pointer",
                  fontFamily: "inherit", letterSpacing: 0.4, textTransform: "uppercase",
                }}>Enroll</button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── My Chess (profile + ratings) ─────────────────────────────────────────────
function ChessProfile() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/chess/me/profile`, { headers: tokenHeader() })
      .then(r => r.json())
      .then(j => setData(j))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ color: "rgba(255,255,255,.4)", textAlign: "center", padding: 30 }}>Loading profile…</div>;
  if (!data?.ok) return <div style={{ color: "rgba(255,255,255,.4)", textAlign: "center", padding: 30 }}>Not authed.</div>;

  const noneLinked = !data.lichessUsername && !data.chessComUsername;
  if (noneLinked) {
    return (
      <div style={{ textAlign: "center", padding: 30, lineHeight: 1.6 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "rgba(255,255,255,.85)", marginBottom: 8 }}>No chess account linked yet</div>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,.55)" }}>
          Go to Settings → External Integrations and link your Lichess or Chess.com username. We poll your recent games every 5 minutes and credit Weered chess challenges/tournaments automatically.
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {data.lichess && (
        <div style={{ padding: 14, background: "rgba(124,58,237,.05)", border: "1px solid rgba(124,58,237,.25)", borderRadius: 6 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: "rgba(196,181,253,.95)" }}>Lichess</div>
            <a href={data.lichess.url} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: "rgba(124,58,237,.85)" }}>@{data.lichess.username}</a>
          </div>
          {data.lichess.perfs && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: 8 }}>
              {Object.entries(data.lichess.perfs).map(([perf, v]: any) => (
                <div key={perf} style={{ padding: 8, background: "rgba(255,255,255,.04)", borderRadius: 4 }}>
                  <div style={{ fontSize: 9, color: "rgba(255,255,255,.55)", textTransform: "uppercase", letterSpacing: 0.6, fontWeight: 700 }}>{perf}</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: "rgba(255,255,255,.92)", marginTop: 2 }}>{v.rating}</div>
                  <div style={{ fontSize: 9, color: "rgba(255,255,255,.45)", marginTop: 2 }}>{v.games} games · {v.prog >= 0 ? "+" : ""}{v.prog}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {data.chessCom && (
        <div style={{ padding: 14, background: "rgba(34,197,94,.05)", border: "1px solid rgba(34,197,94,.25)", borderRadius: 6 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: "rgba(134,239,172,.95)" }}>Chess.com</div>
            <a href={data.chessCom.url} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: "rgba(34,197,94,.85)" }}>@{data.chessCom.username}</a>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: 8 }}>
            {Object.entries(data.chessCom.ratings).map(([k, v]: any) => v != null && (
              <div key={k} style={{ padding: 8, background: "rgba(255,255,255,.04)", borderRadius: 4 }}>
                <div style={{ fontSize: 9, color: "rgba(255,255,255,.55)", textTransform: "uppercase", letterSpacing: 0.6, fontWeight: 700 }}>{k}</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: "rgba(255,255,255,.92)", marginTop: 2 }}>{v}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Game Audit (recent ChessActivityLog) ─────────────────────────────────────
function ChessAudit() {
  const [games, setGames] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/chess/me/activities?limit=25`, { headers: tokenHeader() })
      .then(r => r.json())
      .then(j => { if (j?.ok && Array.isArray(j.activities)) setGames(j.activities); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ color: "rgba(255,255,255,.4)", textAlign: "center", padding: 30 }}>Loading games…</div>;
  if (games.length === 0) return (
    <div style={{ color: "rgba(255,255,255,.4)", textAlign: "center", padding: 30, lineHeight: 1.6 }}>
      No games ingested yet.<br/>
      <span style={{ fontSize: 11, opacity: 0.7 }}>Link your Lichess / Chess.com in Settings. Worker polls every 5 minutes — first poll fires ~30s after server start.</span>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ fontSize: 11, color: "rgba(255,255,255,.55)", marginBottom: 4 }}>Last {games.length} games — full metadata from the provider. Source of truth.</div>
      {games.map((g: any) => {
        const win = g.result === "WIN", loss = g.result === "LOSS";
        return (
          <div key={g.id || g.externalGameId} style={{
            padding: 8, background: "rgba(255,255,255,.03)",
            border: `1px solid ${win ? "rgba(34,197,94,.25)" : loss ? "rgba(239,68,68,.20)" : "rgba(255,255,255,.08)"}`,
            borderRadius: 4,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: win ? "rgba(134,239,172,.95)" : loss ? "rgba(252,165,165,.85)" : "rgba(255,255,255,.85)" }}>
                {g.result} · {g.timeControl} · {g.color}
              </div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,.5)" }}>{new Date(g.playedAt).toLocaleString()}</div>
            </div>
            <div style={{ display: "flex", gap: 10, fontSize: 10, color: "rgba(255,255,255,.55)", marginTop: 4, flexWrap: "wrap" }}>
              <span style={{ color: g.provider === "LICHESS" ? "rgba(196,181,253,.85)" : "rgba(134,239,172,.85)", fontWeight: 700 }}>{g.provider}</span>
              {g.opponent && <span>vs {g.opponent}{g.opponentRating ? ` (${g.opponentRating})` : ""}</span>}
              {g.rating && <span>my rating: {g.rating}{typeof g.ratingDiff === "number" && g.ratingDiff !== 0 ? ` (${g.ratingDiff > 0 ? "+" : ""}${g.ratingDiff})` : ""}</span>}
              {g.openingName && <span style={{ color: "rgba(255,255,255,.7)" }}>{g.ecoCode || ""} {g.openingName}</span>}
              {g.termination && <span style={{ opacity: 0.6 }}>{g.termination}</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

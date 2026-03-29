"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";

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
  btnPri: (accent: string) => ({ padding: "6px 12px", borderRadius: 8, border: `1px solid ${accent}55`, background: `${accent}18`, fontSize: 12, cursor: "pointer", color: "#fff", fontWeight: 600 }) as React.CSSProperties,
  input: { width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,.10)", background: "rgba(0,0,0,.30)", fontSize: 13, color: "rgba(243,244,246,.92)", outline: "none", boxSizing: "border-box" as const },
  label: { fontSize: 10, fontWeight: 700, opacity: 0.45, letterSpacing: ".7px", textTransform: "uppercase" as const, marginBottom: 6 } as React.CSSProperties,
};

const MLB_RED = "#C41E3A";

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function fmtTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  } catch { return iso; }
}

function headshot(playerId: number | string): string {
  return `https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_213,q_auto:best/v1/people/${playerId}/headshot/67/current`;
}

// ── Scoreboard Tab ───────────────────────────────────────────────────────────

function Scoreboard({ accentColor }: { accentColor: string }) {
  const accent = accentColor || MLB_RED;
  const [date, setDate] = useState(() => new Date());
  const [games, setGames] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [boxscore, setBoxscore] = useState<any>(null);
  const [boxLoading, setBoxLoading] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    apiFetch(`/mlb/scoreboard?date=${fmtDate(date)}`)
      .then(j => {
        if (j.ok) setGames(j.games || []);
        else setError(j.error || "Failed to load scoreboard");
        setLoading(false);
      })
      .catch(() => { setError("Network error"); setLoading(false); });
  }, [date]);

  useEffect(() => { load(); const i = setInterval(load, 30000); return () => clearInterval(i); }, [load]);

  function shiftDate(delta: number) {
    setDate(prev => { const d = new Date(prev); d.setDate(d.getDate() + delta); return d; });
    setExpanded(null);
    setBoxscore(null);
  }

  function toggleExpand(gameId: string) {
    if (expanded === gameId) {
      setExpanded(null);
      setBoxscore(null);
      return;
    }
    setExpanded(gameId);
    setBoxLoading(true);
    setBoxscore(null);
    apiFetch(`/mlb/game/${gameId}/boxscore`)
      .then(j => { if (j.ok !== false) setBoxscore(j.game || j); setBoxLoading(false); })
      .catch(() => setBoxLoading(false));
  }

  function statusBadge(g: any) {
    const status = (g.status || g.gameStatus || "").toLowerCase();
    if (status.includes("final")) {
      return <span style={{ fontSize: 9, fontWeight: 800, padding: "2px 6px", borderRadius: 999, background: "rgba(255,255,255,.08)", color: "rgba(255,255,255,.5)" }}>FINAL</span>;
    }
    if (status.includes("live") || status.includes("progress") || status.includes("in progress")) {
      return (
        <span style={{ fontSize: 9, fontWeight: 800, padding: "2px 6px", borderRadius: 999, background: `${accent}20`, color: accent, display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 6px rgba(34,197,94,.6)" }} />
          {g.inning ? `${g.inningHalf || ""} ${g.inning}` : "LIVE"}
        </span>
      );
    }
    if (status.includes("postpone")) {
      return <span style={{ fontSize: 9, fontWeight: 800, padding: "2px 6px", borderRadius: 999, background: "rgba(245,158,11,.12)", color: "rgb(253,230,138)" }}>PPD</span>;
    }
    // Upcoming
    return <span style={{ fontSize: 10, opacity: 0.5 }}>{g.startTime ? fmtTime(g.startTime) : "TBD"}</span>;
  }

  const isLive = (g: any) => {
    const s = (g.status || g.gameStatus || "").toLowerCase();
    return s.includes("live") || s.includes("progress") || s.includes("in progress");
  };

  const isFinal = (g: any) => (g.status || g.gameStatus || "").toLowerCase().includes("final");
  const isUpcoming = (g: any) => !isLive(g) && !isFinal(g) && !(g.status || "").toLowerCase().includes("postpone");

  if (loading && games.length === 0) return <div style={{ padding: 20, textAlign: "center", opacity: 0.4, fontSize: 13 }}>Loading scoreboard...</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {/* Date picker */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14 }}>
        <button onClick={() => shiftDate(-1)} style={{ ...S.btn, padding: "4px 10px", fontSize: 16, lineHeight: 1 }} title="Previous day">&larr;</button>
        <div style={{ fontWeight: 800, fontSize: 14, minWidth: 140, textAlign: "center" }}>
          {date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
        </div>
        <button onClick={() => shiftDate(1)} style={{ ...S.btn, padding: "4px 10px", fontSize: 16, lineHeight: 1 }} title="Next day">&rarr;</button>
      </div>

      {error && <div style={{ fontSize: 12, color: "rgba(252,165,165,.8)", textAlign: "center" }}>{error}</div>}

      {loading && games.length > 0 && (
        <div style={{ fontSize: 10, textAlign: "center", opacity: 0.3 }}>Refreshing...</div>
      )}

      {/* Game cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {games.map(g => {
          const gid = g.gamePk || g.id || g.gameId;
          const isExp = expanded === String(gid);
          return (
            <div key={gid}>
              <div
                onClick={() => toggleExpand(String(gid))}
                style={{
                  ...S.card,
                  cursor: "pointer",
                  transition: "border-color .15s, background .15s",
                  border: isExp ? `1px solid ${accent}40` : "1px solid rgba(255,255,255,.08)",
                  background: isExp ? `${accent}08` : "rgba(255,255,255,.03)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                  {statusBadge(g)}
                  {isLive(g) && g.count && (
                    <div style={{ fontSize: 9, opacity: 0.5, display: "flex", gap: 8 }}>
                      <span>B: {g.count.balls ?? "-"}</span>
                      <span>S: {g.count.strikes ?? "-"}</span>
                      <span>O: {g.count.outs ?? "-"}</span>
                    </div>
                  )}
                </div>

                {/* Teams and scores */}
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {/* Away */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
                      <span style={{ fontWeight: 700, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {g.awayTeam || g.away?.name || "Away"}
                      </span>
                      {g.awayRecord && <span style={{ fontSize: 10, opacity: 0.35 }}>({g.awayRecord})</span>}
                    </div>
                    <span style={{ fontWeight: 900, fontSize: 18, minWidth: 28, textAlign: "right", fontVariantNumeric: "tabular-nums", color: !isUpcoming(g) ? "#fff" : "rgba(255,255,255,.2)" }}>
                      {g.awayScore ?? (isUpcoming(g) ? "" : "0")}
                    </span>
                  </div>
                  {/* Home */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
                      <span style={{ fontWeight: 700, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {g.homeTeam || g.home?.name || "Home"}
                      </span>
                      {g.homeRecord && <span style={{ fontSize: 10, opacity: 0.35 }}>({g.homeRecord})</span>}
                    </div>
                    <span style={{ fontWeight: 900, fontSize: 18, minWidth: 28, textAlign: "right", fontVariantNumeric: "tabular-nums", color: !isUpcoming(g) ? "#fff" : "rgba(255,255,255,.2)" }}>
                      {g.homeScore ?? (isUpcoming(g) ? "" : "0")}
                    </span>
                  </div>
                </div>

                {/* Probable pitchers for upcoming */}
                {isUpcoming(g) && (g.awayProbable || g.homeProbable) && (
                  <div style={{ marginTop: 8, paddingTop: 6, borderTop: "1px solid rgba(255,255,255,.05)", display: "flex", justifyContent: "space-between", fontSize: 10, opacity: 0.45 }}>
                    <span>{g.awayProbable || "TBD"}</span>
                    <span style={{ fontWeight: 700, opacity: 0.3 }}>vs</span>
                    <span>{g.homeProbable || "TBD"}</span>
                  </div>
                )}
              </div>

              {/* Expanded boxscore */}
              {isExp && (
                <div style={{ ...S.card, marginTop: 2, borderTop: "none", borderTopLeftRadius: 0, borderTopRightRadius: 0, border: `1px solid ${accent}25`, background: `${accent}05` }}>
                  {boxLoading && <div style={{ textAlign: "center", padding: 12, opacity: 0.4, fontSize: 12 }}>Loading boxscore...</div>}
                  {!boxLoading && boxscore && (
                    <div style={{ overflowX: "auto" }}>
                      {/* Linescore */}
                      {boxscore.linescore && (
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                          <thead>
                            <tr style={{ borderBottom: "1px solid rgba(255,255,255,.08)" }}>
                              <th style={{ textAlign: "left", padding: "4px 6px", fontWeight: 700, opacity: 0.5, minWidth: 80 }}>Team</th>
                              {(boxscore.linescore.innings || []).map((_: any, i: number) => (
                                <th key={i} style={{ textAlign: "center", padding: "4px 4px", fontWeight: 600, opacity: 0.35, minWidth: 20 }}>{i + 1}</th>
                              ))}
                              <th style={{ textAlign: "center", padding: "4px 6px", fontWeight: 800, opacity: 0.7, borderLeft: "1px solid rgba(255,255,255,.08)" }}>R</th>
                              <th style={{ textAlign: "center", padding: "4px 6px", fontWeight: 800, opacity: 0.7 }}>H</th>
                              <th style={{ textAlign: "center", padding: "4px 6px", fontWeight: 800, opacity: 0.7 }}>E</th>
                            </tr>
                          </thead>
                          <tbody>
                            {["away", "home"].map(side => (
                              <tr key={side} style={{ borderBottom: "1px solid rgba(255,255,255,.04)" }}>
                                <td style={{ padding: "4px 6px", fontWeight: 700, fontSize: 11 }}>
                                  {side === "away" ? (g.awayTeam || g.away?.name || "Away") : (g.homeTeam || g.home?.name || "Home")}
                                </td>
                                {(boxscore.linescore.innings || []).map((inn: any, i: number) => (
                                  <td key={i} style={{ textAlign: "center", padding: "4px 4px", fontVariantNumeric: "tabular-nums", opacity: 0.7 }}>
                                    {inn[side]?.runs ?? "-"}
                                  </td>
                                ))}
                                <td style={{ textAlign: "center", padding: "4px 6px", fontWeight: 900, borderLeft: "1px solid rgba(255,255,255,.08)" }}>
                                  {boxscore.linescore[side]?.runs ?? (side === "away" ? g.awayScore : g.homeScore) ?? "-"}
                                </td>
                                <td style={{ textAlign: "center", padding: "4px 6px", fontWeight: 600, opacity: 0.7 }}>
                                  {boxscore.linescore[side]?.hits ?? "-"}
                                </td>
                                <td style={{ textAlign: "center", padding: "4px 6px", fontWeight: 600, opacity: 0.7 }}>
                                  {boxscore.linescore[side]?.errors ?? "-"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}

                      {/* Winning/Losing/Save pitchers */}
                      {(boxscore.winningPitcher || boxscore.losingPitcher || boxscore.savePitcher) && (
                        <div style={{ display: "flex", gap: 12, marginTop: 8, fontSize: 10, opacity: 0.5, flexWrap: "wrap" }}>
                          {boxscore.winningPitcher && <span><strong style={{ color: "#4ade80" }}>W:</strong> {boxscore.winningPitcher}</span>}
                          {boxscore.losingPitcher && <span><strong style={{ color: "#f87171" }}>L:</strong> {boxscore.losingPitcher}</span>}
                          {boxscore.savePitcher && <span><strong style={{ color: "#60a5fa" }}>SV:</strong> {boxscore.savePitcher}</span>}
                        </div>
                      )}

                      {!boxscore.linescore && (
                        <div style={{ textAlign: "center", padding: 8, opacity: 0.35, fontSize: 12 }}>Boxscore data not yet available</div>
                      )}
                    </div>
                  )}
                  {!boxLoading && !boxscore && (
                    <div style={{ textAlign: "center", padding: 8, opacity: 0.35, fontSize: 12 }}>No boxscore data available</div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {games.length === 0 && !loading && !error && (
        <div style={{ textAlign: "center", padding: 30, opacity: 0.35, fontSize: 13 }}>No games scheduled for this date.</div>
      )}
    </div>
  );
}

// ── Standings Tab ─────────────────────────────────────────────────────────────

const DIVISION_ORDER = ["AL East", "AL Central", "AL West", "NL East", "NL Central", "NL West"];

function Standings({ accentColor }: { accentColor: string }) {
  const accent = accentColor || MLB_RED;
  const [divisions, setDivisions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch("/mlb/standings")
      .then(j => {
        if (j.ok !== false) setDivisions(j.divisions || []);
        else setError(j.error || "Failed to load standings");
        setLoading(false);
      })
      .catch(() => { setError("Network error"); setLoading(false); });
  }, []);

  if (loading) return <div style={{ padding: 20, textAlign: "center", opacity: 0.4, fontSize: 13 }}>Loading standings...</div>;
  if (error) return <div style={{ padding: 20, textAlign: "center", fontSize: 12, color: "rgba(252,165,165,.8)" }}>{error}</div>;

  // Sort divisions into standard order
  const sorted = [...divisions].sort((a, b) => {
    const ai = DIVISION_ORDER.indexOf(a.name || a.division);
    const bi = DIVISION_ORDER.indexOf(b.name || b.division);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {sorted.map(div => (
        <div key={div.name || div.division}>
          {/* Division header */}
          <div style={{
            fontWeight: 900, fontSize: 13, letterSpacing: ".5px", textTransform: "uppercase",
            padding: "6px 10px", marginBottom: 4, borderRadius: 6,
            background: `${accent}12`, borderLeft: `3px solid ${accent}`,
            color: "rgba(243,244,246,.88)",
          }}>
            {div.name || div.division}
          </div>

          {/* Table */}
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(255,255,255,.08)" }}>
                  {["Team", "W", "L", "PCT", "GB", "STRK", "L10", "DIFF"].map(col => (
                    <th key={col} style={{
                      textAlign: col === "Team" ? "left" : "center",
                      padding: "5px 6px", fontWeight: 700, opacity: 0.4, fontSize: 9,
                      letterSpacing: ".5px", textTransform: "uppercase",
                    }}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(div.teams || []).map((t: any, i: number) => {
                  const diff = t.runDifferential ?? t.diff ?? 0;
                  const diffColor = diff > 0 ? "#4ade80" : diff < 0 ? "#f87171" : "rgba(255,255,255,.5)";
                  const diffStr = diff > 0 ? `+${diff}` : String(diff);
                  return (
                    <tr key={t.name || i} style={{
                      borderBottom: "1px solid rgba(255,255,255,.03)",
                      background: i === 0 ? `${accent}06` : "transparent",
                    }}>
                      <td style={{ padding: "6px 6px", fontWeight: 700, fontSize: 12, whiteSpace: "nowrap" }}>
                        {t.name || t.team || "—"}
                      </td>
                      <td style={{ textAlign: "center", padding: "6px 4px", fontVariantNumeric: "tabular-nums" }}>{t.wins ?? t.w ?? "-"}</td>
                      <td style={{ textAlign: "center", padding: "6px 4px", fontVariantNumeric: "tabular-nums" }}>{t.losses ?? t.l ?? "-"}</td>
                      <td style={{ textAlign: "center", padding: "6px 4px", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{t.pct ?? t.winPct ?? "-"}</td>
                      <td style={{ textAlign: "center", padding: "6px 4px", opacity: 0.6 }}>{t.gamesBack ?? t.gb ?? "-"}</td>
                      <td style={{ textAlign: "center", padding: "6px 4px", opacity: 0.6 }}>{t.streak ?? t.strk ?? "-"}</td>
                      <td style={{ textAlign: "center", padding: "6px 4px", opacity: 0.6 }}>{t.lastTen ?? t.l10 ?? "-"}</td>
                      <td style={{ textAlign: "center", padding: "6px 4px", fontWeight: 700, color: diffColor }}>{diffStr}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {divisions.length === 0 && (
        <div style={{ textAlign: "center", padding: 30, opacity: 0.35, fontSize: 13 }}>No standings data available.</div>
      )}
    </div>
  );
}

// ── Leaders Tab ──────────────────────────────────────────────────────────────

const BATTING_CATS = ["HR", "AVG", "RBI", "SB"];
const PITCHING_CATS = ["ERA", "K", "W", "SV"];

function Leaders({ accentColor, onPlayerClick }: { accentColor: string; onPlayerClick: (id: string | number, name: string) => void }) {
  const accent = accentColor || MLB_RED;
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch("/mlb/leaders")
      .then(j => {
        if (j.ok !== false) setCategories(j.categories || []);
        else setError(j.error || "Failed to load leaders");
        setLoading(false);
      })
      .catch(() => { setError("Network error"); setLoading(false); });
  }, []);

  if (loading) return <div style={{ padding: 20, textAlign: "center", opacity: 0.4, fontSize: 13 }}>Loading leaderboards...</div>;
  if (error) return <div style={{ padding: 20, textAlign: "center", fontSize: 12, color: "rgba(252,165,165,.8)" }}>{error}</div>;

  const getCat = (name: string) => categories.find((c: any) => (c.name || c.stat || "").toUpperCase() === name.toUpperCase());

  function LeaderCard({ statName }: { statName: string }) {
    const cat = getCat(statName);
    if (!cat) return null;
    const leaders = cat.leaders || cat.players || [];
    return (
      <div style={{ ...S.card, padding: "8px 10px" }}>
        <div style={{
          fontWeight: 900, fontSize: 12, letterSpacing: ".5px", textTransform: "uppercase",
          marginBottom: 8, color: accent, display: "flex", alignItems: "center", gap: 6,
        }}>
          {statName}
          <span style={{ fontSize: 9, fontWeight: 400, opacity: 0.4, textTransform: "none", letterSpacing: "0" }}>
            {cat.fullName || cat.displayName || ""}
          </span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {leaders.slice(0, 10).map((p: any, i: number) => (
            <div
              key={p.id || p.playerId || i}
              onClick={() => (p.id || p.playerId) && onPlayerClick(p.id || p.playerId, p.name || p.playerName || "")}
              style={{
                display: "flex", alignItems: "center", gap: 6, padding: "3px 4px", borderRadius: 4,
                cursor: (p.id || p.playerId) ? "pointer" : "default",
                transition: "background .1s",
                background: i === 0 ? `${accent}0A` : "transparent",
              }}
              onMouseEnter={e => { if (p.id || p.playerId) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,.05)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = i === 0 ? `${accent}0A` : "transparent"; }}
            >
              <span style={{ width: 16, fontWeight: 800, fontSize: 10, opacity: i === 0 ? 1 : 0.4, color: i === 0 ? accent : "inherit", textAlign: "right" }}>
                {i + 1}
              </span>
              <span style={{ flex: 1, fontSize: 11, fontWeight: i === 0 ? 700 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {p.name || p.playerName || "Unknown"}
              </span>
              <span style={{ fontSize: 9, opacity: 0.35, flexShrink: 0 }}>{p.team || p.teamAbbrev || ""}</span>
              <span style={{ fontWeight: 800, fontSize: 12, fontVariantNumeric: "tabular-nums", minWidth: 36, textAlign: "right", color: i === 0 ? accent : "rgba(243,244,246,.88)" }}>
                {p.value ?? p.stat ?? "-"}
              </span>
            </div>
          ))}
        </div>
        {leaders.length === 0 && <div style={{ fontSize: 11, opacity: 0.35, textAlign: "center", padding: 8 }}>No data</div>}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Batting */}
      <div>
        <div style={{ ...S.label, marginBottom: 8 }}>Batting Leaders</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 8 }}>
          {BATTING_CATS.map(cat => <LeaderCard key={cat} statName={cat} />)}
        </div>
      </div>

      {/* Pitching */}
      <div>
        <div style={{ ...S.label, marginBottom: 8 }}>Pitching Leaders</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 8 }}>
          {PITCHING_CATS.map(cat => <LeaderCard key={cat} statName={cat} />)}
        </div>
      </div>

      {categories.length === 0 && (
        <div style={{ textAlign: "center", padding: 30, opacity: 0.35, fontSize: 13 }}>No leaderboard data available.</div>
      )}
    </div>
  );
}

// ── Player Search Tab ────────────────────────────────────────────────────────

function PlayerSearch({ accentColor, initialPlayerId, initialPlayerName }: {
  accentColor: string;
  initialPlayerId?: string | number | null;
  initialPlayerName?: string | null;
}) {
  const accent = accentColor || MLB_RED;
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedPlayer, setSelectedPlayer] = useState<any>(null);
  const [playerStats, setPlayerStats] = useState<any>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState("");
  const initialLoaded = useRef(false);

  // Load a player from external trigger (e.g., Leaders tab click)
  useEffect(() => {
    if (initialPlayerId && !initialLoaded.current) {
      initialLoaded.current = true;
      loadPlayerStats(initialPlayerId);
    }
  }, [initialPlayerId]);

  function search() {
    if (!query.trim()) return;
    setLoading(true);
    setError("");
    setResults([]);
    setSelectedPlayer(null);
    setPlayerStats(null);
    apiFetch(`/mlb/player/search?q=${encodeURIComponent(query.trim())}`)
      .then(j => {
        if (j.ok !== false) setResults(j.players || []);
        else setError(j.error || "Search failed");
        setLoading(false);
      })
      .catch(() => { setError("Network error"); setLoading(false); });
  }

  function loadPlayerStats(id: string | number) {
    setStatsLoading(true);
    setStatsError("");
    setPlayerStats(null);
    apiFetch(`/mlb/player/${id}/stats`)
      .then(j => {
        if (j.ok !== false) {
          setSelectedPlayer(j.player || { id });
          setPlayerStats(j.stats || j);
        } else {
          setStatsError(j.error || "Failed to load player stats");
        }
        setStatsLoading(false);
      })
      .catch(() => { setStatsError("Network error"); setStatsLoading(false); });
  }

  function selectPlayer(p: any) {
    setSelectedPlayer(p);
    loadPlayerStats(p.id || p.playerId);
  }

  function goBack() {
    setSelectedPlayer(null);
    setPlayerStats(null);
    setStatsError("");
    initialLoaded.current = false;
  }

  // Player detail view
  if (selectedPlayer || statsLoading) {
    const pid = selectedPlayer?.id || selectedPlayer?.playerId || initialPlayerId;
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <button onClick={goBack} style={{ ...S.btn, alignSelf: "flex-start", display: "flex", alignItems: "center", gap: 4 }}>
          &larr; Back to search
        </button>

        {statsLoading && <div style={{ padding: 20, textAlign: "center", opacity: 0.4, fontSize: 13 }}>Loading player stats...</div>}
        {statsError && <div style={{ fontSize: 12, color: "rgba(252,165,165,.8)", textAlign: "center" }}>{statsError}</div>}

        {selectedPlayer && !statsLoading && (
          <>
            {/* Player hero card */}
            <div style={{
              ...S.card,
              display: "flex", gap: 16, alignItems: "flex-start",
              border: `1px solid ${accent}30`, background: `${accent}08`,
              padding: "16px 16px",
            }}>
              <div style={{
                width: 80, height: 80, borderRadius: 12, overflow: "hidden", flexShrink: 0,
                background: "rgba(0,0,0,.4)", border: `2px solid ${accent}40`,
              }}>
                <img
                  src={headshot(pid)}
                  alt={selectedPlayer.name || selectedPlayer.fullName || ""}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 900, fontSize: 20, lineHeight: 1.2, marginBottom: 4 }}>
                  {selectedPlayer.name || selectedPlayer.fullName || initialPlayerName || "Unknown"}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, fontSize: 11, opacity: 0.6 }}>
                  {(selectedPlayer.position || selectedPlayer.primaryPosition) && (
                    <span style={{ padding: "1px 6px", borderRadius: 4, background: `${accent}18`, border: `1px solid ${accent}30`, fontWeight: 700 }}>
                      {selectedPlayer.position || selectedPlayer.primaryPosition}
                    </span>
                  )}
                  {selectedPlayer.team && <span>{selectedPlayer.team}</span>}
                  {selectedPlayer.number && <span>#{selectedPlayer.number}</span>}
                </div>
                {/* Bio info */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 8, fontSize: 10, opacity: 0.4 }}>
                  {selectedPlayer.bats && <span>Bats: {selectedPlayer.bats}</span>}
                  {selectedPlayer.throws && <span>Throws: {selectedPlayer.throws}</span>}
                  {selectedPlayer.age && <span>Age: {selectedPlayer.age}</span>}
                  {selectedPlayer.height && <span>{selectedPlayer.height}</span>}
                  {selectedPlayer.weight && <span>{selectedPlayer.weight} lbs</span>}
                  {selectedPlayer.birthDate && <span>DOB: {selectedPlayer.birthDate}</span>}
                  {selectedPlayer.mlbDebutDate && <span>Debut: {selectedPlayer.mlbDebutDate}</span>}
                </div>
              </div>
            </div>

            {/* Season stats */}
            {playerStats && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {/* Batting stats */}
                {playerStats.batting && (
                  <div>
                    <div style={{ ...S.label, marginBottom: 6 }}>Batting Stats</div>
                    <div style={{ ...S.card, overflowX: "auto", padding: "6px 8px" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                        <thead>
                          <tr style={{ borderBottom: "1px solid rgba(255,255,255,.08)" }}>
                            {["G", "AB", "R", "H", "2B", "3B", "HR", "RBI", "BB", "SO", "SB", "AVG", "OBP", "SLG", "OPS"].map(col => (
                              <th key={col} style={{ textAlign: "center", padding: "4px 5px", fontWeight: 700, opacity: 0.4, fontSize: 9 }}>{col}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            {["games", "atBats", "runs", "hits", "doubles", "triples", "homeRuns", "rbi", "walks", "strikeOuts", "stolenBases", "avg", "obp", "slg", "ops"].map(key => (
                              <td key={key} style={{ textAlign: "center", padding: "5px 5px", fontVariantNumeric: "tabular-nums", fontWeight: ["avg", "obp", "slg", "ops"].includes(key) ? 700 : 400 }}>
                                {playerStats.batting[key] ?? "-"}
                              </td>
                            ))}
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Pitching stats */}
                {playerStats.pitching && (
                  <div>
                    <div style={{ ...S.label, marginBottom: 6 }}>Pitching Stats</div>
                    <div style={{ ...S.card, overflowX: "auto", padding: "6px 8px" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                        <thead>
                          <tr style={{ borderBottom: "1px solid rgba(255,255,255,.08)" }}>
                            {["W", "L", "ERA", "G", "GS", "SV", "IP", "H", "R", "ER", "BB", "SO", "WHIP", "K/9", "BB/9"].map(col => (
                              <th key={col} style={{ textAlign: "center", padding: "4px 5px", fontWeight: 700, opacity: 0.4, fontSize: 9 }}>{col}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            {["wins", "losses", "era", "games", "gamesStarted", "saves", "inningsPitched", "hits", "runs", "earnedRuns", "walks", "strikeOuts", "whip", "kPer9", "bbPer9"].map(key => (
                              <td key={key} style={{ textAlign: "center", padding: "5px 5px", fontVariantNumeric: "tabular-nums", fontWeight: ["era", "whip"].includes(key) ? 700 : 400 }}>
                                {playerStats.pitching[key] ?? "-"}
                              </td>
                            ))}
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Fielding stats */}
                {playerStats.fielding && (
                  <div>
                    <div style={{ ...S.label, marginBottom: 6 }}>Fielding Stats</div>
                    <div style={{ ...S.card, overflowX: "auto", padding: "6px 8px" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                        <thead>
                          <tr style={{ borderBottom: "1px solid rgba(255,255,255,.08)" }}>
                            {["POS", "G", "GS", "INN", "TC", "PO", "A", "E", "DP", "FPCT"].map(col => (
                              <th key={col} style={{ textAlign: "center", padding: "4px 5px", fontWeight: 700, opacity: 0.4, fontSize: 9 }}>{col}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            {["position", "games", "gamesStarted", "innings", "totalChances", "putOuts", "assists", "errors", "doublePlays", "fieldingPct"].map(key => (
                              <td key={key} style={{ textAlign: "center", padding: "5px 5px", fontVariantNumeric: "tabular-nums" }}>
                                {playerStats.fielding[key] ?? "-"}
                              </td>
                            ))}
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Career / season label */}
                {playerStats.season && (
                  <div style={{ textAlign: "center", fontSize: 10, opacity: 0.25, marginTop: 4 }}>
                    {playerStats.season} Season Stats
                  </div>
                )}

                {!playerStats.batting && !playerStats.pitching && !playerStats.fielding && (
                  <div style={{ ...S.card, textAlign: "center", fontSize: 12, opacity: 0.4 }}>No stats available for this player.</div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  // Search view
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Search input */}
      <div style={{ display: "flex", gap: 8 }}>
        <input
          style={{ ...S.input, flex: 1 }}
          placeholder="Search for any MLB player..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === "Enter" && search()}
        />
        <button style={S.btnPri(accent)} onClick={search} disabled={loading}>
          {loading ? "..." : "Search"}
        </button>
      </div>

      {error && <div style={{ fontSize: 12, color: "rgba(252,165,165,.8)" }}>{error}</div>}

      {/* Results */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {results.map((p, i) => {
          const pid = p.id || p.playerId;
          return (
            <div
              key={pid || i}
              onClick={() => selectPlayer(p)}
              style={{
                ...S.card,
                display: "flex", alignItems: "center", gap: 12,
                cursor: "pointer", transition: "border-color .15s, background .15s",
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.borderColor = `${accent}40`;
                (e.currentTarget as HTMLElement).style.background = `${accent}08`;
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,.08)";
                (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,.03)";
              }}
            >
              <div style={{
                width: 48, height: 48, borderRadius: 10, overflow: "hidden", flexShrink: 0,
                background: "rgba(0,0,0,.4)", border: "1px solid rgba(255,255,255,.08)",
              }}>
                {pid && (
                  <img
                    src={headshot(pid)}
                    alt=""
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {p.name || p.fullName || "Unknown"}
                </div>
                <div style={{ display: "flex", gap: 6, fontSize: 10, opacity: 0.5, marginTop: 2 }}>
                  {(p.position || p.primaryPosition) && (
                    <span style={{ padding: "0px 4px", borderRadius: 3, background: "rgba(255,255,255,.06)", fontWeight: 600 }}>
                      {p.position || p.primaryPosition}
                    </span>
                  )}
                  {p.team && <span>{p.team}</span>}
                  {p.number && <span>#{p.number}</span>}
                </div>
              </div>
              <span style={{ fontSize: 14, opacity: 0.2 }}>&rsaquo;</span>
            </div>
          );
        })}
      </div>

      {results.length === 0 && !loading && !error && (
        <div style={{ textAlign: "center", padding: 30, opacity: 0.3, fontSize: 13 }}>
          Search for any MLB player to see their stats, bio, and more
        </div>
      )}
    </div>
  );
}

// ── Twitch Streams (MLB) ─────────────────────────────────────────────────────

function MlbTwitchStreams({ lobbyId, accentColor }: { lobbyId?: string; accentColor?: string }) {
  const [streams, setStreams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeStream, setActiveStream] = useState<string | null>(null);
  const [interceptStream, setInterceptStream] = useState<StreamInfo | null>(null);

  useEffect(() => {
    apiFetch(`/twitch/streams?game=${encodeURIComponent("MLB")}`)
      .then(j => { setStreams(j.streams || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ padding: 20, textAlign: "center", opacity: 0.4, fontSize: 13 }}>Loading streams...</div>;

  function handleCardClick(s: any) {
    setInterceptStream({
      userLogin: s.userLogin || s.user_login || "",
      userName: s.userName || s.user_name || "",
      title: s.title || "",
      viewerCount: Number(s.viewerCount || s.viewer_count || 0),
      thumbnailUrl: s.thumbnailUrl || s.thumbnail_url || "",
      gameName: "MLB",
    });
  }

  function handleWatchHere(stream: StreamInfo) {
    setActiveStream(stream.userLogin);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {/* Embed player */}
      {activeStream && (
        <div style={{ borderRadius: 10, overflow: "hidden", border: `1px solid ${accentColor || MLB_RED}40`, background: "#000", marginBottom: 4 }}>
          <iframe
            src={`https://player.twitch.tv/?channel=${activeStream}&parent=${typeof window !== "undefined" ? window.location.hostname : "weered.ca"}&muted=true`}
            width="100%"
            height="280"
            style={{ border: "none", display: "block" }}
            allowFullScreen
          />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", background: `${accentColor || MLB_RED}10` }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,.85)" }}>{activeStream}</span>
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
              border: activeStream === (s.userLogin || s.user_login) ? `1px solid ${accentColor || MLB_RED}50` : "1px solid rgba(255,255,255,.08)",
              background: activeStream === (s.userLogin || s.user_login) ? `${accentColor || MLB_RED}10` : "rgba(255,255,255,.03)",
            }}
          >
            {(s.thumbnailUrl || s.thumbnail_url) && (
              <img src={s.thumbnailUrl || s.thumbnail_url} alt="" style={{ width: "100%", borderRadius: 6, marginBottom: 6, aspectRatio: "16/9", objectFit: "cover" }} />
            )}
            <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {s.userName || s.user_name}
            </div>
            <div style={{ fontSize: 11, opacity: 0.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 4 }}>
              {s.title}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", flexShrink: 0, boxShadow: "0 0 6px rgba(34,197,94,.6)" }} />
              <span style={{ fontSize: 11, color: "rgba(230,235,240,.75)", fontWeight: 600 }}>
                {(s.viewerCount || s.viewer_count)?.toLocaleString()} viewers
              </span>
            </div>
          </div>
        ))}
      </div>

      {streams.length === 0 && (
        <div style={{ textAlign: "center", padding: 20, opacity: 0.4, fontSize: 13 }}>No live MLB streams right now.</div>
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

// ── Tabs ─────────────────────────────────────────────────────────────────────

const TABS = [
  { id: "scoreboard", label: "Scoreboard", icon: "\u26be" },
  { id: "standings",  label: "Standings",  icon: "\ud83c\udfc6" },
  { id: "leaders",    label: "Leaders",    icon: "\ud83d\udcc8" },
  { id: "player",     label: "Player Search", icon: "\ud83d\udd0d" },
  { id: "streams",    label: "Streams",    icon: "\ud83d\udcfa" },
] as const;

type TabId = typeof TABS[number]["id"];

// ── Main Component ───────────────────────────────────────────────────────────

export default function MlbModulesPanel({
  lobbyId,
  accentColor = "#C41E3A",
  style,
}: {
  lobbyId: string;
  accentColor?: string;
  style?: React.CSSProperties;
}) {
  const [tab, setTab] = useState<TabId>("scoreboard");
  const [jumpToPlayer, setJumpToPlayer] = useState<{ id: string | number; name: string } | null>(null);

  function handleLeaderPlayerClick(id: string | number, name: string) {
    setJumpToPlayer({ id, name });
    setTab("player");
  }

  // Reset jump-to-player when navigating away from player tab
  useEffect(() => {
    if (tab !== "player") {
      setJumpToPlayer(null);
    }
  }, [tab]);

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
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "14px 14px 14px", display: "flex", flexDirection: "column" }}>
        {tab === "scoreboard" && <Scoreboard accentColor={accentColor} />}
        {tab === "standings"  && <Standings accentColor={accentColor} />}
        {tab === "leaders"    && <Leaders accentColor={accentColor} onPlayerClick={handleLeaderPlayerClick} />}
        {tab === "player"     && (
          <PlayerSearch
            accentColor={accentColor}
            initialPlayerId={jumpToPlayer?.id}
            initialPlayerName={jumpToPlayer?.name}
          />
        )}
        {tab === "streams"    && <MlbTwitchStreams lobbyId={lobbyId} accentColor={accentColor} />}
      </div>
    </div>
  );
}

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

// -- Style --------------------------------------------------------------------

const S = {
  card: { borderRadius: 10, border: "1px solid rgba(255,255,255,.08)", background: "rgba(255,255,255,.03)", padding: "10px 12px" } as React.CSSProperties,
  btn: { padding: "6px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,.10)", background: "rgba(255,255,255,.05)", fontSize: 12, cursor: "pointer", color: "rgba(243,244,246,.88)" } as React.CSSProperties,
  btnPri: (accent: string) => ({ padding: "6px 12px", borderRadius: 8, border: `1px solid ${accent}55`, background: `${accent}18`, fontSize: 12, cursor: "pointer", color: "#fff", fontWeight: 600 }) as React.CSSProperties,
  input: { width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,.10)", background: "rgba(0,0,0,.30)", fontSize: 13, color: "rgba(243,244,246,.92)", outline: "none", boxSizing: "border-box" as const },
  label: { fontSize: 10, fontWeight: 700, opacity: 0.45, letterSpacing: ".7px", textTransform: "uppercase" as const, marginBottom: 6 } as React.CSSProperties,
};

// -- Helpers ------------------------------------------------------------------

function relativeTime(iso: string): string {
  try {
    const now = Date.now();
    const then = new Date(iso).getTime();
    const diffMs = now - then;
    if (diffMs < 0) return "just now";
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days === 1) return "yesterday";
    if (days < 7) return `${days}d ago`;
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return iso;
  }
}

/** Format score-to-par for display. Negative = under par (red), positive = over (green), E = even */
function formatScore(score: string | number | null | undefined): { text: string; color: string } {
  if (score === null || score === undefined || score === "" || score === "—") return { text: "—", color: "rgba(255,255,255,.5)" };
  const s = String(score).trim();
  if (s === "E" || s === "0" || s === "Even") return { text: "E", color: "rgba(255,255,255,.85)" };
  const num = parseInt(s, 10);
  if (isNaN(num)) return { text: s, color: "rgba(255,255,255,.7)" };
  if (num < 0) return { text: s, color: "#ef4444" }; // Under par = red (good in golf)
  return { text: `+${num}`, color: "#22c55e" }; // Over par = green
}

/** Country code to flag emoji */
function countryFlag(code: string | undefined): string {
  if (!code) return "";
  const c = code.toUpperCase().trim();
  // Common PGA abbreviations
  const map: Record<string, string> = {
    USA: "\u{1F1FA}\u{1F1F8}", US: "\u{1F1FA}\u{1F1F8}",
    CAN: "\u{1F1E8}\u{1F1E6}", GBR: "\u{1F1EC}\u{1F1E7}", UK: "\u{1F1EC}\u{1F1E7}", ENG: "\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}",
    SCO: "\u{1F3F4}\u{E0067}\u{E0062}\u{E0073}\u{E0063}\u{E0074}\u{E007F}", NIR: "\u{1F1EC}\u{1F1E7}",
    AUS: "\u{1F1E6}\u{1F1FA}", RSA: "\u{1F1FF}\u{1F1E6}", ZAF: "\u{1F1FF}\u{1F1E6}",
    KOR: "\u{1F1F0}\u{1F1F7}", JPN: "\u{1F1EF}\u{1F1F5}", MEX: "\u{1F1F2}\u{1F1FD}",
    ESP: "\u{1F1EA}\u{1F1F8}", FRA: "\u{1F1EB}\u{1F1F7}", GER: "\u{1F1E9}\u{1F1EA}", DEU: "\u{1F1E9}\u{1F1EA}",
    IRL: "\u{1F1EE}\u{1F1EA}", SWE: "\u{1F1F8}\u{1F1EA}", NOR: "\u{1F1F3}\u{1F1F4}", DEN: "\u{1F1E9}\u{1F1F0}",
    ITA: "\u{1F1EE}\u{1F1F9}", ARG: "\u{1F1E6}\u{1F1F7}", COL: "\u{1F1E8}\u{1F1F4}", CHI: "\u{1F1E8}\u{1F1F1}",
    IND: "\u{1F1EE}\u{1F1F3}", CHN: "\u{1F1E8}\u{1F1F3}", THA: "\u{1F1F9}\u{1F1ED}", FIJ: "\u{1F1EB}\u{1F1EF}",
    NZL: "\u{1F1F3}\u{1F1FF}", PHI: "\u{1F1F5}\u{1F1ED}", TAI: "\u{1F1F9}\u{1F1FC}",
  };
  if (map[c]) return map[c];
  // Fallback: try to build flag from 2-letter ISO
  if (c.length === 2) {
    return String.fromCodePoint(...[...c].map(ch => 0x1f1e6 + ch.charCodeAt(0) - 65));
  }
  return c;
}

// -- Leaderboard Tab ----------------------------------------------------------

function Leaderboard({ accentColor }: { accentColor: string }) {
  const accent = accentColor;
  const [event, setEvent] = useState<any>(null);
  const [players, setPlayers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    setError("");
    apiFetch("/pga/leaderboard")
      .then(j => {
        if (j.ok) {
          setEvent(j.event || null);
          setPlayers(j.players || []);
        } else {
          setError(j.error || "Failed to load leaderboard");
        }
        setLoading(false);
      })
      .catch(() => { setError("Network error"); setLoading(false); });
  }, []);

  useEffect(() => {
    load();
    const i = setInterval(load, 30000);
    return () => clearInterval(i);
  }, [load]);

  if (loading && players.length === 0) return <div style={{ padding: 20, textAlign: "center", opacity: 0.4, fontSize: 13 }}>Loading leaderboard...</div>;

  const isActive = event && (
    (event.status || "").toLowerCase().includes("progress") ||
    (event.status || "").toLowerCase().includes("round") ||
    (event.status || "").toLowerCase().includes("active")
  );

  function statusBadge() {
    if (!event) return null;
    const status = (event.status || "").toLowerCase();
    if (status.includes("final") || status.includes("complete") || status.includes("official")) {
      return (
        <span style={{ fontSize: 9, fontWeight: 800, padding: "2px 8px", borderRadius: 999, background: "rgba(255,255,255,.08)", color: "rgba(255,255,255,.5)" }}>
          FINAL
        </span>
      );
    }
    if (status.includes("progress") || status.includes("active")) {
      return (
        <span style={{ fontSize: 9, fontWeight: 800, padding: "2px 8px", borderRadius: 999, background: `${accent}20`, color: accent, display: "inline-flex", alignItems: "center", gap: 4 }}>
          <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 6px rgba(34,197,94,.6)" }} />
          {event.round ? `ROUND ${event.round} LIVE` : "LIVE"}
        </span>
      );
    }
    // Default: show round info
    return (
      <span style={{ fontSize: 9, fontWeight: 800, padding: "2px 8px", borderRadius: 999, background: `${accent}15`, color: accent }}>
        {event.round ? `ROUND ${event.round}` : event.status || "UPCOMING"}
      </span>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {/* Tournament header */}
      {event && (
        <div style={{
          ...S.card,
          border: `1px solid ${accent}30`,
          background: `${accent}08`,
          padding: "14px 16px",
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <div style={{ fontWeight: 900, fontSize: 18, lineHeight: 1.2, flex: 1, minWidth: 0 }}>
              {event.name || "PGA Tournament"}
            </div>
            {statusBadge()}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, fontSize: 11, opacity: 0.55 }}>
            {event.venue && (
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ opacity: 0.7 }}>&#9971;</span> {event.venue}
              </span>
            )}
            {event.location && (
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ opacity: 0.7 }}>&#128205;</span> {event.location}
              </span>
            )}
            {event.purse && (
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ opacity: 0.7 }}>&#128176;</span> {event.purse}
              </span>
            )}
            {event.date && (
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ opacity: 0.7 }}>&#128197;</span> {event.date}
              </span>
            )}
          </div>
          {isActive && (
            <div style={{ marginTop: 6, fontSize: 9, opacity: 0.3 }}>Auto-refreshing every 30s</div>
          )}
        </div>
      )}

      {error && <div style={{ fontSize: 12, color: "rgba(252,165,165,.8)", textAlign: "center" }}>{error}</div>}

      {loading && players.length > 0 && (
        <div style={{ fontSize: 10, textAlign: "center", opacity: 0.3 }}>Refreshing...</div>
      )}

      {/* Leaderboard table */}
      {players.length > 0 && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(255,255,255,.10)" }}>
                {["POS", "PLAYER", "SCORE", "R1", "R2", "R3", "R4", "THRU"].map(col => (
                  <th key={col} style={{
                    textAlign: col === "PLAYER" ? "left" : "center",
                    padding: "6px 6px",
                    fontWeight: 700,
                    opacity: 0.4,
                    fontSize: 9,
                    letterSpacing: ".5px",
                    textTransform: "uppercase",
                    whiteSpace: "nowrap",
                  }}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {players.map((p: any, i: number) => {
                const pos = p.position || p.pos || "";
                const posNum = parseInt(String(pos), 10);
                const isTop3 = !isNaN(posNum) && posNum <= 3;
                const isCutLine = !isNaN(posNum) && posNum === 65;
                const isCut = (p.status || "").toLowerCase() === "cut" || (p.status || "").toLowerCase() === "mc";
                const scoreInfo = formatScore(p.score);
                const rounds = p.rounds || p.roundScores || [];
                const thru = p.thru || p.status || "";

                return (
                  <React.Fragment key={p.name + "-" + i}>
                    {/* Cut line indicator */}
                    {isCutLine && (
                      <tr>
                        <td colSpan={8} style={{ padding: 0 }}>
                          <div style={{
                            display: "flex", alignItems: "center", gap: 8, padding: "4px 0",
                          }}>
                            <div style={{ flex: 1, height: 1, background: "rgba(239,68,68,.3)" }} />
                            <span style={{ fontSize: 8, fontWeight: 800, letterSpacing: "1px", color: "rgba(239,68,68,.5)", textTransform: "uppercase" }}>
                              PROJECTED CUT
                            </span>
                            <div style={{ flex: 1, height: 1, background: "rgba(239,68,68,.3)" }} />
                          </div>
                        </td>
                      </tr>
                    )}
                    <tr style={{
                      borderBottom: "1px solid rgba(255,255,255,.03)",
                      background: isTop3 ? `${accent}08` : "transparent",
                      opacity: isCut ? 0.4 : 1,
                      transition: "background .1s",
                    }}>
                      {/* POS */}
                      <td style={{
                        textAlign: "center", padding: "7px 6px", fontWeight: 800, fontSize: 12,
                        color: isTop3 ? accent : "rgba(255,255,255,.6)",
                        fontVariantNumeric: "tabular-nums",
                        minWidth: 36,
                      }}>
                        {isTop3 && posNum === 1 && <span style={{ marginRight: 2 }}>&#127942;</span>}
                        {pos || "—"}
                      </td>

                      {/* PLAYER */}
                      <td style={{ padding: "7px 6px", fontWeight: isTop3 ? 700 : 500, fontSize: 12, whiteSpace: "nowrap", minWidth: 140 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          {p.country && (
                            <span style={{ fontSize: 12, flexShrink: 0 }} title={p.country}>
                              {countryFlag(p.country)}
                            </span>
                          )}
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                            {p.name || "Unknown"}
                          </span>
                        </div>
                      </td>

                      {/* SCORE (to par) */}
                      <td style={{
                        textAlign: "center", padding: "7px 6px",
                        fontWeight: 900, fontSize: 13,
                        color: scoreInfo.color,
                        fontVariantNumeric: "tabular-nums",
                      }}>
                        {scoreInfo.text}
                      </td>

                      {/* R1-R4 */}
                      {[0, 1, 2, 3].map(ri => (
                        <td key={ri} style={{
                          textAlign: "center", padding: "7px 4px",
                          fontVariantNumeric: "tabular-nums",
                          opacity: rounds[ri] ? 0.7 : 0.2,
                          fontSize: 11,
                        }}>
                          {rounds[ri] || "—"}
                        </td>
                      ))}

                      {/* THRU */}
                      <td style={{
                        textAlign: "center", padding: "7px 6px",
                        fontSize: 10, fontWeight: 600,
                        color: thru === "F" || (thru || "").toLowerCase() === "finished"
                          ? "rgba(255,255,255,.4)"
                          : isCut
                            ? "rgba(239,68,68,.6)"
                            : "rgba(255,255,255,.6)",
                        whiteSpace: "nowrap",
                      }}>
                        {isCut ? "CUT" : thru || "—"}
                      </td>
                    </tr>
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {players.length === 0 && !loading && !error && (
        <div style={{ textAlign: "center", padding: 30, opacity: 0.35, fontSize: 13 }}>
          No leaderboard data available. Check back when a tournament is in progress.
        </div>
      )}
    </div>
  );
}

// -- Field Intel Tab (DFS / Gambling Adjacent) --------------------------------

type FieldSort = "position" | "today" | "name";

function FieldIntel({ accentColor }: { accentColor: string }) {
  const accent = accentColor;
  const [event, setEvent] = useState<any>(null);
  const [field, setField] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sort, setSort] = useState<FieldSort>("position");

  useEffect(() => {
    apiFetch("/pga/field")
      .then(j => {
        if (j.ok) {
          setEvent(j.event || null);
          setField(j.field || []);
        } else {
          setError(j.error || "Failed to load field data");
        }
        setLoading(false);
      })
      .catch(() => { setError("Network error"); setLoading(false); });
  }, []);

  if (loading) return <div style={{ padding: 20, textAlign: "center", opacity: 0.4, fontSize: 13 }}>Loading field intel...</div>;
  if (error) return <div style={{ padding: 20, textAlign: "center", fontSize: 12, color: "rgba(252,165,165,.8)" }}>{error}</div>;

  // Compute today's score for each player
  const enriched = field.map(p => {
    const todayScore = p.today ? parseInt(String(p.today), 10) : NaN;
    const rounds = p.roundScores || p.rounds || [];
    return { ...p, todayNum: todayScore, rounds };
  });

  // Sort
  const sorted = [...enriched].sort((a, b) => {
    if (sort === "name") return (a.name || "").localeCompare(b.name || "");
    if (sort === "today") {
      const at = isNaN(a.todayNum) ? 999 : a.todayNum;
      const bt = isNaN(b.todayNum) ? 999 : b.todayNum;
      return at - bt;
    }
    // position
    const ap = parseInt(String(a.position), 10) || 999;
    const bp = parseInt(String(b.position), 10) || 999;
    return ap - bp;
  });

  // Summary stats
  const todayScores = enriched.filter(p => !isNaN(p.todayNum)).map(p => p.todayNum);
  const fieldAvg = todayScores.length > 0 ? (todayScores.reduce((s, v) => s + v, 0) / todayScores.length).toFixed(1) : "—";
  const lowestRound = todayScores.length > 0 ? Math.min(...todayScores) : null;
  const underPar = todayScores.filter(s => s < 72).length; // typically par 72

  function roundCircle(score: string | number | undefined, idx: number) {
    if (!score && score !== 0) return <span key={idx} style={{ width: 10, height: 10, borderRadius: "50%", background: "rgba(255,255,255,.08)", display: "inline-block" }} />;
    const num = typeof score === "number" ? score : parseInt(String(score), 10);
    if (isNaN(num)) return <span key={idx} style={{ width: 10, height: 10, borderRadius: "50%", background: "rgba(255,255,255,.08)", display: "inline-block" }} />;
    // Under 72 = green, over 72 = red, 72 = gray
    let color = "rgba(255,255,255,.15)";
    if (num < 72) color = "rgba(34,197,94,.6)";
    else if (num > 72) color = "rgba(239,68,68,.5)";
    return (
      <span
        key={idx}
        title={`R${idx + 1}: ${num}`}
        style={{
          width: 10, height: 10, borderRadius: "50%",
          background: color,
          display: "inline-block",
          cursor: "default",
        }}
      />
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {/* Event name */}
      {event && (
        <div style={{ fontWeight: 800, fontSize: 14, opacity: 0.7 }}>
          {event.name} {event.round ? `\u2014 Round ${event.round}` : ""}
        </div>
      )}

      {/* Summary stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
        <div style={{ ...S.card, textAlign: "center", padding: "10px 8px" }}>
          <div style={{ ...S.label, marginBottom: 4 }}>Field Avg Today</div>
          <div style={{ fontWeight: 900, fontSize: 20, fontVariantNumeric: "tabular-nums" }}>{fieldAvg}</div>
        </div>
        <div style={{ ...S.card, textAlign: "center", padding: "10px 8px" }}>
          <div style={{ ...S.label, marginBottom: 4 }}>Lowest Round</div>
          <div style={{ fontWeight: 900, fontSize: 20, color: "#22c55e", fontVariantNumeric: "tabular-nums" }}>
            {lowestRound !== null ? lowestRound : "—"}
          </div>
        </div>
        <div style={{ ...S.card, textAlign: "center", padding: "10px 8px" }}>
          <div style={{ ...S.label, marginBottom: 4 }}>Under Par</div>
          <div style={{ fontWeight: 900, fontSize: 20, color: "#ef4444", fontVariantNumeric: "tabular-nums" }}>
            {underPar}
          </div>
        </div>
      </div>

      {/* Sort controls */}
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <span style={{ ...S.label, marginBottom: 0, marginRight: 4 }}>Sort:</span>
        {(["position", "today", "name"] as FieldSort[]).map(s => (
          <button
            key={s}
            onClick={() => setSort(s)}
            style={sort === s ? S.btnPri(accent) : S.btn}
          >
            {s === "position" ? "Position" : s === "today" ? "Hot / Cold" : "Name"}
          </button>
        ))}
      </div>

      {/* Player cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {sorted.map((p, i) => {
          const scoreInfo = formatScore(p.score);
          const isHot = !isNaN(p.todayNum) && p.todayNum < 68;
          const isCold = !isNaN(p.todayNum) && p.todayNum > 74;

          return (
            <div key={p.id || p.name + "-" + i} style={{
              ...S.card,
              display: "flex", alignItems: "center", gap: 12,
              padding: "10px 12px",
            }}>
              {/* Position */}
              <div style={{
                minWidth: 32, textAlign: "center", fontWeight: 800, fontSize: 13,
                color: "rgba(255,255,255,.45)", fontVariantNumeric: "tabular-nums",
              }}>
                {p.position || "—"}
              </div>

              {/* Name + country + badges */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                  {p.country && (
                    <span style={{ fontSize: 12, flexShrink: 0 }} title={p.country}>
                      {countryFlag(p.country)}
                    </span>
                  )}
                  <span style={{ fontWeight: 700, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {p.name || "Unknown"}
                  </span>
                  {isHot && (
                    <span style={{
                      fontSize: 8, fontWeight: 800, padding: "1px 5px", borderRadius: 4,
                      background: "rgba(34,197,94,.15)", color: "#22c55e", letterSpacing: ".5px",
                    }}>HOT</span>
                  )}
                  {isCold && (
                    <span style={{
                      fontSize: 8, fontWeight: 800, padding: "1px 5px", borderRadius: 4,
                      background: "rgba(239,68,68,.15)", color: "#ef4444", letterSpacing: ".5px",
                    }}>COLD</span>
                  )}
                </div>
                {/* Round-by-round trend dots */}
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  {[0, 1, 2, 3].map(ri => roundCircle(p.rounds[ri], ri))}
                  {p.rounds.length > 0 && (
                    <span style={{ fontSize: 9, opacity: 0.35, marginLeft: 4 }}>
                      {p.rounds.filter(Boolean).join(" / ")}
                    </span>
                  )}
                </div>
              </div>

              {/* Score to par */}
              <div style={{
                fontWeight: 900, fontSize: 16,
                color: scoreInfo.color,
                fontVariantNumeric: "tabular-nums",
                minWidth: 40, textAlign: "right",
              }}>
                {scoreInfo.text}
              </div>

              {/* Today */}
              <div style={{
                minWidth: 36, textAlign: "right",
                fontSize: 11, fontWeight: 600,
                color: isHot ? "#22c55e" : isCold ? "#ef4444" : "rgba(255,255,255,.5)",
              }}>
                {!isNaN(p.todayNum) ? p.todayNum : p.today || "—"}
              </div>
            </div>
          );
        })}
      </div>

      {field.length === 0 && (
        <div style={{ textAlign: "center", padding: 30, opacity: 0.35, fontSize: 13 }}>
          No field data available.
        </div>
      )}
    </div>
  );
}

// -- News Tab -----------------------------------------------------------------

function PgaNews({ accentColor }: { accentColor: string }) {
  const accent = accentColor;
  const [articles, setArticles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch("/pga/news")
      .then(j => {
        if (j.ok) setArticles(j.articles || []);
        else setError(j.error || "Failed to load news");
        setLoading(false);
      })
      .catch(() => { setError("Network error"); setLoading(false); });
  }, []);

  if (loading) return <div style={{ padding: 20, textAlign: "center", opacity: 0.4, fontSize: 13 }}>Loading news...</div>;
  if (error) return <div style={{ padding: 20, textAlign: "center", fontSize: 12, color: "rgba(252,165,165,.8)" }}>{error}</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {articles.map((a, i) => (
        <a
          key={i}
          href={a.link}
          target="_blank"
          rel="noopener noreferrer"
          style={{ textDecoration: "none", color: "inherit" }}
        >
          <div
            style={{
              ...S.card,
              display: "flex", gap: 12, alignItems: "flex-start",
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
            {/* Thumbnail */}
            {a.image && (
              <div style={{
                width: 100, height: 68, borderRadius: 6, overflow: "hidden", flexShrink: 0,
                background: "rgba(0,0,0,.4)",
              }}>
                <img
                  src={a.image}
                  alt=""
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              </div>
            )}

            {/* Content */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                <span style={{
                  fontWeight: 700, fontSize: 13, lineHeight: 1.3,
                  overflow: "hidden", textOverflow: "ellipsis",
                  display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as any,
                }}>
                  {a.headline || a.title || "Untitled"}
                </span>
              </div>

              {a.description && (
                <div style={{
                  fontSize: 11, opacity: 0.5, lineHeight: 1.3, marginBottom: 4,
                  overflow: "hidden", textOverflow: "ellipsis",
                  display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as any,
                }}>
                  {a.description}
                </div>
              )}

              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 10, opacity: 0.4 }}>
                {a.published && <span>{relativeTime(a.published)}</span>}
                {a.premium && (
                  <span style={{
                    fontSize: 8, fontWeight: 800, padding: "1px 5px", borderRadius: 4,
                    background: "rgba(245,158,11,.15)", color: "rgb(253,230,138)",
                    letterSpacing: ".5px", textTransform: "uppercase",
                  }}>
                    ESPN+
                  </span>
                )}
              </div>
            </div>
          </div>
        </a>
      ))}

      {articles.length === 0 && (
        <div style={{ textAlign: "center", padding: 30, opacity: 0.35, fontSize: 13 }}>No PGA news available right now.</div>
      )}
    </div>
  );
}

// -- Twitch Streams (Golf) ----------------------------------------------------

function GolfTwitchStreams({ lobbyId, accentColor }: { lobbyId?: string; accentColor?: string }) {
  const accent = accentColor || "#003B2F";
  const [streams, setStreams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeStream, setActiveStream] = useState<string | null>(null);
  const [interceptStream, setInterceptStream] = useState<StreamInfo | null>(null);

  useEffect(() => {
    apiFetch(`/twitch/streams?game=${encodeURIComponent("Golf")}`)
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
      gameName: "Golf",
    });
  }

  function handleWatchHere(stream: StreamInfo) {
    setActiveStream(stream.userLogin);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {/* Embed player */}
      {activeStream && (
        <div style={{ borderRadius: 10, overflow: "hidden", border: `1px solid ${accent}40`, background: "#000", marginBottom: 4 }}>
          <iframe
            src={`https://player.twitch.tv/?channel=${activeStream}&parent=${typeof window !== "undefined" ? window.location.hostname : "weered.ca"}&muted=true`}
            width="100%"
            height="280"
            style={{ border: "none", display: "block" }}
            allowFullScreen
          />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", background: `${accent}10` }}>
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
              border: activeStream === (s.userLogin || s.user_login) ? `1px solid ${accent}50` : "1px solid rgba(255,255,255,.08)",
              background: activeStream === (s.userLogin || s.user_login) ? `${accent}10` : "rgba(255,255,255,.03)",
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
        <div style={{ textAlign: "center", padding: 20, opacity: 0.4, fontSize: 13 }}>No live golf streams right now.</div>
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

// -- Tabs ---------------------------------------------------------------------

const TABS = [
  { id: "leaderboard", label: "Leaderboard", icon: "\u{1F3CC}" },
  { id: "field",       label: "Field Intel",  icon: "\u{1F3AF}" },
  { id: "news",        label: "News",         icon: "\u{1F4F0}" },
  { id: "streams",     label: "Streams",      icon: "\u{1F4FA}" },
] as const;

type TabId = typeof TABS[number]["id"];

// -- Main Component -----------------------------------------------------------

export default function PgaModulesPanel({
  lobbyId,
  accentColor = "#003B2F",
  style,
}: {
  lobbyId: string;
  accentColor?: string;
  style?: React.CSSProperties;
}) {
  const [tab, setTab] = useState<TabId>("leaderboard");

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
        {tab === "leaderboard" && <Leaderboard accentColor={accentColor} />}
        {tab === "field"       && <FieldIntel accentColor={accentColor} />}
        {tab === "news"        && <PgaNews accentColor={accentColor} />}
        {tab === "streams"     && <GolfTwitchStreams lobbyId={lobbyId} accentColor={accentColor} />}
      </div>
    </div>
  );
}

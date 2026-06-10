"use client";

import React from "react";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";

type Match = {
  id: string;
  round: number;
  bracketPosition: number;
  entryAId: string | null;
  entryBId: string | null;
  scoreA: number | null;
  scoreB: number | null;
  winnerEntryId: string | null;
  status: "PENDING" | "READY" | "LIVE" | "REPORTED" | "CONFIRMED" | "DISPUTED" | "CANCELED";
  scheduledAt: string | null;
  liveAt: string | null;
  twitchLogin: string | null;
  notes: string | null;
  nextMatchId: string | null;
  bracketSide: "WINNERS" | "LOSERS" | "GRAND" | null;
  pgcrInstanceId?: string | null;
  entryA: { id: string; displayName: string; userId: string | null } | null;
  entryB: { id: string; displayName: string; userId: string | null } | null;
};

type Tournament = {
  id: string;
  title: string;
  status: string;
  format: string;
  lobbyId: string | null;
};

const ACCENT = "#f58220";

export default function TournamentBracket({
  tournament,
  matches,
  currentUserId,
  isStaff,
  onMatchClick,
  onRefresh,
}: {
  tournament: Tournament;
  matches: Match[];
  currentUserId?: string;
  isStaff?: boolean;
  onMatchClick: (matchId: string) => void;
  onRefresh: () => void;
}) {
  const sections = React.useMemo(() => {
    const isDouble = matches.some(m => m.bracketSide === "WINNERS" || m.bracketSide === "LOSERS");
    function buildRounds(ms: Match[]) {
      const byRound = new Map<number, Match[]>();
      for (const m of ms) {
        if (!byRound.has(m.round)) byRound.set(m.round, []);
        byRound.get(m.round)!.push(m);
      }
      return Array.from(byRound.entries())
        .sort(([a], [b]) => a - b)
        .map(([r, ms2]) => ({ round: r, matches: ms2.sort((a, b) => a.bracketPosition - b.bracketPosition) }));
    }
    if (!isDouble) {
      return [{ side: null as "WINNERS" | "LOSERS" | "GRAND" | null, rounds: buildRounds(matches) }];
    }
    const grouped: Record<string, Match[]> = { WINNERS: [], LOSERS: [], GRAND: [] };
    for (const m of matches) {
      const k = m.bracketSide || "WINNERS";
      if (!grouped[k]) grouped[k] = [];
      grouped[k].push(m);
    }
    const out: Array<{ side: "WINNERS" | "LOSERS" | "GRAND" | null; rounds: ReturnType<typeof buildRounds> }> = [];
    if (grouped.WINNERS.length) out.push({ side: "WINNERS", rounds: buildRounds(grouped.WINNERS) });
    if (grouped.LOSERS.length) out.push({ side: "LOSERS", rounds: buildRounds(grouped.LOSERS) });
    if (grouped.GRAND.length) out.push({ side: "GRAND", rounds: buildRounds(grouped.GRAND) });
    return out;
  }, [matches]);

  if (sections.length === 0 || sections.every(s => s.rounds.length === 0)) {
    return (
      <div style={{ padding: 30, textAlign: "center", color: "rgba(255,255,255,.5)", fontSize: 13 }}>
        Bracket not generated yet.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {sections.map((section, secIdx) => {
        const sideLabel = section.side === "WINNERS" ? "Winners Bracket"
          : section.side === "LOSERS" ? "Losers Bracket"
          : section.side === "GRAND" ? "Grand Final"
          : null;
        const numRounds = section.rounds.length;
        const finalRoundLabel = (r: number) => {
          if (section.side === "GRAND") return "Grand Final";
          if (section.side === "LOSERS") return `LB Round ${r}`;
          if (r === numRounds) return "Final";
          if (r === numRounds - 1) return "Semifinals";
          if (r === numRounds - 2) return "Quarterfinals";
          return `Round ${r}`;
        };
        const sideColor = section.side === "LOSERS" ? "#f87171" : ACCENT;
        return (
          <div key={section.side || `single-${secIdx}`}>
            {sideLabel && (
              <div style={{
                fontSize: 10, fontWeight: 800, letterSpacing: "1.5px",
                textTransform: "uppercase",
                color: sideColor,
                marginBottom: 8, paddingLeft: 4,
              }}>▌ {sideLabel}</div>
            )}
            <div style={{
              display: "flex", gap: 16, padding: 16,
              overflowX: "auto",
              background: "linear-gradient(180deg, rgba(20,14,8,.6) 0%, rgba(8,5,2,.85) 100%)",
              borderRadius: 6,
              border: `1px solid ${section.side === "LOSERS" ? "rgba(248,113,113,.18)" : "rgba(245,130,32,.18)"}`,
              minHeight: section.side === "GRAND" ? 160 : 400,
            }}>
              {section.rounds.map(({ round, matches: roundMatches }, roundIdx) => {
                const slotHeight = 80;
                const gapMultiplier = Math.pow(2, roundIdx);
                return (
                  <div key={round} style={{ flex: "0 0 auto", width: 220, display: "flex", flexDirection: "column" }}>
                    <div style={{
                      fontSize: 10, fontWeight: 800, letterSpacing: "1.5px", textTransform: "uppercase",
                      color: sideColor,
                      marginBottom: 12, textAlign: "center",
                    }}>{finalRoundLabel(round)}</div>
                    <div style={{
                      flex: 1,
                      display: "flex", flexDirection: "column",
                      justifyContent: "space-around",
                      gap: slotHeight * (gapMultiplier - 1) / Math.max(1, roundMatches.length),
                    }}>
                      {roundMatches.map(m => (
                        <BracketMatchCell
                          key={m.id}
                          match={m}
                          currentUserId={currentUserId}
                          onClick={() => onMatchClick(m.id)}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function BracketMatchCell({ match, currentUserId, onClick }: { match: Match; currentUserId?: string; onClick: () => void }) {
  const winnerA = match.winnerEntryId === match.entryAId && !!match.winnerEntryId;
  const winnerB = match.winnerEntryId === match.entryBId && !!match.winnerEntryId;
  const isLive = match.status === "LIVE";
  const isPending = match.status === "PENDING";
  const isDisputed = match.status === "DISPUTED";
  const isMine = currentUserId && [match.entryA?.userId, match.entryB?.userId].includes(currentUserId);

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "block",
        width: "100%",
        padding: 0,
        background: isPending ? "rgba(20,14,8,.6)" : "rgba(28,20,12,.92)",
        border: `1px solid ${
          isLive ? "rgba(34,197,94,.7)" :
          isDisputed ? "rgba(239,68,68,.7)" :
          isMine ? `${ACCENT}` :
          "rgba(245,130,32,.28)"
        }`,
        borderRadius: 4,
        cursor: "pointer",
        color: "inherit", textAlign: "left",
        fontFamily: "inherit",
        boxShadow: isLive ? "0 0 12px rgba(34,197,94,.3)" : isMine ? `0 0 8px ${ACCENT}33` : "none",
        transition: "all .12s",
        animation: isLive ? "tournament-live-pulse 2s ease-in-out infinite" : "none",
      }}
    >
      <PlayerSlot entry={match.entryA} score={match.scoreA} winner={winnerA} />
      <div style={{ height: 1, background: "rgba(245,130,32,.18)" }} />
      <PlayerSlot entry={match.entryB} score={match.scoreB} winner={winnerB} />
      {(isLive || isDisputed || match.status === "REPORTED") && (
        <div style={{
          padding: "3px 8px",
          fontSize: 8, fontWeight: 800, letterSpacing: "1.2px",
          textTransform: "uppercase",
          textAlign: "center",
          background: isLive ? "rgba(34,197,94,.18)" : isDisputed ? "rgba(239,68,68,.18)" : "rgba(245,130,32,.18)",
          color: isLive ? "#4ade80" : isDisputed ? "#f87171" : ACCENT,
          borderTop: `1px solid ${isLive ? "rgba(34,197,94,.3)" : isDisputed ? "rgba(239,68,68,.3)" : "rgba(245,130,32,.3)"}`,
        }}>
          {isLive ? "● LIVE" : isDisputed ? "⚠ DISPUTED" : "● REPORTED"}
        </div>
      )}
      {match.status === "CONFIRMED" && match.pgcrInstanceId && (
        <div title="Auto-verified from Bungie PGCR" style={{
          padding: "3px 8px",
          fontSize: 8, fontWeight: 800, letterSpacing: "1.2px",
          textTransform: "uppercase", textAlign: "center",
          background: "rgba(99,102,241,.16)",
          color: "#a5b4fc",
          borderTop: "1px solid rgba(99,102,241,.3)",
        }}>
          🛡 Verified by Bungie
        </div>
      )}
      <style>{`
        @keyframes tournament-live-pulse {
          0%, 100% { box-shadow: 0 0 12px rgba(34,197,94,.3); }
          50%      { box-shadow: 0 0 20px rgba(34,197,94,.55); }
        }
      `}</style>
    </button>
  );
}

function PlayerSlot({ entry, score, winner }: { entry: Match["entryA"]; score: number | null; winner: boolean }) {
  const name = entry?.displayName || (entry ? "—" : <em style={{ opacity: 0.4 }}>TBD</em>);
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "7px 10px",
      background: winner ? `${ACCENT}1f` : "transparent",
      color: winner ? "#fff" : entry ? "rgba(255,255,255,.85)" : "rgba(255,255,255,.45)",
      fontWeight: winner ? 700 : 500,
      fontSize: 12,
    }}>
      <span style={{
        flex: 1, minWidth: 0,
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        display: "flex", alignItems: "center", gap: 6,
      }}>
        {winner && <span style={{ color: ACCENT, fontSize: 9 }}>✓</span>}
        {name}
      </span>
      {score != null && (
        <span style={{
          fontFamily: "ui-monospace, monospace",
          fontWeight: 800, fontSize: 13,
          color: winner ? ACCENT : "rgba(255,255,255,.55)",
          marginLeft: 8,
        }}>{score}</span>
      )}
    </div>
  );
}

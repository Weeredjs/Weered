"use client";

import React from "react";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";
const ACCENT = "#f58220";

type Match = {
  id: string;
  bracketPosition: number;
  entryAId: string | null;
  entryBId: string | null;
  scoreA: number | null;
  scoreB: number | null;
  winnerEntryId: string | null;
  status: "PENDING" | "READY" | "LIVE" | "REPORTED" | "CONFIRMED" | "DISPUTED" | "CANCELED";
  scheduledAt: string | null;
  twitchLogin: string | null;
  entryA: { id: string; displayName: string; userId: string | null } | null;
  entryB: { id: string; displayName: string; userId: string | null } | null;
};

type Standing = {
  id: string;
  displayName: string;
  rank: number;
  wins: number;
  losses: number;
  diff: number;
  pointsFor: number;
  pointsAgainst: number;
  alive: boolean;
};

export default function TournamentRoundRobin({
  tournamentId,
  matches,
  currentUserId,
  onMatchClick,
}: {
  tournamentId: string;
  matches: Match[];
  currentUserId?: string;
  onMatchClick: (matchId: string) => void;
}) {
  const [standings, setStandings] = React.useState<Standing[]>([]);

  React.useEffect(() => {
    let alive = true;
    fetch(`${API}/tournaments/${encodeURIComponent(tournamentId)}/standings`)
      .then(r => r.json())
      .then(j => { if (alive && j?.ok) setStandings(j.standings || []); })
      .catch(() => {});
    return () => { alive = false; };
  }, [tournamentId, matches]);

  const remaining = matches.filter(m => m.status !== "CONFIRMED" && m.status !== "CANCELED");
  const completed = matches.filter(m => m.status === "CONFIRMED" || m.status === "CANCELED");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{
        border: `1px solid ${ACCENT}38`,
        borderRadius: 6,
        background: "linear-gradient(180deg, rgba(20,14,8,.7) 0%, rgba(8,5,2,.85) 100%)",
        overflow: "hidden",
      }}>
        <div style={{ padding: "10px 14px", borderBottom: `1px solid ${ACCENT}28`, fontSize: 11, fontWeight: 800, letterSpacing: 1.4, textTransform: "uppercase", color: ACCENT }}>
          ▌ Standings · Round Robin
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, color: "rgba(255,255,255,.92)" }}>
          <thead>
            <tr style={{ background: "rgba(255,255,255,.03)" }}>
              <Th width="40">#</Th>
              <Th>Player</Th>
              <Th width="50" align="center">W</Th>
              <Th width="50" align="center">L</Th>
              <Th width="60" align="center">+/-</Th>
              <Th width="80" align="center">Pts</Th>
            </tr>
          </thead>
          <tbody>
            {standings.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: 20, textAlign: "center", color: "rgba(255,255,255,.4)" }}>Standings will compute once results come in.</td></tr>
            ) : standings.map((s, idx) => (
              <tr key={s.id} style={{ borderTop: "1px solid rgba(255,255,255,.05)", background: idx === 0 ? `${ACCENT}10` : idx < 3 ? `${ACCENT}05` : "transparent" }}>
                <Td align="center" style={{ fontWeight: 800, color: idx === 0 ? ACCENT : "rgba(255,255,255,.65)" }}>{s.rank}</Td>
                <Td>{s.displayName}</Td>
                <Td align="center" style={{ color: "#4ade80", fontWeight: 700 }}>{s.wins}</Td>
                <Td align="center" style={{ color: "#f87171" }}>{s.losses}</Td>
                <Td align="center" style={{ color: s.diff > 0 ? "#4ade80" : s.diff < 0 ? "#f87171" : "rgba(255,255,255,.6)", fontFamily: "ui-monospace, monospace" }}>
                  {s.diff > 0 ? "+" : ""}{s.diff}
                </Td>
                <Td align="center" style={{ fontFamily: "ui-monospace, monospace", color: "rgba(255,255,255,.7)" }}>
                  {s.pointsFor}<span style={{ opacity: 0.4 }}>:</span>{s.pointsAgainst}
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {remaining.length > 0 && (
        <Section title={`Remaining · ${remaining.length}`}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 8 }}>
            {remaining.map(m => <MatchCell key={m.id} match={m} currentUserId={currentUserId} onClick={() => onMatchClick(m.id)} />)}
          </div>
        </Section>
      )}

      {completed.length > 0 && (
        <Section title={`Results · ${completed.length}`} muted>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 8 }}>
            {completed.map(m => <MatchCell key={m.id} match={m} currentUserId={currentUserId} onClick={() => onMatchClick(m.id)} />)}
          </div>
        </Section>
      )}
    </div>
  );
}

function Section({ title, muted, children }: { title: string; muted?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 1.4, textTransform: "uppercase", color: muted ? "rgba(255,255,255,.4)" : ACCENT, marginBottom: 8 }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function MatchCell({ match, currentUserId, onClick }: { match: Match; currentUserId?: string; onClick: () => void }) {
  const isLive = match.status === "LIVE";
  const isReported = match.status === "REPORTED";
  const isMine = currentUserId && [match.entryA?.userId, match.entryB?.userId].includes(currentUserId);
  const winnerA = match.winnerEntryId === match.entryAId && !!match.winnerEntryId;
  const winnerB = match.winnerEntryId === match.entryBId && !!match.winnerEntryId;
  return (
    <button type="button" onClick={onClick} style={{
      display: "block", width: "100%", padding: 0,
      background: "rgba(28,20,12,.92)",
      border: `1px solid ${isLive ? "rgba(34,197,94,.7)" : isMine ? ACCENT : "rgba(245,130,32,.25)"}`,
      borderRadius: 4, cursor: "pointer", color: "inherit", textAlign: "left",
      fontFamily: "inherit",
      boxShadow: isLive ? "0 0 12px rgba(34,197,94,.3)" : isMine ? `0 0 8px ${ACCENT}33` : "none",
    }}>
      <Slot entry={match.entryA} score={match.scoreA} winner={winnerA} />
      <div style={{ height: 1, background: "rgba(245,130,32,.18)" }} />
      <Slot entry={match.entryB} score={match.scoreB} winner={winnerB} />
      {(isLive || isReported) && (
        <div style={{
          padding: "3px 8px",
          fontSize: 8, fontWeight: 800, letterSpacing: 1.2, textTransform: "uppercase", textAlign: "center",
          background: isLive ? "rgba(34,197,94,.18)" : "rgba(245,130,32,.18)",
          color: isLive ? "#4ade80" : ACCENT,
          borderTop: `1px solid ${isLive ? "rgba(34,197,94,.3)" : "rgba(245,130,32,.3)"}`,
        }}>
          {isLive ? "● LIVE" : "● REPORTED"}
        </div>
      )}
    </button>
  );
}

function Slot({ entry, score, winner }: { entry: Match["entryA"]; score: number | null; winner: boolean }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "7px 10px",
      background: winner ? `${ACCENT}1f` : "transparent",
      color: winner ? "#fff" : "rgba(255,255,255,.85)",
      fontWeight: winner ? 700 : 500,
      fontSize: 12,
    }}>
      <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 6 }}>
        {winner && <span style={{ color: ACCENT, fontSize: 9 }}>✓</span>}
        {entry?.displayName || "—"}
      </span>
      {score != null && (
        <span style={{ fontFamily: "ui-monospace, monospace", fontWeight: 800, fontSize: 13, color: winner ? ACCENT : "rgba(255,255,255,.55)", marginLeft: 8 }}>{score}</span>
      )}
    </div>
  );
}

function Th({ children, width, align = "left" }: { children: React.ReactNode; width?: string; align?: "left" | "center" }) {
  return <th style={{ padding: "8px 10px", textAlign: align, width: width ? `${width}px` : undefined, fontSize: 9, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase", color: "rgba(245,130,32,.6)" }}>{children}</th>;
}
function Td({ children, align = "left", style }: { children: React.ReactNode; align?: "left" | "center"; style?: React.CSSProperties }) {
  return <td style={{ padding: "8px 10px", textAlign: align, ...style }}>{children}</td>;
}

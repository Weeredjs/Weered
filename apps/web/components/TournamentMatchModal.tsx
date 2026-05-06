"use client";

import React from "react";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";
const ACCENT = "#f58220";

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
  reportedById: string | null;
  entryA: { id: string; displayName: string; userId: string | null } | null;
  entryB: { id: string; displayName: string; userId: string | null } | null;
};

/**
 * Per-match modal: live Twitch embed if a caster is set, score reporting
 * for participants, confirm/dispute for opponents, full admin overrides
 * for staff. Auto-polls match state every 8s while open.
 */
export default function TournamentMatchModal({
  tournamentId,
  matchId,
  currentUserId,
  isStaff,
  onClose,
  onChanged,
}: {
  tournamentId: string;
  matchId: string;
  currentUserId?: string;
  isStaff?: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [match, setMatch] = React.useState<Match | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [scoreA, setScoreA] = React.useState<string>("");
  const [scoreB, setScoreB] = React.useState<string>("");
  const [pickedWinner, setPickedWinner] = React.useState<string>("");

  const fetchMatch = React.useCallback(async () => {
    try {
      const tok = (() => { try { return localStorage.getItem("weered_token") || ""; } catch { return ""; } })();
      const r = await fetch(`${API}/tournaments/${encodeURIComponent(tournamentId)}/matches`, {
        headers: tok ? { Authorization: `Bearer ${tok}` } : {},
      });
      const j = await r.json();
      if (j?.ok) {
        const found = (j.matches || []).find((m: any) => m.id === matchId);
        if (found) {
          setMatch(found);
          if (found.scoreA != null) setScoreA(String(found.scoreA));
          if (found.scoreB != null) setScoreB(String(found.scoreB));
          if (found.winnerEntryId) setPickedWinner(found.winnerEntryId);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [tournamentId, matchId]);

  React.useEffect(() => {
    fetchMatch();
    const t = setInterval(fetchMatch, 8000);
    return () => clearInterval(t);
  }, [fetchMatch]);

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function call(path: string, body?: any, method: string = "POST") {
    setBusy(true);
    try {
      const tok = (() => { try { return localStorage.getItem("weered_token") || ""; } catch { return ""; } })();
      const r = await fetch(`${API}${path}`, {
        method,
        headers: { "Content-Type": "application/json", ...(tok ? { Authorization: `Bearer ${tok}` } : {}) },
        body: body ? JSON.stringify(body) : undefined,
      });
      const j = await r.json();
      await fetchMatch();
      onChanged();
      return j;
    } finally {
      setBusy(false);
    }
  }

  if (loading || !match) {
    return (
      <Backdrop onClose={onClose}>
        <div style={{ padding: 30, color: "rgba(255,255,255,.6)" }}>Loading match…</div>
      </Backdrop>
    );
  }

  const isParticipant = currentUserId && [match.entryA?.userId, match.entryB?.userId].includes(currentUserId);
  const canReport = (isParticipant || isStaff) && (match.status === "READY" || match.status === "LIVE");
  const canConfirm = match.status === "REPORTED" && (isStaff || (currentUserId && currentUserId !== match.reportedById && isParticipant));
  const canDispute = match.status === "REPORTED" && currentUserId && currentUserId !== match.reportedById && isParticipant;
  const canMarkLive = (isParticipant || isStaff) && match.status === "READY";
  const isLive = match.status === "LIVE";
  const isFinal = match.status === "CONFIRMED" || match.status === "CANCELED";
  const winnerName = match.winnerEntryId === match.entryAId ? match.entryA?.displayName : match.entryB?.displayName;

  return (
    <Backdrop onClose={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        width: "min(880px, 100%)", maxHeight: "90vh", overflow: "auto",
        background: "linear-gradient(180deg, rgba(28,20,12,.97), rgba(14,10,6,.99))",
        border: "2px solid rgba(245,130,32,.6)",
        borderRadius: 6,
        boxShadow: "0 0 0 1px rgba(0,0,0,.5), 0 30px 80px rgba(0,0,0,.7), 0 0 30px rgba(245,130,32,.2)",
        color: "rgba(255,255,255,.92)",
        fontFamily: "inherit",
      }}>
        {/* Header */}
        <div style={{ padding: "14px 18px", borderBottom: "1px solid rgba(245,130,32,.18)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 11, color: ACCENT, letterSpacing: 1.5, textTransform: "uppercase", fontWeight: 800 }}>
              Round {match.round} · Match {match.bracketPosition + 1}
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, marginTop: 2 }}>
              {match.entryA?.displayName || "TBD"} <span style={{ opacity: 0.4 }}>vs</span> {match.entryB?.displayName || "TBD"}
            </div>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 4, color: "rgba(255,255,255,.7)", fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>✕</button>
        </div>

        {/* Live status banner */}
        {isLive && (
          <div style={{
            padding: "10px 18px",
            background: "rgba(34,197,94,.16)",
            borderBottom: "1px solid rgba(34,197,94,.4)",
            color: "#4ade80",
            fontSize: 12, fontWeight: 800, letterSpacing: 1.2,
            textTransform: "uppercase",
            display: "flex", alignItems: "center", gap: 8,
          }}>
            <span style={{ width: 8, height: 8, borderRadius: 4, background: "#22c55e", boxShadow: "0 0 8px rgba(34,197,94,.8)", animation: "pulse 1.5s ease-in-out infinite" }} />
            Match in progress
          </div>
        )}
        {isFinal && winnerName && (
          <div style={{
            padding: "10px 18px",
            background: `${ACCENT}1f`,
            borderBottom: `1px solid ${ACCENT}66`,
            color: ACCENT,
            fontSize: 12, fontWeight: 800, letterSpacing: 1.2,
            textTransform: "uppercase",
          }}>
            ✓ Final · {winnerName} advances
          </div>
        )}

        {/* Twitch embed */}
        {match.twitchLogin && isLive && (
          <div style={{ padding: 12, background: "#000" }}>
            <iframe
              src={`https://player.twitch.tv/?channel=${encodeURIComponent(match.twitchLogin)}&parent=${typeof window !== "undefined" ? window.location.hostname : "weered.ca"}&autoplay=true&muted=true`}
              width="100%"
              height="380"
              frameBorder="0"
              allowFullScreen
              title="Live stream"
              style={{ border: 0, display: "block" }}
            />
            <div style={{ fontSize: 10, color: "rgba(255,255,255,.5)", marginTop: 6, textAlign: "center" }}>
              Streamed by <a href={`https://twitch.tv/${match.twitchLogin}`} target="_blank" rel="noreferrer" style={{ color: ACCENT, textDecoration: "none" }}>{match.twitchLogin}</a>
            </div>
          </div>
        )}

        {/* Body */}
        <div style={{ padding: 18 }}>
          {match.status === "PENDING" && (
            <div style={{ padding: 20, background: "rgba(255,255,255,.03)", borderRadius: 4, textAlign: "center", color: "rgba(255,255,255,.5)", fontSize: 13 }}>
              Waiting on previous round to finish.
            </div>
          )}

          {/* Score reporting */}
          {canReport && (
            <div style={{ padding: 14, background: "rgba(20,14,8,.6)", border: "1px solid rgba(245,130,32,.25)", borderRadius: 4, marginBottom: 12 }}>
              <Label>Report Score</Label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 60px 60px", gap: 10, alignItems: "center", marginTop: 8 }}>
                <RadioBox value={match.entryAId!} picked={pickedWinner} onPick={setPickedWinner} label={match.entryA?.displayName || ""} />
                <input type="number" min={0} max={99} value={scoreA} onChange={e => setScoreA(e.target.value)} placeholder="—" style={inputStyle} />
                <input type="number" min={0} max={99} value={scoreB} onChange={e => setScoreB(e.target.value)} placeholder="—" style={inputStyle} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 60px 60px", gap: 10, alignItems: "center", marginTop: 6 }}>
                <RadioBox value={match.entryBId!} picked={pickedWinner} onPick={setPickedWinner} label={match.entryB?.displayName || ""} />
              </div>
              <button
                onClick={() => call(`/tournaments/${tournamentId}/matches/${matchId}/report`, { winnerEntryId: pickedWinner, scoreA: scoreA ? Number(scoreA) : null, scoreB: scoreB ? Number(scoreB) : null })}
                disabled={busy || !pickedWinner}
                style={{ ...primaryBtn, marginTop: 10, opacity: busy || !pickedWinner ? 0.5 : 1 }}
              >
                {isStaff ? "Report + Confirm" : "Report Result"}
              </button>
              {!isStaff && <div style={{ fontSize: 10, color: "rgba(255,255,255,.5)", marginTop: 4, textAlign: "center" }}>Opponent will need to confirm.</div>}
            </div>
          )}

          {canConfirm && (
            <div style={{ padding: 14, background: "rgba(20,14,8,.6)", border: "1px solid rgba(245,130,32,.25)", borderRadius: 4, marginBottom: 12 }}>
              <Label>Result Reported</Label>
              <div style={{ marginTop: 6, padding: "8px 10px", background: "rgba(255,255,255,.04)", borderRadius: 3 }}>
                <div style={{ fontSize: 13 }}>
                  Winner: <strong style={{ color: ACCENT }}>{match.winnerEntryId === match.entryAId ? match.entryA?.displayName : match.entryB?.displayName}</strong>
                </div>
                {(match.scoreA != null || match.scoreB != null) && (
                  <div style={{ fontSize: 12, opacity: 0.7, marginTop: 2 }}>
                    Score: {match.scoreA ?? "—"} – {match.scoreB ?? "—"}
                  </div>
                )}
              </div>
              <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                <button onClick={() => call(`/tournaments/${tournamentId}/matches/${matchId}/confirm`)} disabled={busy} style={{ ...primaryBtn, flex: 1 }}>
                  ✓ Confirm
                </button>
                {canDispute && (
                  <button onClick={() => call(`/tournaments/${tournamentId}/matches/${matchId}/dispute`)} disabled={busy} style={dangerBtn}>
                    Dispute
                  </button>
                )}
              </div>
            </div>
          )}

          {canMarkLive && !isLive && (
            <button onClick={() => call(`/tournaments/${tournamentId}/matches/${matchId}/live`)} disabled={busy} style={{ ...secondaryBtn, marginBottom: 12, width: "100%" }}>
              ● Mark Live
            </button>
          )}

          {/* Admin tools */}
          {isStaff && (
            <details style={{ marginTop: 14, background: "rgba(255,255,255,.02)", border: "1px solid rgba(255,255,255,.06)", borderRadius: 4, padding: 10 }}>
              <summary style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.2, textTransform: "uppercase", color: ACCENT, cursor: "pointer" }}>Admin Tools</summary>
              <div style={{ marginTop: 10 }}>
                <Label>Caster Twitch handle (for live embed)</Label>
                <input
                  defaultValue={match.twitchLogin || ""}
                  placeholder="e.g. weered_caster"
                  onBlur={e => {
                    const v = e.target.value.trim().slice(0, 30);
                    if (v !== (match.twitchLogin || "")) call(`/tournaments/${tournamentId}/matches/${matchId}`, { twitchLogin: v }, "PATCH");
                  }}
                  style={inputStyle}
                />
                <Label style={{ marginTop: 8 }}>Notes</Label>
                <textarea
                  defaultValue={match.notes || ""}
                  placeholder="Match notes, reschedule reasons, etc."
                  rows={2}
                  onBlur={e => {
                    const v = e.target.value.trim().slice(0, 500);
                    if (v !== (match.notes || "")) call(`/tournaments/${tournamentId}/matches/${matchId}`, { notes: v }, "PATCH");
                  }}
                  style={{ ...inputStyle, resize: "vertical" }}
                />
                {!isFinal && match.entryA && match.entryB && (
                  <>
                    <Label style={{ marginTop: 8 }}>Override Result (admin set + confirm)</Label>
                    <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                      <button onClick={() => call(`/tournaments/${tournamentId}/matches/${matchId}/admin-set`, { winnerEntryId: match.entryAId, scoreA: scoreA ? Number(scoreA) : null, scoreB: scoreB ? Number(scoreB) : null })} disabled={busy} style={{ ...secondaryBtn, flex: 1, fontSize: 11 }}>
                        {match.entryA.displayName} wins
                      </button>
                      <button onClick={() => call(`/tournaments/${tournamentId}/matches/${matchId}/admin-set`, { winnerEntryId: match.entryBId, scoreA: scoreA ? Number(scoreA) : null, scoreB: scoreB ? Number(scoreB) : null })} disabled={busy} style={{ ...secondaryBtn, flex: 1, fontSize: 11 }}>
                        {match.entryB.displayName} wins
                      </button>
                    </div>
                  </>
                )}
              </div>
            </details>
          )}

          {match.notes && (
            <div style={{ marginTop: 14, padding: 10, fontSize: 12, color: "rgba(255,255,255,.7)", background: "rgba(255,255,255,.03)", borderRadius: 3, fontStyle: "italic" }}>
              {match.notes}
            </div>
          )}
        </div>
      </div>
    </Backdrop>
  );
}

function Backdrop({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div onClick={onClose} role="dialog" aria-modal="true" style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(8,5,2,.82)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>{children}</div>
  );
}

function Label({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 1.4, color: "rgba(245,130,32,.7)", textTransform: "uppercase", marginBottom: 4, ...style }}>{children}</div>
  );
}

function RadioBox({ value, picked, onPick, label }: { value: string; picked: string; onPick: (v: string) => void; label: string }) {
  const active = picked === value;
  return (
    <button type="button" onClick={() => onPick(value)} style={{
      padding: "6px 10px",
      background: active ? `${ACCENT}28` : "rgba(255,255,255,.04)",
      border: `1px solid ${active ? ACCENT : "rgba(255,255,255,.1)"}`,
      borderRadius: 3,
      color: active ? "#fff" : "rgba(255,255,255,.75)",
      fontSize: 12, fontWeight: active ? 700 : 500,
      textAlign: "left", cursor: "pointer", fontFamily: "inherit",
      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
    }}>
      {active ? "● " : "○ "}{label}
    </button>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "6px 10px",
  background: "rgba(10,8,4,.6)",
  border: "1px solid rgba(245,130,32,.3)",
  color: "rgba(255,255,255,.95)",
  borderRadius: 3, fontSize: 12, outline: "none",
  fontFamily: "inherit", boxSizing: "border-box",
};

const primaryBtn: React.CSSProperties = {
  padding: "9px 14px",
  background: `linear-gradient(135deg, ${ACCENT} 0%, #ff9a40 100%)`,
  border: `1px solid ${ACCENT}`,
  color: "#1a0e04", borderRadius: 4,
  fontSize: 12, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase",
  cursor: "pointer", fontFamily: "inherit", width: "100%",
};

const secondaryBtn: React.CSSProperties = {
  padding: "8px 12px",
  background: `${ACCENT}1f`,
  border: `1px solid ${ACCENT}66`,
  color: ACCENT, borderRadius: 3,
  fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase",
  cursor: "pointer", fontFamily: "inherit",
};

const dangerBtn: React.CSSProperties = {
  padding: "9px 14px",
  background: "rgba(185,28,28,.4)",
  border: "1px solid rgba(239,68,68,.5)",
  color: "#fca5a5", borderRadius: 4,
  fontSize: 11, fontWeight: 700, textTransform: "uppercase",
  cursor: "pointer", fontFamily: "inherit",
};

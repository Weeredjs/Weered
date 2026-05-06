"use client";

import React from "react";
import TournamentBracket from "./TournamentBracket";
import TournamentMatchModal from "./TournamentMatchModal";
import TournamentRoundRobin from "./TournamentRoundRobin";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";
const ACCENT = "#f58220";

type Tournament = {
  id: string;
  title: string;
  description: string;
  format: "LEADERBOARD" | "BRACKET" | "BRACKET_DOUBLE" | "ROUND_ROBIN";
  status: "REGISTRATION" | "ACTIVE" | "COMPLETED" | "CANCELED";
  lobbyId: string | null;
  startsAt: string;
  endsAt: string;
  registrationOpensAt: string;
  maxEntries: number;
  minEntries: number;
};

/**
 * Tournament list + bracket viewer for a lobby. Lists active + upcoming
 * tournaments at the top. Click one to open its bracket.
 */
export default function TournamentsPanel({
  lobbyId,
  currentUserId,
  isStaff,
}: {
  lobbyId: string;
  currentUserId?: string;
  isStaff?: boolean;
}) {
  const [tournaments, setTournaments] = React.useState<Tournament[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [showCreate, setShowCreate] = React.useState(false);

  const fetchList = React.useCallback(async () => {
    try {
      const r = await fetch(`${API}/tournaments?lobbyId=${encodeURIComponent(lobbyId)}`);
      const j = await r.json();
      if (j?.ok) setTournaments(j.tournaments || []);
    } finally {
      setLoading(false);
    }
  }, [lobbyId]);

  React.useEffect(() => { fetchList(); }, [fetchList]);

  const active = tournaments.filter(t => t.status === "ACTIVE" || t.status === "REGISTRATION");
  const past   = tournaments.filter(t => t.status === "COMPLETED" || t.status === "CANCELED");

  return (
    <div style={{
      flex: 1, minHeight: 0, overflow: "auto",
      padding: "14px 16px",
      color: "rgba(255,255,255,.92)",
      fontFamily: "inherit",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: 1.2, color: ACCENT, textTransform: "uppercase" }}>
            Tournaments
          </div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,.55)", marginTop: 2 }}>
            {active.length} active · {past.length} past
          </div>
        </div>
        {isStaff && (
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            style={{
              padding: "8px 14px",
              background: `linear-gradient(135deg, ${ACCENT} 0%, #ff9a40 100%)`,
              color: "#1a0e04", border: `1px solid ${ACCENT}`,
              borderRadius: 4, fontSize: 11, fontWeight: 800, letterSpacing: 1,
              textTransform: "uppercase", cursor: "pointer", fontFamily: "inherit",
            }}
          >+ New Tournament</button>
        )}
      </div>

      {loading ? (
        <div style={{ padding: 30, textAlign: "center", color: "rgba(255,255,255,.45)", fontSize: 13 }}>
          Loading tournaments…
        </div>
      ) : tournaments.length === 0 ? (
        <EmptyState isStaff={isStaff} onCreate={() => setShowCreate(true)} />
      ) : openId ? (
        <BracketView
          tournament={tournaments.find(t => t.id === openId)!}
          currentUserId={currentUserId}
          isStaff={isStaff}
          onClose={() => setOpenId(null)}
          onChanged={fetchList}
        />
      ) : (
        <>
          {active.length > 0 && (
            <Section title="Active + Upcoming">
              {active.map(t => <TournamentRow key={t.id} t={t} onOpen={() => setOpenId(t.id)} />)}
            </Section>
          )}
          {past.length > 0 && (
            <Section title="Past">
              {past.map(t => <TournamentRow key={t.id} t={t} onOpen={() => setOpenId(t.id)} muted />)}
            </Section>
          )}
        </>
      )}

      {showCreate && (
        <CreateTournamentModal
          lobbyId={lobbyId}
          onClose={() => setShowCreate(false)}
          onCreated={(id) => { setShowCreate(false); fetchList(); setOpenId(id); }}
        />
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 1.4, color: "rgba(245,130,32,.7)", textTransform: "uppercase", marginBottom: 8 }}>
        {title}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>{children}</div>
    </div>
  );
}

function TournamentRow({ t, onOpen, muted }: { t: Tournament; onOpen: () => void; muted?: boolean }) {
  const startDate = new Date(t.startsAt);
  const formatLabel = t.format === "BRACKET" ? "Bracket" : t.format === "BRACKET_DOUBLE" ? "Double Elim" : t.format === "ROUND_ROBIN" ? "Round Robin" : "Leaderboard";
  const statusColor = t.status === "ACTIVE" ? "#4ade80" : t.status === "REGISTRATION" ? ACCENT : "rgba(255,255,255,.4)";
  return (
    <button type="button" onClick={onOpen} style={{
      display: "block", width: "100%", padding: "10px 14px",
      background: muted ? "rgba(20,14,8,.4)" : "rgba(28,20,12,.92)",
      border: `1px solid ${muted ? "rgba(245,130,32,.12)" : "rgba(245,130,32,.3)"}`,
      borderRadius: 4, cursor: "pointer", color: "inherit", textAlign: "left", fontFamily: "inherit",
      transition: "all .12s",
    }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = ACCENT; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = muted ? "rgba(245,130,32,.12)" : "rgba(245,130,32,.3)"; }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: muted ? "rgba(255,255,255,.55)" : "rgba(255,255,255,.95)" }}>{t.title}</span>
        <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: 1.2, color: statusColor, textTransform: "uppercase" }}>● {t.status}</span>
        <span style={{ marginLeft: "auto", fontSize: 10, fontWeight: 700, padding: "2px 7px", background: "rgba(255,255,255,.05)", borderRadius: 999, color: "rgba(255,255,255,.65)", letterSpacing: 0.4 }}>{formatLabel}</span>
      </div>
      <div style={{ fontSize: 11, color: "rgba(255,255,255,.55)" }}>{t.description || `Starts ${startDate.toLocaleString()}`}</div>
    </button>
  );
}

function BracketView({ tournament, currentUserId, isStaff, onClose, onChanged }: { tournament: Tournament; currentUserId?: string; isStaff?: boolean; onClose: () => void; onChanged: () => void }) {
  const [matches, setMatches] = React.useState<any[]>([]);
  const [openMatch, setOpenMatch] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const fetchMatches = React.useCallback(async () => {
    const r = await fetch(`${API}/tournaments/${encodeURIComponent(tournament.id)}/matches`);
    const j = await r.json();
    if (j?.ok) setMatches(j.matches || []);
  }, [tournament.id]);

  React.useEffect(() => { fetchMatches(); }, [fetchMatches]);

  const [seeding, setSeeding] = React.useState<"random" | "rank">("random");
  async function startBracket() {
    setBusy(true);
    try {
      const tok = (() => { try { return localStorage.getItem("weered_token") || ""; } catch { return ""; } })();
      const r = await fetch(`${API}/tournaments/${encodeURIComponent(tournament.id)}/bracket/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(tok ? { Authorization: `Bearer ${tok}` } : {}) },
        body: JSON.stringify({ seeding }),
      });
      const j = await r.json();
      if (j?.ok) { await fetchMatches(); onChanged(); }
      else alert(j?.message || j?.error || "Failed to generate bracket");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <button onClick={onClose} style={{ padding: "5px 10px", background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 3, color: "rgba(255,255,255,.85)", fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>← Back</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: ACCENT }}>{tournament.title}</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,.55)" }}>{tournament.description}</div>
        </div>
        {isStaff && (tournament.format === "BRACKET" || tournament.format === "BRACKET_DOUBLE" || tournament.format === "ROUND_ROBIN") && matches.length === 0 && (
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <select value={seeding} onChange={e => setSeeding(e.target.value as any)} style={{ padding: "6px 8px", background: "rgba(10,8,4,.7)", border: `1px solid ${ACCENT}55`, color: "#fff", borderRadius: 3, fontSize: 11, fontFamily: "inherit" }}>
              <option value="random">Random Seed</option>
              <option value="rank">By Rank</option>
            </select>
            <button onClick={startBracket} disabled={busy} style={{ padding: "8px 14px", background: ACCENT, color: "#1a0e04", border: `1px solid ${ACCENT}`, borderRadius: 3, fontSize: 11, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase", cursor: busy ? "default" : "pointer", fontFamily: "inherit", opacity: busy ? 0.5 : 1 }}>
              {busy ? "Generating…" : tournament.format === "ROUND_ROBIN" ? "Generate Schedule" : "Start Bracket"}
            </button>
          </div>
        )}
      </div>

      {(tournament.format === "BRACKET" || tournament.format === "BRACKET_DOUBLE") ? (
        matches.length > 0 ? (
          <TournamentBracket
            tournament={tournament as any}
            matches={matches}
            currentUserId={currentUserId}
            isStaff={isStaff}
            onMatchClick={setOpenMatch}
            onRefresh={fetchMatches}
          />
        ) : (
          <div style={{ padding: 30, textAlign: "center", color: "rgba(255,255,255,.5)", fontSize: 13, border: "1px dashed rgba(245,130,32,.25)", borderRadius: 6 }}>
            {isStaff ? "Bracket not yet generated. Hit Start Bracket when registration is closed." : "Bracket will appear once the admin generates it."}
          </div>
        )
      ) : tournament.format === "ROUND_ROBIN" ? (
        matches.length > 0 ? (
          <TournamentRoundRobin
            tournamentId={tournament.id}
            matches={matches}
            currentUserId={currentUserId}
            onMatchClick={setOpenMatch}
          />
        ) : (
          <div style={{ padding: 30, textAlign: "center", color: "rgba(255,255,255,.5)", fontSize: 13, border: "1px dashed rgba(245,130,32,.25)", borderRadius: 6 }}>
            {isStaff ? "Round-robin not yet generated. Hit Start Bracket when registration is closed." : "Match schedule will appear once the admin generates it."}
          </div>
        )
      ) : (
        <div style={{ padding: 30, textAlign: "center", color: "rgba(255,255,255,.5)", fontSize: 13 }}>
          {tournament.format} format viewer coming soon. Use the leaderboard view in the meantime.
        </div>
      )}

      {openMatch && (
        <TournamentMatchModal
          tournamentId={tournament.id}
          matchId={openMatch}
          currentUserId={currentUserId}
          isStaff={isStaff}
          onClose={() => setOpenMatch(null)}
          onChanged={fetchMatches}
        />
      )}
    </>
  );
}

function EmptyState({ isStaff, onCreate }: { isStaff?: boolean; onCreate: () => void }) {
  return (
    <div style={{ padding: "40px 20px", textAlign: "center", border: "1px dashed rgba(245,130,32,.3)", borderRadius: 6, background: "rgba(20,14,8,.3)" }}>
      <div style={{ fontSize: 18, color: ACCENT, marginBottom: 6 }}>No tournaments yet.</div>
      <div style={{ fontSize: 12, color: "rgba(255,255,255,.55)", marginBottom: 16 }}>
        {isStaff
          ? "Spin one up. Crucible 6v6, Trials weekly, raid race — whatever your community runs."
          : "Watch this space. When the lobby admins kick one off, it'll show up here."}
      </div>
      {isStaff && (
        <button onClick={onCreate} style={{ padding: "8px 18px", background: `linear-gradient(135deg, ${ACCENT} 0%, #ff9a40 100%)`, color: "#1a0e04", border: `1px solid ${ACCENT}`, borderRadius: 4, fontSize: 12, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase", cursor: "pointer", fontFamily: "inherit" }}>+ Create First Tournament</button>
      )}
    </div>
  );
}

function CreateTournamentModal({ lobbyId, onClose, onCreated }: { lobbyId: string; onClose: () => void; onCreated: (id: string) => void }) {
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [format, setFormat] = React.useState<"BRACKET" | "BRACKET_DOUBLE" | "LEADERBOARD" | "ROUND_ROBIN">("BRACKET");
  const [seeding, setSeeding] = React.useState<"random" | "rank">("random");
  const [maxEntries, setMaxEntries] = React.useState("16");
  const [startsAt, setStartsAt] = React.useState("");
  const [endsAt, setEndsAt] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");

  async function submit() {
    setBusy(true); setError("");
    try {
      const tok = (() => { try { return localStorage.getItem("weered_token") || ""; } catch { return ""; } })();
      const r = await fetch(`${API}/tournaments`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(tok ? { Authorization: `Bearer ${tok}` } : {}) },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          format,
          lobbyId,
          maxEntries: Number(maxEntries) || 16,
          minEntries: 2,
          startsAt: startsAt ? new Date(startsAt).toISOString() : new Date(Date.now() + 60_000).toISOString(),
          endsAt: endsAt ? new Date(endsAt).toISOString() : new Date(Date.now() + 7 * 24 * 3600_000).toISOString(),
          registrationOpensAt: new Date().toISOString(),
          scoringRule: { type: "manual" },
        }),
      });
      const j = await r.json();
      if (!r.ok || !j?.ok) {
        setError(j?.message || j?.error || "Failed to create tournament");
        return;
      }
      onCreated(j.tournament.id);
    } catch (e: any) {
      setError(e?.message || "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div onClick={onClose} role="dialog" aria-modal="true" style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(8,5,2,.82)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: "min(560px, 100%)", padding: 20,
        background: "linear-gradient(180deg, rgba(28,20,12,.97), rgba(14,10,6,.99))",
        border: "2px solid rgba(245,130,32,.6)", borderRadius: 6,
        color: "rgba(255,255,255,.92)", fontFamily: "inherit",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: ACCENT, letterSpacing: 1, textTransform: "uppercase" }}>New Tournament</div>
          <button onClick={onClose} style={{ width: 28, height: 28, background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 3, color: "rgba(255,255,255,.7)", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>✕</button>
        </div>

        <Field label="Title">
          <input value={title} onChange={e => setTitle(e.target.value.slice(0, 80))} placeholder="Trials of the Nine — Q2 Open" style={inputS} />
        </Field>
        <Field label="Description">
          <textarea value={description} onChange={e => setDescription(e.target.value.slice(0, 500))} placeholder="Format, rules, prize pool…" rows={3} style={{ ...inputS, resize: "vertical" }} />
        </Field>
        <Field label="Format">
          <div style={{ display: "flex", gap: 6 }}>
            {(["BRACKET", "BRACKET_DOUBLE", "ROUND_ROBIN", "LEADERBOARD"] as const).map(f => (
              <button key={f} type="button" onClick={() => setFormat(f)} style={{
                flex: 1, padding: "8px 10px",
                background: format === f ? `${ACCENT}28` : "rgba(255,255,255,.04)",
                border: `1px solid ${format === f ? ACCENT : "rgba(255,255,255,.1)"}`,
                color: format === f ? "#fff" : "rgba(255,255,255,.7)",
                borderRadius: 3, fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                letterSpacing: 0.5, textTransform: "uppercase",
              }}>{f.replace("_", " ")}</button>
            ))}
          </div>
        </Field>
        <Field label="Seeding">
          <div style={{ display: "flex", gap: 6 }}>
            {(["random", "rank"] as const).map(opt => (
              <button key={opt} type="button" onClick={() => setSeeding(opt)} style={{
                flex: 1, padding: "6px 10px",
                background: seeding === opt ? `${ACCENT}28` : "rgba(255,255,255,.04)",
                border: `1px solid ${seeding === opt ? ACCENT : "rgba(255,255,255,.1)"}`,
                color: seeding === opt ? "#fff" : "rgba(255,255,255,.7)",
                borderRadius: 3, fontSize: 11, fontWeight: 700, cursor: "pointer",
                fontFamily: "inherit", letterSpacing: 0.4, textTransform: "uppercase",
              }}>{opt === "random" ? "Random" : "By Rank (Notoriety)"}</button>
            ))}
          </div>
        </Field>
        <Field label="Max Entries">
          <input type="number" value={maxEntries} onChange={e => setMaxEntries(e.target.value)} min={2} max={256} style={inputS} />
        </Field>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Field label="Starts">
            <input type="datetime-local" value={startsAt} onChange={e => setStartsAt(e.target.value)} style={inputS} />
          </Field>
          <Field label="Ends">
            <input type="datetime-local" value={endsAt} onChange={e => setEndsAt(e.target.value)} style={inputS} />
          </Field>
        </div>

        {error && <div style={{ marginTop: 10, padding: 8, background: "rgba(185,28,28,.18)", border: "1px solid rgba(239,68,68,.4)", color: "#fca5a5", fontSize: 11, borderRadius: 3 }}>{error}</div>}

        <button onClick={submit} disabled={busy || title.trim().length < 3} style={{
          width: "100%", marginTop: 14, padding: "12px",
          background: title.trim().length >= 3 && !busy ? `linear-gradient(135deg, ${ACCENT} 0%, #ff9a40 100%)` : "rgba(255,255,255,.06)",
          color: title.trim().length >= 3 && !busy ? "#1a0e04" : "rgba(255,255,255,.4)",
          border: `1px solid ${title.trim().length >= 3 && !busy ? ACCENT : "rgba(255,255,255,.1)"}`,
          borderRadius: 4, fontSize: 13, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase",
          cursor: title.trim().length >= 3 && !busy ? "pointer" : "default", fontFamily: "inherit",
        }}>
          {busy ? "Creating…" : "Create Tournament"}
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 1.4, color: "rgba(245,130,32,.7)", textTransform: "uppercase", marginBottom: 4 }}>{label}</div>
      {children}
    </div>
  );
}

const inputS: React.CSSProperties = {
  width: "100%", padding: "8px 10px",
  background: "rgba(10,8,4,.6)",
  border: "1px solid rgba(245,130,32,.3)",
  color: "rgba(255,255,255,.95)",
  borderRadius: 3, fontSize: 12, outline: "none",
  fontFamily: "inherit", boxSizing: "border-box",
};
